import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import type { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { MAX_STACK_SIZE, createStack } from '@/domain/item-stack'
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
  const blockMap = new Map<BlockType, Block>()
  for (const block of blocks) {
    blockMap.set(block.type, block)
  }

  return {
    register: (block: Block) =>
      Effect.sync(() => {
        blockMap.set(block.type, block)
      }),
    get: (blockType: BlockType) =>
      Effect.sync(() => {
        const block = blockMap.get(blockType)
        return block !== undefined ? Option.some(block) : Option.none<Block>()
      }),
    getAll: () => Effect.sync(() => Array.from(blockMap.values())),
    dispose: () =>
      Effect.sync(() => {
        blockMap.clear()
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
    it('slots 0-26 are empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        for (let i = 0; i < HOTBAR_START; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isNone(slot)).toBe(true)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('slots 27-35 are filled with non-AIR blocks when enough non-AIR blocks exist', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      const expectedTypes = fullHotbarBlocks
        .filter((block) => block.type !== 'AIR')
        .slice(0, HOTBAR_SIZE)
        .map((block) => block.type)

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        for (let i = 0; i < HOTBAR_SIZE; i++) {
          const slot = yield* service.getSlot(asSlotIndex(HOTBAR_START + i))
          expect(Option.isSome(slot)).toBe(true)
          if (Option.isSome(slot)) {
            expect(slot.value.blockType).toBe(expectedTypes[i])
            expect(slot.value.blockType).not.toBe('AIR')
            expect(slot.value.count).toBe(MAX_STACK_SIZE)
          }
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('when non-AIR blocks are fewer than 9, only those hotbar slots are filled', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(limitedHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService

        const first = yield* service.getSlot(asSlotIndex(HOTBAR_START))
        const second = yield* service.getSlot(asSlotIndex(HOTBAR_START + 1))
        const third = yield* service.getSlot(asSlotIndex(HOTBAR_START + 2))

        expect(Option.isSome(first)).toBe(true)
        expect(Option.isSome(second)).toBe(true)
        expect(Option.isNone(third)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('getSlot', () => {
    it('returns the value set in a slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 7)))
        const slot = yield* service.getSlot(asSlotIndex(0))

        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('STONE')
          expect(slot.value.count).toBe(7)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('returns Option.none for out-of-range index', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const slot = yield* service.getSlot(asSlotIndex(999))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('setSlot', () => {
    it('sets Option.some stack', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 12)))
        const slot = yield* service.getSlot(asSlotIndex(5))

        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('DIRT')
          expect(slot.value.count).toBe(12)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('clears slot with Option.none', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 12)))
        yield* service.setSlot(asSlotIndex(5), Option.none())

        const slot = yield* service.getSlot(asSlotIndex(5))
        expect(Option.isNone(slot)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('overwrites existing value', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(2), Option.some(createStack('WOOD', 1)))
        yield* service.setSlot(asSlotIndex(2), Option.some(createStack('GLASS', 9)))

        const slot = yield* service.getSlot(asSlotIndex(2))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('GLASS')
          expect(slot.value.count).toBe(9)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('moveStack', () => {
    it('moves stack to empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 10)))
        yield* service.setSlot(asSlotIndex(1), Option.none())

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        if (Option.isSome(to)) {
          expect(to.value.blockType).toBe('DIRT')
          expect(to.value.count).toBe(10)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('merges compatible stacks completely', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 20)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 10)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        if (Option.isSome(to)) {
          expect(to.value.blockType).toBe('STONE')
          expect(to.value.count).toBe(30)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('keeps remainder in source when merge overflows', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 10)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 60)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(to)).toBe(true)
        if (Option.isSome(to)) {
          expect(to.value.count).toBe(MAX_STACK_SIZE)
        }

        expect(Option.isSome(from)).toBe(true)
        if (Option.isSome(from)) {
          expect(from.value.blockType).toBe('STONE')
          expect(from.value.count).toBe(6)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('swaps incompatible stacks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('WOOD', 3)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        if (Option.isSome(from)) {
          expect(from.value.blockType).toBe('WOOD')
          expect(from.value.count).toBe(3)
        }
        if (Option.isSome(to)) {
          expect(to.value.blockType).toBe('DIRT')
          expect(to.value.count).toBe(5)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('does nothing when source slot is empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.none())
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('GLASS', 2)))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const from = yield* service.getSlot(asSlotIndex(0))
        const to = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isNone(from)).toBe(true)
        expect(Option.isSome(to)).toBe(true)
        if (Option.isSome(to)) {
          expect(to.value.blockType).toBe('GLASS')
          expect(to.value.count).toBe(2)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('does nothing when moving to same slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(4), Option.some(createStack('SNOW', 8)))

        yield* service.moveStack(asSlotIndex(4), asSlotIndex(4))

        const slot = yield* service.getSlot(asSlotIndex(4))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('SNOW')
          expect(slot.value.count).toBe(8)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('addBlock', () => {
    it('adds to first empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const added = yield* service.addBlock('DIRT', 5)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('DIRT')
          expect(slot0.value.count).toBe(5)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('fills partial stack first', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 60)))

        const added = yield* service.addBlock('DIRT', 3)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
        expect(Option.isSome(slot5)).toBe(true)
        if (Option.isSome(slot5)) {
          expect(slot5.value.count).toBe(63)
        }
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('fills partial stack then uses empty slot for remainder', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(createStack('DIRT', 62)))

        const added = yield* service.addBlock('DIRT', 5)
        const slot5 = yield* service.getSlot(asSlotIndex(5))
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(added).toBe(true)
        expect(Option.isSome(slot5)).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot5)) {
          expect(slot5.value.count).toBe(MAX_STACK_SIZE)
        }
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('DIRT')
          expect(slot0.value.count).toBe(3)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('splits large amount across multiple empty slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const added = yield* service.addBlock('STONE', MAX_STACK_SIZE + 2)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('STONE')
          expect(slot0.value.count).toBe(MAX_STACK_SIZE)
        }
        if (Option.isSome(slot1)) {
          expect(slot1.value.blockType).toBe('STONE')
          expect(slot1.value.count).toBe(2)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('returns false when inventory cannot fit all blocks', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        for (let i = 0; i < INVENTORY_SIZE; i++) {
          yield* service.setSlot(asSlotIndex(i), Option.some(createStack('STONE', MAX_STACK_SIZE)))
        }

        const added = yield* service.addBlock('DIRT', 1)
        expect(added).toBe(false)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('does not merge into stacks of different block type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 60)))

        const added = yield* service.addBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(added).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('STONE')
          expect(slot0.value.count).toBe(60)
        }
        if (Option.isSome(slot1)) {
          expect(slot1.value.blockType).toBe('DIRT')
          expect(slot1.value.count).toBe(3)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('removeBlock', () => {
    it('removes amount from a single stack', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        const removed = yield* service.removeBlock('WOOD', 4)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.count).toBe(6)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('clears stack when removing exact count', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('WOOD', 10)))

        const removed = yield* service.removeBlock('WOOD', 10)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(true)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('removes across multiple stacks of same type', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 4)))

        const removed = yield* service.removeBlock('DIRT', 7)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(removed).toBe(true)
        expect(Option.isNone(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot1)) {
          expect(slot1.value.count).toBe(2)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('returns false when requested amount is larger than available', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 3)))

        const removed = yield* service.removeBlock('DIRT', 10)
        const slot0 = yield* service.getSlot(asSlotIndex(0))

        expect(removed).toBe(false)
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('does not touch other block types', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('STONE', 5)))
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('DIRT', 5)))

        const removed = yield* service.removeBlock('DIRT', 3)
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        expect(removed).toBe(true)
        expect(Option.isSome(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('STONE')
          expect(slot0.value.count).toBe(5)
        }
        if (Option.isSome(slot1)) {
          expect(slot1.value.blockType).toBe('DIRT')
          expect(slot1.value.count).toBe(2)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('getHotbarSlots', () => {
    it('returns exactly HOTBAR_SIZE slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()
        expect(hotbar.length).toBe(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('returns slots from indices 27-35', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()
        const all = yield* service.getAllSlots()

        for (let i = 0; i < HOTBAR_SIZE; i++) {
          const h = hotbar[i] ?? Option.none()
          const s = all[HOTBAR_START + i] ?? Option.none()
          expect(Option.isSome(h)).toBe(Option.isSome(s))
          if (Option.isSome(h) && Option.isSome(s)) {
            expect(h.value.blockType).toBe(s.value.blockType)
            expect(h.value.count).toBe(s.value.count)
          }
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('reflects updates to hotbar slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(HOTBAR_START + 2), Option.some(createStack('GRAVEL', 11)))

        const hotbar = yield* service.getHotbarSlots()
        const slot = hotbar[2] ?? Option.none()
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('GRAVEL')
          expect(slot.value.count).toBe(11)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('getAllSlots', () => {
    it('returns exactly INVENTORY_SIZE slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const all = yield* service.getAllSlots()
        expect(all.length).toBe(INVENTORY_SIZE)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('reflects slot updates', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(10), Option.some(createStack('SAND', 42)))

        const all = yield* service.getAllSlots()
        const slot10 = all[10] ?? Option.none()
        expect(Option.isSome(slot10)).toBe(true)
        if (Option.isSome(slot10)) {
          expect(slot10.value.blockType).toBe('SAND')
          expect(slot10.value.count).toBe(42)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })
  })

  describe('serialize / deserialize', () => {
    it('serialize returns null for empty slots and objects for filled slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(1), Option.some(createStack('STONE', 8)))
        yield* service.setSlot(asSlotIndex(35), Option.some(createStack('DIRT', 1)))

        const data = yield* service.serialize()

        expect(data.slots.length).toBe(INVENTORY_SIZE)
        expect(data.slots[0]).toBeNull()

        const entry1 = data.slots[1]
        expect(entry1).not.toBeNull()
        if (entry1 !== null && entry1 !== undefined) {
          expect(entry1.slot).toBe(1)
          expect(entry1.blockType).toBe('STONE')
          expect(entry1.count).toBe(8)
        }

        const entry35 = data.slots[35]
        expect(entry35).not.toBeNull()
        if (entry35 !== null && entry35 !== undefined) {
          expect(entry35.slot).toBe(35)
          expect(entry35.blockType).toBe('DIRT')
          expect(entry35.count).toBe(1)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('deserialize restores previously serialized state', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
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
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('WOOD')
          expect(slot0.value.count).toBe(7)
        }
        if (Option.isSome(slot2)) {
          expect(slot2.value.blockType).toBe('GLASS')
          expect(slot2.value.count).toBe(3)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('deserialize ignores null and out-of-range entries', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
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
        if (Option.isSome(slot5)) {
          expect(slot5.value.blockType).toBe('WOOD')
          expect(slot5.value.count).toBe(4)
        }
        expect(Option.isNone(slot0)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('serialize -> deserialize -> serialize is stable', () => {
      const firstLayer = createTestLayer(createTestBlockRegistry(fullHotbarBlocks))
      const firstProgram = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 12)))
        return yield* service.serialize()
      }).pipe(Effect.provide(firstLayer))

      const snapshot = Effect.runSync(firstProgram)

      const secondLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))
      const secondProgram = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.deserialize(snapshot)
        return yield* service.serialize()
      }).pipe(Effect.provide(secondLayer))

      const restored = Effect.runSync(secondProgram)
      expect(restored).toEqual(snapshot)
    })
  })

  // ---------------------------------------------------------------------------
  // C4: removeBlock on an empty slot (slot with no item)
  // ---------------------------------------------------------------------------

  describe('removeBlock on empty slot / inventory', () => {
    it('removeBlock on fully empty inventory returns false without crashing', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // All slots are empty (AIR-only registry → no non-AIR hotbar blocks)
        const result = yield* service.removeBlock('STONE', 1)
        expect(result).toBe(false)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('removeBlock for a block type not present returns false', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // Slot 0 has DIRT, we try to remove STONE (absent)
        yield* service.setSlot(asSlotIndex(0), Option.some(createStack('DIRT', 5)))
        const result = yield* service.removeBlock('STONE', 1)
        expect(result).toBe(false)
        // DIRT slot is untouched
        const slot0 = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.count).toBe(5)
        }
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
    })

    it('removeBlock on a slot explicitly set to Option.none returns false', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(airOnlyBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(3), Option.none())
        const result = yield* service.removeBlock('DIRT', 1)
        expect(result).toBe(false)
        // Slot remains empty
        const slot3 = yield* service.getSlot(asSlotIndex(3))
        expect(Option.isNone(slot3)).toBe(true)
      }).pipe(Effect.provide(testLayer))

      Effect.runSync(program)
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

      const entry0 = decoded.slots[0]
      expect(entry0).not.toBeNull()
      if (entry0 !== null && entry0 !== undefined) {
        expect(entry0.slot).toBe(0)
        expect(entry0.blockType).toBe('DIRT')
        expect(entry0.count).toBe(12)
      }

      expect(decoded.slots[1]).toBeNull()

      const entry2 = decoded.slots[2]
      expect(entry2).not.toBeNull()
      if (entry2 !== null && entry2 !== undefined) {
        expect(entry2.slot).toBe(2)
        expect(entry2.blockType).toBe('STONE')
        expect(entry2.count).toBe(64)
      }
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
