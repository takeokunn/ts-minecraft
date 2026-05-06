import { Array as Arr, Clock, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkService } from './chunk-service'
import type { Chunk } from '../domain/chunk'
import { ChunkCoord, type WorldId } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/world-state'
import { LightEngineService } from './light-engine-service'
import { StorageServicePort } from '../domain/storage-service-port'
import { Position, ChunkCacheKey, DEFAULT_WORLD_ID } from '@ts-minecraft/kernel'
import { BiomeService } from './biome-service'
import { NoiseServicePort } from '../domain/noise-service-port'
import { TerrainWorkerPoolPort } from './terrain-worker-pool-port'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  getChunksInRenderDistance,
  countChunksInRadius,
  chunkCoordToWorldKey,
} from '../domain/chunk-coord-utils'
import { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS, ChunkManagerError } from './chunk-manager-constants'
import { type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'

export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants'
export type { ChunkManagerError } from './chunk-manager-constants'

const MAX_CHUNK_LOADS_PER_CALL = 4
const CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE = 3

let activeChunkWorldIdRef: WorldId = DEFAULT_WORLD_ID
let activeChunkWorldServiceUpdater: ((worldId: WorldId) => void) | undefined

export const setActiveChunkWorldId = (worldId: WorldId): void => {
  activeChunkWorldIdRef = worldId
  activeChunkWorldServiceUpdater?.(worldId)
}
export class ChunkManagerService extends Effect.Service<ChunkManagerService>()(
  '@minecraft/application/ChunkManagerService',
  {
    effect: Effect.gen(function* () {
      yield* ChunkService
      const storageService = yield* StorageServicePort
      yield* BiomeService
      const noiseService = yield* NoiseServicePort
      const terrainPool = yield* TerrainWorkerPoolPort
      const lightEngine = yield* LightEngineService

      const emptyCacheState = (): ChunkCache => ({
        chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
        dirtyChunks: HashSet.empty<ChunkCacheKey>(),
        renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
      })

      const cache = yield* Ref.make<ChunkCache>(emptyCacheState())

      const cachedLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
      const maxCachedChunksRef = yield* Ref.make(MAX_CACHED_CHUNKS)
      const worldIdRef = yield* Ref.make<WorldId>(activeChunkWorldIdRef)
      const lastLoadTimeRef = yield* Ref.make<number>(-200)
      const accessCounterRef = yield* Ref.make<number>(0)
      const loadSemaphore = yield* Effect.makeSemaphore(4)

      const updateActiveWorldId = (worldId: WorldId): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          activeChunkWorldIdRef = worldId
          yield* Ref.set(worldIdRef, worldId)
          yield* Ref.set(cache, emptyCacheState())
          yield* Ref.set(cachedLoadedChunksRef, Option.none())
          yield* Ref.set(maxCachedChunksRef, MAX_CACHED_CHUNKS)
          yield* Ref.set(lastLoadTimeRef, -200)
          yield* Ref.set(accessCounterRef, 0)
        })

      activeChunkWorldServiceUpdater = (worldId) => {
        Effect.runSync(updateActiveWorldId(worldId))
      }

      const ctx: ChunkOpsContext = {
        worldIdRef,
        cache,
        cachedLoadedChunksRef,
        maxCachedChunksRef,
        accessCounterRef,
        storageService,
        noiseService,
        terrainPool,
        lightEngine,
      }

      const service = {
        getChunk: (coord: ChunkCoord) => getChunk(ctx, coord),

        loadChunksAroundPlayer: (playerPos: Position, renderDistance: number = RENDER_DISTANCE): Effect.Effect<boolean, ChunkManagerError> =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis
            const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) =>
              now - last < 200 ? [false, last] : [true, now]
            )
            if (!shouldLoad) {
              return false
            }

            const centerChunk = worldToChunkCoord(playerPos)
            const chunkCacheCapacity = Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2))
            yield* Ref.update(maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity))

            const currentWorldId = yield* Ref.get(worldIdRef)
            const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance)
            const stateBeforeLoad = yield* Ref.get(cache)
            const missingChunksToLoad = Arr.filter(
              chunksToLoad,
              (coord) => !HashMap.has(stateBeforeLoad.chunks, chunkCoordToWorldKey(coord, currentWorldId)),
            )

            const shouldBatchLoads = renderDistance >= CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE
            const chunkLoadBatch = shouldBatchLoads
              ? Arr.take(missingChunksToLoad, MAX_CHUNK_LOADS_PER_CALL)
              : missingChunksToLoad

            yield* Effect.forEach(
              chunkLoadBatch,
              (coord) => loadSemaphore.withPermits(1)(getChunk(ctx, coord)),
              { concurrency: 4 }
            )

            const state = yield* Ref.get(cache)
            const unloadDistance = Math.max(renderDistance + 2, UNLOAD_DISTANCE)
            const maxDistance = unloadDistance * unloadDistance

            yield* Effect.forEach(
              Arr.filter(Arr.fromIterable(HashMap.values(state.chunks)), (entry) =>
                chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance
              ),
              (entry) => unloadChunk(ctx, entry.chunk.coord),
              { concurrency: 1 }
            )

            return chunkLoadBatch.length === missingChunksToLoad.length
          }),

        getLoadedChunks: (): Effect.Effect<ReadonlyArray<Chunk>, never> =>
          Effect.gen(function* () {
            return yield* Option.match(yield* Ref.get(cachedLoadedChunksRef), {
              onSome: Effect.succeed,
              onNone: () => Effect.gen(function* () {
                const state = yield* Ref.get(cache)
                const chunks: ReadonlyArray<Chunk> = Arr.map(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => entry.chunk)
                yield* Ref.set(cachedLoadedChunksRef, Option.some(chunks))
                return chunks
              }),
            })
          }),

        drainRenderDirtyChunks: (): Effect.Effect<ReadonlyArray<Chunk>, never> =>
          Effect.gen(function* () {
            const renderDirtyKeys = yield* Ref.modify(cache, (s) => [
              s.renderDirtyChunks,
              { ...s, renderDirtyChunks: HashSet.empty<ChunkCacheKey>() },
            ])
            const state = yield* Ref.get(cache)
            return Arr.filterMap(
              Arr.fromIterable(renderDirtyKeys),
              (key) => Option.map(HashMap.get(state.chunks, key), (entry) => entry.chunk),
            )
          }),

        markChunkDirty: (coord: ChunkCoord): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const worldId = yield* Ref.get(worldIdRef)
            const key = chunkCoordToWorldKey(coord, worldId)
            const state = yield* Ref.get(cache)
            yield* Option.match(HashMap.get(state.chunks, key), {
              onNone: () => Effect.void,
              onSome: (entry) =>
                lightEngine.updateLight(entry.chunk).pipe(
                  Effect.tap((grids) =>
                    Ref.update(cache, (s) =>
                      Option.match(HashMap.get(s.chunks, key), {
                        onNone: () => s,
                        onSome: (e) => ({
                          ...s,
                          chunks: HashMap.set(s.chunks, key, {
                            ...e,
                            chunk: { ...e.chunk, skyLight: grids.skyLight, blockLight: grids.blockLight },
                          }),
                        }),
                      })
                    )
                  )
                ),
            })

            const neighborOffsets: ReadonlyArray<readonly [number, number]> = [
              [0, 0],
              [-1, -1], [-1, 0], [-1, 1],
              [0, -1], [0, 1],
              [1, -1], [1, 0], [1, 1],
            ]
            const allKeys = Arr.map(neighborOffsets, ([dx, dz]) =>
              chunkCoordToWorldKey({ x: coord.x + dx, z: coord.z + dz }, worldId)
            )
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: Arr.reduce(allKeys, s.dirtyChunks, (set, k) => HashSet.add(set, k)),
              renderDirtyChunks: Arr.reduce(allKeys, s.renderDirtyChunks, (set, k) => HashSet.add(set, k)),
            }))
          }),

        saveDirtyChunks: (): Effect.Effect<void, StorageError> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(cache)
            const keysToSave = state.dirtyChunks
            const currentWorldId = yield* Ref.get(worldIdRef)

            yield* Effect.forEach(
              Arr.filterMap(Arr.fromIterable(keysToSave), (key) => HashMap.get(state.chunks, key)),
              (entry) => storageService.saveChunk(entry.worldId ?? currentWorldId, entry.chunk.coord, {
                blocks: entry.chunk.blocks,
                fluid: Option.getOrUndefined(entry.chunk.fluid),
              }),
              { concurrency: 1 }
            )

            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave),
            }))
          }),

        unloadChunk: (coord: ChunkCoord) => unloadChunk(ctx, coord),
      }

      return service
    }),
  }
) {}
export const ChunkManagerServiceLive = ChunkManagerService.Default
