import { describe,expect,it } from '@effect/vitest'
import {
HOTBAR_SIZE,
HOTBAR_START,
INVENTORY_SIZE,
InventoryService,
} from '@ts-minecraft/inventory'
import { Array as Arr,Effect,Option } from 'effect'
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
        const added = yield* service.addBlock('DIRT', 5)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        const unwrapped = Option.getOrThrow(slot0)
        expect(unwrapped.blockType).toBe('DIRT')
        expect(unwrapped.count).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fills partial stack first', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 60)))

        const added = yield* service.addBlock('DIRT', 3)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
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

        const added = yield* service.addBlock('DIRT', 5)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
        expect(Option.isSome(slot5)).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot5).count).toBe(MAX_STACK_SIZE)
        const unwrappedSlot0 = Option.getOrThrow(slot0)
        expect(unwrappedSlot0.blockType).toBe('DIRT')
        expect(unwrappedSlot0.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('splits large amount across multiple empty slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const added = yield* service.addBlock('STONE', MAX_STACK_SIZE + 2)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.blockType).toBe('STONE')
        expect(unwrapped0.count).toBe(MAX_STACK_SIZE)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.blockType).toBe('STONE')
        expect(unwrapped1.count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('returns false when inventory cannot fit all blocks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(Arr.makeBy(INVENTORY_SIZE, i => i), (i) => service.setSlot(asSlotIndex(i), Option.some(createStack('STONE', MAX_STACK_SIZE))), { concurrency: 1 })

        const added = yield* service.addBlock('DIRT', 1)
        expect(added).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does not merge into stacks of different block type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 60)))

        const added = yield* service.addBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.blockType).toBe('STONE')
        expect(unwrapped0.count).toBe(60)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.blockType).toBe('DIRT')
        expect(unwrapped1.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('removeBlock', () => {
    it.effect('removes amount from a single stack', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        const removed = yield* service.removeBlock('WOOD', 4)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(6)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('clears stack when removing exact count', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        const removed = yield* service.removeBlock('WOOD', 10)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(true)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removes across multiple stacks of same type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 4)))

        const removed = yield* service.removeBlock('DIRT', 7)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(removed).toBe(true)
        expect(Option.isNone(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        expect(Option.getOrThrow(slot1).count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('returns false when requested amount is larger than available', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 3)))

        const removed = yield* service.removeBlock('DIRT', 10)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(false)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does not touch other block types', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        const removed = yield* service.removeBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(removed).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.blockType).toBe('STONE')
        expect(unwrapped0.count).toBe(5)
        const unwrapped1 = Option.getOrThrow(slot1)
        expect(unwrapped1.blockType).toBe('DIRT')
        expect(unwrapped1.count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('prefers removing from the requested slot before touching other matching stacks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        const removed = yield* service.removeBlock('DIRT', 3, asSlotIndex(1))
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(removed).toBe(true)
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
        const removed = yield* service.removeBlock('DIRT', 3, asSlotIndex(999))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(2)
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
            expect(hi.blockType).toBe(si.blockType)
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
        expect(unwrapped.blockType).toBe('GRAVEL')
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
        expect(unwrapped.blockType).toBe('SAND')
        expect(unwrapped.count).toBe(42)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
