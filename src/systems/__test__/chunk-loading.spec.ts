import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, HashMap } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import { calculateChunkUpdates, chunkLoadingSystem } from '../chunk-loading'
import { ComputationWorker, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Position } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerQuery, chunkQuery } from '@/domain/queries'
import { RENDER_DISTANCE } from '@/domain/world-constants'

describe('chunkLoadingSystem', () => {
  it.effect('should load initial chunks', () =>
    Effect.gen(function* ($) {
      const playerEntityId = toEntityId('player')
      const playerPosition = new Position({ x: 0, y: 0, z: 0 })
      const playerSoa: SoAResult<typeof playerQuery.components> = {
        entities: [playerEntityId],
        components: {
          position: [playerPosition],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
          gravity: [],
          collider: [],
          target: [],
        },
      }
      const chunkSoa: SoAResult<typeof chunkQuery.components> = {
        entities: [],
        components: {
          chunk: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query: any) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa as any)
          }
          if (query === chunkQuery) {
            return Effect.succeed(chunkSoa as any)
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

      const computationWorker = yield* $(ComputationWorker)
      const postTaskSpy = vi.spyOn(computationWorker, 'postTask')

      const system = yield* $(chunkLoadingSystem)
      yield* $(system.pipe(Effect.provide(testLayer)))

      const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
      assert.deepStrictEqual(postTaskSpy.mock.calls.length, expectedChunksToLoad)
    }))

  it.effect('should not do anything if player has not moved to a new chunk', () =>
    Effect.gen(function* ($) {
      const playerEntityId = toEntityId('player')
      const playerPosition = new Position({ x: 0, y: 0, z: 0 })
      const playerSoa: SoAResult<typeof playerQuery.components> = {
        entities: [playerEntityId],
        components: {
          position: [playerPosition],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
          gravity: [],
          collider: [],
          target: [],
        },
      }
      const chunkSoa: SoAResult<typeof chunkQuery.components> = {
        entities: [],
        components: {
          chunk: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query: any) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa as any)
          }
          if (query === chunkQuery) {
            return Effect.succeed(chunkSoa as any)
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

      const system = yield* $(chunkLoadingSystem)
      yield* $(system.pipe(Effect.provide(testLayer)))
      yield* $(system.pipe(Effect.provide(testLayer)))

      const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
      assert.deepStrictEqual(postTaskSpy.mock.calls.length, expectedChunksToLoad)
    }))

  it.effect('should not do anything if there are no players', () =>
    Effect.gen(function* ($) {
      const playerSoa: SoAResult<typeof playerQuery.components> = {
        entities: [],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
          gravity: [],
          collider: [],
          target: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: (query: any) => {
          if (query === playerQuery) {
            return Effect.succeed(playerSoa as any)
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

      const system = yield* $(chunkLoadingSystem)
      yield* $(system.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(postTaskSpy.mock.calls.length, 0)
    }))
})

describe('calculateChunkUpdates', () => {
  it('should calculate chunks to load and unload', () => {
    const currentPlayerChunk = { x: 0, z: 0 }
    const loadedChunks = HashMap.make(['0,1', toEntityId('1')], ['-2,-2', toEntityId('2')])
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
    assert.deepStrictEqual(toUnload, [toEntityId('2')])
  })
})
