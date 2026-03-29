import { Array as Arr, Clock, Duration, Effect, HashMap, HashSet, Metric, MetricBoundaries, Option, Ref, Schema } from 'effect'
import { ChunkService, ChunkSchema, Chunk, ChunkCoord, blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { FLUID_BYTE_LENGTH, createFluidBuffer, hydrateLegacyFluidBufferFromBlocks } from '@/domain/fluid'
import { StorageServicePort } from '@/application/storage/storage-service-port'
import type { ChunkStorageValue } from '@/application/storage/storage-service-port'
import { Position, ChunkCacheKey } from '@/shared/kernel'
import { DEFAULT_WORLD_ID, SEA_LEVEL, LAKE_LEVEL } from '@/application/constants'
import { ChunkError, StorageError } from '@/domain/errors'
import { BiomeService } from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'

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

/**
 * Calculate distance squared between two chunk coordinates
 */
const chunkDistanceSquared = (a: ChunkCoord, b: ChunkCoord): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

/**
 * Convert world position to chunk coordinate
 */
const worldToChunkCoord = (pos: Position): ChunkCoord => ({
  x: Math.floor(pos.x / CHUNK_SIZE),
  z: Math.floor(pos.z / CHUNK_SIZE),
})

const getChunkLoadOffsets = (renderDistance: number): ReadonlyArray<readonly [number, number]> => {
  const offsets: Array<readonly [number, number, number]> = []

  for (let dx = -renderDistance; dx <= renderDistance; dx++) {
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      const distance = dx * dx + dz * dz
      if (distance <= renderDistance * renderDistance) {
        offsets.push([dx, dz, distance])
      }
    }
  }

  const sorted = offsets
    .sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1])
    .map(([dx, dz]) => [dx, dz] as const)

  return sorted
}

const countChunksInRadius = (radius: number): number => {
  let count = 0
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) {
        count++
      }
    }
  }
  return count
}

/**
 * Get all chunk coordinates within render distance of a center point
 * Uses a circular check for a nicer radius shape
 */
const getChunksInRenderDistance = (center: ChunkCoord, renderDistance: number): ReadonlyArray<ChunkCoord> => {
  return Arr.map(getChunkLoadOffsets(renderDistance), ([dx, dz]) => ({ x: center.x + dx, z: center.z + dz }))
}

/**
 * Create a unique key for chunk coordinate
 */
const chunkCoordToKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)

const normalizeFluidBuffer = (value: unknown): Uint8Array<ArrayBufferLike> => {
  if (value instanceof Uint8Array) {
    return value.byteLength === FLUID_BYTE_LENGTH ? value : createFluidBuffer()
  }
  return createFluidBuffer()
}

const normalizeChunkStorageValue = (stored: ChunkStorageValue): { blocks: Uint8Array<ArrayBufferLike>; fluid: Uint8Array<ArrayBufferLike> } => {
  if (stored instanceof Uint8Array) {
    return { blocks: stored, fluid: hydrateLegacyFluidBufferFromBlocks(stored, blockTypeToIndex('WATER')) }
  }

  return {
    blocks: stored.blocks,
    fluid: normalizeFluidBuffer(stored.fluid),
  }
}

/**
 * Histogram metric for chunk load duration (generation + storage load) in milliseconds.
 * Buckets: 20 linear buckets from 0ms to 1000ms (width=50ms each).
 */
const chunkLoadHistogram = Metric.histogram(
  'chunk_load_ms',
  MetricBoundaries.linear({ start: 0, width: 50, count: 20 }),
  'Chunk load duration in milliseconds'
)

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
 * Terrain generation constants
 */
const TERRAIN_SCALE = 0.02 // controls terrain frequency
const HEIGHT_VARIATION = 16 // ±16 from sea level

/** Noise frequency for lake basin generation (lower = larger, rounder lakes) */
const LAKE_NOISE_SCALE = 0.02
/** Noise threshold above which a column becomes a lake basin */
const LAKE_THRESHOLD = 0.70
/** Maximum depth of lake depression in blocks */
const LAKE_MAX_DEPTH = 18
/** Minimum water depth — prevents single-block shallow patches */
const LAKE_MIN_DEPTH = 10
/** Noise range below LAKE_THRESHOLD that becomes sandy shoreline */
const LAKE_SHORE_WIDTH = 0.04

/**
 * Calculate clamped surface height from a noise value and biome properties.
 *
 * Maps the 0-1 noise value to a block height using the biome's baseHeight and
 * heightModifier, then clamps to valid chunk bounds [1, CHUNK_HEIGHT-2].
 */
const calculateSurfaceHeight = (
  noiseVal: number,
  baseHeight: number,
  heightModifier: number,
  heightVariation: number
): number => {
  const terrainHeight = Math.floor(
    baseHeight + (noiseVal - 0.5) * heightVariation * 2 * heightModifier
  )
  return Math.max(1, Math.min(CHUNK_HEIGHT - 2, terrainHeight))
}

