import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Layer, MutableHashMap, Option, Schema } from 'effect'
import type { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { MAX_STACK_SIZE, createStack } from '@/domain/item-stack'
import type { ItemStack } from '@/domain/item-stack'
import type { SlotIndex } from '@/shared/kernel'
import {
  HOTBAR_SIZE,
  HOTBAR_START,
  INVENTORY_SIZE,
  InventoryService,
  InventoryServiceLive,
  InventorySaveDataSchema,
} from './inventory-service'

const asSlotIndex = (n: number): SlotIndex => n as unknown as SlotIndex

const makeBlock = (type: BlockType): Block => ({
  id: `block:${type.toLowerCase()}` as Block['id'],
  type,
  properties: {
    hardness: 50,
    transparency: false,
    solid: true,
    emissive: false,
    friction: 0.6,
  },
  faces: {
    top: true,
    bottom: true,
    north: true,
    south: true,
    east: true,
    west: true,
  },
})

const createTestBlockRegistry = (blocks: ReadonlyArray<Block> = []) => {
  let blockMap = MutableHashMap.empty<BlockType, Block>()
  Arr.forEach(blocks, (block) => {
    MutableHashMap.set(blockMap, block.type, block)
  })

  return {
    register: (block: Block) =>
      Effect.sync(() => {
        MutableHashMap.set(blockMap, block.type, block)
      }),
    get: (blockType: BlockType) =>
      Effect.sync(() => MutableHashMap.get(blockMap, blockType)),
    getAll: () => Effect.sync(() => Arr.fromIterable(MutableHashMap.values(blockMap))),
    dispose: () =>
      Effect.sync(() => {
        blockMap = MutableHashMap.empty<BlockType, Block>()
      }),
  }
}

const createTestLayer = (blockRegistry: ReturnType<typeof createTestBlockRegistry>) =>
  InventoryServiceLive.pipe(
    Layer.provide(Layer.succeed(BlockRegistry, blockRegistry as unknown as BlockRegistry))
  )

const fullHotbarBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
  makeBlock('WOOD'),
  makeBlock('GRASS'),
  makeBlock('SAND'),
  makeBlock('WATER'),
  makeBlock('LEAVES'),
  makeBlock('GLASS'),
  makeBlock('SNOW'),
  makeBlock('GRAVEL'),
  makeBlock('COBBLESTONE'),
]

const limitedHotbarBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
]

