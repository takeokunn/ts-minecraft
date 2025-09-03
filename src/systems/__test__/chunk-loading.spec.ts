import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, HashMap, Option } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import * as fc from 'effect/FastCheck'
import { calculateChunkUpdates, chunkLoadingSystem } from '../chunk-loading'
import { ComputationWorker, World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { Position, Chunk } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerQuery, chunkQuery } from '@/domain/queries'
import { RENDER_DISTANCE, CHUNK_SIZE } from '@/domain/world-constants'
import { arbitraryPosition, arbitraryChunk } from '@test/arbitraries'

const arbitraryChunkCoord = fc.record({
  x: fc.integer(),
  z: fc.integer(),
})

describe('calculateChunkUpdates', () => {
  it.effect('should correctly calculate chunks to load and unload', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          arbitraryChunkCoord,
          fc.array(fc.tuple(fc.string(), arbitraryChunk.map(toEntityId))),
          fc.integer({ min: 1, max: 5 }),
          async (playerChunk, loadedChunksArray, renderDistance) => {
            const loadedChunks = HashMap.fromIterable(loadedChunksArray)
            const { toLoad, toUnload } = calculateChunkUpdates(
              playerChunk,
              loadedChunks,
              renderDistance,
            )

            const requiredChunks = new Set<string>()
            for (let x = playerChunk.x - renderDistance; x <= playerChunk.x + renderDistance; x++) {
              for (let z = playerChunk.z - renderDistance; z <= playerChunk.z + renderDistance; z++) {
                requiredChunks.add(`${x},${z}`)
              }
            }

            toLoad.forEach((chunk) => {
              const key = `${chunk.x},${chunk.z}`
              assert.isTrue(requiredChunks.has(key), `Chunk ${key} should be required`)
              assert.isFalse(HashMap.has(loadedChunks, key), `Chunk ${key} should not be already loaded`)
            })

            toUnload.forEach((entityId) => {
              const isActuallyLoaded = ReadonlyArray.some(
                loadedChunksArray,
                ([_, id]) => id === entityId,
              )
              assert.isTrue(isActuallyLoaded, `Entity ${entityId} should be in the original loaded chunks`)

              const key = ReadonlyArray.findFirst(
                loadedChunksArray,
                ([_, id]) => id === entityId,
              ).pipe(Option.map(([key]) => key)).pipe(Option.getOrThrow)
              assert.isFalse(requiredChunks.has(key), `Unloaded chunk ${key} should not be required`)
            })
          },
        ),
      ),
    ))
})

describe('chunkLoadingSystem', () => {
  it.effect('should adhere to chunk loading properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          fc.option(arbitraryPosition, { nil: undefined }),
          fc.array(arbitraryChunk),
          async (playerPositionOpt, loadedChunks) => {
            const playerSoa: SoAResult<typeof playerQuery.components> = {
              entities: playerPositionOpt ? [toEntityId('player')] : [],
              components: {
                position: playerPositionOpt ? [playerPositionOpt] : [],
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
              entities: loadedChunks.map((_, i) => toEntityId(i)),
              components: {
                chunk: loadedChunks,
              },
            }

            const querySoaMock = vi.fn((query: any) => {
              if (query === playerQuery) return Effect.succeed(playerSoa as any)
              if (query === chunkQuery) return Effect.succeed(chunkSoa as any)
              return Effect.fail(new Error('unexpected query'))
            })
            const removeEntitySpy = vi.fn(() => Effect.succeed(undefined))
            const postTaskSpy = vi.fn(() => Effect.succeed(undefined))

            const mockWorld: Partial<World> = {
              querySoA: querySoaMock,
              removeEntity: removeEntitySpy,
            }
            const mockComputationWorker: Partial<ComputationWorker> = {
              postTask: postTaskSpy,
            }

            const testLayer = Layer.succeed(World, mockWorld as World).pipe(
              Layer.provide(Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)),
            )

            const system = await Effect.runPromise(chunkLoadingSystem)
            await Effect.runPromise(system.pipe(Effect.provide(testLayer)))

            if (!playerPositionOpt) {
              assert.strictEqual(postTaskSpy.mock.calls.length, 0)
              assert.strictEqual(removeEntitySpy.mock.calls.length, 0)
              return
            }

            const playerChunk = {
              x: Math.floor(playerPositionOpt.x / CHUNK_SIZE),
              z: Math.floor(playerPositionOpt.z / CHUNK_SIZE),
            }
            const loadedChunksMap = HashMap.fromIterable(
              loadedChunks.map((chunk, i) => [`${chunk.chunkX},${chunk.chunkZ}`, toEntityId(i)] as const),
            )

            const { toLoad, toUnload } = calculateChunkUpdates(
              playerChunk,
              loadedChunksMap,
              RENDER_DISTANCE,
            )

            assert.strictEqual(postTaskSpy.mock.calls.length, toLoad.length)
            assert.strictEqual(removeEntitySpy.mock.calls.length, toUnload.length)
          },
        ),
      ),
    ))
})