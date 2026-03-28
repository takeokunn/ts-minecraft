import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Layer, Option, Schema } from 'effect'
import type { Block, BlockType } from '@/domain/block'
// Block is used only in the registry stub below
import { BlockRegistry } from '@/domain/block-registry'
import { createStack, MAX_STACK_SIZE } from '@/domain/item-stack'
import type { SlotIndex } from '@/shared/kernel'
import { InventoryService, InventoryServiceLive, INVENTORY_SIZE } from './inventory-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asSlotIndex = (n: number): SlotIndex => n as unknown as SlotIndex

const emptyRegistryLayer = Layer.succeed(BlockRegistry, {
  register: (_block: Block) => Effect.void,
  get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
  getAll: () => Effect.succeed([] as Block[]),
  dispose: () => Effect.void,
} as unknown as BlockRegistry)

const TestLayer = InventoryServiceLive.pipe(Layer.provide(emptyRegistryLayer))

// Arbitrary for valid slot indices (0 – INVENTORY_SIZE-1)
const slotIndexArb = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, INVENTORY_SIZE - 1)))

// Arbitrary for a valid block type (a small fixed set to keep tests fast)
const blockTypeArb = Arbitrary.make(Schema.Literal('DIRT', 'STONE', 'WOOD', 'GLASS', 'SAND'))

// Arbitrary for a valid item count (1 – MAX_STACK_SIZE)
const countArb = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(1, MAX_STACK_SIZE)))

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
          yield* inv.setSlot(asSlotIndex(slotA), Option.some(createStack(typeA as BlockType, countA)))
          yield* inv.setSlot(asSlotIndex(slotB), Option.some(createStack(typeB as BlockType, countB)))

          // Round-trip: A→B, then B→A
          yield* inv.moveStack(asSlotIndex(slotA), asSlotIndex(slotB))
          yield* inv.moveStack(asSlotIndex(slotB), asSlotIndex(slotA))

          const finalA = yield* inv.getSlot(asSlotIndex(slotA))
          const finalB = yield* inv.getSlot(asSlotIndex(slotB))

          expect(Option.isSome(finalA) && finalA.value.blockType === typeA && finalA.value.count === countA).toBe(true)
          expect(Option.isSome(finalB) && finalB.value.blockType === typeB && finalB.value.count === countB).toBe(true)
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
          yield* inv.setSlot(asSlotIndex(slotA), Option.some(createStack(type as BlockType, count)))
          yield* inv.setSlot(asSlotIndex(slotB), Option.none())

          // Move A→B (slotB was empty, so stack moves completely)
          yield* inv.moveStack(asSlotIndex(slotA), asSlotIndex(slotB))
          // Move B→A (slotA is now empty)
          yield* inv.moveStack(asSlotIndex(slotB), asSlotIndex(slotA))

          const finalA = yield* inv.getSlot(asSlotIndex(slotA))
          const finalB = yield* inv.getSlot(asSlotIndex(slotB))

          expect(Option.isSome(finalA) && finalA.value.blockType === type && finalA.value.count === count).toBe(true)
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
          const totalBefore = Arr.reduce(slotsBefore, 0, (sum, s) =>
            sum + (Option.isSome(s) && s.value.blockType === type ? s.value.count : 0)
          )

          yield* inv.addBlock(type as BlockType, count)
          yield* inv.removeBlock(type as BlockType, count)

          const slotsAfter = yield* inv.getAllSlots()
          const totalAfter = Arr.reduce(slotsAfter, 0, (sum, s) =>
            sum + (Option.isSome(s) && s.value.blockType === type ? s.value.count : 0)
          )

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
          const stack = createStack(type as BlockType, count)
          yield* inv.setSlot(asSlotIndex(slotN), Option.some(stack))
          const result = yield* inv.getSlot(asSlotIndex(slotN))

          expect(Option.isSome(result) && result.value.blockType === type && result.value.count === count).toBe(true)
        }).pipe(Effect.provide(TestLayer))
    )

    it.effect.prop(
      'setting a slot to Option.none then reading it returns Option.none',
      { slotN: slotIndexArb, type: blockTypeArb, count: countArb },
      ({ slotN, type, count }) =>
        Effect.gen(function* () {
          const inv = yield* InventoryService
          // First put something in the slot
          yield* inv.setSlot(asSlotIndex(slotN), Option.some(createStack(type as BlockType, count)))
          // Then clear it
          yield* inv.setSlot(asSlotIndex(slotN), Option.none())
          const result = yield* inv.getSlot(asSlotIndex(slotN))

          expect(Option.isNone(result)).toBe(true)
        }).pipe(Effect.provide(TestLayer))
    )
  })
})
