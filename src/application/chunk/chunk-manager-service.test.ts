import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { StorageService } from '@/infrastructure/storage/storage-service'
import { StorageError } from '@/domain/errors'
import { NoiseServiceLive } from '@/infrastructure/noise/noise-service'
import { BiomeServiceLive } from '@/application/biome/biome-service'
import { ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { WorldIdSchema } from '@/shared/kernel'
import { ChunkManagerService, ChunkManagerServiceLive, RENDER_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-service'

// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

const makeInMemoryStorage = () => {
  const chunks = new Map<string, Uint8Array>()
  const metadata = new Map<string, unknown>()

  return StorageService.of({
    _tag: '@minecraft/infrastructure/storage/StorageService' as const,
    initialize: Effect.void as Effect.Effect<undefined, StorageError>,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        chunks.set(`${worldId}:${coord.x}:${coord.z}`, data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => {
        const data = chunks.get(`${worldId}:${coord.x}:${coord.z}`)
        return data !== undefined ? Option.some(data) : Option.none()
      }),
    saveWorldMetadata: (worldId, meta) =>
      Effect.sync(() => {
        metadata.set(worldId, meta)
      }) as Effect.Effect<undefined, StorageError>,
    loadWorldMetadata: (worldId) =>
      Effect.sync(() => {
        const data = metadata.get(worldId)
        return data !== undefined ? Option.some(data as never) : Option.none()
      }),
    deleteWorld: (worldId) =>
      Effect.sync(() => {
        for (const key of [...chunks.keys()]) {
          if (key.startsWith(`${worldId}:`)) chunks.delete(key)
        }
        metadata.delete(worldId)
      }) as Effect.Effect<undefined, StorageError>,
  })
}

// ---------------------------------------------------------------------------
// Test layer composition
// ---------------------------------------------------------------------------

const buildTestLayer = () => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageService, storage as unknown as StorageService)
  const NoiseLayer = NoiseServiceLive
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const TestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
  )

  return { TestLayer, storage }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_WORLD_ID = WorldIdSchema.make('default')
