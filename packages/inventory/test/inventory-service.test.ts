import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import {
  HOTBAR_SIZE,
  HOTBAR_START,
  INVENTORY_SIZE,
  InventoryService,
} from '@ts-minecraft/inventory'
import { ItemStack, MAX_STACK_SIZE, createStack } from '../domain/item-stack'
import {
  asSlotIndex,
  createTestBlockRegistry,
  createTestLayer,
  fullHotbarBlocks,
  limitedHotbarBlocks,
  airOnlyBlocks,
} from './inventory-service-test-utils'

describe('application/inventory/inventory-service', () => {
  describe('constants', () => {
    it('INVENTORY_SIZE is 36', () => {
      expect(INVENTORY_SIZE).toBe(36)
    })

    it('HOTBAR_START is 27', () => {
      expect(HOTBAR_START).toBe(27)
    })

    it('HOTBAR_SIZE is 9', () => {
      expect(HOTBAR_SIZE).toBe(9)
    })

    it('hotbar range is inside inventory bounds', () => {
      expect(HOTBAR_START + HOTBAR_SIZE).toBe(INVENTORY_SIZE)
    })
  })

  describe('initial state', () => {
    it.effect('slots 0-26 are empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(Arr.makeBy(HOTBAR_START, (i) => i), (i) =>
          Effect.gen(function* () {
            const slot = yield* service.getSlot(asSlotIndex(i))
            expect(Option.isNone(slot)).toBe(true)
          })
        , { concurrency: 1 })
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('slots 27-35 are empty in a fresh survival-style inventory', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(Arr.makeBy(HOTBAR_SIZE, (i) => i), (i) =>
          Effect.gen(function* () {
            const slot = yield* service.getSlot(asSlotIndex(HOTBAR_START + i))
            expect(Option.isNone(slot)).toBe(true)
          })
        , { concurrency: 1 })
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('fresh survival inventory stays empty even if the registry contains a small block set', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(limitedHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService

        const first = yield* service.getSlot(asSlotIndex(HOTBAR_START))
        const second = yield* service.getSlot(asSlotIndex(HOTBAR_START + 1))
        const third = yield* service.getSlot(asSlotIndex(HOTBAR_START + 2))

        expect(Option.isNone(first)).toBe(true)
        expect(Option.isNone(second)).toBe(true)
        expect(Option.isNone(third)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getSlot', () => {
    it.effect('returns the value set in a slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 7)))
        const slot = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot)).toBe(true)
        const unwrapped = Option.getOrThrow(slot)
        expect(unwrapped.itemType).toBe('STONE')
        expect(unwrapped.count).toBe(7)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('returns Option.none for out-of-range index', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const slot = yield* service.getSlot(asSlotIndex(999))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('setSlot', () => {
    it.effect('sets Option.some stack', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 12)))
        const slot = yield* service.getSlot(asSlotIndex(5))

        expect(Option.isSome(slot)).toBe(true)
        const unwrapped = Option.getOrThrow(slot)
        expect(unwrapped.itemType).toBe('DIRT')
        expect(unwrapped.count).toBe(12)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('clears slot with Option.none', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 12)))
        yield* service.setSlot(asSlotIndex(5), Option.none())

        const slot = yield* service.getSlot(asSlotIndex(5))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('overwrites existing value', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(2), Option.some(createStack('WOOD', 1)))
        yield* service.setSlot(asSlotIndex(2), Option.some(createStack('GLASS', 9)))

        const slot = yield* service.getSlot(asSlotIndex(2))
        expect(Option.isSome(slot)).toBe(true)
        const unwrapped = Option.getOrThrow(slot)
        expect(unwrapped.itemType).toBe('GLASS')
        expect(unwrapped.count).toBe(9)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('moveStack', () => {
    it.effect('moves stack to empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 10)))
        yield* service.setSlot(asSlotIndex(1), Option.none())

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        const unwrapped = Option.getOrThrow(to)
        expect(unwrapped.itemType).toBe('DIRT')
        expect(unwrapped.count).toBe(10)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('merges compatible stacks completely', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 20)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 10)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        const unwrapped = Option.getOrThrow(to)
        expect(unwrapped.itemType).toBe('STONE')
        expect(unwrapped.count).toBe(30)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('keeps remainder in source when merge overflows', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 10)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 60)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(to)).toBe(true)
        expect(Option.getOrThrow(to).count).toBe(MAX_STACK_SIZE)

        expect(Option.isSome(from)).toBe(true)
        const unwrappedFrom = Option.getOrThrow(from)
        expect(unwrappedFrom.itemType).toBe('STONE')
        expect(unwrappedFrom.count).toBe(6)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('swaps incompatible stacks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('WOOD', 3)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        const unwrappedFrom = Option.getOrThrow(from)
        expect(unwrappedFrom.itemType).toBe('WOOD')
        expect(unwrappedFrom.count).toBe(3)
        const unwrappedTo = Option.getOrThrow(to)
        expect(unwrappedTo.itemType).toBe('DIRT')
        expect(unwrappedTo.count).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('swaps two same-type tools instead of merging, preserving each durability', () => {
      // canMerge() refuses durable tools even when the item type matches, so a
      // tool dropped onto a same-type tool must SWAP (vanilla behaviour) — never
      // merge (which would destroy one instance's durability) and never no-op.
      // Distinct durabilities (50 vs 20) prove each instance is carried intact.
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ itemType: 'WOODEN_PICKAXE', count: 1, durability: 50 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ itemType: 'WOODEN_PICKAXE', count: 1, durability: 20 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = Option.getOrThrow(yield* service.getSlot(asSlotIndex(0)))
        const to = Option.getOrThrow(yield* service.getSlot(asSlotIndex(1)))
        // Both slots still occupied by single tools (no merge into count>1, no loss).
        expect(from.itemType).toBe('WOODEN_PICKAXE')
        expect(to.itemType).toBe('WOODEN_PICKAXE')
        expect(from.count).toBe(1)
        expect(to.count).toBe(1)
        // Swapped: the durability-20 tool is now in slot 0, the durability-50 in slot 1.
        expect(from.durability).toBe(20)
        expect(to.durability).toBe(50)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does nothing when source slot is empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.none())
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('GLASS', 2)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        const unwrapped = Option.getOrThrow(to)
        expect(unwrapped.itemType).toBe('GLASS')
        expect(unwrapped.count).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('does nothing when moving to same slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(4), Option.some(createStack('SNOW', 8)))

        yield* service.moveStack(asSlotIndex(4), asSlotIndex(4))

        const slot = yield* service.getSlot(asSlotIndex(4))
        expect(Option.isSome(slot)).toBe(true)
        const unwrapped = Option.getOrThrow(slot)
        expect(unwrapped.itemType).toBe('SNOW')
        expect(unwrapped.count).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('clear', () => {
    it.effect('resets all 36 slots to Option.none after having items', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // Set several slots across main inventory and hotbar
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 10)))
        yield* service.setSlot(asSlotIndex(10), Option.some(createStack('STONE', 5)))
        yield* service.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('WOOD', 3)))
        yield* service.setSlot(asSlotIndex(HOTBAR_START + 4), Option.some(createStack('SAND', 7)))

        yield* service.clear()

        const all = yield* service.getAllSlots()
        expect(all.length).toBe(INVENTORY_SIZE)
        Arr.forEach(all, (slot) => {
          expect(Option.isNone(slot)).toBe(true)
        })
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('quickMove (shift-click)', () => {
    it.effect('moves a hotbar stack into the first empty main-inventory slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('STONE', 10)))
        yield* service.quickMove(asSlotIndex(HOTBAR_START))

        // source hotbar slot cleared, lands in main slot 0
        expect(Option.isNone(yield* service.getSlot(asSlotIndex(HOTBAR_START)))).toBe(true)
        const dest = Option.getOrThrow(yield* service.getSlot(asSlotIndex(0)))
        expect(dest.itemType).toBe('STONE')
        expect(dest.count).toBe(10)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('merges into an existing same-type stack in the target region before using empty slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // main slot 0 already holds 50 STONE; quick-move 10 → merges in place to 60 (≤ max),
        // so no empty slot is used (proves merge-first ordering).
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 50)))
        yield* service.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('STONE', 10)))
        yield* service.quickMove(asSlotIndex(HOTBAR_START))

        expect(Option.isNone(yield* service.getSlot(asSlotIndex(HOTBAR_START)))).toBe(true)
        const merged = Option.getOrThrow(yield* service.getSlot(asSlotIndex(0)))
        expect(merged.count).toBe(60)
        // slot 1 stays empty — everything merged into the existing stack.
        expect(Option.isNone(yield* service.getSlot(asSlotIndex(1)))).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('leaves the overflow remainder in the source slot when the target region cannot hold it all', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // Fill all 27 main slots so only merge-space remains: put MAX-1 STONE in slot 0,
        // fill 1..26 with full non-mergeable DIRT stacks → only 1 STONE space in the region.
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', MAX_STACK_SIZE - 1)))
        yield* Effect.forEach(Arr.makeBy(HOTBAR_START - 1, (i) => i + 1), (i) =>
          service.setSlot(asSlotIndex(i), Option.some(createStack('DIRT', MAX_STACK_SIZE))),
        )
        yield* service.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('STONE', 5)))
        yield* service.quickMove(asSlotIndex(HOTBAR_START))

        // Only 1 STONE fit (merge into slot 0); 4 remain in the source.
        const dest = Option.getOrThrow(yield* service.getSlot(asSlotIndex(0)))
        expect(dest.count).toBe(MAX_STACK_SIZE)
        const src = Option.getOrThrow(yield* service.getSlot(asSlotIndex(HOTBAR_START)))
        expect(src.count).toBe(4)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('is a no-op for an empty source slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.quickMove(asSlotIndex(HOTBAR_START))
        const all = yield* service.getAllSlots()
        Arr.forEach(all, (slot) => expect(Option.isNone(slot)).toBe(true))
      }).pipe(Effect.provide(testLayer))
    })
  })
})
