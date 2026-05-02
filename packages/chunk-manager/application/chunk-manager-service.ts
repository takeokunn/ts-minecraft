import { Array as Arr, Clock, Duration, Effect, HashMap, HashSet, Metric, Option, Ref, Schema } from 'effect'
import { ChunkService, ChunkSchema, Chunk, ChunkCoord, blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { FLUID_BYTE_LENGTH, createFluidBuffer, hydrateLegacyFluidBufferFromBlocks } from '@ts-minecraft/domain'
import { LightEngineService } from '@ts-minecraft/light-engine'
import { StorageServicePort } from '@ts-minecraft/block-storage'
import type { ChunkStorageValue } from '@ts-minecraft/block-storage'
import { Position, ChunkCacheKey } from '@ts-minecraft/kernel'
import { DEFAULT_WORLD_ID, SEA_LEVEL, LAKE_LEVEL } from '@ts-minecraft/kernel'
import { ChunkError, StorageError } from '@ts-minecraft/domain'
import { BiomeService } from '@ts-minecraft/biome-classifier'
import { NoiseServicePort } from '@ts-minecraft/noise-generator'
import { TerrainWorkerPoolPort } from '@ts-minecraft/terrain-generator'
import { chunkLoadHistogram } from '@ts-minecraft/terrain-generator'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  getChunksInRenderDistance,
  countChunksInRadius,
  chunkCoordToKey,
} from '../domain/chunk-coord-utils'

/**
 * Render distance configuration
 * Circular radius of 8 chunks around player
 */
export const RENDER_DISTANCE = 8

/**
 * Unload distance configuration
 * Chunks beyond this radius are unloaded
 */
export const UNLOAD_DISTANCE = 10

/**
 * Maximum number of chunks to keep in LRU cache
 */
export const MAX_CACHED_CHUNKS = 400

/**
 * Combined error type for chunk operations
 */
export type ChunkManagerError = ChunkError | StorageError

const normalizeFluidBuffer = (value: unknown): Uint8Array<ArrayBufferLike> => {
  if (value instanceof Uint8Array) {
    return value.byteLength === FLUID_BYTE_LENGTH ? value : createFluidBuffer()
  }
  return createFluidBuffer()
}

const normalizeChunkStorageValue = (stored: ChunkStorageValue): { blocks: Uint8Array<ArrayBufferLike>; fluid: Uint8Array<ArrayBufferLike> } => {
  if (stored instanceof Uint8Array) {
    return { blocks: stored, fluid: hydrateLegacyFluidBufferFromBlocks(stored, blockTypeToIndex('WATER'), blockTypeToIndex('LAVA')) }
  }

  return {
    blocks: stored.blocks,
    fluid: normalizeFluidBuffer(stored.fluid),
  }
}

/**
 * LRU cache entry wrapping a chunk with its last access time.
 * lastAccessed is intentionally mutable for O(1) in-place LRU updates.
 */
const ChunkCacheEntrySchema = Schema.mutable(
  Schema.Struct({
    chunk: ChunkSchema,         // ChunkSchema defined in src/domain/chunk.ts
    lastAccessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),  // mutable for O(1) LRU in-place updates
  }),
)
type ChunkCacheEntry = Schema.Schema.Type<typeof ChunkCacheEntrySchema>

/**
 * Internal state for loaded chunks with LRU tracking
 *
 * FR-006 DEFERRED: Effect.Cache is architecturally incompatible with this LRU implementation.
 * Incompatibilities: (1) no onEvict callback for dirty-chunk persistence, (2) distance-based
 * eviction not supported, (3) dirty tracking atomicity broken by Cache's key-deduplication.
 * The current Phase 8 atomic LRU (HashMap + eviction loop) is correct and should be kept.
 *
 * HashMap/HashSet from Effect replace the native Map/Set:
 * - Immutable: no defensive copies needed in Ref.modify callbacks (eliminates TOCTOU risk)
 * - Value equality: structural equality for key lookup (no accidental reference bugs)
 */
type ChunkCache = {
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>
  dirtyChunks: HashSet.HashSet<ChunkCacheKey>
}

/**
 * ChunkManagerService class for chunk lifecycle management
 *
 * Handles loading, caching, and unloading of chunks based on player position.
 * Coordinates between ChunkService (creation), StorageService (persistence),
 * and TerrainService (procedural generation).
 */