const airOnlyBlocks: ReadonlyArray<Block> = [makeBlock('AIR')]

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
          service.getSlot(asSlotIndex(i)).pipe(Effect.map((slot) => expect(Option.isNone(slot)).toBe(true)))
        , { concurrency: 1 })
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('slots 27-35 are filled with non-AIR blocks when enough non-AIR blocks exist', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      const expectedTypes = Arr.map(
        Arr.take(Arr.filter(fullHotbarBlocks, (block) => block.type !== 'AIR'), HOTBAR_SIZE),
        (block) => block.type
      )
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* Effect.forEach(Arr.makeBy(HOTBAR_SIZE, (i) => i), (i) =>
          service.getSlot(asSlotIndex(HOTBAR_START + i)).pipe(Effect.map((slot) => {
            expect(Option.isSome(slot)).toBe(true)
            const unwrapped = Option.getOrThrow(slot)
            expect(unwrapped.blockType).toBe(Option.getOrElse(Arr.get(expectedTypes, i), () => 'AIR' as const))
            expect(unwrapped.blockType).not.toBe('AIR')
            expect(unwrapped.count).toBe(MAX_STACK_SIZE)
          }))
        , { concurrency: 1 })
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('when non-AIR blocks are fewer than 9, only those hotbar slots are filled', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(limitedHotbarBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService

        const first = yield* service.getSlot(asSlotIndex(HOTBAR_START))
        const second = yield* service.getSlot(asSlotIndex(HOTBAR_START + 1))
        const third = yield* service.getSlot(asSlotIndex(HOTBAR_START + 2))

        expect(Option.isSome(first)).toBe(true)
        expect(Option.isSome(second)).toBe(true)
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
        expect(unwrapped.blockType).toBe('STONE')
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
        expect(unwrapped.blockType).toBe('DIRT')
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
        expect(unwrapped.blockType).toBe('GLASS')
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
        expect(unwrapped.blockType).toBe('DIRT')
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
        expect(unwrapped.blockType).toBe('STONE')
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
        expect(unwrappedFrom.blockType).toBe('STONE')
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
        expect(unwrappedFrom.blockType).toBe('WOOD')
        expect(unwrappedFrom.count).toBe(3)
        const unwrappedTo = Option.getOrThrow(to)
        expect(unwrappedTo.blockType).toBe('DIRT')
        expect(unwrappedTo.count).toBe(5)
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
        expect(unwrapped.blockType).toBe('GLASS')
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
        expect(unwrapped.blockType).toBe('SNOW')
        expect(unwrapped.count).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })
  })

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
          Option.match(Option.all([h, s] as const), {
            onNone: () => {},
            onSome: ([hi, si]) => {
              expect(hi.blockType).toBe(si.blockType)
              expect(hi.count).toBe(si.count)
            },
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

  describe('serialize / deserialize', () => {
    it.effect('serialize returns null for empty slots and objects for filled slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 8)))
        yield* service.setSlot(asSlotIndex(35), Option.some(createStack('DIRT', 1)))

        const data = yield* service.serialize()

        expect(data.slots.length).toBe(INVENTORY_SIZE)
        expect(data.slots[0]).toBeNull()

        const entry1 = Option.fromNullable(data.slots[1])
        expect(Option.isSome(entry1)).toBe(true)
        const unwrapped1 = Option.getOrThrow(entry1)
        expect(unwrapped1.slot).toBe(1)
        expect(unwrapped1.blockType).toBe('STONE')
        expect(unwrapped1.count).toBe(8)

        const entry35 = Option.fromNullable(data.slots[35])
        expect(Option.isSome(entry35)).toBe(true)
        const unwrapped35 = Option.getOrThrow(entry35)
        expect(unwrapped35.slot).toBe(35)
        expect(unwrapped35.blockType).toBe('DIRT')
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
        expect(unwrapped0.blockType).toBe('WOOD')
        expect(unwrapped0.count).toBe(7)
        const unwrapped2 = Option.getOrThrow(slot2)
        expect(unwrapped2.blockType).toBe('GLASS')
        expect(unwrapped2.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('deserialize ignores null and out-of-range entries', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        const data = {
          slots: [
            null,
            { slot: asSlotIndex(-1), blockType: 'STONE' as const, count: 9 },
            { slot: asSlotIndex(5), blockType: 'WOOD' as const, count: 4 },
            { slot: asSlotIndex(99), blockType: 'DIRT' as const, count: 2 },
          ],
        }

        yield* service.deserialize(data)

        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot5)).toBe(true)
        const unwrapped = Option.getOrThrow(slot5)
        expect(unwrapped.blockType).toBe('WOOD')
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
    it.effect('removeBlock on fully empty inventory returns false without crashing', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // All slots are empty (AIR-only registry → no non-AIR hotbar blocks)
        const result = yield* service.removeBlock('STONE', 1)
        expect(result).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removeBlock for a block type not present returns false', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        // Slot 0 has DIRT, we try to remove STONE (absent)
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        const result = yield* service.removeBlock('STONE', 1)
        expect(result).toBe(false)
        // DIRT slot is untouched
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.getOrThrow(slot0).count).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('removeBlock on a slot explicitly set to Option.none returns false', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      return Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(3), Option.none())
        const result = yield* service.removeBlock('DIRT', 1)
        expect(result).toBe(false)
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
          { slot: asSlotIndex(0), blockType: 'DIRT' as const, count: 12 },
          null,
          { slot: asSlotIndex(2), blockType: 'STONE' as const, count: 64 },
        ],
      }

      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded.slots.length).toBe(3)

      const entry0 = Option.fromNullable(decoded.slots[0])
      expect(Option.isSome(entry0)).toBe(true)
      const unwrapped0 = Option.getOrThrow(entry0)
      expect(unwrapped0.slot).toBe(0)
      expect(unwrapped0.blockType).toBe('DIRT')
      expect(unwrapped0.count).toBe(12)

      expect(decoded.slots[1]).toBeNull()

      const entry2 = Option.fromNullable(decoded.slots[2])
      expect(Option.isSome(entry2)).toBe(true)
      const unwrapped2 = Option.getOrThrow(entry2)
      expect(unwrapped2.slot).toBe(2)
      expect(unwrapped2.blockType).toBe('STONE')
      expect(unwrapped2.count).toBe(64)
    })

    it('round-trips: decode(encode(x)) deep-equals original', () => {
      const original = {
        slots: [
          null,
          { slot: asSlotIndex(5), blockType: 'WOOD' as const, count: 1 },
          null,
          { slot: asSlotIndex(27), blockType: 'GLASS' as const, count: 64 },
        ],
      }

      const roundTripped = decode(encode(original))
      expect(roundTripped).toEqual(original)
    })

    it('decoding invalid data (unknown blockType) throws a ParseError', () => {
      const invalid = {
        slots: [
          { slot: 0, blockType: 'INVALID_BLOCK_TYPE', count: 5 },
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
      expect(result.slots).toEqual([null, null, null])
    })
  })
})
