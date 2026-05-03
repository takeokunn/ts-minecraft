import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Layer, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive, FurnaceError } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import { makeFurnaceLayer, makeChunkWithFurnace } from './furnace-service-test-utils'

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
          ingredients: [{ blockType: 'WOOD', count: 1 }],
          output: { blockType: 'PLANKS', count: 4 },
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
      expect((err as FurnaceError).reason).toContain('No nearby furnace')
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
      expect((err as FurnaceError).reason).toContain('Missing input')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map<BlockType, number>([['COAL', 1]]), // no RAW_IRON
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
      expect((err as FurnaceError).reason).toContain('no input ingredient')
    }).pipe(Effect.provide(makeFurnaceLayer({
      recipeMap: {
        'empty-ingredients-recipe': {
          station: 'furnace',
          ingredients: [], // empty — no input[0]
          output: { blockType: 'IRON_INGOT', count: 1 },
        },
      },
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when removeBlock for coal fails at runtime', () => {
    // getAllSlots reports COAL present, but removeBlock('COAL') fails (simulated concurrent removal)
    const concurrentInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: string, _count: number) {
        return Effect.succeed(false) // all removals fail
      },
      addBlock(_blockType: string, _count: number) {
        return Effect.succeed(true)
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, concurrentInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
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
      expect((err as FurnaceError).reason).toContain('Missing furnace fuel: COAL')
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
      expect((err as FurnaceError).reason).toContain('Missing furnace fuel: COAL')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map<BlockType, number>([['RAW_IRON', 1]]), // no COAL
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
      expect((err as FurnaceError).reason).toContain('already smelting')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map<BlockType, number>([['RAW_IRON', 2], ['COAL', 2]]),
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
      expect((err as FurnaceError).reason).toContain('output slot is occupied')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map<BlockType, number>([['RAW_IRON', 2], ['COAL', 2]]),
    }))),
  )

})
