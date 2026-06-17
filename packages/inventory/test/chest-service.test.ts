import { describe, expect, it } from '@effect/vitest'
import { BlockRegistry } from '@ts-minecraft/block'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE, SlotIndex } from '@ts-minecraft/core'
import { PlayerServicePort, WorldBlockQueryPort } from '@ts-minecraft/world'
import {
  CHEST_SIZE,
  ChestService,
  InventoryService,
} from '@ts-minecraft/inventory'
import { Effect, Layer, Option } from 'effect'

import type { ChestBlockState } from '../domain/chest-state'
import { ItemStack } from '../domain/item-stack'
import {
  createTestBlockRegistry,
  fullHotbarBlocks,
} from './inventory-service-test-utils'
import {
  makeChunkManagerService,
  makePlayerService,
} from './furnace-service-test-utils'

const chestPosition = { x: 0, y: 64, z: 0 } as const
const invalidHeightChestPosition = { x: 0, y: -1, z: 0 } as const

const makeChunkWithChest = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[64] = blockTypeToIndex('CHEST')
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

const makeChestLayer = (
  playerPosition: { readonly x: number; readonly y: number; readonly z: number } = chestPosition,
) => {
  const inventoryLayer = InventoryService.Default.pipe(
    Layer.provide(Layer.succeed(BlockRegistry, createTestBlockRegistry(fullHotbarBlocks))),
  )

  return ChestService.Default.pipe(
    Layer.provideMerge(inventoryLayer),
    Layer.provide(Layer.succeed(PlayerServicePort, makePlayerService(playerPosition))),
    Layer.provide(Layer.succeed(WorldBlockQueryPort, makeChunkManagerService(makeChunkWithChest()))),
  )
}