const chunkBlockIndexUnchecked = (x: number, y: number, z: number): number => y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE

/**
 * Fill a single vertical column of blocks up to surfaceY using biome block types.
 *
 * Block assignment (pure, no Effect overhead):
 *   y == surfaceY: biome surface block (GRASS, SAND, STONE, etc.)
 *   surfaceY-3 <= y < surfaceY: biome subsurface block (DIRT, SAND, etc.)
 *   y < surfaceY-3: STONE
 */
const fillColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  surfaceY: number,
  props: { surfaceBlockIndex: number; subSurfaceBlockIndex: number; stoneBlockIndex: number }
): void => {
  let idx = chunkBlockIndexUnchecked(lx, 0, lz)
  for (let y = 0; y <= surfaceY; y++, idx++) {
    blocks[idx] = y === surfaceY
      ? props.surfaceBlockIndex
      : y >= surfaceY - 3
        ? props.subSurfaceBlockIndex
        : props.stoneBlockIndex
  }
}

/**
 * Return true if a tree should be placed at this world column.
 *
 * Uses a deterministic sine-hash RNG so tree placement is reproducible across
 * chunk reloads. Returns the treeRng value as well so the caller can reuse it
 * for trunk-height calculation without recomputing the hash.
 */
const shouldPlaceTree = (
  treeDensity: number,
  surfaceY: number,
  wx: number,
  wz: number
): { place: boolean; treeRng: number } => {
  if (treeDensity <= 0 || surfaceY <= 5 || surfaceY >= CHUNK_HEIGHT - 10) {
    return { place: false, treeRng: 0 }
  }
  // Deterministic pseudo-random using world position
  const treeRng = Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453
  const treeProb = treeRng - Math.floor(treeRng)
  return { place: treeProb < treeDensity, treeRng }
}

/**
 * Place a tree (trunk + 3x3x3 leaf canopy) into the blocks array.
 *
 * Writes are cropped to chunk boundaries (no cross-chunk writes).
 * Leaves are only placed into AIR blocks to avoid overwriting solid terrain.
 */
const placeTree = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  surfaceY: number,
  treeRng: number
): void => {
  // Trunk height: 4-6 blocks, derived from the same RNG used for probability
  const trunkHeight = 4 + Math.floor((treeRng * 2) % 3)

  // Trunk — place straight up from one block above the surface
  let trunkIdx = chunkBlockIndexUnchecked(lx, surfaceY + 1, lz)
  for (let ty = surfaceY + 1; ty <= surfaceY + trunkHeight; ty++, trunkIdx++) {
    blocks[trunkIdx] = blockTypeToIndex('WOOD') // intentional direct write: pre-construction Uint8Array before Chunk is assembled
  }

  // Leaves: 3x3x3 canopy anchored at top of trunk, cropped at chunk boundary
  const leafBase = surfaceY + trunkHeight - 1
  for (let dy = 0; dy <= 2; dy++) {
    for (let dlx = -1; dlx <= 1; dlx++) {
      for (let dlz = -1; dlz <= 1; dlz++) {
        const lx2 = lx + dlx
        const lz2 = lz + dlz
        const ly = leafBase + dy
        if (lx2 < 0 || lx2 >= CHUNK_SIZE || lz2 < 0 || lz2 >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT) continue
        const idx = chunkBlockIndexUnchecked(lx2, ly, lz2)
        if (blocks[idx] === 0) blocks[idx] = blockTypeToIndex('LEAVES') // intentional direct write: pre-construction Uint8Array before Chunk is assembled
      }
    }
  }
}

/**
 * Generate terrain for a chunk using noise-based heightmap.
 *
 * Height range: 48-80 blocks (sea level 64)
 * Block assignment:
 *   y > height: AIR
 *   y == height: biome surface block (GRASS, SAND, STONE, etc.)
 *   height-1 >= y >= height-3: biome subsurface block (DIRT, SAND, etc.)
 *   y < height-3: STONE
 *   y == 0: STONE (bedrock-like)
 */
