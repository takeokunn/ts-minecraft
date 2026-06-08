import { describe,expect,it } from '@effect/vitest'
import {
HOTBAR_SIZE,
HOTBAR_START,
INVENTORY_SIZE,
InventoryService,
} from '@ts-minecraft/inventory'
import { Array as Arr,Effect,Either,Option } from 'effect'
import type { ItemStack } from '../domain/item-stack'
import { MAX_STACK_SIZE,createStack } from '../domain/item-stack'
import {
airOnlyBlocks,
asSlotIndex,
createTestBlockRegistry,
createTestLayer,
fullHotbarBlocks,
} from './inventory-service-test-utils'

describe('application/inventory/inventory-service', () => {
  describe('addBlock', () => {
    it.effect('adds to first empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.addBlock('DIRT', 5)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot0)).toBe(true)
        const unwrapped = Option.getOrThrow(slot0)
        expect(unwrapped.itemType).toBe('DIRT')
        expect(unwrapped.count).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fills partial stack first', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 60)))

        yield* service.addBlock('DIRT', 3)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot5)).toBe(true)
        expect(Option.getOrThrow(slot5).count).toBe(63)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fills partial stack then uses empty slot for remainder', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 62)))

        yield* service.addBlock('DIRT', 5)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot5)).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot5).count).toBe(MAX_STACK_SIZE)
        const unwrappedSlot0 = Option.getOrThrow(slot0)
        expect(unwrappedSlot0.itemType).toBe('DIRT')
        expect(unwrappedSlot0.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('splits large amount across multiple empty slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.addBlock('STONE', MAX_STACK_SIZE + 2)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.itemType).toBe('STONE')
        expect(unwrapped0.count).toBe(MAX_STACK_SIZE)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.itemType).toBe('STONE')
        expect(unwrapped1.count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fails with InventoryError when inventory cannot fit all blocks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(Arr.makeBy(INVENTORY_SIZE, i => i), (i) => service.setSlot(asSlotIndex(i), Option.some(createStack('STONE', MAX_STACK_SIZE))), { concurrency: 1 })

        const result = yield* Effect.either(service.addBlock('DIRT', 1))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does not merge into stacks of different block type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 60)))

        yield* service.addBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.itemType).toBe('STONE')
        expect(unwrapped0.count).toBe(60)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.itemType).toBe('DIRT')
        expect(unwrapped1.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('skips full matching stacks and fills next partial stack', () => {
      // Exercises the fillExistingStacks space<=0 branch: slot 0 is full STONE (space=0),
      // so the guard fires and it is skipped; slot 1 is partial and receives the items.
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', MAX_STACK_SIZE)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 60)))

        yield* service.addBlock('STONE', 3)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        // Full stack was skipped (space=0 branch hit)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(MAX_STACK_SIZE)
        // Partial stack received the items
        expect(Option.isSome(slot1)).toBe(true)
        expect(Option.getOrThrow(slot1).count).toBe(63)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('addBlock atomic rollback: state unchanged when not all items fit', () => {
      // 35 slots at MAX (35*64 = 2240 filled), slot 35 has 30 STONE → only 34 spaces.
      // Trying to add 60 STONE fails → rollback → slot 35 still has 30.
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(
          Arr.makeBy(INVENTORY_SIZE - 1, (i) => i),
          (i) => service.setSlot(asSlotIndex(i), Option.some(createStack('STONE', MAX_STACK_SIZE))),
          { concurrency: 1 },
        )
        yield* service.setSlot(asSlotIndex(INVENTORY_SIZE - 1), Option.some(createStack('STONE', 30)))

        const result = yield* Effect.either(service.addBlock('STONE', 60))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
        // Atomicity: slot 35 must not have been partially updated
        const lastSlot = yield* service.getSlot(asSlotIndex(INVENTORY_SIZE - 1))
        expect(Option.isSome(lastSlot)).toBe(true)
        expect(Option.getOrThrow(lastSlot).count).toBe(30)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('opens a new slot for each tool (max stack = 1)', () => {
      // Tools cannot stack, so each addBlock call must open a fresh slot.
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.addBlock('WOODEN_SWORD', 1)
        yield* service.addBlock('WOODEN_SWORD', 1)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).itemType).toBe('WOODEN_SWORD')
        expect(Option.getOrThrow(slot0).count).toBe(1)
        expect(Option.isSome(slot1)).toBe(true)
        expect(Option.getOrThrow(slot1).itemType).toBe('WOODEN_SWORD')
        expect(Option.getOrThrow(slot1).count).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('removeBlock', () => {
    it.effect('removes amount from a single stack', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        yield* service.removeBlock('WOOD', 4)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(6)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('clears stack when removing exact count', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        yield* service.removeBlock('WOOD', 10)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removes across multiple stacks of same type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 4)))

        yield* service.removeBlock('DIRT', 7)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isNone(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        expect(Option.getOrThrow(slot1).count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fails with InventoryError when requested amount is larger than available', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 3)))

        const result = yield* Effect.either(service.removeBlock('DIRT', 10))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
        // Atomicity: slot is unchanged on failure
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does not touch other block types', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        yield* service.removeBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.itemType).toBe('STONE')
        expect(unwrapped0.count).toBe(5)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.itemType).toBe('DIRT')
        expect(unwrapped1.count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('prefers removing from the requested slot before touching other matching stacks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        yield* service.removeBlock('DIRT', 3, asSlotIndex(1))
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(Option.getOrThrow(slot0).count).toBe(5)
        expect(Option.getOrThrow(slot1).count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('skips the preferred slot when it holds a different item type, draining matching stacks instead', () => {
      // Exercises drainPreferredSlot's takeFrom mismatch branch: preferred slot 0 holds STONE,
      // but we remove DIRT — slot 0 must be left untouched and DIRT taken from slot 1.
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        yield* service.removeBlock('DIRT', 3, asSlotIndex(0))

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        // Preferred slot (mismatched type) is untouched; DIRT is drained from slot 1.
        expect(Option.getOrThrow(slot0).itemType).toBe('STONE')
        expect(Option.getOrThrow(slot0).count).toBe(5)
        expect(Option.getOrThrow(slot1).count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('falls back to other slots when preferred slot index is out of range (inner onNone path)', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))

        // preferredIdx 999 is out of range → inner onNone fires, falls back to slot 0
        yield* service.removeBlock('DIRT', 3, asSlotIndex(999))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.getOrThrow(slot0).count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('skips preferred slot on second pass when it was only partially drained', () => {
      // Exercises the second-pass preferredIdx guard:
      //   slot 0 (preferred, DIRT×3): step 1 drains all 3, rem1=2; step 2 when idx=0 → guard fires (skip)
      //   slot 1 (DIRT×5): step 2 drains 2 to satisfy rem1=2
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 3)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        yield* service.removeBlock('DIRT', 5, asSlotIndex(0))

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        // Slot 0 was fully drained in step 1
        expect(Option.isNone(slot0)).toBe(true)
        // Slot 1 had 2 removed in step 2 (5 - 2 = 3 remaining)
        expect(Option.isSome(slot1)).toBe(true)
        expect(Option.getOrThrow(slot1).count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getHotbarSlots', () => {
    it.effect('returns exactly HOTBAR_SIZE slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()
        expect(hotbar.length).toBe(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('returns slots from indices 27-35', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()
        const all = yield* service.getAllSlots()

        Arr.forEach(Arr.makeBy(HOTBAR_SIZE, (i) => i), (i) => {
          const h = Option.flatten(Arr.get(hotbar, i))
          const s = Option.flatten(Arr.get(all, HOTBAR_START + i))
          expect(Option.isSome(h)).toBe(Option.isSome(s))
          Option.map(Option.all([h, s] as const), ([hi, si]) => {
            expect(hi.itemType).toBe(si.itemType)
            expect(hi.count).toBe(si.count)
          })
        })
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('reflects updates to hotbar slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(HOTBAR_START + 2), Option.some(createStack('GRAVEL', 11)))

        const hotbar = yield* service.getHotbarSlots()
        const slot = Option.getOrElse(Arr.get(hotbar, 2), () => Option.none<ItemStack>())
        expect(Option.isSome(slot)).toBe(true)
        const unwrapped = Option.getOrThrow(slot)
        expect(unwrapped.itemType).toBe('GRAVEL')
        expect(unwrapped.count).toBe(11)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getAllSlots', () => {
    it.effect('returns exactly INVENTORY_SIZE slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const all = yield* service.getAllSlots()
        expect(all.length).toBe(INVENTORY_SIZE)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('reflects slot updates', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(10), Option.some(createStack('SAND', 42)))

        const all = yield* service.getAllSlots()
        const slot10 = Option.getOrElse(Arr.get(all, 10), () => Option.none<ItemStack>())
        expect(Option.isSome(slot10)).toBe(true)
        const unwrapped = Option.getOrThrow(slot10)
        expect(unwrapped.itemType).toBe('SAND')
        expect(unwrapped.count).toBe(42)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
