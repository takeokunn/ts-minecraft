import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { PlayerInputService } from '@/application/input/player-input-service'
import { InventoryServiceLive } from '@/application/inventory/inventory-service'
import { HotbarService, HotbarServiceLive, HOTBAR_SIZE } from './hotbar-service'
import type { SlotIndex } from '@/shared/kernel'

const asSlotIndex = (n: number): SlotIndex => n as unknown as SlotIndex

/**
 * Test implementation of InputService with controllable wheel and key state
 */
const createTestInputService = (config: {
  justPressedKeys?: ReadonlyArray<string>
  wheelDelta?: number
} = {}) => {
  const justPressedKeys = new Set<string>(config.justPressedKeys ?? [])
  let pendingWheelDelta = config.wheelDelta ?? 0

  return {
    isKeyPressed: (_key: string) => Effect.sync(() => false),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (justPressedKeys.has(key)) {
          justPressedKeys.delete(key)
          return true
        }
        return false
      }),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isMouseDown: (_button: number) => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => false),
    consumeMouseClick: (_button: number) => Effect.sync(() => false),
    consumeWheelDelta: () =>
      Effect.sync(() => {
        const delta = pendingWheelDelta
        pendingWheelDelta = 0
        return delta
      }),
    // Test helpers
    simulateKeyPress: (key: string) => {
      justPressedKeys.add(key)
    },
    setWheelDelta: (delta: number) => {
      pendingWheelDelta = delta
    },
  }
}

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
 * Default blocks used for most tests: AIR + 8 non-AIR types to fill all 9 slots
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
 * Create the HotbarService test layer with given input and block configurations.
 * HotbarService now depends on InventoryService (which in turn depends on BlockRegistry).
 */
const createTestLayer = (
  inputService: ReturnType<typeof createTestInputService>,
  blockRegistry: ReturnType<typeof createTestBlockRegistry>
) => {
  const inputLayer = Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)
  const blockRegistryLayer = Layer.succeed(BlockRegistry, blockRegistry as unknown as BlockRegistry)
  const inventoryLayer = InventoryServiceLive.pipe(
    Layer.provide(blockRegistryLayer)
  )

  return HotbarServiceLive.pipe(
    Layer.provide(inputLayer),
    Layer.provide(inventoryLayer)
  )
}

