import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Either, Option, Schema } from 'effect'
import type { SlotIndex } from '@ts-minecraft/kernel'
import {
  INVENTORY_SIZE,
  InventoryService,
} from '@ts-minecraft/inventory'
import { InventorySaveDataSchema } from '@ts-minecraft/kernel'
import { createStack } from '../domain/item-stack'
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

        const entry35 = getAt(data.slots, 35)
        expect(Option.isSome(entry35)).toBe(true)
        const unwrapped35 = Option.getOrThrow(entry35)
        expect(unwrapped35.slot).toBe(35)
        expect(unwrapped35.itemType).toBe('DIRT')
        expect(unwrapped35.count).toBe(1)
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
            Option.none<{ slot: SlotIndex; itemType: 'STONE' | 'WOOD' | 'DIRT'; count: number }>(),
            Option.some({ slot: asSlotIndex(-1), itemType: 'STONE' as const, count: 9 }),
            Option.some({ slot: asSlotIndex(5), itemType: 'WOOD' as const, count: 4 }),
            Option.some({ slot: asSlotIndex(99), itemType: 'DIRT' as const, count: 2 }),
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
          Option.some({ slot: asSlotIndex(0), itemType: 'DIRT' as const, count: 12 }),
          Option.none(),
          Option.some({ slot: asSlotIndex(2), itemType: 'STONE' as const, count: 64 }),
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
          Option.some({ slot: asSlotIndex(5), itemType: 'WOOD' as const, count: 1 }),
          Option.none(),
          Option.some({ slot: asSlotIndex(27), itemType: 'GLASS' as const, count: 64 }),
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
