import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/blockRegistry'
import { ItemStack, MAX_STACK_SIZE } from '@/domain/item-stack'
import type { SlotIndex } from '@/shared/kernel'
import {
  InventoryService,
  InventoryServiceLive,
  INVENTORY_SIZE,
  HOTBAR_START,
  HOTBAR_SIZE,
} from './inventory-service'

const asSlotIndex = (n: number): SlotIndex => n as unknown as SlotIndex

/**
 * Build a minimal Block object for a given BlockType
 */
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

/**
 * Test implementation of BlockRegistry with a fixed set of blocks
 */
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

/**
 * Default test blocks: AIR + 8 non-AIR types to fill all 9 hotbar slots
 */
const defaultTestBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
  makeBlock('WOOD'),
  makeBlock('GRASS'),
  makeBlock('SAND'),
  makeBlock('WATER'),
  makeBlock('LEAVES'),
  makeBlock('GLASS'),
]

/**
 * Create InventoryService test layer with given BlockRegistry
 */
const createTestLayer = (blockRegistry: ReturnType<typeof createTestBlockRegistry>) => {
  const blockRegistryLayer = Layer.succeed(BlockRegistry, blockRegistry as unknown as BlockRegistry)
  return InventoryServiceLive.pipe(Layer.provide(blockRegistryLayer))
}