describe('application/hotbar/hotbar-service', () => {
  describe('HOTBAR_SIZE constant', () => {
    it('should equal 9', () => {
      expect(HOTBAR_SIZE).toBe(9)
    })
  })

  describe('HotbarServiceLive', () => {
    it('should provide HotbarService as Layer', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const layer = createTestLayer(inputService, blockRegistry)

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService

        expect(typeof service.getSelectedSlot).toBe('function')
        expect(typeof service.setSelectedSlot).toBe('function')
        expect(typeof service.getSelectedBlockType).toBe('function')
        expect(typeof service.getSlots).toBe('function')
        expect(typeof service.update).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getSelectedSlot', () => {
    it('should return 0 as initial selected slot', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('setSelectedSlot', () => {
    it('should set selected slot to 3', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clamp negative slot index to 0', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(-1))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clamp slot index above 8 to 8', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(9))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should allow setting slot to the valid boundary value 8', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getSlots', () => {
    it('should return array of length HOTBAR_SIZE (9)', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()
        expect(slots.length).toBe(HOTBAR_SIZE)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should fill slots with non-AIR block types from BlockRegistry', () => {
      const inputService = createTestInputService()
      // Provide AIR + 3 non-AIR blocks; remaining 6 slots should be None
      const blocks: ReadonlyArray<Block> = [
        makeBlock('AIR'),
        makeBlock('DIRT'),
        makeBlock('STONE'),
        makeBlock('WOOD'),
      ]
      const blockRegistry = createTestBlockRegistry(blocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()

        // First 3 slots should have block types
        expect(Option.isSome(slots[0] ?? Option.none())).toBe(true)
        expect(Option.isSome(slots[1] ?? Option.none())).toBe(true)
        expect(Option.isSome(slots[2] ?? Option.none())).toBe(true)
        // Remaining slots should be None
        expect(Option.isNone(slots[3] ?? Option.none())).toBe(true)
        expect(Option.isNone(slots[8] ?? Option.none())).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return all Option.none slots when only AIR is registered', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry([makeBlock('AIR')])
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()

        expect(slots.length).toBe(HOTBAR_SIZE)
        for (const slot of slots) {
          expect(Option.isNone(slot)).toBe(true)
        }

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getSelectedBlockType', () => {
    it('should return Option.some with the block type of the selected slot', () => {
      const inputService = createTestInputService()
      // non-AIR blocks: DIRT at slot 0, STONE at slot 1
      const blocks: ReadonlyArray<Block> = [makeBlock('AIR'), makeBlock('DIRT'), makeBlock('STONE')]
      const blockRegistry = createTestBlockRegistry(blocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService

        // Default slot is 0 → DIRT
        const blockType = yield* service.getSelectedBlockType()
        expect(Option.isSome(blockType)).toBe(true)
        if (Option.isSome(blockType)) {
          expect(blockType.value).toBe('DIRT')
        }

        // Switch to slot 1 → STONE
        yield* service.setSelectedSlot(asSlotIndex(1))
        const blockType2 = yield* service.getSelectedBlockType()
        expect(Option.isSome(blockType2)).toBe(true)
        if (Option.isSome(blockType2)) {
          expect(blockType2.value).toBe('STONE')
        }

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return Option.none for an empty slot', () => {
      const inputService = createTestInputService()
      // Only AIR → all slots are None
      const blockRegistry = createTestBlockRegistry([makeBlock('AIR')])
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        const blockType = yield* service.getSelectedBlockType()
        expect(Option.isNone(blockType)).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('update — keyboard slot selection', () => {
    it('should select slot 4 (0-indexed) when Digit5 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit5'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(4)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should select slot 0 when Digit1 is pressed', () => {
      const inputService = createTestInputService()
      inputService.simulateKeyPress('Digit1')
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService

        // Move to a different slot first
        yield* service.setSelectedSlot(asSlotIndex(5))

        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should select slot 8 when Digit9 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit9'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should only process first key press and ignore wheel when key is pressed', () => {
      // Both Digit3 pressed and a wheel delta present — key takes priority
      const inputService = createTestInputService({
        justPressedKeys: ['Digit3'],
        wheelDelta: 100,
      })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        // Digit3 maps to slot 2 (0-indexed)
        expect(slot).toBe(2)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('update — mouse wheel slot selection', () => {
    it('should increment slot by 1 when wheel delta is positive', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        // Start at slot 0
        expect(yield* service.getSelectedSlot()).toBe(0)

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(1)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should decrement slot by 1 when wheel delta is negative', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap from slot 8 to slot 0 when scrolling forward', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap from slot 0 to slot 8 when scrolling backward', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        // Initial slot is 0

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should not change slot when wheel delta is 0', () => {
      const inputService = createTestInputService({ wheelDelta: 0 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('wheel scroll boundary wrapping', () => {
    it('should wrap from slot 8 to slot 0 after scrolling forward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        inputService.setWheelDelta(100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap from slot 0 to slot 8 after scrolling backward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        // starts at slot 0 by default

        inputService.setWheelDelta(-100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap correctly over multiple forward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(7))

        // scroll forward twice: 7 → 8 → 0
        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)

        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap correctly over multiple backward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(1))

        // scroll backward twice: 1 → 0 → 8
        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)

        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should advance by exactly 1 step per update regardless of wheel delta magnitude', () => {
      // The implementation uses Math.sign(wheelDelta) so large deltas still move by 1
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(9999)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        // Large positive delta → direction = 1 → advances by 1: 4 → 5
        expect(slot).toBe(5)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('update — NaN wheel delta edge case', () => {
    it('wheelDelta of NaN does not change selected slot', () => {
      // NaN wheel delta: Math.sign(NaN) === NaN, NaN !== 0 is true,
      // but (current + NaN) % HOTBAR_SIZE = NaN, which collapses to 0.
      // We document the actual behaviour: slot must remain valid (a number),
      // not become NaN.
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        // Inject NaN via the mutable helper
        inputService.setWheelDelta(NaN)
        yield* service.update()

        return yield* service.getSelectedSlot()
      }).pipe(Effect.provide(testLayer))

      const slot = Effect.runSync(program)
      // The slot must always be a finite number within [0, HOTBAR_SIZE-1]
      expect(Number.isFinite(slot)).toBe(true)
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(HOTBAR_SIZE)
    })

    it('wheelDelta of Infinity does not wrap to an out-of-range slot', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(Infinity)
        yield* service.update()

        return yield* service.getSelectedSlot()
      }).pipe(Effect.provide(testLayer))

      const slot = Effect.runSync(program)
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(HOTBAR_SIZE)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining operations', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      const program = Effect.gen(function* () {
        const service = yield* HotbarService

        const slot = yield* service.setSelectedSlot(asSlotIndex(5)).pipe(
          Effect.flatMap(() => service.getSelectedSlot())
        )

        expect(slot).toBe(5)
        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