const generateTerrain = (
  chunkService: ChunkService,
  biomeService: BiomeService,
  noiseService: NoiseServicePort,
  coord: ChunkCoord
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    // Mutable blocks array for efficient generation
    const blocks = new Uint8Array(chunk.blocks)
    const columnCount = CHUNK_SIZE * CHUNK_SIZE
    const baseWorldX = coord.x * CHUNK_SIZE
    const baseWorldZ = coord.z * CHUNK_SIZE

    const terrainNoisePoints: Array<readonly [number, number]> = new Array(columnCount)
    const lakeNoisePoints: Array<readonly [number, number]> = new Array(columnCount)
    let noisePointIndex = 0
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = baseWorldX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const z = baseWorldZ + lz
        terrainNoisePoints[noisePointIndex] = [x * TERRAIN_SCALE, z * TERRAIN_SCALE]
        lakeNoisePoints[noisePointIndex] = [x * LAKE_NOISE_SCALE + 5000, z * LAKE_NOISE_SCALE + 5000]
        noisePointIndex++
      }
    }

    const [biomeColumns, terrainNoiseVals, lakeNoiseVals] = yield* Effect.all([
      biomeService.getBiomesAndPropertiesForChunk(coord.x, coord.z),
      noiseService.octaveNoise2DBatch(terrainNoisePoints, 4, 0.5, 2.0),
      noiseService.noise2DBatch(lakeNoisePoints),
    ], { concurrency: 'unbounded' })

    const stoneBlockIndex = blockTypeToIndex('STONE')
    const waterBlockIndex = blockTypeToIndex('WATER')
    const sandBlockIndex = blockTypeToIndex('SAND')

    let columnIndex = 0
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseWorldX + lx
        const wz = baseWorldZ + lz

        const { biome, props } = biomeColumns[columnIndex]!
        const surfaceBlockIndex = blockTypeToIndex(props.surfaceBlock)
        const subSurfaceBlockIndex = blockTypeToIndex(props.subSurfaceBlock)

        // Phase 2: Calculate surface height from noise
        const noiseVal = terrainNoiseVals[columnIndex]!
        const initialSurfaceY = calculateSurfaceHeight(noiseVal, props.baseHeight, props.heightModifier, HEIGHT_VARIATION)

        // Phase 2.5: Lake generation — lower surface to create a basin, fill with water later
        // lakeNoiseVal: only computed for non-OCEAN biomes (OCEAN uses 0, ensuring isShore = false)
        const lakeNoiseVal = biome !== 'OCEAN' ? lakeNoiseVals[columnIndex]! : 0

        // lakeBasin: Some(depressedY) = inland lake at that surface, None = no lake
        let lakeBasinY: number | null = null
        if (biome !== 'OCEAN' && lakeNoiseVal > LAKE_THRESHOLD && initialSurfaceY >= LAKE_LEVEL) {
          const t = (lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD)
          const lakeDepth = Math.max(LAKE_MIN_DEPTH, Math.floor(t * LAKE_MAX_DEPTH))
          const depressedY = Math.max(SEA_LEVEL + 1, initialSurfaceY - lakeDepth)
          // Only commit to lake if the depression actually reaches below the water line
          if (depressedY < LAKE_LEVEL) {
            lakeBasinY = depressedY
          }
        }
        const surfaceY = lakeBasinY ?? initialSurfaceY

        // Sandy shoreline: only near terrain low enough that lakes can form nearby
        const isShore = lakeBasinY === null && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH && surfaceY < LAKE_LEVEL + 4

        // Phase 3: Fill column blocks (inner loop — pure, no Effect overhead)
        fillColumn(
          blocks,
          lx,
          lz,
          surfaceY,
          lakeBasinY !== null
            ? { surfaceBlockIndex: sandBlockIndex, subSurfaceBlockIndex: sandBlockIndex, stoneBlockIndex }
            : isShore
              ? { surfaceBlockIndex: sandBlockIndex, subSurfaceBlockIndex, stoneBlockIndex }
              : { surfaceBlockIndex, subSurfaceBlockIndex, stoneBlockIndex },
        )

        // Phase 3.5: Water fill — ocean (below SEA_LEVEL) and inland lakes (below LAKE_LEVEL)
        if (surfaceY < SEA_LEVEL) {
          for (let y = surfaceY + 1; y <= SEA_LEVEL; y++) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex // intentional direct write: water fill during terrain generation
          }
        } else {
          if (lakeBasinY !== null) {
            for (let y = surfaceY + 1; y <= LAKE_LEVEL; y++) {
              blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex // intentional direct write: lake water fill during terrain generation
            }
          }
        }

        // Phase 4: Place trees (probability-based, pure)
        const { place, treeRng } = shouldPlaceTree(props.treeDensity, surfaceY, wx, wz)
        if (place && lakeBasinY === null) {
          placeTree(blocks, lx, lz, surfaceY, treeRng)
        }

        columnIndex++
      }
    }

    return { ...chunk, blocks }
  })

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
      const chunkService = yield* ChunkService
      const storageService = yield* StorageServicePort
      const biomeService = yield* BiomeService
      const noiseService = yield* NoiseServicePort

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
              // Generate new chunk via procedural terrain — track load duration
              const newChunk = yield* generateTerrain(chunkService, biomeService, noiseService, coord).pipe(
                Metric.trackDurationWith(chunkLoadHistogram, (d) => Duration.toMillis(d))
              )
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
                  const chunk: Chunk = { coord, blocks, fluid: Option.fromNullable(fluid) }
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

            // Load chunks in render distance — up to 4 concurrent fibers via semaphore
            yield* Effect.forEach(
              chunksToLoad,
              (coord) => loadSemaphore.withPermits(1)(getChunk(coord)),
              { concurrency: 'unbounded' }
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
         * Mark a chunk as dirty (modified, needs saving)
         */
        markChunkDirty: (coord: ChunkCoord): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkCoordToKey(coord)
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: HashSet.add(s.dirtyChunks, key),
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
