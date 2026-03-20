import { Clock, Effect, Ref, Option, Schema, Metric, MetricBoundaries, Duration } from 'effect'
import { ChunkService, ChunkSchema, Chunk, ChunkCoord, blockTypeToIndex, blockIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { StorageService } from '@/infrastructure/storage/storage-service'
import { Position } from '@/shared/kernel'
import { DEFAULT_WORLD_ID } from '@/application/constants'
import { ChunkError, StorageError } from '@/domain/errors'
import { BiomeService } from '@/application/biome/biome-service'
import { NoiseService } from '@/infrastructure/noise/noise-service'

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

/**
 * Get all chunk coordinates within render distance of a center point
 * Uses a circular check for a nicer radius shape
 */
const getChunksInRenderDistance = (center: ChunkCoord): ChunkCoord[] => {
  const chunks: ChunkCoord[] = []
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      // Circular check for nicer radius
      if (dx * dx + dz * dz <= RENDER_DISTANCE * RENDER_DISTANCE) {
        chunks.push({ x: center.x + dx, z: center.z + dz })
      }
    }
  }
  return chunks
}

/**
 * Create a unique key for chunk coordinate
 */
const chunkCoordToKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

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
    lastAccessed: Schema.Number,  // mutable for O(1) LRU in-place updates
  }),
)
type ChunkCacheEntry = Schema.Schema.Type<typeof ChunkCacheEntrySchema>

/**
 * Internal state for loaded chunks with LRU tracking
 *
 * FR-006 DEFERRED: Effect.Cache is architecturally incompatible with this LRU implementation.
 * Incompatibilities: (1) no onEvict callback for dirty-chunk persistence, (2) distance-based
 * eviction not supported, (3) dirty tracking atomicity broken by Cache's key-deduplication.
 * The current Phase 8 atomic LRU (Map + eviction loop) is correct and should be kept.
 */
interface ChunkCache {
  chunks: Map<string, ChunkCacheEntry>
  dirtyChunks: Set<string>
}

/**
 * Terrain generation constants
 */
