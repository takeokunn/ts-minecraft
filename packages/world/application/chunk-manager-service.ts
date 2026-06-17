import { Effect, Option, Ref } from 'effect'
import { ChunkService } from './chunk-service'
import { ChunkCoord, DEFAULT_WORLD_ID, Position, type WorldId as WorldIdType } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { LightEngineService } from './light-engine-service'
import { StorageServicePort } from '../domain/storage-service-port'
import { BiomeService } from './biome-service'
import { NoiseServicePort } from '../domain/noise-service-port'
import { TerrainWorkerPoolPort } from '@ts-minecraft/worker'
import { MAX_CACHED_CHUNKS } from './chunk-manager-constants'
import type { ChunkManagerError } from './chunk-manager-constants'
import type { ChunkCache } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'
import { loadChunksAroundPlayer } from './chunk-manager-service-load'
import { markChunkDirty } from './chunk-manager-service-dirty'
import { saveDirtyChunks } from './chunk-manager-service-save'
import { drainRenderDirtyChunkEntries, drainRenderDirtyChunks, getLoadedChunks } from './chunk-manager-service-read'
import type { ChunkLoadOptions } from './chunk-manager-service-model'
import type { Dimension } from '../domain/nether/nether-travel'
import { buildSetActiveDimension, buildSetActiveWorldId, emptyCacheState } from './chunk-manager-service-world-state'

export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants'
export type { ChunkManagerError } from './chunk-manager-constants'
export type { ChunkLoadOptions } from './chunk-manager-service-model'

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
      const setActiveDimension = buildSetActiveDimension(baseWorldIdRef, dimensionRef, resetCache)

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
        setActiveDimension,
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
