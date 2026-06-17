/**
 * chunk-manager-ops.ts
 *
 * Low-level cache operations for ChunkManagerService:
 *  - insertChunkWithEviction — atomic insert + evict + dirty-save
 *  - getChunk          — cache, then storage, then generation
 *  - unloadChunk       — save-if-dirty + remove from cache
 *
 * All functions receive their dependencies as parameters so they remain
 * pure Effect pipelines with no hidden module-level state.
 */

import { Duration, Effect, HashMap, HashSet, Metric, Option, Ref } from 'effect'
import { createFluidBuffer } from '@ts-minecraft/block'
import { computeMaxY, type Chunk } from '../domain/chunk'
import { ChunkCoord, type WorldId } from '@ts-minecraft/core'
import { StorageError } from '../domain/errors'
import type { StorageServicePort } from '../domain/storage-service-port'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { ChunkError } from '../domain/errors'
import type { NoiseServicePort } from '../domain/noise-service-port'
import type { TerrainWorkerPoolPort, TerrainGenerationError } from '@ts-minecraft/worker'
import { chunkLoadHistogram } from './terrain-generation'
import type { ChunkBlocks } from '@ts-minecraft/world'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { ChunkManagerError } from './chunk-manager-constants'
import { removeChunkFromCacheState, type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'
import type { LightEngineService } from './light-engine-service'
import type { Dimension } from '../domain/nether/nether-travel'
import { DEFAULT_TERRAIN_LEVELS, type TerrainLevels } from '../domain/terrain/generator-types'
import { insertChunkWithEviction } from './chunk-manager-ops-selection'
import { loadStoredChunk, saveChunkToStorage } from './chunk-manager-ops-storage'

// ---------------------------------------------------------------------------
// Types shared by helpers
// ---------------------------------------------------------------------------

export type ChunkOpsContext = {
  worldIdRef: Ref.Ref<WorldId>
  dimensionRef: Ref.Ref<Dimension>
  cache: Ref.Ref<ChunkCache>
  cachedLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  maxCachedChunksRef: Ref.Ref<number>
  accessCounterRef: Ref.Ref<number>
  storageService: StorageServicePort
  noiseService: NoiseServicePort
  terrainPool: TerrainWorkerPoolPort
  lightEngine: LightEngineService
}

const removeChunkFromCache = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey
): Effect.Effect<void, never> =>
  Ref.update(ctx.cache, (s) => removeChunkFromCacheState(s, key)).pipe(
    Effect.flatMap(() => Ref.set(ctx.cachedLoadedChunksRef, Option.none()))
  )

const insertWithEviction = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  chunk: Chunk
): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const worldId = yield* Ref.get(ctx.worldIdRef)
    const key = chunkCoordToWorldKey(coord, worldId)
    const maxCachedChunks = yield* Ref.get(ctx.maxCachedChunksRef)
    const accessOrder = yield* Ref.modify(ctx.accessCounterRef, (n) => [n + 1, n + 1])

    const evictedDirtyEntry = yield* Ref.modify(
      ctx.cache,
      (state): [Option.Option<ChunkCacheEntry>, ChunkCache] => {
        const result = insertChunkWithEviction(state, key, chunk, worldId, accessOrder, maxCachedChunks)
        return [result.evictedDirtyEntry, result.cache]
      }
    )

    const dirtyEntry = Option.getOrNull(evictedDirtyEntry)
    if (dirtyEntry !== null) {
      yield* ctx.storageService.saveChunk(dirtyEntry.worldId ?? worldId, dirtyEntry.chunk.coord, {
        blocks: dirtyEntry.chunk.blocks,
        fluid: Option.getOrElse(dirtyEntry.chunk.fluid, createFluidBuffer),
      })
    }

    yield* Ref.set(ctx.cachedLoadedChunksRef, Option.none())
  })

const generateChunk = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  terrainLevels: TerrainLevels,
  insert: (coord: ChunkCoord, chunk: Chunk) => Effect.Effect<void, StorageError>
): Effect.Effect<Chunk, ChunkManagerError> =>
  Effect.gen(function* () {
    const seed = yield* ctx.noiseService.getSeed
    const dimension = yield* Ref.get(ctx.dimensionRef)
    const generatedEffect = ctx.terrainPool
      .generateTerrain(coord, { ...terrainLevels, seed, dimension })
      .pipe(
        Effect.mapError(
          (err: TerrainGenerationError) =>
            new ChunkError({ chunkCoord: coord, reason: err.reason }),
        ),
        Metric.trackDurationWith(chunkLoadHistogram, (d) => Duration.toMillis(d)),
      ) as Effect.Effect<ChunkBlocks, ChunkManagerError>
    const generated = yield* generatedEffect
    const chunk: Chunk = {
      coord,
      blocks: generated.blocks,
      skyLight: generated.skyLight,
      blockLight: generated.blockLight,
      fluid: Option.none(),
      // FR-3.3: derived metadata for tighter frustum AABB; computed once at gen time.
      maxY: computeMaxY(generated.blocks),
    }
    yield* insert(coord, chunk)
    return chunk
  })

// ---------------------------------------------------------------------------
// getChunk  (cache → storage → generation)
// ---------------------------------------------------------------------------

/**
 * Retrieve a chunk by coord using a three-step strategy:
 *  1. In-memory LRU cache (O(1) HashMap lookup)
 *  2. IndexedDB storage (async IDB read)
 *  3. Terrain generation via TerrainWorkerPool (off-thread BFS + noise)
 *
 * This is the most performance-critical path — preserve its structure carefully.
 */
export const getChunk = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
): Effect.Effect<Chunk, ChunkManagerError> =>
  Effect.gen(function* () {
    const worldId = yield* Ref.get(ctx.worldIdRef)
    const key = chunkCoordToWorldKey(coord, worldId)
    const state = yield* Ref.get(ctx.cache)

      const cached = Option.getOrNull(HashMap.get(state.chunks, key))
      if (cached !== null) {
        const accessOrder = yield* Ref.modify(ctx.accessCounterRef, (n) => [n + 1, n + 1])
        cached.lastAccessed = accessOrder
        return cached.chunk
      }

      const storedChunk = yield* loadStoredChunk(ctx, worldId, coord)
      if (Option.isSome(storedChunk)) {
        const chunk = storedChunk.value
        yield* insertWithEviction(ctx, coord, chunk)
        return chunk
      }

      return yield* generateChunk(ctx, coord, terrainLevels, (coord, chunk) =>
        insertWithEviction(ctx, coord, chunk)
      )
    })

// ---------------------------------------------------------------------------
// unloadChunk
// ---------------------------------------------------------------------------

/**
 * Save a chunk to storage if it is dirty, then remove it from the in-memory cache.
 */
export const unloadChunk = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord
): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const worldId = yield* Ref.get(ctx.worldIdRef)
    const key = chunkCoordToWorldKey(coord, worldId)
    const state = yield* Ref.get(ctx.cache)
    const unloadEntry = Option.getOrNull(HashMap.get(state.chunks, key))
    if (unloadEntry === null) return

    if (HashSet.has(state.dirtyChunks, key)) {
      yield* saveChunkToStorage(ctx, worldId, unloadEntry)
    }
    yield* removeChunkFromCache(ctx, key)
  })
