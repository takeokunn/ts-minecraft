import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Either, Layer, Option, Schema } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { BlockRegistry } from '@ts-minecraft/block/application/block-registry'
import { createStack, MAX_STACK_SIZE } from '../domain/item-stack'
import type { SlotIndex } from '@ts-minecraft/core'
import { InventoryService, INVENTORY_SIZE } from '@ts-minecraft/inventory/application/inventory-service'
import { createTestBlockRegistry } from './inventory-service-test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asSlotIndex = (n: number): SlotIndex => n as SlotIndex

const emptyRegistryLayer = Layer.succeed(BlockRegistry, createTestBlockRegistry())

const TestLayer = InventoryService.Default.pipe(Layer.provide(emptyRegistryLayer))

// Arbitrary for valid slot indices (0 – INVENTORY_SIZE-1)
const slotIndexArb = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, INVENTORY_SIZE - 1)))

// Arbitrary for a valid block type (a small fixed set to keep tests fast)
const blockTypeArb = Arbitrary.make(Schema.Literal('DIRT', 'STONE', 'WOOD', 'GLASS', 'SAND'))

// Arbitrary for a valid item count (1 – MAX_STACK_SIZE)
const countArb = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(1, MAX_STACK_SIZE)))

// Count total of a given block type across all inventory slots
const countOf = (slots: ReadonlyArray<Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>>, itemType: InventoryItem): number =>
  Arr.reduce(slots, 0, (sum, slot) =>
    sum + (Option.isSome(slot) && slot.value.itemType === itemType ? slot.value.count : 0)
  )

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('application/inventory/inventory-service (property-based)', () => {
  // -------------------------------------------------------------------------
  // moveStack round-trip: moving incompatible stacks A→B then B→A restores
  // the original state (both slots return to their initial content).
  // -------------------------------------------------------------------------
  describe('moveStack round-trip', () => {
    it.effect.prop(
      'moveStack(A→B) then moveStack(B→A) restores original state for incompatible types',
      {
        slotA: slotIndexArb,
        slotB: slotIndexArb,
        typeA: blockTypeArb,
        typeB: blockTypeArb,
        countA: countArb,
        countB: countArb,
      },
      ({ slotA, slotB, typeA, typeB, countA, countB }) =>
        Effect.gen(function* () {
          // Skip when slots are the same or block types are identical
          if (slotA === slotB || typeA === typeB) return

          const inv = yield* InventoryService
          yield* inv.setSlot(asSlotIndex(slotA), Option.some(createStack(typeA as InventoryItem, countA)))
          yield* inv.setSlot(asSlotIndex(slotB), Option.some(createStack(typeB as InventoryItem, countB)))

          // Round-trip: A→B, then B→A
          yield* inv.moveStack(asSlotIndex(slotA), asSlotIndex(slotB))
          yield* inv.moveStack(asSlotIndex(slotB), asSlotIndex(slotA))

          const finalA = yield* inv.getSlot(asSlotIndex(slotA))
          const finalB = yield* inv.getSlot(asSlotIndex(slotB))

          expect(Option.isSome(finalA)).toBe(true)
          const stackA = Option.getOrThrow(finalA)
          expect(stackA.itemType).toBe(typeA)
          expect(stackA.count).toBe(countA)
          expect(Option.isSome(finalB)).toBe(true)
          const stackB = Option.getOrThrow(finalB)
          expect(stackB.itemType).toBe(typeB)
          expect(stackB.count).toBe(countB)
        }).pipe(Effect.provide(TestLayer))
    )

    it.effect.prop(
      'moveStack to empty slot then back restores original state',
      {
        slotA: slotIndexArb,
        slotB: slotIndexArb,
        type: blockTypeArb,
        count: countArb,
      },
      ({ slotA, slotB, type, count }) =>
        Effect.gen(function* () {
          if (slotA === slotB) return

          const inv = yield* InventoryService
          yield* inv.setSlot(asSlotIndex(slotA), Option.some(createStack(type as InventoryItem, count)))
          yield* inv.setSlot(asSlotIndex(slotB), Option.none())

          // Move A→B (slotB was empty, so stack moves completely)
          yield* inv.moveStack(asSlotIndex(slotA), asSlotIndex(slotB))
          // Move B→A (slotA is now empty)
          yield* inv.moveStack(asSlotIndex(slotB), asSlotIndex(slotA))

          const finalA = yield* inv.getSlot(asSlotIndex(slotA))
          const finalB = yield* inv.getSlot(asSlotIndex(slotB))

          expect(Option.isSome(finalA)).toBe(true)
          const movedStack = Option.getOrThrow(finalA)
          expect(movedStack.itemType).toBe(type)
          expect(movedStack.count).toBe(count)
          expect(Option.isNone(finalB)).toBe(true)
        }).pipe(Effect.provide(TestLayer))
    )
  })

  // -------------------------------------------------------------------------
  // addBlock / removeBlock total conservation: adding N of a type then
  // removing N of the same type returns the inventory to its prior count.
  // -------------------------------------------------------------------------
  describe('addBlock then removeBlock conservation', () => {
    it.effect.prop(
      'adding then removing the same count leaves total unchanged',
      { type: blockTypeArb, count: countArb },
      ({ type, count }) =>
        Effect.gen(function* () {
          const inv = yield* InventoryService

          const slotsBefore = yield* inv.getAllSlots()
          const totalBefore = countOf(slotsBefore, type as InventoryItem)

          // addBlock may fail if inventory is full (InventoryError) — skip conservation check in that case
          const addResult = yield* Effect.either(inv.addBlock(type as InventoryItem, count))
          if (Either.isLeft(addResult)) return

          yield* inv.removeBlock(type as InventoryItem, count)

          const slotsAfter = yield* inv.getAllSlots()
          const totalAfter = countOf(slotsAfter, type as InventoryItem)

          expect(totalAfter).toBe(totalBefore)
        }).pipe(Effect.provide(TestLayer))
    )
  })

  // -------------------------------------------------------------------------
  // setSlot / getSlot round-trip: whatever is written can be read back.
  // -------------------------------------------------------------------------
  describe('setSlot / getSlot round-trip', () => {
    it.effect.prop(
      'getSlot(i) returns exactly what was set by setSlot(i)',
      { slotN: slotIndexArb, type: blockTypeArb, count: countArb },
      ({ slotN, type, count }) =>
        Effect.gen(function* () {
          const inv = yield* InventoryService
          const stack = createStack(type as InventoryItem, count)
          yield* inv.setSlot(asSlotIndex(slotN), Option.some(stack))
          const result = yield* inv.getSlot(asSlotIndex(slotN))

          expect(Option.isSome(result)).toBe(true)
          const item = Option.getOrThrow(result)
          expect(item.itemType).toBe(type)
          expect(item.count).toBe(count)
        }).pipe(Effect.provide(TestLayer))
    )

    it.effect.prop(
      'setting a slot to Option.none then reading it returns Option.none',
      { slotN: slotIndexArb, type: blockTypeArb, count: countArb },
      ({ slotN, type, count }) =>
        Effect.gen(function* () {
          const inv = yield* InventoryService
          // First put something in the slot
          yield* inv.setSlot(asSlotIndex(slotN), Option.some(createStack(type as InventoryItem, count)))
          // Then clear it
          yield* inv.setSlot(asSlotIndex(slotN), Option.none())
          const result = yield* inv.getSlot(asSlotIndex(slotN))

          expect(Option.isNone(result)).toBe(true)
        }).pipe(Effect.provide(TestLayer))
    )
  })
})
