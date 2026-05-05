import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableHashMap, MutableRef, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive } from '@ts-minecraft/furnace'
import { RecipeService, InventoryError } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { PlayerService } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import type { BlockType, InventoryItem } from '@ts-minecraft/kernel'
import {
  makeChunkManagerService,
  makeFurnaceLayer,
  makeChunkWithFurnace,
  makeInventoryService,
  makePlayerService,
  makeRecipeService,
} from './furnace-service-test-utils'

describe('application/furnace/furnace-service', () => {
  it.effect('startSmelting consumes raw iron and coal, tick fills output slot, and collectOutput moves ingot to inventory', () => {
    const items = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])
    const inventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ itemType: 'RAW_IRON' as InventoryItem, count: Option.getOrElse(MutableHashMap.get(items, 'RAW_IRON'), () => 0) }),
          Option.some({ itemType: 'COAL' as InventoryItem, count: Option.getOrElse(MutableHashMap.get(items, 'COAL'), () => 0) }),
        ])
      },
      removeBlock(itemType: InventoryItem, count: number) {
        return Effect.suspend(() => {
          const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
          if (current < count) return Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
          MutableHashMap.set(items, itemType, current - count)
          return Effect.void
        })
      },
      addBlock(itemType: InventoryItem, count: number) {
        return Effect.sync(() => {
          const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
          MutableHashMap.set(items, itemType, current + count)
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(items, {
        removeBlock: inventory.removeBlock,
        addBlock: inventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(1.5 as never)
      const state = yield* furnace.getNearestFurnaceState().pipe(Effect.map(Option.getOrNull))
      expect(state?.output).toEqual(Option.some({ itemType: 'IRON_INGOT', count: 1 }))
      expect(Option.getOrElse(MutableHashMap.get(items, 'RAW_IRON'), () => 0)).toBe(0)
      expect(Option.getOrElse(MutableHashMap.get(items, 'COAL'), () => 0)).toBe(0)
      expect(Option.getOrElse(MutableHashMap.get(items, 'IRON_INGOT'), () => 0)).toBe(0)
      yield* furnace.collectOutput()
      expect(Option.getOrElse(MutableHashMap.get(items, 'IRON_INGOT'), () => 0)).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('serialize and deserialize round-trip furnace block state', () => {
    const items = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])
    const inventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ itemType: 'RAW_IRON' as InventoryItem, count: Option.getOrElse(MutableHashMap.get(items, 'RAW_IRON'), () => 0) }),
          Option.some({ itemType: 'COAL' as InventoryItem, count: Option.getOrElse(MutableHashMap.get(items, 'COAL'), () => 0) }),
        ])
      },
      removeBlock(itemType: InventoryItem, count: number) {
        return Effect.suspend(() => {
          const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
          if (current < count) return Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
          MutableHashMap.set(items, itemType, current - count)
          return Effect.void
        })
      },
      addBlock(itemType: InventoryItem, count: number) {
        return Effect.sync(() => {
          const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
          MutableHashMap.set(items, itemType, current + count)
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(items, {
        removeBlock: inventory.removeBlock,
        addBlock: inventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const serialized = yield* furnace.serialize()
      yield* furnace.deserialize(serialized)
      const roundTripped = yield* furnace.serialize()
      expect(roundTripped).toEqual(serialized)
    }).pipe(Effect.provide(layer))
  })

  // --- hasNearbyFurnace ---

  it.effect('hasNearbyFurnace returns false when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* furnace.hasNearbyFurnace()
      expect(result).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('hasNearbyFurnace returns true when a furnace is selected and nearby', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* furnace.hasNearbyFurnace()
      expect(result).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- clearFurnace ---

  it.effect('clearFurnace returns empty array when no furnace exists at position', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const items = yield* furnace.clearFurnace({ x: 99, y: 64, z: 99 })
      expect(items).toEqual([])
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('clearFurnace returns items from all occupied slots and clears furnace state', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // furnace now has input=RAW_IRON, fuel=COAL, output=none
      const items = yield* furnace.clearFurnace({ x: 0, y: 64, z: 0 })
      expect(items).toEqual(
        expect.arrayContaining([
          { itemType: 'RAW_IRON', count: 1 },
          { itemType: 'COAL', count: 1 },
        ]),
      )
      expect(items.length).toBe(2)
      // furnace state should now be empty
      const state = yield* furnace.getNearestFurnaceState()
      expect(Option.isNone(state)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('clearFurnace clears the selected furnace when the cleared position matches', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // tick to completion to also populate output slot
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const items = yield* furnace.clearFurnace({ x: 0, y: 64, z: 0 })
      // after tick: input+fuel removed, output=IRON_INGOT → 1 item
      expect(items).toEqual([{ itemType: 'IRON_INGOT', count: 1 }])
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- dismantleFurnace ---

  it.effect('dismantleFurnace returns true when no furnace exists at position (onNone path)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* furnace.dismantleFurnace({ x: 99, y: 64, z: 99 })
      expect(result).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('dismantleFurnace returns true and adds items back to inventory when furnace has items', () => {
    // Track inventory externally via a shared mutable object
    const trackedItems = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])
    const trackedInventory = {
      getAllSlots() {
        return Effect.succeed(
          Arr.fromIterable(MutableHashMap.keys(trackedItems)).map((itemType) =>
            Option.some({ itemType, count: Option.getOrElse(MutableHashMap.get(trackedItems, itemType), () => 0) }),
          ),
        )
      },
      removeBlock(itemType: InventoryItem, count: number) {
        return Effect.suspend(() => {
          const current = Option.getOrElse(MutableHashMap.get(trackedItems, itemType), () => 0)
          if (current < count) return Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
          MutableHashMap.set(trackedItems, itemType, current - count)
          return Effect.void
        })
      },
      addBlock(itemType: InventoryItem, count: number) {
        return Effect.sync(() => {
          const current = Option.getOrElse(MutableHashMap.get(trackedItems, itemType), () => 0)
          MutableHashMap.set(trackedItems, itemType, current + count)
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(trackedItems, {
        removeBlock: trackedInventory.removeBlock,
        addBlock: trackedInventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // RAW_IRON and COAL were removed from inventory by startSmelting
      expect(Option.getOrElse(MutableHashMap.get(trackedItems, 'RAW_IRON'), () => 0)).toBe(0)
      expect(Option.getOrElse(MutableHashMap.get(trackedItems, 'COAL'), () => 0)).toBe(0)
      const result = yield* furnace.dismantleFurnace({ x: 0, y: 64, z: 0 })
      expect(result).toBe(true)
      // items should be returned to inventory
      expect(Option.getOrElse(MutableHashMap.get(trackedItems, 'RAW_IRON'), () => 0)).toBe(1)
      expect(Option.getOrElse(MutableHashMap.get(trackedItems, 'COAL'), () => 0)).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('dismantleFurnace returns false when inventoryService.addBlock fails with InventoryError', () => {
    const addCallCountRef = MutableRef.make(0)
    const customInventory = {
      items: MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]]),
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: BlockType, _count: number) {
        return Effect.void
      },
      addBlock(_blockType: BlockType, _count: number) {
        MutableRef.update(addCallCountRef, (n) => n + 1)
        return Effect.fail(new InventoryError({ operation: 'addBlock', cause: 'inventory full' })) // inventory full
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(customInventory.items, {
        removeBlock: customInventory.removeBlock,
        addBlock: customInventory.addBlock,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const result = yield* furnace.dismantleFurnace({ x: 0, y: 64, z: 0 })
      expect(result).toBe(false)
      expect(MutableRef.get(addCallCountRef)).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })
})
