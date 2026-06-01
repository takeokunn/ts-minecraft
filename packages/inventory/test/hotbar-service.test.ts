import { describe, it } from '@effect/vitest'
import { HOTBAR_SIZE,HOTBAR_START,HotbarService,InventoryService } from '@ts-minecraft/inventory'
import { InventoryItem } from '@ts-minecraft/core'
import { Block } from '@ts-minecraft/block'
import { Array as Arr,Effect,Option } from 'effect'
import { expect } from 'vitest'
import { createStack } from '../domain/item-stack'
import {
asSlotIndex,
createTestBlockRegistry,
createTestInputService,
createTestLayer,
defaultTestBlocks,
makeBlock,
} from './hotbar-service-test-utils'

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
        const inventory = yield* InventoryService
        yield* inventory.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('DIRT', 1)))
        yield* inventory.setSlot(asSlotIndex(HOTBAR_START + 1), Option.some(createStack('STONE', 1)))
        yield* inventory.setSlot(asSlotIndex(HOTBAR_START + 2), Option.some(createStack('WOOD', 1)))
        const slots = yield* service.getSlots()

        // First 3 slots should have block types
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 0), () => Option.none<InventoryItem>()))).toBe(true)
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 1), () => Option.none<InventoryItem>()))).toBe(true)
        expect(Option.isSome(Option.getOrElse(Arr.get(slots, 2), () => Option.none<InventoryItem>()))).toBe(true)
        // Remaining slots should be None
        expect(Option.isNone(Option.getOrElse(Arr.get(slots, 3), () => Option.none<InventoryItem>()))).toBe(true)
        expect(Option.isNone(Option.getOrElse(Arr.get(slots, 8), () => Option.none<InventoryItem>()))).toBe(true)
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
        const inventory = yield* InventoryService
        yield* inventory.setSlot(asSlotIndex(HOTBAR_START), Option.some(createStack('DIRT', 1)))
        yield* inventory.setSlot(asSlotIndex(HOTBAR_START + 1), Option.some(createStack('STONE', 1)))

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
})
