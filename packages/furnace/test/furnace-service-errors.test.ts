import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Layer, MutableHashMap, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive, FurnaceError } from '@ts-minecraft/furnace'
import { RecipeService, InventoryError } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { PlayerService } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import type { InventoryItem } from '@ts-minecraft/kernel'
import {
  makeChunkManagerService,
  makeChunkWithFurnace,
  makeFurnaceLayer,
  makeInventoryService,
  makePlayerService,
  makeRecipeService,
} from './furnace-service-test-utils'

describe('application/furnace/furnace-service', () => {
  // --- startSmelting error paths ---

  it.effect('startSmelting fails with FurnaceError when recipe not found', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('nonexistent-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).operation).toBe('startSmelting')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('startSmelting fails with FurnaceError when recipe station is not furnace', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('workbench-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
    }).pipe(Effect.provide(makeFurnaceLayer({
      recipeMap: {
        'workbench-recipe': {
          station: 'crafting_table',
          ingredients: [{ itemType: 'WOOD', count: 1 }],
          output: { itemType: 'PLANKS', count: 4 },
        },
      },
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      // do NOT call setSelectedFurnace
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('No nearby furnace')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('startSmelting fails with FurnaceError when missing input material', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('Missing input')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['COAL', 1]]), // no RAW_IRON
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when recipe has no input ingredient', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('empty-ingredients-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('no input ingredient')
    }).pipe(Effect.provide(makeFurnaceLayer({
      recipeMap: {
        'empty-ingredients-recipe': {
          station: 'furnace',
          ingredients: [], // empty — no input[0]
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      },
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when removeBlock for coal fails at runtime', () => {
    // getAllSlots reports COAL present, but removeBlock('COAL') fails (simulated concurrent removal)
    const inventoryItems = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]])

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, makeRecipeService({
        'raw-iron-to-iron-ingot': {
          station: 'furnace',
          ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      }))),
      Layer.provide(Layer.succeed(InventoryService, makeInventoryService(inventoryItems, {
        removeBlock: () => Effect.fail(new InventoryError({ operation: 'removeBlock', cause: 'simulated failure' })),
        addBlock: () => Effect.void,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('Missing furnace fuel: COAL')
    }).pipe(Effect.provide(layer))
  })

  it.effect('startSmelting fails with FurnaceError when missing coal', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('Missing furnace fuel: COAL')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1]]), // no COAL
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when furnace already has activeRecipeId', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      // first smelt succeeds and sets activeRecipeId
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // second smelt should fail — furnace is already smelting
      // but we need more items in inventory for the second call to reach the check
      // The check happens before removeBlock, so it fails immediately
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('already smelting')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 2], ['COAL', 2]]),
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when furnace output slot is occupied', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // tick to completion — output slot now has IRON_INGOT
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      // try to smelt again with fresh items
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect(String((err as FurnaceError).cause)).toContain('output slot is occupied')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 2], ['COAL', 2]]),
    }))),
  )

})