describe('ChestService', () => {
  it.effect('opens a nearby chest with 27 empty slots', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService

      yield* chestService.setSelectedChest(chestPosition)

      const chest = Option.getOrThrow(yield* chestService.getNearestChestState())
      expect(chest.position).toEqual(chestPosition)
      expect(chest.slots).toHaveLength(CHEST_SIZE)
      expect(chest.slots.every(Option.isNone)).toBe(true)
      expect(yield* chestService.hasNearbyChest()).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('does not expose a selected chest when the player is out of range', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService

      yield* chestService.setSelectedChest(chestPosition)

      expect(Option.isNone(yield* chestService.getNearestChestState())).toBe(true)
      expect(yield* chestService.hasNearbyChest()).toBe(false)
    }).pipe(Effect.provide(makeChestLayer({ x: 16, y: 64, z: 0 }))),
  )

  it.effect('moves inventory stacks into and out of chest slots', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService
      const inventorySlot = SlotIndex.make(0)

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(inventorySlot, Option.some(new ItemStack({ itemType: 'STONE', count: 32, durability: null })))

      yield* chestService.moveInventoryStackToChestSlot(inventorySlot, 0)

      expect(Option.isNone(yield* inventoryService.getSlot(inventorySlot))).toBe(true)
      const stored = Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])
      expect(stored.itemType).toBe('STONE')
      expect(stored.count).toBe(32)

      yield* chestService.moveChestStackToInventorySlot(0, inventorySlot)

      expect(Option.isNone(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])).toBe(true)
      const restored = Option.getOrThrow(yield* inventoryService.getSlot(inventorySlot))
      expect(restored.itemType).toBe('STONE')
      expect(restored.count).toBe(32)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('merges and swaps direct moves according to the target slot contents', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 40, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)
      yield* inventoryService.setSlot(SlotIndex.make(1), Option.some(new ItemStack({ itemType: 'STONE', count: 30, durability: null })))

      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(1), 0)

      const mergedChestStack = Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])
      const remainder = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(1)))
      expect(mergedChestStack.itemType).toBe('STONE')
      expect(mergedChestStack.count).toBe(64)
      expect(remainder.itemType).toBe('STONE')
      expect(remainder.count).toBe(6)

      yield* inventoryService.setSlot(SlotIndex.make(2), Option.some(new ItemStack({ itemType: 'DIRT', count: 3, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(2), 0)

      const swappedChestStack = Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])
      const swappedInventoryStack = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(2)))
      expect(swappedChestStack.itemType).toBe('DIRT')
      expect(swappedChestStack.count).toBe(3)
      expect(swappedInventoryStack.itemType).toBe('STONE')
      expect(swappedInventoryStack.count).toBe(64)

      yield* chestService.moveChestStackToInventorySlot(1, SlotIndex.make(3))
      expect(Option.isNone(yield* inventoryService.getSlot(SlotIndex.make(3)))).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('drops an invalid-height selection before exposing chest state', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService

      yield* chestService.setSelectedChest(invalidHeightChestPosition)

      expect(Option.isNone(yield* chestService.getNearestChestState())).toBe(true)
      expect(yield* chestService.hasNearbyChest()).toBe(false)
    }).pipe(Effect.provide(makeChestLayer(invalidHeightChestPosition))),
  )

  it.effect('quick moves inventory stacks into existing chest stacks before empty slots', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 40, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)

      yield* inventoryService.setSlot(SlotIndex.make(1), Option.some(new ItemStack({ itemType: 'STONE', count: 30, durability: null })))
      yield* chestService.quickMoveInventoryToChest(SlotIndex.make(1))

      const chest = Option.getOrThrow(yield* chestService.getNearestChestState())
      const first = Option.getOrThrow(chest.slots[0])
      const second = Option.getOrThrow(chest.slots[1])
      expect(first.itemType).toBe('STONE')
      expect(first.count).toBe(64)
      expect(second.itemType).toBe('STONE')
      expect(second.count).toBe(6)
      expect(Option.isNone(yield* inventoryService.getSlot(SlotIndex.make(1)))).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('quick moves chest stacks into matching inventory stacks before empty slots', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'DIRT', count: 50, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)
      yield* inventoryService.setSlot(SlotIndex.make(2), Option.some(new ItemStack({ itemType: 'DIRT', count: 60, durability: null })))

      yield* chestService.quickMoveChestToInventory(0)

      const chest = Option.getOrThrow(yield* chestService.getNearestChestState())
      expect(Option.isNone(chest.slots[0])).toBe(true)

      const firstInventorySlot = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(0)))
      const thirdInventorySlot = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(2)))
      expect(firstInventorySlot.itemType).toBe('DIRT')
      expect(firstInventorySlot.count).toBe(46)
      expect(thirdInventorySlot.itemType).toBe('DIRT')
      expect(thirdInventorySlot.count).toBe(64)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('keeps inventory stacks unchanged when the selected chest has no room', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.deserialize([
        {
          position: chestPosition,
          slots: Array.from({ length: CHEST_SIZE }, () =>
            Option.some(new ItemStack({ itemType: 'DIRT', count: 64, durability: null })),
          ),
        },
      ])
      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 8, durability: null })))

      yield* chestService.quickMoveInventoryToChest(SlotIndex.make(0))

      const inventoryStack = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(0)))
      expect(inventoryStack.itemType).toBe('STONE')
      expect(inventoryStack.count).toBe(8)
      expect(Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0]).itemType).toBe('DIRT')
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('keeps chest stacks unchanged when inventory has no room', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 8, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)

      for (let i = 0; i < 36; i += 1) {
        yield* inventoryService.setSlot(SlotIndex.make(i), Option.some(new ItemStack({ itemType: 'DIRT', count: 64, durability: null })))
      }

      yield* chestService.quickMoveChestToInventory(0)

      const chestStack = Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])
      expect(chestStack.itemType).toBe('STONE')
      expect(chestStack.count).toBe(8)
      expect(Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(0))).itemType).toBe('DIRT')
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('treats empty or unavailable transfer sources as no-ops', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 9, durability: null })))
      yield* chestService.quickMoveInventoryToChest(SlotIndex.make(0))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), CHEST_SIZE)
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(1), 0)
      yield* chestService.moveChestStackToInventorySlot(CHEST_SIZE, SlotIndex.make(1))
      yield* chestService.moveChestStackToInventorySlot(0, SlotIndex.make(1))
      yield* chestService.quickMoveChestToInventory(0)
      expect(Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(0))).count).toBe(9)

      yield* chestService.setSelectedChest(chestPosition)
      yield* chestService.quickMoveInventoryToChest(SlotIndex.make(1))
      yield* chestService.quickMoveChestToInventory(CHEST_SIZE)
      yield* chestService.quickMoveChestToInventory(1)
      expect(Option.isNone(yield* inventoryService.getSlot(SlotIndex.make(1)))).toBe(true)
      expect(yield* chestService.dismantleChest({ x: 1, y: 64, z: 0 })).toBe(true)
      expect(Option.isSome((yield* chestService.getState()).selectedChestPosition)).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('normalizes plain serialized stacks and omitted chest slots', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService

      yield* chestService.deserialize([
        {
          position: chestPosition,
          slots: [
            Option.some({ itemType: 'STONE', count: 5, durability: null }),
            Option.none(),
          ],
        },
      ] satisfies ReadonlyArray<ChestBlockState>)
      yield* chestService.setSelectedChest(chestPosition)

      const chest = Option.getOrThrow(yield* chestService.getNearestChestState())
      const restored = Option.getOrThrow(chest.slots[0])
      expect(restored.itemType).toBe('STONE')
      expect(restored.count).toBe(5)
      expect(chest.slots).toHaveLength(CHEST_SIZE)
      expect(Option.isNone(chest.slots[1])).toBe(true)
      expect(Option.isNone(chest.slots[CHEST_SIZE - 1])).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('stops quick inventory transfer as soon as the source stack is fully merged', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.deserialize([
        {
          position: chestPosition,
          slots: [
            Option.some({ itemType: 'STONE', count: 63, durability: null }),
            ...Array.from({ length: CHEST_SIZE - 1 }, () => Option.some({ itemType: 'DIRT', count: 64, durability: null })),
          ],
        },
      ])
      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 1, durability: null })))

      yield* chestService.quickMoveInventoryToChest(SlotIndex.make(0))

      const chest = Option.getOrThrow(yield* chestService.getNearestChestState())
      expect(Option.getOrThrow(chest.slots[0]).count).toBe(64)
      expect(Option.isNone(yield* inventoryService.getSlot(SlotIndex.make(0)))).toBe(true)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('clears stored chest contents and selection', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 7, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)

      const dropped = yield* chestService.clearChest(chestPosition)

      expect(dropped).toHaveLength(1)
      expect(dropped[0]?.itemType).toBe('STONE')
      expect(dropped[0]?.count).toBe(7)
      expect(yield* chestService.hasNearbyChest()).toBe(false)
      expect(yield* chestService.clearChest(chestPosition)).toEqual([])
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('serializes and restores chest contents', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'DIRT', count: 12, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 3)

      const serialized = yield* chestService.serialize()
      yield* chestService.clearChest(chestPosition)
      yield* chestService.deserialize(serialized)
      yield* chestService.setSelectedChest(chestPosition)

      const restored = Option.getOrThrow(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[3])
      expect(restored.itemType).toBe('DIRT')
      expect(restored.count).toBe(12)
    }).pipe(Effect.provide(makeChestLayer())),
  )

  it.effect('dismantles a chest only when all contents fit in inventory', () =>
    Effect.gen(function* () {
      const chestService = yield* ChestService
      const inventoryService = yield* InventoryService

      yield* chestService.setSelectedChest(chestPosition)
      yield* inventoryService.setSlot(SlotIndex.make(0), Option.some(new ItemStack({ itemType: 'STONE', count: 8, durability: null })))
      yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(0), 0)

      for (let i = 0; i < 36; i += 1) {
        yield* inventoryService.setSlot(SlotIndex.make(i), Option.some(new ItemStack({ itemType: 'DIRT', count: 64, durability: null })))
      }

      expect(yield* chestService.dismantleChest(chestPosition)).toBe(false)
      expect(Option.isSome(Option.getOrThrow(yield* chestService.getNearestChestState()).slots[0])).toBe(true)

      yield* inventoryService.setSlot(SlotIndex.make(0), Option.none())

      expect(yield* chestService.dismantleChest(chestPosition)).toBe(true)
      const restored = Option.getOrThrow(yield* inventoryService.getSlot(SlotIndex.make(0)))
      expect(restored.itemType).toBe('STONE')
      expect(restored.count).toBe(8)
      expect((yield* chestService.serialize()).length).toBe(0)
    }).pipe(Effect.provide(makeChestLayer())),
  )
})