const EXPECTED_BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/chunk/chunk-manager-service', () => {
  describe('getChunk', () => {
    it('returns a generated chunk for an unknown coordinate', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        expect(chunk.coord.x).toBe(0)
        expect(chunk.coord.z).toBe(0)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('caches chunk and returns same blocks content on second call', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk1 = yield* service.getChunk({ x: 0, z: 0 })
        const chunk2 = yield* service.getChunk({ x: 0, z: 0 })

        // Both calls should return the same blocks data
        expect(chunk1.blocks).toEqual(chunk2.blocks)
        expect(chunk1.coord).toEqual(chunk2.coord)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('loads chunk from storage when available', () => {
      const { TestLayer, storage } = buildTestLayer()

      // Pre-populate storage with a known chunk
      const savedBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH).fill(2) // fill with STONE index

      const program = Effect.gen(function* () {
        // Write directly to in-memory storage
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 3, z: 7 }, savedBlocks)

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 3, z: 7 })

        expect(chunk.coord.x).toBe(3)
        expect(chunk.coord.z).toBe(7)
        expect(chunk.blocks).toEqual(savedBlocks)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('markChunkDirty and saveDirtyChunks', () => {
    it('persists dirty chunk to storage after saveDirtyChunks', () => {
      const { TestLayer, storage } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load a chunk so it enters the cache
        yield* service.getChunk({ x: 1, z: 1 })

        // Mark it dirty
        yield* service.markChunkDirty({ x: 1, z: 1 })

        // Save all dirty chunks
        yield* service.saveDirtyChunks()

        // Verify it was written to storage
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 1, z: 1 })

        expect(Option.isSome(stored)).toBe(true)
        if (Option.isSome(stored)) {
          expect(stored.value).toBeInstanceOf(Uint8Array)
          expect(stored.value.length).toBe(EXPECTED_BLOCKS_LENGTH)
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('does not persist chunk to storage when not marked dirty', () => {
      const { TestLayer, storage } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunk but do NOT mark dirty
        yield* service.getChunk({ x: 2, z: 2 })

        // Save (should save nothing for this coord)
        yield* service.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 2, z: 2 })
        expect(Option.isNone(stored)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getLoadedChunks', () => {
    it('returns empty array initially', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const loaded = yield* service.getLoadedChunks()

        expect(loaded).toHaveLength(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('returns loaded chunks after getChunk calls', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 0, z: 0 })
        yield* service.getChunk({ x: 1, z: 0 })
        yield* service.getChunk({ x: 0, z: 1 })

        const loaded = yield* service.getLoadedChunks()

        expect(loaded.length).toBe(3)

        const keys = loaded.map((c) => `${c.coord.x},${c.coord.z}`)
        expect(keys).toContain('0,0')
        expect(keys).toContain('1,0')
        expect(keys).toContain('0,1')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('unloadChunk', () => {
    it('removes chunk from loaded set after unload', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 5, z: 5 })

        const beforeUnload = yield* service.getLoadedChunks()
        expect(beforeUnload.some((c) => c.coord.x === 5 && c.coord.z === 5)).toBe(true)

        yield* service.unloadChunk({ x: 5, z: 5 })

        const afterUnload = yield* service.getLoadedChunks()
        expect(afterUnload.some((c) => c.coord.x === 5 && c.coord.z === 5)).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('auto-saves dirty chunk to storage on unload', () => {
      const { TestLayer, storage } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 4, z: 4 })
        yield* service.markChunkDirty({ x: 4, z: 4 })

        // unloadChunk should save the dirty chunk before removing it
        yield* service.unloadChunk({ x: 4, z: 4 })

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 4, z: 4 })
        expect(Option.isSome(stored)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('is a no-op when chunk is not loaded', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Unload a coord that was never loaded - should not throw
        yield* service.unloadChunk({ x: 99, z: 99 })

        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('loadChunksAroundPlayer', () => {
    it('loads chunks within render distance of player position', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Player at world origin
        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })

        const loaded = yield* service.getLoadedChunks()

        // Should have loaded chunks within the render distance circle
        expect(loaded.length).toBeGreaterThan(0)

        // All loaded chunks should be within RENDER_DISTANCE of (0,0)
        const rdSquared = RENDER_DISTANCE * RENDER_DISTANCE
        for (const chunk of loaded) {
          const dx = chunk.coord.x
          const dz = chunk.coord.z
          expect(dx * dx + dz * dz).toBeLessThanOrEqual(rdSquared)
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('is throttled: second immediate call does not reload chunks', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // First call: loads chunks
        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })
        const afterFirst = yield* service.getLoadedChunks()
        const countFirst = afterFirst.length

        // Immediate second call should be throttled (200ms window) and not change state
        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })
        const afterSecond = yield* service.getLoadedChunks()
        const countSecond = afterSecond.length

        expect(countFirst).toBe(countSecond)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('RENDER_DISTANCE constant', () => {
    it('is defined as a positive integer', () => {
      expect(RENDER_DISTANCE).toBeTypeOf('number')
      expect(RENDER_DISTANCE).toBeGreaterThan(0)
      expect(Number.isInteger(RENDER_DISTANCE)).toBe(true)
    })
  })

  describe('MAX_CACHED_CHUNKS constant', () => {
    it('is defined as a positive integer', () => {
      expect(MAX_CACHED_CHUNKS).toBeTypeOf('number')
      expect(MAX_CACHED_CHUNKS).toBeGreaterThan(0)
      expect(Number.isInteger(MAX_CACHED_CHUNKS)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // LRU eviction boundary tests
  //
  // MAX_CACHED_CHUNKS = 400, so we pre-populate chunks in the in-memory storage
  // to avoid terrain generation — each getChunk call just does a Map lookup
  // instead of running the noise pipeline, making the loop fast.
  // ---------------------------------------------------------------------------
  describe('insertWithEviction (LRU cache eviction)', () => {
    /**
     * Build a test layer with N chunks pre-populated in storage.
     * Coordinates are laid out on the x-axis: (0,0), (1,0), (2,0), …
     * Each chunk has a minimal but valid block array (all zeros = AIR).
     */
    const buildLayerWithStorageChunks = (count: number) => {
      const storage = makeInMemoryStorage()

      // Pre-populate `count` distinct chunks so getChunk reads from storage
      // rather than triggering terrain generation (avoids slow noise pipeline).
      const minimalBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)
      const StorageTestLayer = Layer.succeed(StorageService, storage as unknown as StorageService)

      const program = Effect.gen(function* () {
        for (let i = 0; i < count; i++) {
          yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: i, z: 0 }, minimalBlocks)
        }
      })
      Effect.runSync(program)

      const NoiseLayer = NoiseServiceLive
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
      )

      return { TestLayer, storage }
    }

    it('cache size stays at MAX_CACHED_CHUNKS after loading one chunk beyond capacity', () => {
      // Pre-populate MAX_CACHED_CHUNKS + 1 chunks in storage so no terrain
      // generation happens during the loop — each getChunk is a fast Map read.
      const { TestLayer } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load MAX_CACHED_CHUNKS chunks — fills the cache to exact capacity.
        for (let i = 0; i < MAX_CACHED_CHUNKS; i++) {
          yield* service.getChunk({ x: i, z: 0 })
        }

        const atCapacity = yield* service.getLoadedChunks()
        expect(atCapacity.length).toBe(MAX_CACHED_CHUNKS)

        // Load one more chunk — triggers insertWithEviction's eviction branch.
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        const afterEviction = yield* service.getLoadedChunks()
        // Cache must not exceed MAX_CACHED_CHUNKS.
        expect(afterEviction.length).toBe(MAX_CACHED_CHUNKS)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    }, 30_000) // allow up to 30 s for 401 in-memory storage reads

    it('evicted dirty chunk is auto-saved to storage before eviction', () => {
      // We need at least MAX_CACHED_CHUNKS + 1 storage entries.
      // Chunk (0,0) is the first loaded → it will be the LRU entry and get
      // evicted once the cache reaches capacity and a new chunk is loaded.
      const { TestLayer, storage } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunk (0,0) first so it becomes the LRU (oldest lastAccessed).
        yield* service.getChunk({ x: 0, z: 0 })
        yield* service.markChunkDirty({ x: 0, z: 0 })

        // Load MAX_CACHED_CHUNKS - 1 more chunks so the cache is exactly full.
        // These all have newer lastAccessed timestamps so (0,0) remains LRU.
        for (let i = 1; i < MAX_CACHED_CHUNKS; i++) {
          yield* service.getChunk({ x: i, z: 0 })
        }

        // Sanity: (0,0) is still in cache (not yet evicted).
        const beforeEviction = yield* service.getLoadedChunks()
        expect(beforeEviction.some((c) => c.coord.x === 0 && c.coord.z === 0)).toBe(true)

        // Loading one more chunk should evict (0,0) — the LRU entry.
        // Because (0,0) is dirty, insertWithEviction must save it first.
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        // (0,0) should no longer be in the in-memory cache.
        const afterEviction = yield* service.getLoadedChunks()
        expect(afterEviction.some((c) => c.coord.x === 0 && c.coord.z === 0)).toBe(false)

        // (0,0) must have been written to storage during the pre-eviction save.
        const saved = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 })
        expect(Option.isSome(saved)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    }, 30_000)

    it('evicted clean chunk is NOT written to storage during eviction', () => {
      // Load MAX_CACHED_CHUNKS + 1 chunks, but keep chunk (0,0) clean.
      // After eviction the storage entry for (0,0) should still be the original
      // pre-populated data (unchanged by the eviction path itself).
      const { TestLayer, storage } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      // Overwrite chunk (0,0) storage entry with a sentinel value so we can
      // detect if the eviction path re-saves it with different data.
      const sentinelBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH).fill(99)
      Effect.runSync(storage.saveChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 }, sentinelBlocks))

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunk (0,0) first — it picks up the sentinel data from storage.
        yield* service.getChunk({ x: 0, z: 0 })
        // Deliberately do NOT mark (0,0) dirty.

        // Fill the rest of the cache.
        for (let i = 1; i < MAX_CACHED_CHUNKS; i++) {
          yield* service.getChunk({ x: i, z: 0 })
        }

        // Trigger eviction of (0,0).
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        // (0,0) should have been evicted.
        const afterEviction = yield* service.getLoadedChunks()
        expect(afterEviction.some((c) => c.coord.x === 0 && c.coord.z === 0)).toBe(false)

        // The storage value for (0,0) must still equal the original sentinel —
        // the eviction path must NOT re-save clean chunks.
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 })
        expect(Option.isSome(stored)).toBe(true)
        if (Option.isSome(stored)) {
          expect(stored.value[0]).toBe(99) // sentinel byte intact
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    }, 30_000)

    it('newly inserted chunk is retrievable immediately after eviction cycle', () => {
      const { TestLayer } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 2)

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Fill the cache to capacity.
        for (let i = 0; i < MAX_CACHED_CHUNKS; i++) {
          yield* service.getChunk({ x: i, z: 0 })
        }

        // Trigger eviction and insert the new chunk.
        const newCoord = { x: MAX_CACHED_CHUNKS, z: 0 }
        const inserted = yield* service.getChunk(newCoord)

        expect(inserted.coord.x).toBe(MAX_CACHED_CHUNKS)
        expect(inserted.coord.z).toBe(0)
        expect(inserted.blocks).toBeInstanceOf(Uint8Array)

        // The inserted chunk must be present in the loaded set.
        const loaded = yield* service.getLoadedChunks()
        expect(loaded.some((c) => c.coord.x === MAX_CACHED_CHUNKS && c.coord.z === 0)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    }, 30_000)
  })
})
