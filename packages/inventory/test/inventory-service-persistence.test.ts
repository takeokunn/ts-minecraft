import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Either, Option, Schema } from 'effect'
import type { SlotIndex } from '@ts-minecraft/core'
import {
  INVENTORY_SIZE,
  InventoryService,
} from '@ts-minecraft/inventory'
import { InventorySaveDataSchema } from '@ts-minecraft/core'
import { createStack } from '../domain/item-stack'
import { getMaxDurability } from '../domain/durability'
import {
  asSlotIndex,
  createTestBlockRegistry,
  createTestLayer,
  airOnlyBlocks,
  fullHotbarBlocks,
} from './inventory-service-test-utils'

describe('application/inventory/inventory-service', () => {
  const getAt = <T>(values: ReadonlyArray<T>, index: number): T =>
    Option.getOrThrow(Arr.get(values, index))

  describe('serialize / deserialize', () => {
    it.effect('serialize returns Option.none for empty slots and Option.some for filled slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 8)))
        yield* service.setSlot(asSlotIndex(35), Option.some(createStack('DIRT', 1)))

        const data = yield* service.serialize()

        expect(data.slots.length).toBe(INVENTORY_SIZE)
        expect(Option.isNone(getAt(data.slots, 0))).toBe(true)

        const entry1 = getAt(data.slots, 1)
        expect(Option.isSome(entry1)).toBe(true)
        const unwrapped1 = Option.getOrThrow(entry1)
        expect(unwrapped1.slot).toBe(1)
        expect(unwrapped1.itemType).toBe('STONE')
        expect(unwrapped1.count).toBe(8)
        expect(unwrapped1.durability).toBeNull()

        const entry35 = getAt(data.slots, 35)
        expect(Option.isSome(entry35)).toBe(true)
        const unwrapped35 = Option.getOrThrow(entry35)
        expect(unwrapped35.slot).toBe(35)
        expect(unwrapped35.itemType).toBe('DIRT')
        expect(unwrapped35.count).toBe(1)
        expect(unwrapped35.durability).toBeNull()
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('deserialize restores previously serialized state', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService

        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 7)))
        yield* service.setSlot(asSlotIndex(2), Option.some(createStack('GLASS', 3)))
        const snapshot = yield* service.serialize()

        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 1)))
        yield* service.setSlot(asSlotIndex(2), Option.none())

        yield* service.deserialize(snapshot)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot2 = yield* service.getSlot(asSlotIndex(2))

        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot2)).toBe(true)
        const unwrapped0 = Option.getOrThrow(slot0)
        expect(unwrapped0.itemType).toBe('WOOD')
        expect(unwrapped0.count).toBe(7)
        const unwrapped2 = Option.getOrThrow(slot2)
        expect(unwrapped2.itemType).toBe('GLASS')
        expect(unwrapped2.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('deserialize ignores Option.none and out-of-range entries', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const data = {
          slots: [
            Option.none<{ slot: SlotIndex; itemType: 'STONE' | 'WOOD' | 'DIRT'; count: number; durability: null }>(),
            Option.some({ slot: asSlotIndex(-1), itemType: 'STONE' as const, count: 9, durability: null }),
            Option.some({ slot: asSlotIndex(5), itemType: 'WOOD' as const, count: 4, durability: null }),
            Option.some({ slot: asSlotIndex(99), itemType: 'DIRT' as const, count: 2, durability: null }),
          ],
        }

        yield* service.deserialize(data)

        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot5)).toBe(true)
        const unwrapped = Option.getOrThrow(slot5)
        expect(unwrapped.itemType).toBe('WOOD')
        expect(unwrapped.count).toBe(4)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('serialize -> deserialize -> serialize is stable', () => {
      const firstLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      const secondLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const snapshot = yield* Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 12)))
          return yield* service.serialize()
        }).pipe(Effect.provide(firstLayer))

        const restored = yield* Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.deserialize(snapshot)
          return yield* service.serialize()
        }).pipe(Effect.provide(secondLayer))

        expect(restored).toEqual(snapshot)
      })
    })

    it.effect('REPLACES the inventory: slots absent from the snapshot are cleared (no stale items / duplication)', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // Snapshot a state with only slot 0 occupied.
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 5)))
        const snapshot = yield* service.serialize()
        // Dirty a DIFFERENT slot the snapshot never mentions, then restore the snapshot.
        yield* service.setSlot(asSlotIndex(10), Option.some(createStack('STONE', 64)))
        yield* service.deserialize(snapshot)

        // The stale STONE must be CLEARED (a merge would leave it — the root cause of
        // dismantleFurnace's rollback duplication and load-into-dirty-inventory corruption).
        expect(Option.getOrThrow(yield* service.getSlot(asSlotIndex(0))).itemType).toBe('WOOD')
        expect(Option.isNone(yield* service.getSlot(asSlotIndex(10)))).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // Tool durability: damageSlot + serialize/deserialize round-trip
  // ---------------------------------------------------------------------------

  describe('damageSlot', () => {
    it.effect('reduces the durability of a tool in the slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const sword = createStack('IRON_SWORD')
        const full = Option.getOrThrow(getMaxDurability('IRON_SWORD'))
        yield* service.setSlot(asSlotIndex(27), Option.some(sword))

        yield* service.damageSlot(asSlotIndex(27), 5)

        const slot = yield* service.getSlot(asSlotIndex(27))
        expect(Option.isSome(slot)).toBe(true)
        expect(Option.getOrThrow(slot).durability).toBe(full - 5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('defaults the damage amount to 1', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const full = Option.getOrThrow(getMaxDurability('DIAMOND_SWORD'))
        yield* service.setSlot(asSlotIndex(28), Option.some(createStack('DIAMOND_SWORD')))

        yield* service.damageSlot(asSlotIndex(28))

        const slot = yield* service.getSlot(asSlotIndex(28))
        expect(Option.getOrThrow(slot).durability).toBe(full - 1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('clears the slot when the tool breaks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // WOODEN_SWORD has 59 durability — over-damage it so it breaks.
        yield* service.setSlot(asSlotIndex(29), Option.some(createStack('WOODEN_SWORD')))

        yield* service.damageSlot(asSlotIndex(29), 59)

        const slot = yield* service.getSlot(asSlotIndex(29))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('leaves a non-tool slot unchanged', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(30), Option.some(createStack('DIRT', 8)))

        yield* service.damageSlot(asSlotIndex(30), 5)

        const slot = yield* service.getSlot(asSlotIndex(30))
        expect(Option.isSome(slot)).toBe(true)
        const stack = Option.getOrThrow(slot)
        expect(stack.itemType).toBe('DIRT')
        expect(stack.count).toBe(8)
        expect(stack.durability).toBeNull()
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('is a no-op on an empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.damageSlot(asSlotIndex(31), 1)
        const slot = yield* service.getSlot(asSlotIndex(31))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('breaks a WOODEN_SWORD only on the final (59th) per-swing hit', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // WOODEN_SWORD max durability is 59. createStack spawns it at full.
        const full = Option.getOrThrow(getMaxDurability('WOODEN_SWORD'))
        expect(full).toBe(59)
        yield* service.setSlot(asSlotIndex(27), Option.some(createStack('WOODEN_SWORD')))

        // First 58 swings: tool survives, durability decremented one per hit.
        yield* Effect.forEach(Arr.makeBy(58, (i) => i + 1), (hit) =>
          Effect.gen(function* () {
            yield* service.damageSlot(asSlotIndex(27), 1)
            const slot = yield* service.getSlot(asSlotIndex(27))
            expect(Option.isSome(slot)).toBe(true)
            expect(Option.getOrThrow(slot).durability).toBe(full - hit)
          })
        )

        // After 58 hits the sword still holds at durability 1.
        const beforeFinal = yield* service.getSlot(asSlotIndex(27))
        expect(Option.isSome(beforeFinal)).toBe(true)
        expect(Option.getOrThrow(beforeFinal).durability).toBe(1)

        // The 59th swing breaks it → slot becomes empty.
        yield* service.damageSlot(asSlotIndex(27), 1)
        const afterFinal = yield* service.getSlot(asSlotIndex(27))
        expect(Option.isNone(afterFinal)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('serialize / deserialize — durability round-trip', () => {
    it.effect('serialize includes a tool durability and deserialize restores it', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const full = Option.getOrThrow(getMaxDurability('IRON_SWORD'))
        yield* service.setSlot(asSlotIndex(27), Option.some(createStack('IRON_SWORD')))
        yield* service.damageSlot(asSlotIndex(27), 7)

        const data = yield* service.serialize()
        const entry = getAt(data.slots, 27)
        expect(Option.isSome(entry)).toBe(true)
        expect(Option.getOrThrow(entry).durability).toBe(full - 7)

        // Mutate then restore from the serialized snapshot.
        yield* service.setSlot(asSlotIndex(27), Option.none())
        yield* service.deserialize(data)

        const restored = yield* service.getSlot(asSlotIndex(27))
        expect(Option.isSome(restored)).toBe(true)
        expect(Option.getOrThrow(restored).durability).toBe(full - 7)
      }).pipe(Effect.provide(testLayer))
    })

  })

  // ---------------------------------------------------------------------------
  // C4: removeBlock on an empty slot (slot with no item)
  // ---------------------------------------------------------------------------

  describe('removeBlock on empty slot / inventory', () => {
    it.effect('removeBlock on fully empty inventory fails with InventoryError without crashing', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // All slots are empty (AIR-only registry → no non-AIR hotbar blocks)
        const result = yield* Effect.either(service.removeBlock('STONE', 1))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removeBlock for a block type not present fails with InventoryError', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // Slot 0 has DIRT, we try to remove STONE (absent)
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        const result = yield* Effect.either(service.removeBlock('STONE', 1))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
        // DIRT slot is untouched (atomicity: roll back on failure)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removeBlock on a slot explicitly set to Option.none fails with InventoryError', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(3), Option.none())
        const result = yield* Effect.either(service.removeBlock('DIRT', 1))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('InventoryError')
        // Slot remains empty
        const slot3 = yield* service.getSlot(asSlotIndex(3))
        expect(Option.isNone(slot3)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // C5: InventorySaveDataSchema encode / decode round-trip
  // ---------------------------------------------------------------------------

  describe('InventorySaveDataSchema encode / decode round-trip', () => {
    const encode = Schema.encodeSync(InventorySaveDataSchema)
    const decode = Schema.decodeSync(InventorySaveDataSchema)

    it('encodes and decodes a valid InventorySaveData object correctly', () => {
      const original = {
        slots: [
          Option.some({ slot: asSlotIndex(0), itemType: 'DIRT' as const, count: 12, durability: null }),
          Option.none(),
          Option.some({ slot: asSlotIndex(2), itemType: 'STONE' as const, count: 64, durability: null }),
        ],
      }

      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded.slots.length).toBe(3)

        const entry0 = getAt(decoded.slots, 0)
      expect(Option.isSome(entry0)).toBe(true)
      const unwrapped0 = Option.getOrThrow(entry0)
      expect(unwrapped0.slot).toBe(0)
      expect(unwrapped0.itemType).toBe('DIRT')
      expect(unwrapped0.count).toBe(12)

        expect(Option.isNone(getAt(decoded.slots, 1))).toBe(true)

        const entry2 = getAt(decoded.slots, 2)
      expect(Option.isSome(entry2)).toBe(true)
      const unwrapped2 = Option.getOrThrow(entry2)
      expect(unwrapped2.slot).toBe(2)
      expect(unwrapped2.itemType).toBe('STONE')
      expect(unwrapped2.count).toBe(64)
    })

    it('round-trips: decode(encode(x)) deep-equals original', () => {
      const original = {
        slots: [
          Option.none(),
          Option.some({ slot: asSlotIndex(5), itemType: 'WOOD' as const, count: 1, durability: null }),
          Option.none(),
          Option.some({ slot: asSlotIndex(27), itemType: 'GLASS' as const, count: 64, durability: null }),
        ],
      }

      const roundTripped = decode(encode(original))
      expect(roundTripped).toEqual(original)
    })

    it('decoding invalid data (unknown blockType) throws a ParseError', () => {
      const invalid = {
        slots: [
          { slot: 0, itemType: 'INVALID_BLOCK_TYPE', count: 5 },
        ],
      }

      expect(() => decode(invalid as never)).toThrow()
    })

    it('decoding data with missing required field throws a ParseError', () => {
      const invalid = { notSlots: [] }
      expect(() => decode(invalid as never)).toThrow()
    })

    it('decoding all-null slots array succeeds', () => {
      const allNull = { slots: [null, null, null] }
      const result = decode(allNull)
      expect(result.slots).toEqual([Option.none(), Option.none(), Option.none()])
    })
  })
})