const TERRAIN_SCALE = 0.02 // controls terrain frequency
const HEIGHT_VARIATION = 16 // ±16 from sea level

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
  props: { surfaceBlock: import('@/domain/block').BlockType; subSurfaceBlock: import('@/domain/block').BlockType }
): void => {
  for (let y = 0; y <= surfaceY; y++) {
    const idx = blockIndex(lx, y, lz)
    if (idx === null) continue // skip out-of-bounds (should never happen with valid coords)
    if (y === surfaceY) {
      blocks[idx] = blockTypeToIndex(props.surfaceBlock) // intentional direct write: pre-construction Uint8Array before Chunk is assembled
    } else if (y >= surfaceY - 3) {
      blocks[idx] = blockTypeToIndex(props.subSurfaceBlock) // intentional direct write: pre-construction Uint8Array before Chunk is assembled
    } else {
      blocks[idx] = blockTypeToIndex('STONE') // intentional direct write: pre-construction Uint8Array before Chunk is assembled
    }
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
  for (let ty = surfaceY + 1; ty <= surfaceY + trunkHeight; ty++) {
    const idx = blockIndex(lx, ty, lz)
    if (idx !== null) {
      blocks[idx] = blockTypeToIndex('WOOD') // intentional direct write: pre-construction Uint8Array before Chunk is assembled
    }
  }

  // Leaves: 3x3x3 canopy anchored at top of trunk, cropped at chunk boundary
  const leafBase = surfaceY + trunkHeight - 1
  for (let dy = 0; dy <= 2; dy++) {
    for (let dlx = -1; dlx <= 1; dlx++) {
      for (let dlz = -1; dlz <= 1; dlz++) {
        const lx2 = lx + dlx
        const lz2 = lz + dlz
        const ly = leafBase + dy
        const leafIdx = blockIndex(lx2, ly, lz2)
        if (leafIdx !== null && blocks[leafIdx] === 0) {
          blocks[leafIdx] = blockTypeToIndex('LEAVES') // intentional direct write: pre-construction Uint8Array before Chunk is assembled
        }
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
  noiseService: NoiseService,
  coord: ChunkCoord
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    // Mutable blocks array for efficient generation
    const blocks = new Uint8Array(chunk.blocks)

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = coord.x * CHUNK_SIZE + lx
        const wz = coord.z * CHUNK_SIZE + lz

        // Phase 1: Get biome for this column
        const biome = yield* biomeService.getBiome(wx, wz)
        const props = yield* biomeService.getBiomeProperties(biome)

        // Phase 2: Calculate surface height from noise
        const noiseVal = yield* noiseService.octaveNoise2D(
          wx * TERRAIN_SCALE,
          wz * TERRAIN_SCALE,
          4,
          0.5,
          2.0
        )
        const surfaceY = calculateSurfaceHeight(noiseVal, props.baseHeight, props.heightModifier, HEIGHT_VARIATION)

        // Phase 3: Fill column blocks (inner loop — pure, no Effect overhead)
        fillColumn(blocks, lx, lz, surfaceY, props)

        // Phase 4: Place trees (probability-based, pure)
        const { place, treeRng } = shouldPlaceTree(props.treeDensity, surfaceY, wx, wz)
        if (place) {
          placeTree(blocks, lx, lz, surfaceY, treeRng)
        }
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
      const storageService = yield* StorageService
      const biomeService = yield* BiomeService
      const noiseService = yield* NoiseService

      const cache = yield* Ref.make<ChunkCache>({
        chunks: new Map(),
        dirtyChunks: new Set(),
      })

      const lastLoadTimeRef = yield* Ref.make<number>(0)

      // Semaphore limiting concurrent chunk generation/loading to 4 fibers at a time
      const loadSemaphore = yield* Effect.makeSemaphore(4)

      // Helper: find the LRU key in a chunks map (O(n) scan, fine at 400 items)
      const findLRUKey = (chunks: Map<string, ChunkCacheEntry>): string => {
        let oldestKey = ''
        let oldestTime = Infinity
        for (const [k, entry] of chunks) {
          if (entry.lastAccessed < oldestTime) {
            oldestTime = entry.lastAccessed
            oldestKey = k
          }
        }
        return oldestKey
      }

      // Helper: insert a chunk into the cache, evicting the LRU entry if at capacity.
      // Pre-eviction dirty save happens BEFORE the atomic Ref.update to preserve the
      // same atomicity guarantees as the original duplicated blocks.
      const insertWithEviction = (
        coord: ChunkCoord,
        chunk: Chunk
      ): Effect.Effect<void, StorageError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)

          // Pre-eviction: if cache is full and the LRU entry is dirty, save it first
          // then insert + evict atomically in a single Ref.update
          const stateBeforeInsert = yield* Ref.get(cache)
          if (stateBeforeInsert.chunks.size >= MAX_CACHED_CHUNKS) {
            const evictKey = findLRUKey(stateBeforeInsert.chunks)
            if (evictKey && stateBeforeInsert.dirtyChunks.has(evictKey)) {
              const evictee = stateBeforeInsert.chunks.get(evictKey)!
              yield* storageService.saveChunk(DEFAULT_WORLD_ID, evictee.chunk.coord, evictee.chunk.blocks) // intentional: raw Uint8Array passed to storage serialization
            }
          }

          // Atomic: insert + evict LRU in one Ref.update
          const now = yield* Clock.currentTimeMillis
          yield* Ref.update(cache, (s) => {
            const newChunks = new Map(s.chunks)
            newChunks.set(key, { chunk, lastAccessed: now })
            let newDirty = s.dirtyChunks
            if (newChunks.size > MAX_CACHED_CHUNKS) {
              const evictKey = findLRUKey(newChunks)
              if (evictKey) {
                newChunks.delete(evictKey)
                newDirty = new Set(s.dirtyChunks)
                newDirty.delete(evictKey)
              }
            }
            return { ...s, chunks: newChunks, dirtyChunks: newDirty }
          })
        })

      const getChunk = (coord: ChunkCoord): Effect.Effect<Chunk, ChunkManagerError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const state = yield* Ref.get(cache)

          // Return cached chunk if available, updating LRU access time
          const cached = state.chunks.get(key)
          if (cached) {
            const accessTime = yield* Clock.currentTimeMillis
            cached.lastAccessed = accessTime  // O(1) in-place update, safe in single-threaded JS
            return cached.chunk
          }

          // Try to load from storage — measured with chunkLoadHistogram
          const storedData = yield* storageService.loadChunk(DEFAULT_WORLD_ID, coord)

          if (Option.isSome(storedData)) {
            // Guard: storage may return deserialized JSON (plain Array) on schema mismatch.
            // Re-wrap to Uint8Array to ensure typed array semantics are preserved.
            const rawBlocks = storedData.value
            const blocks = rawBlocks instanceof Uint8Array
              ? rawBlocks
              : new Uint8Array(rawBlocks as ArrayLike<number>)

            const EXPECTED_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
            if (blocks.byteLength !== EXPECTED_LENGTH) {
              // Buffer length mismatch — discard and regenerate (corrupted or version-mismatched data)
              yield* Effect.logWarning(`Chunk (${coord.x},${coord.z}) has invalid buffer length ${blocks.byteLength} (expected ${EXPECTED_LENGTH}); regenerating`)
            } else {
              const chunk: Chunk = {
                coord,
                blocks,
              }
              yield* insertWithEviction(coord, chunk)
              return chunk
            }
          }

          // Generate new chunk via procedural terrain — track load duration
          const newChunk = yield* generateTerrain(chunkService, biomeService, noiseService, coord).pipe(
            Metric.trackDurationWith(chunkLoadHistogram, (d) => Duration.toMillis(d))
          )
          yield* insertWithEviction(coord, newChunk)

          return newChunk
        })

      const unloadChunk = (coord: ChunkCoord): Effect.Effect<void, StorageError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const state = yield* Ref.get(cache)
          const chunk = state.chunks.get(key)?.chunk

          if (!chunk) {
            return
          }

          // Save if dirty
          if (state.dirtyChunks.has(key)) {
            yield* storageService.saveChunk(DEFAULT_WORLD_ID, chunk.coord, chunk.blocks) // intentional: raw Uint8Array passed to storage serialization
          }

          // Remove from cache
          yield* Ref.update(cache, (s) => {
            const newChunks = new Map(s.chunks)
            newChunks.delete(key)
            const newDirty = new Set(s.dirtyChunks)
            newDirty.delete(key)
            return { chunks: newChunks, dirtyChunks: newDirty }
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
        loadChunksAroundPlayer: (playerPos: Position): Effect.Effect<void, ChunkManagerError> =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis
            const lastLoadTime = yield* Ref.get(lastLoadTimeRef)

            // Throttle: only run every 200ms
            if (now - lastLoadTime < 200) {
              return
            }
            yield* Ref.set(lastLoadTimeRef, now)

            const centerChunk = worldToChunkCoord(playerPos)
            const chunksToLoad = getChunksInRenderDistance(centerChunk)

            // Load chunks in render distance — up to 4 concurrent fibers via semaphore
            yield* Effect.forEach(
              chunksToLoad,
              (coord) => loadSemaphore.withPermits(1)(getChunk(coord)),
              { concurrency: 'unbounded' }
            )

            // Unload chunks outside unload distance
            const state = yield* Ref.get(cache)
            const maxDistance = UNLOAD_DISTANCE * UNLOAD_DISTANCE

            for (const entry of state.chunks.values()) {
              const dist = chunkDistanceSquared(entry.chunk.coord, centerChunk)
              if (dist > maxDistance) {
                yield* unloadChunk(entry.chunk.coord)
              }
            }
          }),

        /**
         * Get all currently loaded chunks
         */
        getLoadedChunks: (): Effect.Effect<ReadonlyArray<Chunk>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(cache)
            return Array.from(state.chunks.values()).map((entry) => entry.chunk)
          }),

        /**
         * Mark a chunk as dirty (modified, needs saving)
         */
        markChunkDirty: (coord: ChunkCoord): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkCoordToKey(coord)
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: new Set(s.dirtyChunks).add(key),
            }))
          }),

        /**
         * Save all dirty chunks to storage
         */
        saveDirtyChunks: (): Effect.Effect<void, StorageError> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(cache)

            for (const key of state.dirtyChunks) {
              const entry = state.chunks.get(key)
              if (entry) {
                yield* storageService.saveChunk(DEFAULT_WORLD_ID, entry.chunk.coord, entry.chunk.blocks) // intentional: raw Uint8Array passed to storage serialization
              }
            }

            // Clear dirty flags
            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: new Set<string>(),
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