export class ChunkManagerService extends Effect.Service<ChunkManagerService>()(
  '@minecraft/application/ChunkManagerService',
  {
    effect: Effect.gen(function* () {
      // ChunkService and BiomeService are still required at the layer boundary
      // (other services in the graph depend on them being provided alongside
      // ChunkManagerService) but the chunk-manager body itself no longer touches them
      // directly — terrain generation moved off-thread via TerrainWorkerPoolPort.
      yield* ChunkService
      const storageService = yield* StorageServicePort
      yield* BiomeService
      // NoiseServicePort exposes `getSeed` (the active world seed). Output remains
      // byte-identical because generateTerrainBlocks (in the worker pool's sync fallback
      // and in the worker itself) constructs the same NoisePrimitives from the same seed.
      const noiseService = yield* NoiseServicePort
      const terrainPool = yield* TerrainWorkerPoolPort
      const lightEngine = yield* LightEngineService

      // Compute and attach skyLight + blockLight grids onto a freshly-loaded or
      // freshly-generated chunk before it enters the cache. The mesher uses these
      // grids to emit per-vertex sky/block factors via vertex colors.
      const withLighting = (chunk: Chunk): Effect.Effect<Chunk, never> =>
        lightEngine.updateLight(chunk).pipe(
          Effect.map((grids) => ({ ...chunk, skyLight: grids.skyLight, blockLight: grids.blockLight }))
        )

      const cache = yield* Ref.make<ChunkCache>({
        chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
        dirtyChunks: HashSet.empty<ChunkCacheKey>(),
      })

      // Cache for getLoadedChunks result — invalidated whenever a chunk is inserted or removed.
      // Avoids allocating two arrays + N object refs on every frame at 60 Hz.
      const cachedLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
      const maxCachedChunksRef = yield* Ref.make(MAX_CACHED_CHUNKS)

      const lastLoadTimeRef = yield* Ref.make<number>(-200)

      // Monotonically incrementing counter for LRU access ordering.
      // Using a counter instead of wall-clock time guarantees strict uniqueness per access,
      // which avoids ties when multiple chunks are inserted within the same millisecond.
      // HashMap iteration order is hash-based (not insertion-ordered like native Map),
      // so ties in lastAccessed would produce non-deterministic LRU eviction — the counter fixes this.
      const accessCounterRef = yield* Ref.make<number>(0)

      // Semaphore limiting concurrent chunk generation/loading to 4 fibers at a time
      const loadSemaphore = yield* Effect.makeSemaphore(4)

      // Helper: find the LRU key in a chunks map (O(n) scan, fine at 400 items)
      const findLRUKey = (chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>): Option.Option<ChunkCacheKey> =>
        Arr.reduce(
          Arr.fromIterable(chunks),
          { keyOpt: Option.none<ChunkCacheKey>(), time: Infinity } satisfies { keyOpt: Option.Option<ChunkCacheKey>; time: number },
          (acc, [k, entry]) =>
            entry.lastAccessed < acc.time
              ? { keyOpt: Option.some(k), time: entry.lastAccessed }
              : acc
        ).keyOpt

      // Helper: insert a chunk into the cache, evicting the LRU entry if at capacity.
      // Uses Ref.modify to atomically insert + evict and return the evicted entry if dirty,
      // then saves it outside the modify (I/O cannot run inside a Ref.modify callback).
      // This eliminates the TOCTOU race where a pre-eviction save and the eviction step
      // could target different LRU keys when concurrent fibers modify the cache in between.
      const insertWithEviction = (
        coord: ChunkCoord,
        chunk: Chunk
      ): Effect.Effect<void, StorageError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const maxCachedChunks = yield* Ref.get(maxCachedChunksRef)
          // Use monotonically incrementing counter instead of wall-clock time.
          // Clock.currentTimeMillis can return the same value for multiple rapid insertions,
          // causing ties in lastAccessed. With HashMap (hash-ordered iteration), a tie produces
          // non-deterministic LRU selection. The counter guarantees strictly unique access order.
          const accessOrder = yield* Ref.modify(accessCounterRef, (n) => [n + 1, n + 1])

          // Atomically insert + evict LRU, returning the dirty evictee (if any) for post-save.
          // HashMap/HashSet are immutable — no defensive copies needed; modifications return new instances.
          const evictedDirtyEntry = yield* Ref.modify(cache, (s): [Option.Option<ChunkCacheEntry>, ChunkCache] => {
            const baseChunks = HashMap.set(s.chunks, key, { chunk, lastAccessed: accessOrder })

            if (HashMap.size(baseChunks) <= maxCachedChunks) {
              return [Option.none(), { ...s, chunks: baseChunks }]
            }

            return Option.match(findLRUKey(baseChunks), {
              onNone: () => {
                const result: [Option.Option<ChunkCacheEntry>, ChunkCache] = [Option.none<ChunkCacheEntry>(), { ...s, chunks: baseChunks }]
                return result
              },
              onSome: (evictKey) => {
                const evictEntryOpt = HashMap.get(baseChunks, evictKey)
                const isDirty = HashSet.has(s.dirtyChunks, evictKey)
                const newChunks = HashMap.remove(baseChunks, evictKey)
                const newDirty = HashSet.remove(s.dirtyChunks, evictKey)
                const evictedDirty = Option.filter(evictEntryOpt, () => isDirty)
                return [evictedDirty, { ...s, chunks: newChunks, dirtyChunks: newDirty }]
              },
            })
          })

          // Save the evicted chunk if it was dirty (I/O must happen outside Ref.modify)
          yield* Option.match(evictedDirtyEntry, {
            onNone: () => Effect.void,
            onSome: (evicted) =>
              storageService.saveChunk(DEFAULT_WORLD_ID, evicted.chunk.coord, {
                blocks: evicted.chunk.blocks,
                fluid: Option.getOrElse(evicted.chunk.fluid, createFluidBuffer),
              }),
          })

          // Invalidate getLoadedChunks cache: chunk set has changed
          yield* Ref.set(cachedLoadedChunksRef, Option.none())
        })

      const getChunk = (coord: ChunkCoord): Effect.Effect<Chunk, ChunkManagerError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const state = yield* Ref.get(cache)

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
              const seed = yield* noiseService.getSeed
              const generated = yield* terrainPool
                .generateTerrain(coord, { seaLevel: SEA_LEVEL, lakeLevel: LAKE_LEVEL, seed })
                .pipe(
                  Effect.mapError((err) => new ChunkError({ chunkCoord: coord, reason: err.reason })),
                  Metric.trackDurationWith(chunkLoadHistogram, (d) => Duration.toMillis(d)),
                )
              const newChunk: Chunk = {
                coord,
                blocks: generated.blocks,
                skyLight: generated.skyLight,
                blockLight: generated.blockLight,
                fluid: Option.none(),
              }
              yield* insertWithEviction(coord, newChunk)
              return newChunk
            })

          return yield* Option.match(HashMap.get(state.chunks, key), {
            onSome: (cached) => Effect.gen(function* () {
              // Return cached chunk, updating LRU access order
              const accessOrder = yield* Ref.modify(accessCounterRef, (n) => [n + 1, n + 1])
              cached.lastAccessed = accessOrder  // O(1) in-place update, safe in single-threaded JS
              return cached.chunk
            }),
            onNone: () => Effect.gen(function* () {
              // Try to load from storage — measured with chunkLoadHistogram
              const storedData = yield* storageService.loadChunk(DEFAULT_WORLD_ID, coord)
              return yield* Option.match(storedData, {
                onNone: () => generateAndInsert(),
                onSome: (stored) => Effect.gen(function* () {
                  const { blocks, fluid } = normalizeChunkStorageValue(stored)

                  const EXPECTED_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
                  if (blocks.byteLength !== EXPECTED_LENGTH) {
                    // Buffer length mismatch — discard and regenerate (corrupted or version-mismatched data)
                    yield* Effect.logWarning(`Chunk (${coord.x},${coord.z}) has invalid buffer length ${blocks.byteLength} (expected ${EXPECTED_LENGTH}); regenerating`)
                    return yield* generateAndInsert()
                  }
                  const baseChunk: Chunk = { coord, blocks, fluid: Option.fromNullable(fluid) }
                  // Compute lighting fresh on load — storage doesn't persist light grids;
                  // this avoids stale lighting after manual block edits between sessions.
                  const chunk = yield* withLighting(baseChunk)
                  yield* insertWithEviction(coord, chunk)
                  return chunk
                }),
              })
            }),
          })
        })

      const unloadChunk = (coord: ChunkCoord): Effect.Effect<void, StorageError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const state = yield* Ref.get(cache)
          yield* Option.match(Option.map(HashMap.get(state.chunks, key), (e) => e.chunk), {
            onNone: () => Effect.void,
            onSome: (chunk) => Effect.gen(function* () {
              // Save if dirty
              if (HashSet.has(state.dirtyChunks, key)) {
                yield* storageService.saveChunk(DEFAULT_WORLD_ID, chunk.coord, {
                  blocks: chunk.blocks,
                  fluid: Option.getOrElse(chunk.fluid, createFluidBuffer),
                })
              }
              // Remove from cache — HashMap/HashSet are immutable; remove returns new instance
              yield* Ref.update(cache, (s) => ({
                ...s,
                chunks: HashMap.remove(s.chunks, key),
                dirtyChunks: HashSet.remove(s.dirtyChunks, key),
              }))
              // Invalidate getLoadedChunks cache: chunk set has changed
              yield* Ref.set(cachedLoadedChunksRef, Option.none())
            }),
          })
        })

      return {
        /**
         * Get a chunk at the specified coordinate
         * Loads from storage, generates if needed, or returns cached
         */
        getChunk,

        /**
         * Load chunks around the player position within render distance
         * Unloads chunks outside render distance
         */
        loadChunksAroundPlayer: (playerPos: Position, renderDistance: number = RENDER_DISTANCE): Effect.Effect<boolean, ChunkManagerError> =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis

            // Throttle: atomic check-and-update so concurrent callers can't both pass the gate
            const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) =>
              now - last < 200 ? [false, last] : [true, now]
            )
            if (!shouldLoad) {
              return false
            }

            const centerChunk = worldToChunkCoord(playerPos)
            const chunkCacheCapacity = Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2))
            yield* Ref.update(maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity))
            const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance)

            // Load chunks in render distance — cap fan-out to the same 4 fibers as the semaphore.
            yield* Effect.forEach(
              chunksToLoad,
              (coord) => loadSemaphore.withPermits(1)(getChunk(coord)),
              { concurrency: 4 }
            )

            // Unload chunks outside the render radius plus a small buffer.
            const state = yield* Ref.get(cache)
            const unloadDistance = Math.max(renderDistance + 2, UNLOAD_DISTANCE)
            const maxDistance = unloadDistance * unloadDistance

            yield* Effect.forEach(
              Arr.filter(Arr.fromIterable(HashMap.values(state.chunks)), (entry) =>
                chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance
              ),
              (entry) => unloadChunk(entry.chunk.coord),
              { concurrency: 1 }
            )

            return true
          }),

        /**
         * Get all currently loaded chunks.
         * Result is cached and only recomputed when the chunk set changes (insert/remove).
         * Avoids allocating two arrays + N object refs on every frame at 60 Hz.
         */
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

        /**
         * Mark a chunk as dirty (modified, needs saving) and refresh its light grids.
         * Also marks the 8 neighboring chunks as dirty so the renderer re-meshes them —
         * lighting changes near chunk borders affect adjacent chunks (no cross-chunk BFS yet,
         * but corner sampling reaches one voxel into the AIR side which may be in a neighbor).
         */
        markChunkDirty: (coord: ChunkCoord): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkCoordToKey(coord)
            // Recompute lighting for the modified chunk in-place — the existing skyLight/blockLight
            // buffers are reused (lightBufferOrFresh checks byteLength) so no extra allocations.
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

            // Mark this chunk + 8 neighbors as dirty (renderer re-meshes from dirty set).
            const neighborOffsets: ReadonlyArray<readonly [number, number]> = [
              [0, 0],
              [-1, -1], [-1, 0], [-1, 1],
              [0, -1],           [0, 1],
              [1, -1],  [1, 0],  [1, 1],
            ]
            const allKeys = Arr.map(neighborOffsets, ([dx, dz]) =>
              chunkCoordToKey({ x: coord.x + dx, z: coord.z + dz })
            )
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: Arr.reduce(allKeys, s.dirtyChunks, (set, k) => HashSet.add(set, k)),
            }))
          }),

        /**
         * Save all dirty chunks to storage
         */
        saveDirtyChunks: (): Effect.Effect<void, StorageError> =>
          Effect.gen(function* () {
            // Snapshot the dirty key set — saves only these keys, not any new ones added
            // during the async save loop. Clears only the saved keys afterward so that
            // block modifications arriving mid-save are not silently discarded.
            // HashSet is immutable — holding a reference IS a snapshot (no defensive copy needed).
            const state = yield* Ref.get(cache)
            const keysToSave = state.dirtyChunks

            yield* Effect.forEach(
              Arr.filterMap(Arr.fromIterable(keysToSave), (key) => HashMap.get(state.chunks, key)),
              (entry) => storageService.saveChunk(DEFAULT_WORLD_ID, entry.chunk.coord, entry.chunk.blocks), // intentional: raw Uint8Array passed to storage serialization
              { concurrency: 1 }
            )

            // Clear only the keys we actually saved — preserves new dirty flags set during save.
            // HashSet.difference returns elements in s.dirtyChunks NOT in keysToSave.
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave),
            }))
          }),

        /**
         * Unload a specific chunk (saves if dirty first)
         */
        unloadChunk,
      }
    }),
  }
) {}
export const ChunkManagerServiceLive = ChunkManagerService.Default
