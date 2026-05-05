import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, HashMap, Layer, MutableHashMap, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive } from '@ts-minecraft/furnace'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { PlayerService } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId } from '@ts-minecraft/kernel'
import { CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import type { BlockType, InventoryItem } from '@ts-minecraft/kernel'
import {
  makeChunkManagerService,
  makeChunkWithFurnace,
  makeEmptyChunk,
  makeFurnaceLayer,
  makeInventoryService,
  makePlayerService,
  makeRecipeService,
} from './furnace-service-test-utils'


describe('application/furnace/furnace-service', () => {
  it.effect('getSelectedFurnacePosition returns None and clears state when player is more than 5 blocks away', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      // verify it is selected initially
      const nearbyBefore = yield* furnace.hasNearbyFurnace()
      expect(nearbyBefore).toBe(true)
      // now the player has moved far away — use a layer where player is at x=100
    }).pipe(Effect.provide(makeFurnaceLayer())).pipe(
      // After first check passes, run in a separate layer with player far away
      Effect.andThen(
        Effect.gen(function* () {
          const furnace = yield* FurnaceService
          // select furnace at origin, but player is far away
          yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
          const nearby = yield* furnace.hasNearbyFurnace()
          expect(nearby).toBe(false)
        }).pipe(Effect.provide(makeFurnaceLayer({ playerPosition: { x: 100, y: 64, z: 0 } }))),
      ),
    ),
  )

  it.effect('getSelectedFurnacePosition returns None when furnace y position is out of chunk bounds', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      // position.y >= CHUNK_HEIGHT makes the guard on line 92 fire
      yield* furnace.setSelectedFurnace({ x: 0, y: CHUNK_HEIGHT, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ playerPosition: { x: 0, y: CHUNK_HEIGHT, z: 0 } }))),
  )

  it.effect('getSelectedFurnacePosition returns None when block at position is not a furnace', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      // block at index 64 is AIR (0), not FURNACE
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ chunkBlocks: makeEmptyChunk().blocks }))),
  )

  it.effect('getSelectedFurnacePosition returns None when chunk is unavailable', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ getChunkFails: true }))),
  )

  it.effect('getState returns initial empty state (no furnaces registered)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const state = yield* furnace.getState()
      expect(HashMap.size(state.furnaces)).toBe(0)
    }).pipe(Effect.provide(makeFurnaceLayer()))
  )

  it.effect('startSmelting counts only non-empty slots (onNone path in slot reduction)', () => {
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
        getAllSlots: () => Effect.succeed([
          Option.none(),
          Option.some({ itemType: 'RAW_IRON' as InventoryItem, count: 1 }),
          Option.none(),
          Option.some({ itemType: 'COAL' as InventoryItem, count: 1 }),
        ]),
        removeBlock: () => Effect.void,
        addBlock: () => Effect.void,
      }))),
      Layer.provide(Layer.succeed(PlayerService, makePlayerService({ x: 0, y: 64, z: 0 }))),
      Layer.provide(Layer.succeed(ChunkManagerService, makeChunkManagerService(makeChunkWithFurnace()))),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')).pipe(Effect.either)
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })
})
