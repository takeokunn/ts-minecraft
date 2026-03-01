import { Effect, Ref, Option } from 'effect'
import { ChunkService, Chunk, ChunkCoord, blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { StorageService } from '@/infrastructure/storage/storage-service'
import { Position, WorldIdSchema } from '@/shared/kernel'
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
 * Evict the least-recently-used entry from the chunks map if over capacity.
 * Mutates the provided Map in-place.
 */
const evictLRUIfNeeded = (chunks: Map<string, ChunkCacheEntry>): void => {
  if (chunks.size <= MAX_CACHED_CHUNKS) return
  let oldestKey = ''
  let oldestTime = Infinity
  for (const [k, entry] of chunks) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed
      oldestKey = k
    }
  }
  if (oldestKey) chunks.delete(oldestKey)
}

/**
 * Default world ID
 */
const DEFAULT_WORLD_ID = WorldIdSchema.make('default')

/**
 * LRU cache entry wrapping a chunk with its last access time.
 * lastAccessed is intentionally mutable for O(1) in-place LRU updates.
 */
interface ChunkCacheEntry {
  chunk: Chunk
  lastAccessed: number  // mutable for LRU update performance
}

/**
 * Internal state for loaded chunks with LRU tracking
 */
interface ChunkCache {
  chunks: Map<string, ChunkCacheEntry>
  dirtyChunks: Set<string>
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

    const TERRAIN_SCALE = 0.02 // controls terrain frequency
    const HEIGHT_VARIATION = 16 // ±16 from sea level

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = coord.x * CHUNK_SIZE + lx
        const wz = coord.z * CHUNK_SIZE + lz

        // Get biome for this column
        const biome = yield* biomeService.getBiome(wx, wz)
        const props = biomeService.getBiomeProperties(biome)

        // Heightmap: octave noise → height
        const noiseVal = noiseService.octaveNoise2D(
          wx * TERRAIN_SCALE,
          wz * TERRAIN_SCALE,
          4,
          0.5,
          2.0
        )
        // noiseVal is 0-1, map to height range with biome modifier
        const terrainHeight = Math.floor(
          props.baseHeight + (noiseVal - 0.5) * HEIGHT_VARIATION * 2 * props.heightModifier
        )
        const height = Math.max(1, Math.min(CHUNK_HEIGHT - 2, terrainHeight))

        // Fill blocks column
        for (let y = 0; y <= height; y++) {
          const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
          if (y === height) {
            blocks[idx] = blockTypeToIndex(props.surfaceBlock)
          } else if (y >= height - 3) {
            blocks[idx] = blockTypeToIndex(props.subSurfaceBlock)
          } else {
            blocks[idx] = blockTypeToIndex('STONE')
          }
        }

