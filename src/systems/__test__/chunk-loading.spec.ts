import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, HashMap, ReadonlyArray } from 'effect'
import { calculateChunkUpdates, chunkLoadingSystem } from '../chunk-loading'
import { ComputationWorker, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Position } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerQuery, chunkQuery } from '@/domain/queries'
import { RENDER_DISTANCE } from '@/domain/world-constants'

describe('chunkLoadingSystem', () => {
  it.effect('should load initial chunks', () =>
    Effect.gen(function* ($) {
      const playerEntityId = EntityId('player')
      const playerPosition = new Position({ x: 0, y: 0, z: 0 })
      const playerSoa: SoA<typeof playerQuery> = {
        entities: [playerEntityId],
        components: {
          position: [playerPosition],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }
      const chunkSoa: SoA<typeof chunkQuery> = {
        entities: [],
        components: {
          chunk: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa)
          }
          if (query === chunkQuery) {
            return Effect.succeed(chunkSoa)
          }
          return Effect.fail(new Error('unexpected query'))
        },
        removeEntity: () => Effect.succeed(undefined),
      }

      const mockComputationWorker: Partial<ComputationWorker> = {
        postTask: () => Effect.succeed(undefined),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const computationWorkerLayer = Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)
      const testLayer = worldLayer.pipe(Layer.provide(computationWorkerLayer))

      const world = yield* $(World)
      const computationWorker = yield* $(ComputationWorker)
      const postTaskSpy = vi.spyOn(computationWorker, 'postTask')
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')

      yield* $(chunkLoadingSystem.pipe(Effect.provide(testLayer)))

      const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
      assert.deepStrictEqual(postTaskSpy.mock.calls.length, expectedChunksToLoad)
      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
    }))

  it.effect('should not do anything if player has not moved to a new chunk', () =>
    Effect.gen(function* ($) {
      const playerEntityId = EntityId('player')
      const playerPosition = new Position({ x: 0, y: 0, z: 0 })
      const playerSoa: SoA<typeof playerQuery> = {
        entities: [playerEntityId],
        components: {
          position: [playerPosition],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }
      const chunkSoa: SoA<typeof chunkQuery> = {
        entities: [],
        components: {
          chunk: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa)
          }
          if (query === chunkQuery) {
            return Effect.succeed(chunkSoa)
          }
          return Effect.fail(new Error('unexpected query'))
        },
      }

      const mockComputationWorker: Partial<ComputationWorker> = {
        postTask: () => Effect.succeed(undefined),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const computationWorkerLayer = Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)
      const testLayer = worldLayer.pipe(Layer.provide(computationWorkerLayer))

      const computationWorker = yield* $(ComputationWorker)
      const postTaskSpy = vi.spyOn(computationWorker, 'postTask')

      yield* $(chunkLoadingSystem.pipe(Effect.provide(testLayer)))
      yield* $(chunkLoadingSystem.pipe(Effect.provide(testLayer)))

      const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
      assert.deepStrictEqual(postTaskSpy.mock.calls.length, expectedChunksToLoad)
    }))

  it.effect('should not do anything if there are no players', () =>
    Effect.gen(function* ($) {
      const playerSoa: SoA<typeof playerQuery> = {
        entities: [],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa)
          }
          return Effect.fail(new Error('unexpected query'))
        },
      }

      const mockComputationWorker: Partial<ComputationWorker> = {
        postTask: () => Effect.succeed(undefined),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const computationWorkerLayer = Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)
      const testLayer = worldLayer.pipe(Layer.provide(computationWorkerLayer))

      const computationWorker = yield* $(ComputationWorker)
      const postTaskSpy = vi.spyOn(computationWorker, 'postTask')

      yield* $(chunkLoadingSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(postTaskSpy.mock.calls.length, 0)
    }))
})

describe('calculateChunkUpdates', () => {
  it('should calculate chunks to load and unload', () => {
    const currentPlayerChunk = { x: 0, z: 0 }
    const loadedChunks = HashMap.make(['0,1', EntityId('1')], ['-2,-2', EntityId('2')])
    const renderDistance = 1

    const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, renderDistance)

    const toLoadSet = new Set(ReadonlyArray.map(toLoad, (c) => `${c.x},${c.z}`))
    const expectedToLoadSet = new Set([
      '-1,-1',
      '0,-1',
      '1,-1',
      '-1,0',
      '0,0',
      '1,0',
      '-1,1',
      '1,1',
    ])

    assert.deepStrictEqual(toLoadSet, expectedToLoadSet)
    assert.deepStrictEqual(toUnload, [EntityId('2')])
  })
})
