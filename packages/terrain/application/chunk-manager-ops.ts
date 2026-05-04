/**
 * chunk-manager-ops.ts
 *
 * Low-level cache operations for ChunkManagerService:
 *  - findLRUKey        — O(n) LRU key scan
 *  - insertWithEviction — atomic insert + evict + dirty-save
 *  - getChunk          — 3-tier fallback: cache → storage → generation
 *  - unloadChunk       — save-if-dirty + remove from cache
 *
 * All functions receive their dependencies as parameters so they remain
 * pure Effect pipelines with no hidden module-level state.
 */

import { Array as Arr, Duration, Effect, HashMap, HashSet, Metric, Option, Ref } from 'effect'
import type { Chunk } from '../domain/chunk'
import { ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { createFluidBuffer, StorageError } from '@ts-minecraft/world-state'
import type { StorageServicePort } from '../domain/storage-service-port'
import { ChunkCacheKey, DEFAULT_WORLD_ID, SEA_LEVEL, LAKE_LEVEL } from '@ts-minecraft/kernel'
import { ChunkError } from '../domain/errors'
import type { NoiseServicePort } from '../domain/noise-service-port'
import type { TerrainWorkerPoolPort, TerrainGenerationError } from './terrain-worker-pool-port'
import { chunkLoadHistogram } from '../domain/terrain/generator'
import { chunkCoordToKey } from '../domain/chunk-coord-utils'
import type { ChunkManagerError } from './chunk-manager-constants'
import { storedChunkPayload, type ChunkCacheEntry, type ChunkCache } from './chunk-manager-cache'
import type { LightEngineService, LightGrids } from './light-engine-service'

// ---------------------------------------------------------------------------
// Types shared by helpers
// ---------------------------------------------------------------------------

export type ChunkOpsContext = {
  cache: Ref.Ref<ChunkCache>
  cachedLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  maxCachedChunksRef: Ref.Ref<number>
  accessCounterRef: Ref.Ref<number>
  storageService: StorageServicePort
  noiseService: NoiseServicePort
  terrainPool: TerrainWorkerPoolPort
  lightEngine: LightEngineService
}

// ---------------------------------------------------------------------------
// findLRUKey
// ---------------------------------------------------------------------------

/**
 * Find the LRU key in a chunks map (O(n) scan, fine at ≤400 items).
 * Uses a monotonically incrementing counter (not wall-clock) to guarantee
 * strict uniqueness per access — HashMap iteration is hash-ordered (not
 * insertion-ordered) so ties in lastAccessed produce non-deterministic eviction.
 */
export const findLRUKey = (
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>
): Option.Option<ChunkCacheKey> =>
  Arr.reduce(
    Arr.fromIterable(chunks),
    { keyOpt: Option.none<ChunkCacheKey>(), time: Infinity } satisfies {
      keyOpt: Option.Option<ChunkCacheKey>
      time: number
    },
    (acc, [k, entry]) =>
      entry.lastAccessed < acc.time
        ? { keyOpt: Option.some(k), time: entry.lastAccessed }
        : acc
  ).keyOpt

// ---------------------------------------------------------------------------
// insertWithEviction
// ---------------------------------------------------------------------------

/**
 * Atomically insert a chunk into the cache, evicting the LRU entry when at
 * capacity, then saving the evicted entry if it was dirty.
 *
 * The Ref.modify step combines insert + evict atomically so that concurrent
 * fibers cannot race on different LRU keys.  I/O (the save) happens outside
 * the modify callback.
 */
export const insertWithEviction = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  chunk: Chunk
): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const key = chunkCoordToKey(coord)
    const maxCachedChunks = yield* Ref.get(ctx.maxCachedChunksRef)
    // Use monotonically incrementing counter instead of wall-clock time.
    // Clock.currentTimeMillis can return the same value for multiple rapid insertions,
    // causing ties in lastAccessed. With HashMap (hash-ordered iteration), a tie produces
    // non-deterministic LRU selection. The counter guarantees strictly unique access order.
    const accessOrder = yield* Ref.modify(ctx.accessCounterRef, (n) => [n + 1, n + 1])

    // Atomically insert + evict LRU, returning the dirty evictee (if any) for post-save.
    // HashMap/HashSet are immutable — no defensive copies needed; modifications return new instances.
    const evictedDirtyEntry = yield* Ref.modify(
      ctx.cache,
      (s): [Option.Option<ChunkCacheEntry>, ChunkCache] => {
        const baseChunks = HashMap.set(s.chunks, key, { chunk, lastAccessed: accessOrder })

        if (HashMap.size(baseChunks) <= maxCachedChunks) {
          return [Option.none(), { ...s, chunks: baseChunks }]
        }

        const evictKey = Option.getOrThrow(findLRUKey(baseChunks))
        const evictEntryOpt = HashMap.get(baseChunks, evictKey)
        const isDirty = HashSet.has(s.dirtyChunks, evictKey)
        const newChunks = HashMap.remove(baseChunks, evictKey)
        const newDirty = HashSet.remove(s.dirtyChunks, evictKey)
        const evictedDirty = Option.filter(evictEntryOpt, () => isDirty)
        return [evictedDirty, { ...s, chunks: newChunks, dirtyChunks: newDirty }]
      }
    )

    // Save the evicted chunk if it was dirty (I/O must happen outside Ref.modify)
    yield* Option.match(evictedDirtyEntry, {
      onNone: () => Effect.void,
      onSome: (evicted) =>
        ctx.storageService.saveChunk(DEFAULT_WORLD_ID, evicted.chunk.coord, {
          blocks: evicted.chunk.blocks,
          fluid: Option.getOrElse(evicted.chunk.fluid, createFluidBuffer),
        }),
    })

    // Invalidate getLoadedChunks cache: chunk set has changed
    yield* Ref.set(ctx.cachedLoadedChunksRef, Option.none())
  })

