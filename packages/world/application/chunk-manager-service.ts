import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkService } from './chunk-service'
import { ChunkCacheKey, ChunkCoord, DEFAULT_WORLD_ID, Position, type WorldId } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { LightEngineService } from './light-engine-service'
import type { ChunkAABB } from '../domain/chunk-aabb'
import { StorageServicePort } from '../domain/storage-service-port'
import { BiomeService } from './biome-service'
import { NoiseServicePort } from '../domain/noise-service-port'
import { TerrainWorkerPoolPort } from '@ts-minecraft/worker'
import { MAX_CACHED_CHUNKS } from './chunk-manager-constants'
import type { ChunkManagerError } from './chunk-manager-constants'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'
import { drainRenderDirtyChunkEntries, drainRenderDirtyChunks, getLoadedChunks, loadChunksAroundPlayer, markChunkDirty, saveDirtyChunks } from './chunk-manager-service-ops'
import type { ChunkLoadOptions } from './chunk-manager-service-model'

export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants'
export type { ChunkManagerError } from './chunk-manager-constants'
export type { ChunkLoadOptions } from './chunk-manager-service-model'

let activeChunkWorldIdRef: WorldId = DEFAULT_WORLD_ID
let activeChunkWorldServiceUpdater: ((worldId: WorldId) => void) | undefined

export const setActiveChunkWorldId = (worldId: WorldId): void => {
  activeChunkWorldIdRef = worldId
  activeChunkWorldServiceUpdater?.(worldId)
}

const emptyCacheState = (): ChunkCache => ({
  chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
  dirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
})

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

      const cache = yield* Ref.make<ChunkCache>(emptyCacheState())
      const cachedLoadedChunksRef = yield* Ref.make(Option.none<ReadonlyArray<Chunk>>())
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

      activeChunkWorldServiceUpdater = (worldId) => Effect.runSync(updateActiveWorldId(worldId))

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

      return {
        getChunk: (coord: ChunkCoord) => getChunk(ctx, coord),
        loadChunksAroundPlayer: (playerPos: Position, renderDistance?: number, options?: ChunkLoadOptions): Effect.Effect<boolean, ChunkManagerError> =>
          loadChunksAroundPlayer(ctx, lastLoadTimeRef, loadSemaphore, playerPos, renderDistance, options),
        getLoadedChunks: () => getLoadedChunks(ctx),
        drainRenderDirtyChunks: () => drainRenderDirtyChunks(cache),
        drainRenderDirtyChunkEntries: () => drainRenderDirtyChunkEntries(cache),
        markChunkDirty: (
          coord: ChunkCoord,
          dirtyVoxels?: ReadonlyArray<{ readonly lx: number; readonly y: number; readonly lz: number }>,
        ) => markChunkDirty(ctx, coord, dirtyVoxels),
        saveDirtyChunks: () => saveDirtyChunks(ctx),
        unloadChunk: (coord: ChunkCoord) => unloadChunk(ctx, coord),
      }
    }),
  }
) {}
export const ChunkManagerServiceLive = ChunkManagerService.Default
