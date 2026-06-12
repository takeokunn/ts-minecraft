import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkService } from './chunk-service'
import { ChunkCacheKey, ChunkCoord, DEFAULT_WORLD_ID, Position, WorldId, type WorldId as WorldIdType } from '@ts-minecraft/core'
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
import type { Dimension } from '../domain/nether/nether-travel'

export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants'
export type { ChunkManagerError } from './chunk-manager-constants'
export type { ChunkLoadOptions } from './chunk-manager-service-model'

const emptyCacheState = (): ChunkCache => ({
  chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
  dirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
})

// Atomically reset all cache state when switching worlds.
// Effect.all with concurrency='unbounded' applies all Ref writes without a
// partial-state window between operations.
const buildSetActiveWorldId = (
  worldIdRef: Ref.Ref<WorldIdType>,
  cache: Ref.Ref<ChunkCache>,
  cachedLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>,
  maxCachedChunksRef: Ref.Ref<number>,
  lastLoadTimeRef: Ref.Ref<number>,
  accessCounterRef: Ref.Ref<number>,
) => (worldId: WorldIdType): Effect.Effect<void, never> =>
  Ref.set(worldIdRef, worldId).pipe(
    Effect.flatMap(() => Ref.update(cache, () => emptyCacheState())),
    Effect.flatMap(() => Ref.set(cachedLoadedChunksRef, Option.none())),
    Effect.flatMap(() => Ref.set(maxCachedChunksRef, MAX_CACHED_CHUNKS)),
    Effect.flatMap(() => Ref.set(lastLoadTimeRef, -200)),
    Effect.flatMap(() => Ref.set(accessCounterRef, 0)),
  )

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
      const worldIdRef = yield* Ref.make<WorldIdType>(DEFAULT_WORLD_ID)
      const baseWorldIdRef = yield* Ref.make<WorldIdType>(DEFAULT_WORLD_ID)
      const dimensionRef = yield* Ref.make<Dimension>('overworld')
      const lastLoadTimeRef = yield* Ref.make<number>(-200)
      const accessCounterRef = yield* Ref.make<number>(0)
      const loadSemaphore = yield* Effect.makeSemaphore(4)

      const resetCache = buildSetActiveWorldId(
        worldIdRef, cache, cachedLoadedChunksRef, maxCachedChunksRef, lastLoadTimeRef, accessCounterRef,
      )

      const ctx: ChunkOpsContext = {
        worldIdRef,
        dimensionRef,
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
        /** Switch to a different world ID, atomically resetting all cache state. */
        setActiveWorldId: (worldId: WorldIdType): Effect.Effect<void, never> =>
          Ref.set(baseWorldIdRef, worldId).pipe(
            Effect.flatMap(() => Ref.set(dimensionRef, 'overworld')),
            Effect.flatMap(() => resetCache(worldId)),
          ),
        /** Switch dimension, clear cache, and re-key storage under a dimension-scoped world ID. */
        setActiveDimension: (dim: Dimension): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const base = yield* Ref.get(baseWorldIdRef)
            const newWorldId = dim === 'nether'
              ? WorldId.make(`${base}-nether`)
              : dim === 'end'
                ? WorldId.make(`${base}-end`)
                : base
            yield* Ref.set(dimensionRef, dim)
            yield* resetCache(newWorldId)
          }),
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

/**
 * Effect pipeline entry point for switching the active world ID.
 * Prefer calling service.setActiveWorldId(worldId) directly when you already
 * have a service reference. This helper is for callers that only have the tag.
 */
export const setActiveChunkWorldId = (worldId: WorldIdType): Effect.Effect<void, never, ChunkManagerService> =>
  Effect.gen(function* () {
    const service = yield* ChunkManagerService
    yield* service.setActiveWorldId(worldId)
  })