// ---------------------------------------------------------------------------
// getChunk  (3-tier: cache → storage → generation)
// ---------------------------------------------------------------------------

/**
 * Retrieve a chunk by coord using a 3-tier fallback strategy:
 *  1. In-memory LRU cache (O(1) HashMap lookup)
 *  2. IndexedDB storage (async IDB read)
 *  3. Terrain generation via TerrainWorkerPool (off-thread BFS + noise)
 *
 * This is the most performance-critical path — preserve its structure carefully.
 */
export const getChunk = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord
): Effect.Effect<Chunk, ChunkManagerError> =>
  Effect.gen(function* () {
    const key = chunkCoordToKey(coord)
    const state = yield* Ref.get(ctx.cache)

    const generateAndInsert = (): Effect.Effect<Chunk, ChunkManagerError> =>
      Effect.gen(function* () {
        // Generate new chunk off-main-thread via TerrainWorkerPoolPort — falls back to
        // synchronous generation when Worker is unavailable (Node.js / Vitest).
        // Output is byte-identical to the previous main-thread generateTerrain call
        // (proved by terrain-worker-pool.parity.property.test.ts).
        //
        // The worker now also runs the full sky+block-light BFS (see
        // `terrain-generation.computeInitialLightGrids`), so we adopt the
        // returned `skyLight`/`blockLight` directly — no `withLighting` call
        // here. That moves ~0.6-1.25s of main-thread BFS at RD=2 cold-start
        // onto the worker fibers.
        const seed = yield* ctx.noiseService.getSeed
        const generated = yield* ctx.terrainPool
          .generateTerrain(coord, { seaLevel: SEA_LEVEL, lakeLevel: LAKE_LEVEL, seed })
          .pipe(
            Effect.mapError(
              (err: TerrainGenerationError) =>
                new ChunkError({ chunkCoord: coord, reason: err.reason })
            ),
            Metric.trackDurationWith(chunkLoadHistogram, (d) => Duration.toMillis(d))
          )
        const newChunk: Chunk = {
          coord,
          blocks: generated.blocks,
          skyLight: generated.skyLight,
          blockLight: generated.blockLight,
          fluid: Option.none(),
        }
        yield* insertWithEviction(ctx, coord, newChunk)
        return newChunk
      })

    return yield* Option.match(HashMap.get(state.chunks, key), {
      onSome: (cached) =>
        Effect.gen(function* () {
          // Return cached chunk, updating LRU access order
          const accessOrder = yield* Ref.modify(ctx.accessCounterRef, (n) => [n + 1, n + 1])
          cached.lastAccessed = accessOrder // O(1) in-place update, safe in single-threaded JS
          return cached.chunk
        }),
      onNone: () =>
        Effect.gen(function* () {
          // Try to load from storage — measured with chunkLoadHistogram
          const storedData = yield* ctx.storageService.loadChunk(DEFAULT_WORLD_ID, coord)
          return yield* Option.match(storedData, {
            onNone: () => generateAndInsert(),
            onSome: (stored) =>
              Effect.gen(function* () {
                const { blocks, fluid } = storedChunkPayload(stored)

                const EXPECTED_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
                if (blocks.byteLength !== EXPECTED_LENGTH) {
                  // Buffer length mismatch — discard and regenerate (corrupted or version-mismatched data)
                  yield* Effect.logWarning(
                    `Chunk (${coord.x},${coord.z}) has invalid buffer length ${blocks.byteLength} (expected ${EXPECTED_LENGTH}); regenerating`
                  )
                  return yield* generateAndInsert()
                }
                const baseChunk: Chunk = { coord, blocks, fluid: Option.fromNullable(fluid) }
                // Compute lighting fresh on load — storage doesn't persist light grids;
                // this avoids stale lighting after manual block edits between sessions.
                const grids: LightGrids = yield* ctx.lightEngine.updateLight(baseChunk)
                const chunk: Chunk = { ...baseChunk, skyLight: grids.skyLight, blockLight: grids.blockLight }
                yield* insertWithEviction(ctx, coord, chunk)
                return chunk
              }),
          })
        }),
    })
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
    const key = chunkCoordToKey(coord)
    const state = yield* Ref.get(ctx.cache)
    yield* Option.match(Option.map(HashMap.get(state.chunks, key), (e) => e.chunk), {
      onNone: () => Effect.void,
      onSome: (chunk) =>
        Effect.gen(function* () {
          // Save if dirty
          if (HashSet.has(state.dirtyChunks, key)) {
            yield* ctx.storageService.saveChunk(DEFAULT_WORLD_ID, chunk.coord, {
              blocks: chunk.blocks,
              fluid: Option.getOrElse(chunk.fluid, createFluidBuffer),
            })
          }
          // Remove from cache — HashMap/HashSet are immutable; remove returns new instance
          yield* Ref.update(ctx.cache, (s) => ({
            ...s,
            chunks: HashMap.remove(s.chunks, key),
            dirtyChunks: HashSet.remove(s.dirtyChunks, key),
          }))
          // Invalidate getLoadedChunks cache: chunk set has changed
          yield* Ref.set(ctx.cachedLoadedChunksRef, Option.none())
        }),
    })
  })
