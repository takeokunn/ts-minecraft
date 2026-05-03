import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Layer, MutableRef, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive, FurnaceError } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import { makeFurnaceLayer, makeChunkWithFurnace } from './furnace-service-test-utils'

describe('application/furnace/furnace-service', () => {
  it.effect('collectOutput fails with FurnaceError when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).operation).toBe('collectOutput')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput fails with FurnaceError when furnace has no output', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('No furnace output')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput returns false when inventoryService.addBlock returns false', () => {
    const customInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: string, _count: number) {
        return Effect.succeed(true)
      },
      addBlock(_blockType: string, _count: number) {
        return Effect.succeed(false)
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, customInventory as unknown as InventoryService)),
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
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const result = yield* furnace.collectOutput()
      expect(result).toBe(false)
    }).pipe(Effect.provide(layer))
  })

  it.effect('startSmelting refunds coal when removeBlock for input material fails after coal is removed', () => {
    const coalRemovedRef = MutableRef.make(false)
    const refundInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(blockType: string, _count: number) {
        return Effect.sync(() => {
          if (blockType === 'COAL') {
            MutableRef.set(coalRemovedRef, true)
            return true
          }
          return false
        })
      },
      addBlock(blockType: string, _count: number) {
        return Effect.sync(() => {
          if (blockType === 'COAL' && MutableRef.get(coalRemovedRef)) {
            MutableRef.set(coalRemovedRef, false)
          }
          return true
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, refundInventory as unknown as InventoryService)),
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
      expect((err as FurnaceError).reason).toContain('Missing input')
      expect(MutableRef.get(coalRemovedRef)).toBe(false)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick advances progress without completing when deltaTime is less than smelt duration', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(0.5))
      const state = yield* furnace.getNearestFurnaceState()
      expect(Option.isSome(state)).toBe(true)
      const s = Option.getOrThrow(state)
      expect(s.progressSecs).toBeCloseTo(0.5)
      expect(Option.isSome(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('tick does nothing when furnace has no activeRecipeId', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const stateAfter = yield* furnace.getNearestFurnaceState()
      expect(Option.isSome(stateAfter)).toBe(true)
      const s = Option.getOrThrow(stateAfter)
      expect(s.progressSecs).toBe(0)
      expect(Option.isNone(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('tick does not advance progress when furnace state has no activeRecipeId (furnace registered but idle)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      yield* furnace.collectOutput()
      const idleStateBefore = yield* furnace.getNearestFurnaceState()
      const progressBefore = Option.map(idleStateBefore, (s) => s.progressSecs)
      yield* furnace.tick(DeltaTimeSecs.make(1.0))
      const idleStateAfter = yield* furnace.getNearestFurnaceState()
      const progressAfter = Option.map(idleStateAfter, (s) => s.progressSecs)
      expect(progressBefore).toEqual(progressAfter)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )
})