describe('application/inventory/inventory-service', () => {
  describe('constants', () => {
    it('INVENTORY_SIZE should be 36', () => {
      expect(INVENTORY_SIZE).toBe(36)
    })

    it('HOTBAR_START should be 27', () => {
      expect(HOTBAR_START).toBe(27)
    })

    it('HOTBAR_SIZE should be 9', () => {
      expect(HOTBAR_SIZE).toBe(9)
    })
  })

  describe('InventoryServiceLive', () => {
    it('should provide InventoryService as Layer', () => {
      const layer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))
      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService

        expect(typeof service.getSlot).toBe('function')
        expect(typeof service.setSlot).toBe('function')
        expect(typeof service.moveStack).toBe('function')
        expect(typeof service.addBlock).toBe('function')
        expect(typeof service.removeBlock).toBe('function')
        expect(typeof service.getHotbarSlots).toBe('function')
        expect(typeof service.getAllSlots).toBe('function')
        expect(typeof service.serialize).toBe('function')
        expect(typeof service.deserialize).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('initial state', () => {
    it('should have empty slots for main grid (indices 0-26)', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        for (let i = 0; i < HOTBAR_START; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isNone(slot)).toBe(true)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should pre-fill hotbar slots with non-AIR block types up to available non-AIR block count', () => {
      // defaultTestBlocks has 1 AIR + 8 non-AIR = 8 filled slots, last slot (index 35) is empty
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // Verify the 8 filled slots are all non-AIR
        for (let i = HOTBAR_START; i < HOTBAR_START + 8; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isSome(slot)).toBe(true)
          if (Option.isSome(slot)) {
            expect(slot.value.blockType).not.toBe('AIR')
          }
        }
        // The 9th hotbar slot (index 35) is empty because only 8 non-AIR blocks were registered
        const lastSlot = yield* service.getSlot(asSlotIndex(HOTBAR_START + 8))
        expect(Option.isNone(lastSlot)).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should leave hotbar slots empty when only AIR is registered', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        for (let i = HOTBAR_START; i < HOTBAR_START + HOTBAR_SIZE; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isNone(slot)).toBe(true)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should fill only the available non-AIR slots when fewer than 9 non-AIR blocks are registered', () => {
      const threeNonAir: ReadonlyArray<Block> = [
        makeBlock('AIR'),
        makeBlock('DIRT'),
        makeBlock('STONE'),
        makeBlock('WOOD'),
      ]
      const testLayer = createTestLayer(createTestBlockRegistry(threeNonAir))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // First 3 hotbar slots should be filled
        for (let i = HOTBAR_START; i < HOTBAR_START + 3; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isSome(slot)).toBe(true)
        }
        // Remaining 6 hotbar slots should be empty
        for (let i = HOTBAR_START + 3; i < HOTBAR_START + HOTBAR_SIZE; i++) {
          const slot = yield* service.getSlot(asSlotIndex(i))
          expect(Option.isNone(slot)).toBe(true)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getSlot / setSlot', () => {
    it('should round-trip: setSlot then getSlot returns the same value', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 1 })))
        const slot = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('DIRT')
          expect(slot.value.count).toBe(1)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should set slot to Option.none when clearing a slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'STONE', count: 5 })))
        yield* service.setSlot(asSlotIndex(0), Option.none())
        const slot = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isNone(slot)).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return Option.none for slot index beyond INVENTORY_SIZE', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const slot = yield* service.getSlot(asSlotIndex(100))
        expect(Option.isNone(slot)).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should allow overwriting an existing slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(5), Option.some(new ItemStack({ blockType: 'DIRT', count: 10 })))
        yield* service.setSlot(asSlotIndex(5), Option.some(new ItemStack({ blockType: 'STONE', count: 3 })))
        const slot = yield* service.getSlot(asSlotIndex(5))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('STONE')
          expect(slot.value.count).toBe(3)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('moveStack', () => {
    it('should move stack from filled slot to empty slot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 10 })))
        yield* service.setSlot(asSlotIndex(1), Option.none())

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isNone(source)).toBe(true)
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('DIRT')
          expect(target.value.count).toBe(10)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should merge compatible stacks: DIRT×30 into DIRT×20 gives DIRT×50 at target, empty at source', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 30 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'DIRT', count: 20 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        // mergeStacks merges source into target, so target gets 50 and source becomes empty
        expect(Option.isNone(source)).toBe(true)
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('DIRT')
          expect(target.value.count).toBe(50)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should leave remainder in source when merge overflows MAX_STACK_SIZE', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // 50 + 30 = 80, overflows MAX_STACK_SIZE(64): target gets 64, source keeps 16
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 30 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'DIRT', count: 50 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.count).toBe(MAX_STACK_SIZE)
        }
        expect(Option.isSome(source)).toBe(true)
        if (Option.isSome(source)) {
          expect(source.value.count).toBe(16)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should swap stacks of different block types', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 5 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'STONE', count: 3 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isSome(source)).toBe(true)
        if (Option.isSome(source)) {
          expect(source.value.blockType).toBe('STONE')
          expect(source.value.count).toBe(3)
        }
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('DIRT')
          expect(target.value.count).toBe(5)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should do nothing when source slot is empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.none())
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'STONE', count: 3 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        expect(Option.isNone(source)).toBe(true)
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('STONE')
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should merge STONE×10 into STONE×50: target becomes 60, source becomes empty', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'STONE', count: 10 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'STONE', count: 50 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        // 10 + 50 = 60, within MAX_STACK_SIZE(64): target=60, source=empty
        expect(Option.isNone(source)).toBe(true)
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('STONE')
          expect(target.value.count).toBe(60)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should be a no-op when moving a slot to itself', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(2), Option.some(new ItemStack({ blockType: 'WOOD', count: 7 })))

        yield* service.moveStack(asSlotIndex(2), asSlotIndex(2))

        const slot = yield* service.getSlot(asSlotIndex(2))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('WOOD')
          expect(slot.value.count).toBe(7)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should move STONE×30 into STONE×40: overflow gives target=64, source=6', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'STONE', count: 30 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'STONE', count: 40 })))

        yield* service.moveStack(asSlotIndex(0), asSlotIndex(1))

        const source = yield* service.getSlot(asSlotIndex(0))
        const target = yield* service.getSlot(asSlotIndex(1))

        // 30 + 40 = 70, overflows MAX_STACK_SIZE(64): target=64, source=6
        expect(Option.isSome(target)).toBe(true)
        if (Option.isSome(target)) {
          expect(target.value.blockType).toBe('STONE')
          expect(target.value.count).toBe(MAX_STACK_SIZE)
        }
        expect(Option.isSome(source)).toBe(true)
        if (Option.isSome(source)) {
          expect(source.value.blockType).toBe('STONE')
          expect(source.value.count).toBe(6)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('addBlock', () => {
    it('should add blocks to an empty slot and return true', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // Clear slot 0 to ensure it is empty
        yield* service.setSlot(asSlotIndex(0), Option.none())

        const added = yield* service.addBlock('STONE', 5)
        expect(added).toBe(true)

        // Verify at least one slot now contains STONE
        const slots = yield* service.getAllSlots()
        const hasStone = slots.some(
          (s) => Option.isSome(s) && s.value.blockType === 'STONE'
        )
        expect(hasStone).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should fill an existing partial stack before opening a new slot', () => {
      // Use only AIR registry so all slots start empty
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 60 })))

        // Adding 5 should fill slot 0 to 64 (space=4) then overflow into another slot (1)
        const added = yield* service.addBlock('DIRT', 5)
        expect(added).toBe(true)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.count).toBe(MAX_STACK_SIZE)
        }

        // Remaining 1 DIRT goes into slot 1
        const slot1 = yield* service.getSlot(asSlotIndex(1))
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot1)) {
          expect(slot1.value.blockType).toBe('DIRT')
          expect(slot1.value.count).toBe(1)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return false when inventory is full and cannot fit all blocks', () => {
      // Use only AIR registry so all 36 slots start empty, then fill them all
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // Fill every slot with a full stack of STONE
        for (let i = 0; i < INVENTORY_SIZE; i++) {
          yield* service.setSlot(asSlotIndex(i), Option.some(new ItemStack({ blockType: 'STONE', count: MAX_STACK_SIZE })))
        }

        // Now attempt to add DIRT — all slots full and no partial DIRT stacks
        const added = yield* service.addBlock('DIRT', 1)
        expect(added).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('removeBlock', () => {
    it('should remove blocks from a filled slot and return true', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'STONE', count: 10 })))

        const removed = yield* service.removeBlock('STONE', 5)
        expect(removed).toBe(true)

        const slot = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('STONE')
          expect(slot.value.count).toBe(5)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clear a slot when all items are removed', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'STONE', count: 5 })))

        const removed = yield* service.removeBlock('STONE', 5)
        expect(removed).toBe(true)

        const slot = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isNone(slot)).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should span multiple slots when removing more than one slot holds', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 10 })))
        yield* service.setSlot(asSlotIndex(1), Option.some(new ItemStack({ blockType: 'DIRT', count: 10 })))

        const removed = yield* service.removeBlock('DIRT', 15)
        expect(removed).toBe(true)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot1 = yield* service.getSlot(asSlotIndex(1))

        // slot 0 emptied (10 taken), slot 1 reduced by 5
        expect(Option.isNone(slot0)).toBe(true)
        expect(Option.isSome(slot1)).toBe(true)
        if (Option.isSome(slot1)) {
          expect(slot1.value.count).toBe(5)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return false when not enough blocks are in inventory', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 3 })))

        const removed = yield* service.removeBlock('DIRT', 10)
        expect(removed).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return false when removing a block type not in inventory', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        // No WOOD in inventory
        const removed = yield* service.removeBlock('WOOD', 1)
        expect(removed).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getHotbarSlots', () => {
    it('should return a ReadonlyArray of exactly HOTBAR_SIZE (9) slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()
        expect(hotbar.length).toBe(HOTBAR_SIZE)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should reflect the same contents as slots 27-35', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const hotbar = yield* service.getHotbarSlots()

        for (let i = 0; i < HOTBAR_SIZE; i++) {
          const directSlot = yield* service.getSlot(asSlotIndex(HOTBAR_START + i))
          const hotbarSlot = hotbar[i] ?? Option.none()

          expect(Option.isSome(hotbarSlot)).toBe(Option.isSome(directSlot))
          if (Option.isSome(hotbarSlot) && Option.isSome(directSlot)) {
            expect(hotbarSlot.value.blockType).toBe(directSlot.value.blockType)
          }
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should update when a hotbar slot is modified via setSlot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(HOTBAR_START + 2), Option.some(new ItemStack({ blockType: 'GRAVEL', count: 7 })))

        const hotbar = yield* service.getHotbarSlots()
        const slot = hotbar[2] ?? Option.none()

        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('GRAVEL')
          expect(slot.value.count).toBe(7)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getAllSlots', () => {
    it('should return a ReadonlyArray of exactly INVENTORY_SIZE (36) slots', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const all = yield* service.getAllSlots()
        expect(all.length).toBe(INVENTORY_SIZE)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should have main grid slots (0-26) as Option.none initially', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        const all = yield* service.getAllSlots()
        for (let i = 0; i < HOTBAR_START; i++) {
          expect(Option.isNone(all[i] ?? Option.none())).toBe(true)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should reflect mutations from setSlot', () => {
      const testLayer = createTestLayer(createTestBlockRegistry(defaultTestBlocks))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(10), Option.some(new ItemStack({ blockType: 'SAND', count: 42 })))

        const all = yield* service.getAllSlots()
        const slot10 = all[10] ?? Option.none()

        expect(Option.isSome(slot10)).toBe(true)
        if (Option.isSome(slot10)) {
          expect(slot10.value.blockType).toBe('SAND')
          expect(slot10.value.count).toBe(42)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('serialize / deserialize round-trip', () => {
    it('should produce a serializable save data object', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 5 })))

        const data = yield* service.serialize()
        expect(data).toBeDefined()
        expect(Array.isArray(data.slots)).toBe(true)
        expect(data.slots.length).toBe(INVENTORY_SIZE)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should serialize filled slots as objects and empty slots as null', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService
        yield* service.setSlot(asSlotIndex(3), Option.some(new ItemStack({ blockType: 'STONE', count: 12 })))

        const data = yield* service.serialize()

        const entry3 = data.slots[3]
        expect(entry3).not.toBeNull()
        if (entry3 !== null && entry3 !== undefined) {
          expect(entry3.slot).toBe(3)
          expect(entry3.blockType).toBe('STONE')
          expect(entry3.count).toBe(12)
        }

        // All other slots should be null
        for (let i = 0; i < INVENTORY_SIZE; i++) {
          if (i !== 3) {
            expect(data.slots[i]).toBeNull()
          }
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should restore inventory state after deserialize', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService

        // Set up an initial state
        yield* service.setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'DIRT', count: 5 })))
        yield* service.setSlot(asSlotIndex(15), Option.some(new ItemStack({ blockType: 'STONE', count: 20 })))

        // Serialize it
        const data = yield* service.serialize()

        // Clear the inventory
        for (let i = 0; i < INVENTORY_SIZE; i++) {
          yield* service.setSlot(asSlotIndex(i), Option.none())
        }

        // Verify it is cleared
        const slot0Before = yield* service.getSlot(asSlotIndex(0))
        expect(Option.isNone(slot0Before)).toBe(true)

        // Deserialize and verify restoration
        yield* service.deserialize(data)

        const slot0 = yield* service.getSlot(asSlotIndex(0))
        const slot15 = yield* service.getSlot(asSlotIndex(15))

        expect(Option.isSome(slot0)).toBe(true)
        if (Option.isSome(slot0)) {
          expect(slot0.value.blockType).toBe('DIRT')
          expect(slot0.value.count).toBe(5)
        }

        expect(Option.isSome(slot15)).toBe(true)
        if (Option.isSome(slot15)) {
          expect(slot15.value.blockType).toBe('STONE')
          expect(slot15.value.count).toBe(20)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should ignore null entries in save data during deserialize', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService

        const saveData = {
          slots: Array.from({ length: INVENTORY_SIZE }, (_, i) =>
            i === 5
              ? { slot: 5, blockType: 'WOOD' as const, count: 3 }
              : null
          ),
        }

        yield* service.deserialize(saveData)

        const slot5 = yield* service.getSlot(asSlotIndex(5))
        expect(Option.isSome(slot5)).toBe(true)
        if (Option.isSome(slot5)) {
          expect(slot5.value.blockType).toBe('WOOD')
          expect(slot5.value.count).toBe(3)
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining operations', () => {
      const testLayer = createTestLayer(createTestBlockRegistry([makeBlock('AIR')]))

      const program = Effect.gen(function* () {
        const service = yield* InventoryService

        const slot = yield* service
          .setSlot(asSlotIndex(0), Option.some(new ItemStack({ blockType: 'GRASS', count: 1 })))
          .pipe(Effect.flatMap(() => service.getSlot(asSlotIndex(0))))

        expect(Option.isSome(slot)).toBe(true)
        if (Option.isSome(slot)) {
          expect(slot.value.blockType).toBe('GRASS')
        }
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