        // Simple tree generation based on biome tree density
        if (props.treeDensity > 0 && height > 5 && height < CHUNK_HEIGHT - 10) {
          // Deterministic pseudo-random using position
          const treeRng = Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453
          const treeProb = treeRng - Math.floor(treeRng)

          if (treeProb < props.treeDensity) {
            // Place tree: trunk (4-6 blocks) + leaves (3x3x3 canopy)
            const trunkHeight = 4 + Math.floor((treeRng * 2) % 3)

            // Trunk
            for (let ty = height + 1; ty <= height + trunkHeight; ty++) {
              if (ty < CHUNK_HEIGHT) {
                const idx = ty + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                blocks[idx] = blockTypeToIndex('WOOD')
              }
            }

            // Leaves (3x3x3 around top of trunk, cropped at chunk boundary)
            const leafBase = height + trunkHeight - 1
            for (let dy = 0; dy <= 2; dy++) {
              for (let dlx = -1; dlx <= 1; dlx++) {
                for (let dlz = -1; dlz <= 1; dlz++) {
                  const lx2 = lx + dlx
                  const lz2 = lz + dlz
                  const ly = leafBase + dy
                  // Crop at chunk boundary (no cross-chunk writes)
                  if (lx2 >= 0 && lx2 < CHUNK_SIZE && lz2 >= 0 && lz2 < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                    const leafIdx = ly + lz2 * CHUNK_HEIGHT + lx2 * CHUNK_HEIGHT * CHUNK_SIZE
                    // Only place leaves if block is AIR
                    if (blocks[leafIdx] === 0) {
                      blocks[leafIdx] = blockTypeToIndex('LEAVES')
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return { ...chunk, blocks, dirty: false }
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

      const getChunk = (coord: ChunkCoord): Effect.Effect<Chunk, ChunkManagerError> =>
        Effect.gen(function* () {
          const key = chunkCoordToKey(coord)
          const state = yield* Ref.get(cache)

          // Return cached chunk if available, updating LRU access time
          const cached = state.chunks.get(key)
          if (cached) {
            cached.lastAccessed = Date.now()  // O(1) in-place update, safe in single-threaded JS
            return cached.chunk
          }

          // Try to load from storage
          const storedData = yield* storageService.loadChunk(DEFAULT_WORLD_ID, coord)

          if (Option.isSome(storedData)) {
            // Reconstruct chunk from stored data
            const chunk: Chunk = {
              coord,
              blocks: storedData.value,
              dirty: false,
            }

            // Pre-eviction: if cache is full and the LRU entry is dirty, save it first
            const stateBeforeInsert = yield* Ref.get(cache)
            if (stateBeforeInsert.chunks.size >= MAX_CACHED_CHUNKS) {
              let oldestKey = ''
              let oldestTime = Infinity
              for (const [k, entry] of stateBeforeInsert.chunks) {
                if (entry.lastAccessed < oldestTime) {
                  oldestTime = entry.lastAccessed
                  oldestKey = k
                }
              }
              if (oldestKey && stateBeforeInsert.dirtyChunks.has(oldestKey)) {
                const evictee = stateBeforeInsert.chunks.get(oldestKey)!
                yield* storageService.saveChunk(DEFAULT_WORLD_ID, evictee.chunk.coord, evictee.chunk.blocks)
              }
            }

            yield* Ref.update(cache, (s) => {
              const newChunks = new Map(s.chunks)
              newChunks.set(key, { chunk, lastAccessed: Date.now() })
              evictLRUIfNeeded(newChunks)
              return { ...s, chunks: newChunks }
            })
            return chunk
          }

          // Generate new chunk via procedural terrain
          const newChunk = yield* generateTerrain(chunkService, biomeService, noiseService, coord)

          // Pre-eviction: if cache is full and the LRU entry is dirty, save it first
          const stateBeforeGenInsert = yield* Ref.get(cache)
          if (stateBeforeGenInsert.chunks.size >= MAX_CACHED_CHUNKS) {
            let oldestKey = ''
            let oldestTime = Infinity
            for (const [k, entry] of stateBeforeGenInsert.chunks) {
              if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed
                oldestKey = k
              }
            }
            if (oldestKey && stateBeforeGenInsert.dirtyChunks.has(oldestKey)) {
              const evictee = stateBeforeGenInsert.chunks.get(oldestKey)!
              yield* storageService.saveChunk(DEFAULT_WORLD_ID, evictee.chunk.coord, evictee.chunk.blocks)
            }
          }

          yield* Ref.update(cache, (s) => {
            const newChunks = new Map(s.chunks)
            newChunks.set(key, { chunk: newChunk, lastAccessed: Date.now() })
            evictLRUIfNeeded(newChunks)
            return { ...s, chunks: newChunks }
          })

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
            yield* storageService.saveChunk(DEFAULT_WORLD_ID, chunk.coord, chunk.blocks)
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
            const now = Date.now()
            const lastLoadTime = yield* Ref.get(lastLoadTimeRef)

            // Throttle: only run every 200ms
            if (now - lastLoadTime < 200) {
              return
            }
            yield* Ref.set(lastLoadTimeRef, now)

            const centerChunk = worldToChunkCoord(playerPos)
            const chunksToLoad = getChunksInRenderDistance(centerChunk)

            // Load chunks in render distance
            for (const coord of chunksToLoad) {
              yield* getChunk(coord)
            }

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
                yield* storageService.saveChunk(DEFAULT_WORLD_ID, entry.chunk.coord, entry.chunk.blocks)
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
export { ChunkManagerService as ChunkManagerServiceLive }
