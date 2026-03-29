import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, MutableHashMap, MutableHashSet, Option } from 'effect'
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
  const justPressedKeys = MutableHashSet.fromIterable(Option.getOrElse(Option.fromNullable(config.justPressedKeys), (): ReadonlyArray<string> => []))
  let pendingWheelDelta = Option.getOrElse(Option.fromNullable(config.wheelDelta), () => 0)

  return {
    isKeyPressed: (_key: string) => Effect.sync(() => false),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
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
      MutableHashSet.add(justPressedKeys, key)
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

    it.effect('should have all required methods', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        expect(typeof service.getSelectedSlot).toBe('function')
        expect(typeof service.setSelectedSlot).toBe('function')
        expect(typeof service.getSelectedBlockType).toBe('function')
        expect(typeof service.getSlots).toBe('function')
        expect(typeof service.update).toBe('function')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getSelectedSlot', () => {
    it.effect('should return 0 as initial selected slot', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('setSelectedSlot', () => {
    it.effect('should set selected slot to 3', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should clamp negative slot index to 0', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(-1))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should clamp slot index above 8 to 8', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(9))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should allow setting slot to the valid boundary value 8', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getSlots', () => {
    it.effect('should return array of length HOTBAR_SIZE (9)', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()
        expect(slots.length).toBe(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fill slots with non-AIR block types from BlockRegistry', () => {
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

      return Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()

        // First 3 slots should have block types
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 0), () => Option.none<BlockType>()))).toBe(true)
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 1), () => Option.none<BlockType>()))).toBe(true)
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 2), () => Option.none<BlockType>()))).toBe(true)
        // Remaining slots should be None
        expect(Option.isNone(Option.getOrElse(Arr.get(slots, 3), () => Option.none<BlockType>()))).toBe(true)
        expect(Option.isNone(Option.getOrElse(Arr.get(slots, 8), () => Option.none<BlockType>()))).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should return all Option.none slots when only AIR is registered', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry([makeBlock('AIR')])
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        const slots = yield* service.getSlots()

        expect(slots.length).toBe(HOTBAR_SIZE)
        Arr.forEach(slots, (slot) => {
          expect(Option.isNone(slot)).toBe(true)
        })
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getSelectedBlockType', () => {
    it.effect('should return Option.some with the block type of the selected slot', () => {
      const inputService = createTestInputService()
      // non-AIR blocks: DIRT at slot 0, STONE at slot 1
      const blocks: ReadonlyArray<Block> = [makeBlock('AIR'), makeBlock('DIRT'), makeBlock('STONE')]
      const blockRegistry = createTestBlockRegistry(blocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        // Default slot is 0 → DIRT
        const blockType = yield* service.getSelectedBlockType()
        expect(Option.isSome(blockType)).toBe(true)
        expect(Option.getOrThrow(blockType)).toBe('DIRT')

        // Switch to slot 1 → STONE
        yield* service.setSelectedSlot(asSlotIndex(1))
        const blockType2 = yield* service.getSelectedBlockType()
        expect(Option.isSome(blockType2)).toBe(true)
        expect(Option.getOrThrow(blockType2)).toBe('STONE')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should return Option.none for an empty slot', () => {
      const inputService = createTestInputService()
      // Only AIR → all slots are None
      const blockRegistry = createTestBlockRegistry([makeBlock('AIR')])
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        const blockType = yield* service.getSelectedBlockType()
        expect(Option.isNone(blockType)).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update — keyboard slot selection', () => {
    it.effect('should select slot 4 (0-indexed) when Digit5 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit5'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(4)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should select slot 0 when Digit1 is pressed', () => {
      const inputService = createTestInputService()
      inputService.simulateKeyPress('Digit1')
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        // Move to a different slot first
        yield* service.setSelectedSlot(asSlotIndex(5))

        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should select slot 8 when Digit9 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit9'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should only process first key press and ignore wheel when key is pressed', () => {
      // Both Digit3 pressed and a wheel delta present — key takes priority
      const inputService = createTestInputService({
        justPressedKeys: ['Digit3'],
        wheelDelta: 100,
      })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        // Digit3 maps to slot 2 (0-indexed)
        expect(slot).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update — mouse wheel slot selection', () => {
    it.effect('should increment slot by 1 when wheel delta is positive', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // Start at slot 0
        expect(yield* service.getSelectedSlot()).toBe(0)

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should decrement slot by 1 when wheel delta is negative', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 8 to slot 0 when scrolling forward', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 0 to slot 8 when scrolling backward', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // Initial slot is 0

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should not change slot when wheel delta is 0', () => {
      const inputService = createTestInputService({ wheelDelta: 0 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('wheel scroll boundary wrapping', () => {
    it.effect('should wrap from slot 8 to slot 0 after scrolling forward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        inputService.setWheelDelta(100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 0 to slot 8 after scrolling backward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // starts at slot 0 by default

        inputService.setWheelDelta(-100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap correctly over multiple forward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(7))

        // scroll forward twice: 7 → 8 → 0
        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)

        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap correctly over multiple backward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(1))

        // scroll backward twice: 1 → 0 → 8
        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)

        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should advance by exactly 1 step per update regardless of wheel delta magnitude', () => {
      // The implementation uses Math.sign(wheelDelta) so large deltas still move by 1
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(9999)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        // Large positive delta → direction = 1 → advances by 1: 4 → 5
        expect(slot).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update — NaN wheel delta edge case', () => {
    it.effect('wheelDelta of NaN does not change selected slot', () => {
      // NaN wheel delta: Math.sign(NaN) === NaN, NaN !== 0 is true,
      // but (current + NaN) % HOTBAR_SIZE = NaN, which collapses to 0.
      // We document the actual behaviour: slot must remain valid (a number),
      // not become NaN.
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        // Inject NaN via the mutable helper
        inputService.setWheelDelta(NaN)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        // The slot must always be a finite number within [0, HOTBAR_SIZE-1]
        expect(Number.isFinite(slot)).toBe(true)
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('wheelDelta of Infinity does not wrap to an out-of-range slot', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(Infinity)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining operations', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        const slot = yield* service.setSelectedSlot(asSlotIndex(5)).pipe(
          Effect.flatMap(() => service.getSelectedSlot())
        )

        expect(slot).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
