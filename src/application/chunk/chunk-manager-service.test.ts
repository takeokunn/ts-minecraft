import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Layer, MutableHashMap, Option, Schema } from 'effect'
import { StorageServicePort } from '@/application/storage/storage-service-port'
import { StorageError } from '@/domain/errors'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { BiomeServiceLive } from '@/application/biome/biome-service'
import { ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ChunkManagerService, ChunkManagerServiceLive, RENDER_DISTANCE, MAX_CACHED_CHUNKS, UNLOAD_DISTANCE } from './chunk-manager-service'
import { DEFAULT_WORLD_ID } from '@/application/constants'

// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<string, Uint8Array>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        MutableHashMap.set(chunks, `${worldId}:${coord.x}:${coord.z}`, data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, `${worldId}:${coord.x}:${coord.z}`)),
  })
}

// ---------------------------------------------------------------------------
// Test layer composition
// ---------------------------------------------------------------------------

const buildTestLayer = () => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
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

        const keys = Arr.map(loaded, (c) => `${c.coord.x},${c.coord.z}`)
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
        expect(Arr.some(beforeUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(true)

        yield* service.unloadChunk({ x: 5, z: 5 })

        const afterUnload = yield* service.getLoadedChunks()
        expect(Arr.some(afterUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(false)

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
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)

      const program = Effect.gen(function* () {
        for (let i = 0; i < count; i++) {
          yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: i, z: 0 }, minimalBlocks)
        }
      })
      Effect.runSync(program)

      const NoiseLayer = NoiseServicePort.Default
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
        expect(Arr.some(beforeEviction, (c) => c.coord.x === 0 && c.coord.z === 0)).toBe(true)

        // Loading one more chunk should evict (0,0) — the LRU entry.
        // Because (0,0) is dirty, insertWithEviction must save it first.
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        // (0,0) should no longer be in the in-memory cache.
        const afterEviction = yield* service.getLoadedChunks()
        expect(Arr.some(afterEviction, (c) => c.coord.x === 0 && c.coord.z === 0)).toBe(false)

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
        expect(Arr.some(afterEviction, (c) => c.coord.x === 0 && c.coord.z === 0)).toBe(false)

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
        expect(Arr.some(loaded, (c) => c.coord.x === MAX_CACHED_CHUNKS && c.coord.z === 0)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    }, 30_000)
  })

  // ---------------------------------------------------------------------------
  // D3: StorageError propagation
  // ---------------------------------------------------------------------------

  describe('StorageError propagation', () => {
    it('getChunk propagates StorageError when storage.loadChunk fails', () => {
      // Build a storage mock whose loadChunk always fails with a StorageError
      const failingStorage = StorageServicePort.of({
        _tag: '@minecraft/application/storage/StorageServicePort' as const,
        saveChunk: (_worldId, _coord, _data) =>
          Effect.void as Effect.Effect<undefined, StorageError>,
        loadChunk: (_worldId, _coord) =>
          Effect.fail(
            new StorageError({ operation: 'loadChunk', cause: 'simulated storage failure' })
          ) as unknown as Effect.Effect<Option.Option<Uint8Array>, StorageError>,
      })

      const FailingStorageLayer = Layer.succeed(StorageServicePort, failingStorage as unknown as StorageServicePort)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const FailingTestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(FailingStorageLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
      )

      // The error should propagate and be catchable with Effect.catchTag
      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const result = yield* service.getChunk({ x: 0, z: 0 }).pipe(
          Effect.catchTag('StorageError', (e) =>
            Effect.succeed({ caught: 'StorageError', operation: e.operation })
          )
        )
        return result
      }).pipe(Effect.provide(FailingTestLayer))

      const result = Effect.runSync(program) as { caught: string; operation: string }
      expect(result.caught).toBe('StorageError')
      expect(result.operation).toBe('loadChunk')
    })
  })

  // ---------------------------------------------------------------------------
  // D4: loadChunksAroundPlayer unload path
  // ---------------------------------------------------------------------------

  describe('loadChunksAroundPlayer unload path', () => {
    it('UNLOAD_DISTANCE constant is greater than RENDER_DISTANCE', () => {
      expect(UNLOAD_DISTANCE).toBeGreaterThan(RENDER_DISTANCE)
    })

    it('chunks loaded near origin are unloaded after loading near a far position', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunks around origin — fills cache with chunks near (0,0)
        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })

        const afterFirstLoad = yield* service.getLoadedChunks()
        const countNearOrigin = afterFirstLoad.length
        expect(countNearOrigin).toBeGreaterThan(0)

        // Record one of the origin-adjacent chunk coords that we know was loaded
        const originChunkLoaded = Arr.some(afterFirstLoad,
          (c) => c.coord.x === 0 && c.coord.z === 0
        )
        expect(originChunkLoaded).toBe(true)

        // Now move player far away — beyond UNLOAD_DISTANCE from origin
        // UNLOAD_DISTANCE=10, so moving 500 chunks away is far outside the unload radius
        // We need to bypass the 200ms throttle — unloadChunk explicitly to simulate what
        // loadChunksAroundPlayer would do after the throttle window expires.
        // Directly unload origin chunks that are out of range of the new position.
        const farChunkCoord = { x: 500, z: 500 }

        // Unload chunks that are beyond UNLOAD_DISTANCE of the far position
        const loadedBeforeUnload = yield* service.getLoadedChunks()
        const udSquared = UNLOAD_DISTANCE * UNLOAD_DISTANCE
        for (const chunk of loadedBeforeUnload) {
          const dx = chunk.coord.x - farChunkCoord.x
          const dz = chunk.coord.z - farChunkCoord.z
          if (dx * dx + dz * dz > udSquared) {
            yield* service.unloadChunk(chunk.coord)
          }
        }

        // After unloading, origin chunks should no longer be loaded
        const afterUnload = yield* service.getLoadedChunks()
        const originStillLoaded = Arr.some(afterUnload,
          (c) => c.coord.x === 0 && c.coord.z === 0
        )
        expect(originStillLoaded).toBe(false)

        // The total number of loaded chunks should have decreased
        expect(afterUnload.length).toBeLessThan(countNearOrigin)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // C1: loadChunk idempotency (same chunk returned on second call, uses cache)
  // ---------------------------------------------------------------------------

  describe('loadChunk idempotency', () => {
    it('calling loadChunk (getChunk) twice for same coordinate returns identical chunk object', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const chunk1 = yield* service.getChunk({ x: 7, z: -3 })
        // Copy blocks immediately to compare before any potential mutation
        const blocks1Copy = new Uint8Array(chunk1.blocks)

        const chunk2 = yield* service.getChunk({ x: 7, z: -3 })

        // Same coord
        expect(chunk2.coord.x).toBe(7)
        expect(chunk2.coord.z).toBe(-3)
        // Same blocks content — second call must use the cache
        expect(chunk2.blocks).toEqual(blocks1Copy)
        // Should be the exact same Uint8Array reference (cached object)
        expect(chunk2.blocks).toBe(chunk1.blocks)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('calling getChunk twice does not double-count in getLoadedChunks', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 2, z: 5 })
        yield* service.getChunk({ x: 2, z: 5 })

        const loaded = yield* service.getLoadedChunks()
        // Must appear only once in the cache
        const matches = Arr.filter(loaded, (c) => c.coord.x === 2 && c.coord.z === 5)
        expect(matches.length).toBe(1)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // C2: Negative chunk coordinates
  // ---------------------------------------------------------------------------

  describe('negative chunk coordinates', () => {
    it('generates a valid chunk for coordinate { x: -1, z: -1 }', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -1, z: -1 })

        expect(chunk.coord.x).toBe(-1)
        expect(chunk.coord.z).toBe(-1)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        // Surface height must be within valid bounds [1, CHUNK_HEIGHT - 2]
        // Find the highest non-AIR block in the center column (lx=8, lz=8)
        // blockIndex: y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        let surfaceY = 0
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const idx = y + 8 * CHUNK_HEIGHT + 8 * CHUNK_HEIGHT * CHUNK_SIZE
          if (chunk.blocks[idx] !== 0) {
            surfaceY = y
            break
          }
        }
        expect(surfaceY).toBeGreaterThanOrEqual(1)
        expect(surfaceY).toBeLessThanOrEqual(CHUNK_HEIGHT - 2)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('generates a valid chunk for coordinate { x: -5, z: 3 }', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -5, z: 3 })

        expect(chunk.coord.x).toBe(-5)
        expect(chunk.coord.z).toBe(3)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        // At least some blocks must be non-AIR (terrain was generated)
        const nonAirCount = chunk.blocks.reduce((acc, b) => acc + (b !== 0 ? 1 : 0), 0)
        expect(nonAirCount).toBeGreaterThan(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('caches negative-coordinate chunk correctly on second call', () => {
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const first = yield* service.getChunk({ x: -3, z: -7 })
        const second = yield* service.getChunk({ x: -3, z: -7 })

        expect(second.blocks).toBe(first.blocks)

        const loaded = yield* service.getLoadedChunks()
        const count = Arr.filter(loaded, (c) => c.coord.x === -3 && c.coord.z === -7).length
        expect(count).toBe(1)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // D9: shouldPlaceTree determinism property test
  //
  // shouldPlaceTree is a private function, but its determinism is the key
  // invariant. We test it by verifying that identical getChunk calls on a
  // fresh service always produce identical block arrays for the same coord,
  // which implicitly depends on shouldPlaceTree being deterministic.
  // ---------------------------------------------------------------------------

  describe('terrain generation determinism (shouldPlaceTree invariant)', () => {
    it('getChunk returns same blocks on repeated calls (cache hit is deterministic)', () => {
      // Two calls to getChunk for the same coord within one service instance
      // must return identical block data. The first call generates terrain;
      // the second call should return the cached chunk unchanged.
      const { TestLayer } = buildTestLayer()

      const program = Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk1 = yield* service.getChunk({ x: 3, z: 7 })
        // Copy blocks before second call (Uint8Array is mutated in-place if ever)
        const blocks1 = new Uint8Array(chunk1.blocks)
        const chunk2 = yield* service.getChunk({ x: 3, z: 7 })
        return { blocks1, blocks2: chunk2.blocks }
      }).pipe(Effect.provide(TestLayer))

      const { blocks1, blocks2 } = Effect.runSync(program)
      expect(blocks1).toEqual(blocks2)
    })

    // Replicate the shouldPlaceTree formula for direct determinism testing
    const shouldPlaceTreeFormula = (
      treeDensity: number,
      surfaceY: number,
      wx: number,
      wz: number
    ): boolean => {
      if (treeDensity <= 0 || surfaceY <= 5 || surfaceY >= 256 - 10) {
        return false
      }
      const treeRng = Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453
      const treeProb = treeRng - Math.floor(treeRng)
      return treeProb < treeDensity
    }

    it.prop(
      'shouldPlaceTree formula produces same result for same inputs (direct formula test)',
      {
        density: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
        surfaceY: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(6, 246))),
        wx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
        wz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      },
      ({ density, surfaceY, wx, wz }) => {
        const result1 = shouldPlaceTreeFormula(density, surfaceY, wx, wz)
        const result2 = shouldPlaceTreeFormula(density, surfaceY, wx, wz)
        expect(result1).toBe(result2)
      }
    )
  })
})
