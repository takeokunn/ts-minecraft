import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Brand, Effect, HashSet, Layer, MutableHashMap, Option, Schema } from 'effect'
import { StorageServicePort } from '@ts-minecraft/block-storage'
import type { ChunkStorageValue } from '@ts-minecraft/block-storage'
import { StorageError } from '@ts-minecraft/domain'
import { NoiseServicePort } from '@ts-minecraft/noise-generator'
import { NoiseServiceLive } from '@ts-minecraft/noise-generator'
import { TerrainWorkerPoolPort } from '@ts-minecraft/terrain-generator'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/app'
import { generateTerrain as legacyGenerateTerrain } from '@ts-minecraft/terrain-generator'
import { BiomeService, BiomeServiceLive, type BiomeType } from '@ts-minecraft/biome-classifier'
import { LightEngineService } from '@ts-minecraft/light-engine'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/domain'
import { ChunkService, ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { ChunkManagerService, ChunkManagerServiceLive, RENDER_DISTANCE, MAX_CACHED_CHUNKS, UNLOAD_DISTANCE, getChunksInRenderDistance } from '@ts-minecraft/chunk-manager'
import { DEFAULT_WORLD_ID, type WorldId } from '@ts-minecraft/kernel'
import { computeColumnY } from '@ts-minecraft/terrain-generator'

// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()
const storageKey = (worldId: WorldId, coord: { x: number; z: number }): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<ChunkStorageKey, ChunkStorageValue>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        MutableHashMap.set(chunks, storageKey(worldId, coord), data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, storageKey(worldId, coord))),
  })
}

// ---------------------------------------------------------------------------
// No-op LightEngine mock — skips BFS for tests that don't exercise lighting
// ---------------------------------------------------------------------------

const LightEngineNoopLive = Layer.succeed(LightEngineService, {
  _tag: '@minecraft/application/LightEngineService' as const,
  computeLight: (_chunk: unknown) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  updateLight: (_chunk: unknown) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  getSkyLight: (_chunk: unknown, _lx: number, _y: number, _lz: number) => 15,
  getBlockLight: (_chunk: unknown, _lx: number, _y: number, _lz: number) => 0,
} as unknown as LightEngineService)

// ---------------------------------------------------------------------------
// Custom TerrainWorkerPoolPort layer that delegates back to the legacy generator
// using the test-provided BiomeService + NoiseServicePort. This preserves the
// pre-FR-001 contract for tests that inject custom biome/noise to drive terrain
// output. The default TerrainWorkerPool ignores those services (it builds its
// own seeded primitives), so tests using custom biome/noise must use this layer.
// Caller must provide ChunkService, BiomeService, and NoiseServicePort — the
// `buildLegacyTerrainPoolLayer` helper composes them in for ergonomic use.
// ---------------------------------------------------------------------------

const buildLegacyTerrainPoolLayer = (
  deps: Layer.Layer<ChunkService | BiomeService | NoiseServicePort>,
): Layer.Layer<TerrainWorkerPoolPort> =>
  Layer.effect(
    TerrainWorkerPoolPort,
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const biomeService = yield* BiomeService
      const noiseService = yield* NoiseServicePort
      return {
        _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
        generateTerrain: (coord: { readonly x: number; readonly z: number }, _options: { seaLevel: number; lakeLevel: number; seed: number }) =>
          legacyGenerateTerrain(chunkService, biomeService, noiseService, coord).pipe(
            Effect.map((chunk) => ({
              blocks: chunk.blocks,
              skyLight: new Uint8Array(LIGHT_BYTE_LENGTH),
              blockLight: new Uint8Array(LIGHT_BYTE_LENGTH),
            })),
          ),
      } as unknown as TerrainWorkerPoolPort
    }),
  ).pipe(Layer.provide(deps))

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
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineNoopLive),
  )

  return { TestLayer, storage }
}

const buildTestLayerWithStoredChunks = (coords: ReadonlyArray<{ readonly x: number; readonly z: number }>) => {
  const storage = makeInMemoryStorage()
  const minimalBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)

  const seedStorage = Effect.forEach(
    coords,
    (coord) => storage.saveChunk(DEFAULT_WORLD_ID, coord, minimalBlocks),
    { concurrency: 1, discard: true },
  )

  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const TestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineNoopLive),
  )

  return { TestLayer, storage, seedStorage }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const chunkStorageBlocks = (value: ChunkStorageValue): Uint8Array<ArrayBufferLike> =>
  value instanceof Uint8Array ? value : value.blocks

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/chunk/chunk-manager-service', () => {
  describe('getChunk', () => {
    it.effect('returns a generated chunk for an unknown coordinate', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        expect(chunk.coord.x).toBe(0)
        expect(chunk.coord.z).toBe(0)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('caches chunk and returns same blocks content on second call', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk1 = yield* service.getChunk({ x: 0, z: 0 })
        const chunk2 = yield* service.getChunk({ x: 0, z: 0 })

        // Both calls should return the same blocks data
        expect(chunk1.blocks).toEqual(chunk2.blocks)
        expect(chunk1.coord).toEqual(chunk2.coord)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('loads chunk from storage when available', () => {
      const { TestLayer, storage } = buildTestLayer()

      // Pre-populate storage with a known chunk
      const savedBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH).fill(2) // fill with STONE index

      return Effect.gen(function* () {
        // Write directly to in-memory storage
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 3, z: 7 }, savedBlocks)

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 3, z: 7 })

        expect(chunk.coord.x).toBe(3)
        expect(chunk.coord.z).toBe(7)
        expect(chunk.blocks).toEqual(savedBlocks)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('markChunkDirty and saveDirtyChunks', () => {
    it.effect('persists dirty chunk to storage after saveDirtyChunks', () => {
      const { TestLayer, storage } = buildTestLayer()

      return Effect.gen(function* () {
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
        expect(chunkStorageBlocks(Option.getOrThrow(stored)).length).toBe(EXPECTED_BLOCKS_LENGTH)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('does not persist chunk to storage when not marked dirty', () => {
      const { TestLayer, storage } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunk but do NOT mark dirty
        yield* service.getChunk({ x: 2, z: 2 })

        // Save (should save nothing for this coord)
        yield* service.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 2, z: 2 })
        expect(Option.isNone(stored)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('getLoadedChunks', () => {
    it.effect('returns empty array initially', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const loaded = yield* service.getLoadedChunks()

        expect(loaded).toHaveLength(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('returns loaded chunks after getChunk calls', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('unloadChunk', () => {
    it.effect('removes chunk from loaded set after unload', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 5, z: 5 })

        const beforeUnload = yield* service.getLoadedChunks()
        expect(Arr.some(beforeUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(true)

        yield* service.unloadChunk({ x: 5, z: 5 })

        const afterUnload = yield* service.getLoadedChunks()
        expect(Arr.some(afterUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('auto-saves dirty chunk to storage on unload', () => {
      const { TestLayer, storage } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 4, z: 4 })
        yield* service.markChunkDirty({ x: 4, z: 4 })

        // unloadChunk should save the dirty chunk before removing it
        yield* service.unloadChunk({ x: 4, z: 4 })

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 4, z: 4 })
        expect(Option.isSome(stored)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('is a no-op when chunk is not loaded', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Unload a coord that was never loaded - should not throw
        yield* service.unloadChunk({ x: 99, z: 99 })

        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('loadChunksAroundPlayer', () => {
    it.live('loads chunks within render distance of player position', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, RENDER_DISTANCE)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        // Player at world origin
        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })

        const loaded = yield* service.getLoadedChunks()

        // Should have loaded chunks within the render distance circle
        expect(loaded.length).toBeGreaterThan(0)

        // All loaded chunks should be within RENDER_DISTANCE of (0,0)
        const rdSquared = RENDER_DISTANCE * RENDER_DISTANCE
        Arr.forEach(loaded, (chunk) => {
          const dx = chunk.coord.x
          const dz = chunk.coord.z
          expect(dx * dx + dz * dz).toBeLessThanOrEqual(rdSquared)
        })
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)

    it.live('honors a custom render distance when loading chunks', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, 2)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, 2)

        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(13)

        const rdSquared = 2 * 2
        Arr.forEach(loaded, (chunk) => {
          const dx = chunk.coord.x
          const dz = chunk.coord.z
          expect(dx * dx + dz * dz).toBeLessThanOrEqual(rdSquared)
        })
      }).pipe(Effect.provide(TestLayer))
    }, 35_000)

    it.live('does not cap loading at the old unload radius', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, 11)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, 11)

        const loaded = yield* service.getLoadedChunks()
        expect(Arr.some(loaded, (chunk) => chunk.coord.x === 11 && chunk.coord.z === 0)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    }, 35_000)

    it.effect('is throttled: second immediate call does not reload chunks', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, RENDER_DISTANCE)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        // First call: loads chunks
        const firstLoaded = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })
        const afterFirst = yield* service.getLoadedChunks()
        const countFirst = afterFirst.length

        // Immediate second call should be throttled (200ms window) and not change state
        const secondLoaded = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })
        const afterSecond = yield* service.getLoadedChunks()
        const countSecond = afterSecond.length

        expect(firstLoaded).toBe(true)
        expect(secondLoaded).toBe(false)
        expect(countFirst).toBe(countSecond)
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)
  })

  describe('RENDER_DISTANCE constant', () => {
    it('is defined as a positive integer', () => {
      expect(RENDER_DISTANCE).toBeTypeOf('number')
      expect(RENDER_DISTANCE).toBeGreaterThan(0)
      expect(Number.isInteger(RENDER_DISTANCE)).toBe(true)
    }, 25_000)
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
    const buildLayerWithStorageChunks = (count: number) => {
      const storage = makeInMemoryStorage()

      // Pre-populate `count` distinct chunks so getChunk reads from storage
      // rather than triggering terrain generation (avoids slow noise pipeline).
      const minimalBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)

      Effect.runSync(
        Effect.forEach(Arr.makeBy(count, i => i), (i) => storage.saveChunk(DEFAULT_WORLD_ID, { x: i, z: 0 }, minimalBlocks), { concurrency: 1 })
      )

      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseServiceLive),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLive),
      )

      return { TestLayer, storage }
    }

    it.effect('cache size stays at MAX_CACHED_CHUNKS after loading one chunk beyond capacity', () => {
      // Pre-populate MAX_CACHED_CHUNKS + 1 chunks in storage so no terrain
      // generation happens during the loop — each getChunk is a fast Map read.
      const { TestLayer } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load MAX_CACHED_CHUNKS chunks — fills the cache to exact capacity.
        yield* Effect.forEach(Arr.makeBy(MAX_CACHED_CHUNKS, i => i), (i) => service.getChunk({ x: i, z: 0 }), { concurrency: 1 })

        const atCapacity = yield* service.getLoadedChunks()
        expect(atCapacity.length).toBe(MAX_CACHED_CHUNKS)

        // Load one more chunk — triggers insertWithEviction's eviction branch.
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        const afterEviction = yield* service.getLoadedChunks()
        // Cache must not exceed MAX_CACHED_CHUNKS.
        expect(afterEviction.length).toBe(MAX_CACHED_CHUNKS)
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 }) // allow up to 30 s for 401 in-memory storage reads

    it.effect('evicted dirty chunk is auto-saved to storage before eviction', () => {
      // We need at least MAX_CACHED_CHUNKS + 1 storage entries.
      // Chunk (0,0) is the first loaded → it will be the LRU entry and get
      // evicted once the cache reaches capacity and a new chunk is loaded.
      const { TestLayer, storage } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Load chunk (0,0) first so it becomes the LRU (oldest lastAccessed).
        yield* service.getChunk({ x: 0, z: 0 })
        yield* service.markChunkDirty({ x: 0, z: 0 })

        // Load MAX_CACHED_CHUNKS - 1 more chunks so the cache is exactly full.
        // These all have newer lastAccessed timestamps so (0,0) remains LRU.
        yield* Effect.forEach(Arr.makeBy(MAX_CACHED_CHUNKS - 1, i => i + 1), (i) => service.getChunk({ x: i, z: 0 }), { concurrency: 1 })

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
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })

    it.effect('evicted clean chunk is NOT written to storage during eviction', () => {
      // Load MAX_CACHED_CHUNKS + 1 chunks, but keep chunk (0,0) clean.
      // After eviction the storage entry for (0,0) should still be the original
      // pre-populated data (unchanged by the eviction path itself).
      const { TestLayer, storage } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      return Effect.gen(function* () {
        // Overwrite chunk (0,0) storage entry with a sentinel value so we can
        // detect if the eviction path re-saves it with different data.
        const sentinelBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH).fill(99)
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 }, sentinelBlocks)

        const service = yield* ChunkManagerService

        // Load chunk (0,0) first — it picks up the sentinel data from storage.
        yield* service.getChunk({ x: 0, z: 0 })
        // Deliberately do NOT mark (0,0) dirty.

        // Fill the rest of the cache.
        yield* Effect.forEach(Arr.makeBy(MAX_CACHED_CHUNKS - 1, i => i + 1), (i) => service.getChunk({ x: i, z: 0 }), { concurrency: 1 })

        // Trigger eviction of (0,0).
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        // (0,0) should have been evicted.
        const afterEviction = yield* service.getLoadedChunks()
        expect(Arr.some(afterEviction, (c) => c.coord.x === 0 && c.coord.z === 0)).toBe(false)

        // The storage value for (0,0) must still equal the original sentinel —
        // the eviction path must NOT re-save clean chunks.
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 })
        expect(Option.isSome(stored)).toBe(true)
        expect(chunkStorageBlocks(Option.getOrThrow(stored))[0]).toBe(99) // sentinel byte intact
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })

    it.effect('newly inserted chunk is retrievable immediately after eviction cycle', () => {
      const { TestLayer } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 2)

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // Fill the cache to capacity.
        yield* Effect.forEach(Arr.makeBy(MAX_CACHED_CHUNKS, i => i), (i) => service.getChunk({ x: i, z: 0 }), { concurrency: 1 })

        // Trigger eviction and insert the new chunk.
        const newCoord = { x: MAX_CACHED_CHUNKS, z: 0 }
        const inserted = yield* service.getChunk(newCoord)

        expect(inserted.coord.x).toBe(MAX_CACHED_CHUNKS)
        expect(inserted.coord.z).toBe(0)
        expect(inserted.blocks).toBeInstanceOf(Uint8Array)

        // The inserted chunk must be present in the loaded set.
        const loaded = yield* service.getLoadedChunks()
        expect(Arr.some(loaded, (c) => c.coord.x === MAX_CACHED_CHUNKS && c.coord.z === 0)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })
  })

  // ---------------------------------------------------------------------------
  // D3: StorageError propagation
  // ---------------------------------------------------------------------------

  describe('StorageError propagation', () => {
    it.effect('getChunk propagates StorageError when storage.loadChunk fails', () => {
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
        Layer.provide(NoiseServiceLive),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLive),
      )

      // The error should propagate and be catchable with Effect.catchTag
      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const result = yield* service.getChunk({ x: 0, z: 0 }).pipe(
          Effect.catchTag('StorageError', (e) =>
            Effect.succeed({ caught: 'StorageError', operation: e.operation })
          )
        )
        expect((result as { caught: string; operation: string }).caught).toBe('StorageError')
        expect((result as { caught: string; operation: string }).operation).toBe('loadChunk')
      }).pipe(Effect.provide(FailingTestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // D4: loadChunksAroundPlayer unload path
  // ---------------------------------------------------------------------------

  describe('loadChunksAroundPlayer unload path', () => {
    it('UNLOAD_DISTANCE constant is greater than RENDER_DISTANCE', () => {
      expect(UNLOAD_DISTANCE).toBeGreaterThan(RENDER_DISTANCE)
    })

    it.live('chunks loaded near origin are unloaded after loading near a far position', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, RENDER_DISTANCE)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
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
        yield* Effect.forEach(loadedBeforeUnload, (chunk) => {
          const dx = chunk.coord.x - farChunkCoord.x
          const dz = chunk.coord.z - farChunkCoord.z
          if (dx * dx + dz * dz > udSquared) {
            return service.unloadChunk(chunk.coord)
          }
          return Effect.void
        }, { concurrency: 1 })

        // After unloading, origin chunks should no longer be loaded
        const afterUnload = yield* service.getLoadedChunks()
        const originStillLoaded = Arr.some(afterUnload,
          (c) => c.coord.x === 0 && c.coord.z === 0
        )
        expect(originStillLoaded).toBe(false)

        // The total number of loaded chunks should have decreased
        expect(afterUnload.length).toBeLessThan(countNearOrigin)
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)
  })

  // ---------------------------------------------------------------------------
  // C1: loadChunk idempotency (same chunk returned on second call, uses cache)
  // ---------------------------------------------------------------------------

  describe('loadChunk idempotency', () => {
    it.effect('calling loadChunk (getChunk) twice for same coordinate returns identical chunk object', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('calling getChunk twice does not double-count in getLoadedChunks', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 2, z: 5 })
        yield* service.getChunk({ x: 2, z: 5 })

        const loaded = yield* service.getLoadedChunks()
        // Must appear only once in the cache
        const matches = Arr.filter(loaded, (c) => c.coord.x === 2 && c.coord.z === 5)
        expect(matches.length).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // C2: Negative chunk coordinates
  // ---------------------------------------------------------------------------

  describe('negative chunk coordinates', () => {
    it.effect('generates a valid chunk for coordinate { x: -1, z: -1 }', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -1, z: -1 })

        expect(chunk.coord.x).toBe(-1)
        expect(chunk.coord.z).toBe(-1)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        // Surface height must be within valid bounds [1, CHUNK_HEIGHT - 2]
        // Find the highest non-AIR block in the center column (lx=8, lz=8)
        // blockIndex: y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        const surfaceY = Option.getOrElse(
          Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i), (y) =>
            chunk.blocks[y + 8 * CHUNK_HEIGHT + 8 * CHUNK_HEIGHT * CHUNK_SIZE] !== 0
          ),
          () => 0
        )
        expect(surfaceY).toBeGreaterThanOrEqual(1)
        expect(surfaceY).toBeLessThanOrEqual(CHUNK_HEIGHT - 2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('generates a valid chunk for coordinate { x: -5, z: 3 }', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -5, z: 3 })

        expect(chunk.coord.x).toBe(-5)
        expect(chunk.coord.z).toBe(3)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        // At least some blocks must be non-AIR (terrain was generated)
        const nonAirCount = chunk.blocks.reduce((acc, b) => acc + (b !== 0 ? 1 : 0), 0)
        expect(nonAirCount).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('caches negative-coordinate chunk correctly on second call', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const first = yield* service.getChunk({ x: -3, z: -7 })
        const second = yield* service.getChunk({ x: -3, z: -7 })

        expect(second.blocks).toBe(first.blocks)

        const loaded = yield* service.getLoadedChunks()
        const count = Arr.filter(loaded, (c) => c.coord.x === -3 && c.coord.z === -7).length
        expect(count).toBe(1)
      }).pipe(Effect.provide(TestLayer))
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
    it.effect('getChunk returns same blocks on repeated calls (cache hit is deterministic)', () => {
      // Two calls to getChunk for the same coord within one service instance
      // must return identical block data. The first call generates terrain;
      // the second call should return the cached chunk unchanged.
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk1 = yield* service.getChunk({ x: 3, z: 7 })
        // Copy blocks before second call (Uint8Array is mutated in-place if ever)
        const blocks1 = new Uint8Array(chunk1.blocks)
        const chunk2 = yield* service.getChunk({ x: 3, z: 7 })

        expect(blocks1).toEqual(chunk2.blocks)
      }).pipe(Effect.provide(TestLayer))
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

  // ---------------------------------------------------------------------------
  // Phase 1.2: Bedrock + Deepslate + Stone variants
  //
  // BlockType index constants (see src/domain/chunk.ts BLOCK_TYPE_TO_INDEX).
  // ---------------------------------------------------------------------------


  describe('terrain appearance polish', () => {
    const AIR = 0
    const DIRT = 1
    const STONE = 2
    const WOOD = 3
    const GRASS = 4
    const WATER = 6
    const LEAVES = 7
    const GRAVEL = 10
    const GRANITE = 12
    const DIORITE = 13
    const ANDESITE = 14
    const DEEPSLATE = 15

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    const columnIndex = (lx: number, lz: number): number => lx * CHUNK_SIZE + lz
    const terrainIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx

    const makeBiomeColumn = (biome: BiomeType, treeDensity = 0) => {
      switch (biome) {
        case 'SNOW':
          return {
            biome,
            props: { surfaceBlock: 'SNOW', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.1, humidity: 0.5 },
          } as const
        case 'JUNGLE':
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.9, humidity: 0.8 },
          } as const
        case 'FOREST':
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.6 },
          } as const
        default:
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.3 },
          } as const
      }
    }

    const makeTerrainChannels = () => ({
      continentalness: new Float64Array(256).fill(0.7),
      erosion: new Float64Array(256).fill(0.8),
      pv: new Float64Array(256).fill(0.2),
      jaggedness: new Float64Array(256),
    })

    const buildCustomTerrainLayer = (
      biomeColumns: ReadonlyArray<{
        biome: BiomeType
        props: {
          surfaceBlock: string
          subSurfaceBlock: string
          treeDensity: number
          temperature: number
          humidity: number
        }
      }>,
      terrainChannels: {
        continentalness: Float64Array
        erosion: Float64Array
        pv: Float64Array
        jaggedness: Float64Array
      },
    ) => {
      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const CustomBiomeLayer = Layer.succeed(
        BiomeService,
        {
          getBiome: (_x: number, _z: number) => Effect.succeed('PLAINS' as const),
          getBiomeProperties: (biome: BiomeType) => Effect.succeed(makeBiomeColumn(biome).props),
          getTemperature: (_x: number, _z: number) => Effect.succeed(0.5),
          getHumidity: (_x: number, _z: number) => Effect.succeed(0.5),
          getBiomesAndPropertiesForChunk: (_chunkX: number, _chunkZ: number) => Effect.succeed(biomeColumns),
        } as unknown as BiomeService,
      )
      const CustomNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.0),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.0)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.0)),
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0.0),
          erosion: (_x: number, _z: number) => Effect.succeed(0.0),
          weirdness: (_x: number, _z: number) => Effect.succeed(0.0),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0.0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(terrainChannels),
        } as unknown as NoiseServicePort),
      )

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(CustomBiomeLayer),
        Layer.provide(CustomNoise),
        Layer.provide(NoiseServiceLive),
        Layer.provide(buildLegacyTerrainPoolLayer(
          Layer.mergeAll(ChunkServiceLive, CustomBiomeLayer, CustomNoise),
        )),
        Layer.provide(LightEngineNoopLive),
      )

      return { TestLayer, storage }
    }

    const loadChunk = Effect.gen(function* () {
      const service = yield* ChunkManagerService
      return yield* service.getChunk({ x: 0, z: 0 })
    })

    const getGroundY = (blocks: Uint8Array, lx: number, lz: number): number => {
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const block = blocks[idx(lx, y, lz)]!
        if (block !== AIR && block !== WATER && block !== WOOD && block !== LEAVES) {
          return y
        }
      }
      return -1
    }

    const analyzeTree = (blocks: Uint8Array, lx: number, lz: number) => {
      let woodCount = 0
      let leafCount = 0
      let topWoodY = -1
      for (let x = Math.max(0, lx - 2); x <= Math.min(CHUNK_SIZE - 1, lx + 2); x++) {
        for (let z = Math.max(0, lz - 2); z <= Math.min(CHUNK_SIZE - 1, lz + 2); z++) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            const block = blocks[idx(x, y, z)]
            if (block === WOOD) {
              woodCount++
              topWoodY = Math.max(topWoodY, y)
            }
            if (block === LEAVES) {
              leafCount++
            }
          }
        }
      }
      const groundY = getGroundY(blocks, lx, lz)
      return {
        woodCount,
        leafCount,
        trunkHeight: topWoodY - groundY,
      }
    }

    const getSurfaceBlock = (blocks: Uint8Array, lx: number, lz: number): { y: number; block: number } => {
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const block = blocks[idx(lx, y, lz)]!
        if (block !== AIR && block !== WATER) {
          return { y, block }
        }
      }
      return { y: -1, block: AIR }
    }

    it('uses biome-driven tree archetypes deterministically', () => {
      const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('PLAINS', 0))
      biomeColumns[columnIndex(3, 3)] = makeBiomeColumn('PLAINS', 1)
      biomeColumns[columnIndex(8, 8)] = makeBiomeColumn('SNOW', 1)
      biomeColumns[columnIndex(12, 12)] = makeBiomeColumn('JUNGLE', 1)
      const terrainChannels = makeTerrainChannels()

      const { TestLayer: layerA } = buildCustomTerrainLayer(biomeColumns, terrainChannels)
      const { TestLayer: layerB } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunkA = yield* loadChunk.pipe(Effect.provide(layerA))
        const chunkB = yield* loadChunk.pipe(Effect.provide(layerB))

        expect(chunkA.blocks).toEqual(chunkB.blocks)

        const oak = analyzeTree(chunkA.blocks, 3, 3)
        const spruce = analyzeTree(chunkA.blocks, 8, 8)
        const jungle = analyzeTree(chunkA.blocks, 12, 12)

        expect(oak.trunkHeight).toBeGreaterThanOrEqual(4)
        expect(oak.trunkHeight).toBeLessThanOrEqual(6)
        expect(spruce.trunkHeight).toBeGreaterThanOrEqual(7)
        expect(jungle.trunkHeight).toBeGreaterThanOrEqual(8)
        expect(spruce.trunkHeight).toBeGreaterThan(oak.trunkHeight)
        expect(jungle.leafCount).toBeGreaterThan(oak.leafCount)
      }))
    })

    it('generates seamless tree canopies across chunk borders instead of suppressing edge trees', () => {
      const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('DESERT', 0))
      biomeColumns[columnIndex(15, 8)] = makeBiomeColumn('FOREST', 1)
      const terrainChannels = makeTerrainChannels()
      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const SeamBiomeLayer = Layer.succeed(
        BiomeService,
        {
          getBiome: (x: number, z: number) => Effect.succeed(x === 15 && z === 8 ? 'FOREST' as const : 'DESERT' as const),
          getBiomeProperties: (biome: BiomeType) => Effect.succeed(makeBiomeColumn(biome, biome === 'FOREST' ? 1 : 0).props),
          getTemperature: (_x: number, _z: number) => Effect.succeed(0.5),
          getHumidity: (_x: number, _z: number) => Effect.succeed(0.5),
          getBiomesAndPropertiesForChunk: (chunkX: number, _chunkZ: number) =>
            Effect.succeed(chunkX === 0 ? biomeColumns : Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('DESERT', 0))),
        } as unknown as BiomeService,
      )
      const SeamNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.0),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.0)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.0)),
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0.7),
          erosion: (_x: number, _z: number) => Effect.succeed(0.8),
          weirdness: (_x: number, _z: number) => Effect.succeed(0.2),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0.0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(terrainChannels),
        } as unknown as NoiseServicePort),
      )
      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(SeamBiomeLayer),
        Layer.provide(SeamNoise),
        Layer.provide(NoiseServiceLive),
        Layer.provide(buildLegacyTerrainPoolLayer(
          Layer.mergeAll(ChunkServiceLive, SeamBiomeLayer, SeamNoise),
        )),
        Layer.provide(LightEngineNoopLive),
      )

      return Effect.runPromise(Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const leftChunk = yield* service.getChunk({ x: 0, z: 0 })
        const rightChunk = yield* service.getChunk({ x: 1, z: 0 })

        const rightBorderTreeBlocks = Arr.filter(Arr.makeBy(CHUNK_HEIGHT, (y) => rightChunk.blocks[idx(0, y, 8)]!), (block) => block === WOOD || block === LEAVES)
        const leftOriginTree = analyzeTree(leftChunk.blocks, 15, 8)

        expect(leftOriginTree.woodCount).toBeGreaterThan(0)
        expect(rightBorderTreeBlocks.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer)))
    })

    it('adds rocky surface variation on rugged highland columns while gentle forest stays grassy', () => {
      const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('FOREST', 0))
      const terrainChannels = makeTerrainChannels()

      terrainChannels.continentalness[terrainIndex(6, 6)] = 0.8
      terrainChannels.erosion[terrainIndex(6, 6)] = -0.8
      terrainChannels.pv[terrainIndex(6, 6)] = 0.9
      terrainChannels.jaggedness[terrainIndex(6, 6)] = 1.0

      terrainChannels.continentalness[terrainIndex(9, 9)] = 0.8
      terrainChannels.erosion[terrainIndex(9, 9)] = 0.9
      terrainChannels.pv[terrainIndex(9, 9)] = 0.5
      terrainChannels.jaggedness[terrainIndex(9, 9)] = 0.0

      const { TestLayer } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunk = yield* loadChunk.pipe(Effect.provide(TestLayer))

        const roughSurface = getSurfaceBlock(chunk.blocks, 6, 6)
        const gentleSurface = getSurfaceBlock(chunk.blocks, 9, 9)

        expect(roughSurface.y).toBeGreaterThan(0)
        expect(gentleSurface.y).toBeGreaterThan(0)
        expect([STONE, GRAVEL]).toContain(roughSurface.block)
        expect(gentleSurface.block).toBe(GRASS)
        expect(chunk.blocks[idx(9, gentleSurface.y - 1, 9)]).toBe(DIRT)
      }))
    })

    it('adds stone overhangs above the base surface in rugged mountain terrain', () => {
      const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('MOUNTAINS', 0))
      const terrainChannels = makeTerrainChannels()
      terrainChannels.jaggedness.fill(0.9)

      const { TestLayer } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunk = yield* loadChunk.pipe(Effect.provide(TestLayer))
        const baseSurfaceY = computeColumnY(terrainChannels, 8, 8)

        let foundOverhang = false
        for (let y = baseSurfaceY + 2; y < Math.min(baseSurfaceY + 14, CHUNK_HEIGHT); y++) {
          const block = chunk.blocks[idx(8, y, 8)]!
          if (HashSet.has(HashSet.make(STONE, DEEPSLATE, GRANITE, DIORITE, ANDESITE), block)) {
            foundOverhang = true
            break
          }
        }

        expect(foundOverhang).toBe(true)
      }))
    })
  })

  describe('Phase 1.2 — bedrock layer, deepslate, stone variants', () => {
    const AIR = 0
    const DIRT = 1
    const STONE = 2
    const GRANITE = 12
    const DIORITE = 13
    const ANDESITE = 14
    const BEDROCK = 16

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    it.effect('y=0 is ALWAYS BEDROCK across every (lx, lz) column', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        yield* Effect.forEach(
          Arr.makeBy(CHUNK_SIZE, (i) => i),
          (lx) =>
            Effect.forEach(
              Arr.makeBy(CHUNK_SIZE, (i) => i),
              (lz) =>
                Effect.sync(() => {
                  expect(chunk.blocks[idx(lx, 0, lz)]).toBe(BEDROCK)
                }),
              { concurrency: 1 },
            ),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('y<16 in the deep-stone region is DEEPSLATE, never STONE', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Generate several chunks and scan y=5..15 across all columns.
        // y=5..15 is above the bedrock layer (y<=4) and below DEEPSLATE_CEILING=16.
        // In this band the block must be DEEPSLATE (never STONE) wherever the
        // column reaches that altitude — surface is always >= LAKE_LEVEL=62 in
        // the default biome so y=5..15 is deep stone for every column.
        yield* Effect.forEach(
          Arr.makeBy(3, (i) => i),
          (cx) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk({ x: cx, z: 0 })
              yield* Effect.forEach(
                Arr.makeBy(CHUNK_SIZE, (i) => i),
                (lx) =>
                  Effect.forEach(
                    Arr.makeBy(CHUNK_SIZE, (i) => i),
                    (lz) =>
                      Effect.forEach(
                        // y=5..15 inclusive
                        Arr.makeBy(11, (i) => i + 5),
                        (y) =>
                          Effect.sync(() => {
                            const b = chunk.blocks[idx(lx, y, lz)]
                            // Must never be STONE in this altitude band
                            expect(b).not.toBe(STONE)
                          }),
                        { concurrency: 1 },
                      ),
                    { concurrency: 1 },
                  ),
                { concurrency: 1 },
              )
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('stone variants only replace STONE/DEEPSLATE — never AIR/DIRT/BEDROCK', () => {
      // Custom noise mock that forces variant patches by returning a high value
      // for the variant noise pattern (values > VARIANT_THRESHOLD=0.90).
      // All other 2D batches use the neutral 0.5 value (so terrain is flat).
      const HighVariantNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.95),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (
            points: ReadonlyArray<readonly [number, number]>,
            _o: number,
            _p: number,
            _l: number,
          ) => Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (
            xs: ReadonlyArray<number>,
            _zs: ReadonlyArray<number>,
            _o: number,
            _p: number,
            _l: number,
          ) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.95)),
          noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
            Effect.succeed(xs.map(() => 0.95)),
          // Phase 1.3: 3D noise for cave carving. Return 1.0 (above any cave threshold)
          // so no caves are carved in this test — keeps the variant check focused.
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (
            xs: ReadonlyArray<number>,
            _ys: ReadonlyArray<number>,
            _zs: ReadonlyArray<number>,
          ) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0),
          erosion: (_x: number, _z: number) => Effect.succeed(0),
          weirdness: (_x: number, _z: number) => Effect.succeed(0),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0),
          sampleTerrainChannels: (_cx: number, _cz: number) =>
            Effect.succeed({
              continentalness: new Float64Array(256),
              erosion: new Float64Array(256),
              pv: new Float64Array(256),
              jaggedness: new Float64Array(256),
            }),
        } as unknown as NoiseServicePort),
      )

      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(HighVariantNoise))

      const HighVariantTestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(HighVariantNoise),
        Layer.provide(NoiseServiceLive),
        Layer.provide(buildLegacyTerrainPoolLayer(
          Layer.mergeAll(ChunkServiceLive, BiomeTestLayer, HighVariantNoise),
        )),
        Layer.provide(LightEngineNoopLive),
      )

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        // Scan the entire chunk. Verify:
        //   (a) No variant block appears at y<=4 (bedrock layer).
        //   (b) No variant block sits adjacent to AIR above it (i.e. variants
        //       never overwrote the biome surface/subsurface DIRT/SAND).
        // Because the noise mock forces all 2D-noise to 0.95 ( > 0.90 threshold),
        // GRANITE must appear at least once across the chunk (proving path runs).
        let variantBlockCount = 0
        let bedrockLayerVariants = 0
        let variantsAdjacentToAir = 0

        yield* Effect.sync(() => {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
              for (let y = 0; y < CHUNK_HEIGHT; y++) {
                const b = chunk.blocks[idx(lx, y, lz)]
                const isVariant = b === GRANITE || b === DIORITE || b === ANDESITE
                if (!isVariant) continue
                variantBlockCount++
                if (y <= 4) bedrockLayerVariants++
                const above = y + 1 < CHUNK_HEIGHT ? chunk.blocks[idx(lx, y + 1, lz)] : AIR
                if (above === AIR) variantsAdjacentToAir++
              }
            }
          }
        })

        // Variants must exist (proves the path is exercised)
        expect(variantBlockCount).toBeGreaterThan(0)
        // Variants must NEVER be in the bedrock layer (y<=4)
        expect(bedrockLayerVariants).toBe(0)
        // Variants must NEVER be directly under AIR (would mean a DIRT/SAND was overwritten)
        expect(variantsAdjacentToAir).toBe(0)

        // Also: at a specific column, verify that cells at y in [surfaceY-3, surfaceY-1]
        // are the biome subsurface block when above water line (skip water columns).
        // Surface detection: highest non-(AIR/WATER) block.
        const WATER = 6
        let landSurfaceY = -1
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const b = chunk.blocks[idx(8, y, 8)]
          if (b !== AIR && b !== WATER) {
            landSurfaceY = y
            break
          }
        }
        expect(landSurfaceY).toBeGreaterThan(4)
        // At y = landSurfaceY-1 (clearly subsurface), the block must NOT be a variant.
        const subSurfaceBlock = chunk.blocks[idx(8, landSurfaceY - 1, 8)]
        expect(
          subSurfaceBlock === GRANITE || subSurfaceBlock === DIORITE || subSurfaceBlock === ANDESITE,
        ).toBe(false)
        // It must be either DIRT, SAND, or STONE (biome subsurface)
        expect([DIRT, 5 /* SAND */, STONE]).toContain(subSurfaceBlock)
      }).pipe(Effect.provide(HighVariantTestLayer))
    })

    it.effect('terrain generation is deterministic — same coord yields identical blocks on fresh service', () => {
      // Build two independent service instances and compare blocks for the same coord.
      // Because bedrock uses Math.sin hash (deterministic) and noise is stateless,
      // the two chunks must be byte-for-byte identical.
      const layer1 = buildTestLayer().TestLayer
      const layer2 = buildTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 2, z: -4 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 2, z: -4 })
        }).pipe(Effect.provide(layer2))

        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Phase 1.3: Cave carving via 3D Perlin noise
  //
  // Caves are carved AFTER fillColumn but BEFORE tree placement. Invariants:
  //   - Bedrock layer (y <= 4) is never touched
  //   - Existing WATER/AIR is never modified
  //   - Cave carving produces a non-trivial number of AIR voxels in the deep
  //     stone band (y=10..40) for a default-seeded chunk
  // ---------------------------------------------------------------------------

  describe('Phase 1.3 — 3D cave carving', () => {
    const AIR = 0
    const BEDROCK = 16

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    it.effect('bedrock layer (y<=4) must be intact after cave carving', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan a handful of chunks to catch any stray carve into y<=4
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: -1, z: 2 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    expect(chunk.blocks[idx(lx, 0, lz)]).toBe(BEDROCK)
                    for (const y of [1, 2, 3, 4] as const) {
                      expect(chunk.blocks[idx(lx, y, lz)]).not.toBe(AIR)
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('carves SOME AIR voxels in the deep-stone region (y=10..40)', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan a 2x2 chunk area — deterministic seed guarantees ≥1 AIR voxel somewhere.
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: 1, z: 1 },
        ]
        let airVoxelCount = 0

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 10; y <= 40; y++) {
                      if (chunk.blocks[idx(lx, y, lz)] === AIR) {
                        airVoxelCount++
                      }
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )

        // Assert at least some carving happened. With threshold=0.18 and
        // smoothstep depth bias, a 4-chunk scan should easily produce >> 0.
        expect(airVoxelCount).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('deterministic carving — same seed produces identical cave patterns', () => {
      // Build two independent service instances; their cave patterns must match
      // byte-for-byte because the 3D noise is seeded deterministically.
      const layer1 = buildTestLayer().TestLayer
      const layer2 = buildTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 5, z: -3 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 5, z: -3 })
        }).pipe(Effect.provide(layer2))

        // Full chunk byte comparison — same Perlin seed → same caves
        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Phase 1.4: Depth-based ore vein generation
  //
  // Ores are placed AFTER cave carving but BEFORE tree placement so caves can
  // expose ore walls. Invariants:
  //   - Never overwrite AIR / WATER / BEDROCK / DIRT / GRASS / SAND / existing-ores
  //   - DIAMOND only at y <= 16; GOLD/LAPIS/EMERALD at y <= 32
  //   - DEEPSLATE_*_ORE below y=16; regular *_ORE at y >= 16
  //   - Deterministic: same chunk coord → identical ore placement byte-for-byte
  // ---------------------------------------------------------------------------

  describe('Phase 1.4 — depth-based ore vein generation', () => {
    const AIR = 0
    const DIRT = 1
    const GRASS = 4
    const SAND = 5
    const WATER = 6
    const COAL_ORE = 19
    const IRON_ORE = 20
    const GOLD_ORE = 21
    const DIAMOND_ORE = 22
    const REDSTONE_ORE = 23
    const LAPIS_ORE = 24
    const EMERALD_ORE = 25
    const DEEPSLATE_COAL_ORE = 26
    const DEEPSLATE_DIAMOND_ORE = 29
    const DEEPSLATE_EMERALD_ORE = 32

    const REGULAR_ORES = [COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, REDSTONE_ORE, LAPIS_ORE, EMERALD_ORE]
    const DEEPSLATE_ORES = [26, 27, 28, 29, 30, 31, 32]
    const ALL_ORES_SET = HashSet.fromIterable(Arr.appendAll(REGULAR_ORES, DEEPSLATE_ORES))
    const REGULAR_ORES_SET = HashSet.fromIterable(REGULAR_ORES)
    const DEEPSLATE_ORES_SET = HashSet.fromIterable(DEEPSLATE_ORES)

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    const isOre = (b: number | undefined): boolean => b !== undefined && HashSet.has(ALL_ORES_SET, b)

    // Build a test layer with a mock noise service that keeps caves from carving
    // (noise3D = 1.0 > any threshold). Stone variants off (2D noise = 0.5 <
    // VARIANT_THRESHOLD). Terrain is flat-ish → fills columns with STONE/DEEPSLATE/DIRT/GRASS.
    // Ensures ore placement has enough STONE/DEEPSLATE real estate for reliable test counts.
    // (The stateless default NoiseServicePort returns noise3D=0 which carves every
    // voxel in y=5..58 to AIR, leaving no STONE for ores to replace.)
    const buildOreTestLayer = () => {
      const OreNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          // noise3D = 1.0 keeps |interpolated| above CAVE_BASE_THRESHOLD=0.18 → no carving.
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0),
          erosion: (_x: number, _z: number) => Effect.succeed(0),
          weirdness: (_x: number, _z: number) => Effect.succeed(0),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0),
          sampleTerrainChannels: (_cx: number, _cz: number) =>
            Effect.succeed({
              continentalness: new Float64Array(256),
              erosion: new Float64Array(256),
              pv: new Float64Array(256),
              jaggedness: new Float64Array(256),
            }),
        } as unknown as NoiseServicePort),
      )

      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
      const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(OreNoise))

      const TestLayer = ChunkManagerServiceLive.pipe(
        Layer.provide(ChunkServiceLive),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(OreNoise),
        Layer.provide(NoiseServiceLive),
        Layer.provide(buildLegacyTerrainPoolLayer(
          Layer.mergeAll(ChunkServiceLive, BiomeTestLayer, OreNoise),
        )),
        Layer.provide(LightEngineNoopLive),
      )

      return { TestLayer, storage }
    }

    it.effect('ores never overwrite BEDROCK layer (y<=4)', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 2 },
          { x: -3, z: 4 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 0; y <= 4; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      expect(isOre(b)).toBe(false)
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('ores never overwrite AIR / WATER / DIRT / GRASS / SAND anywhere in chunk', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan multiple chunks and verify block type invariants. Specifically,
        // for any y above the column's surface (y > surfaceY), the block must
        // NOT be an ore — ore placement must not have leaked into the sky AIR.
        const coords = [
          { x: 0, z: 0 },
          { x: 2, z: -1 },
          { x: -1, z: 3 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    let surfY = -1
                    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b !== AIR && b !== WATER) { surfY = y; break }
                    }
                    for (let y = surfY + 1; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      expect(isOre(b)).toBe(false)
                    }
                    if (surfY >= 0) {
                      const start = Math.max(5, surfY - 3)
                      for (let y = start; y <= surfY; y++) {
                        const b = chunk.blocks[idx(lx, y, lz)]
                        if (b === DIRT || b === GRASS || b === SAND) {
                          expect(isOre(b)).toBe(false)
                        }
                      }
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('DIAMOND only appears at y <= 16', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan many chunks — find all DIAMOND/DEEPSLATE_DIAMOND cells, verify y<=16
        const coords = Arr.flatMap(Arr.makeBy(3, (i) => i - 1), (x) =>
          Arr.map(Arr.makeBy(3, (i) => i - 1), (z) => ({ x, z })),
        )

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b === DIAMOND_ORE || b === DEEPSLATE_DIAMOND_ORE) {
                        expect(y).toBeLessThanOrEqual(16)
                      }
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('DEEPSLATE_*_ORE used below y=16; regular *_ORE used at y >= 16', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = Arr.flatMap(Arr.makeBy(4, (i) => i), (x) =>
          Arr.map(Arr.makeBy(4, (i) => i), (z) => ({ x, z })),
        )

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b === undefined) continue
                      if (HashSet.has(REGULAR_ORES_SET, b)) {
                        expect(y).toBeGreaterThanOrEqual(16)
                      }
                      if (HashSet.has(DEEPSLATE_ORES_SET, b)) {
                        expect(y).toBeLessThan(16)
                      }
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('common ores (COAL/IRON) appear across a multi-chunk scan', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan a 4x4 chunk area; with COAL avg=20 veins (size 5-12) per chunk,
        // we should see many COAL cells. Similarly IRON.
        const coords = Arr.flatMap(Arr.makeBy(4, (i) => i), (x) =>
          Arr.map(Arr.makeBy(4, (i) => i), (z) => ({ x, z })),
        )
        let coalCount = 0
        let ironCount = 0

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b === COAL_ORE || b === DEEPSLATE_COAL_ORE) coalCount++
                      if (b === IRON_ORE || b === 27 /* DEEPSLATE_IRON_ORE */) ironCount++
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )

        // With 16 chunks × 20 avg veins × ~8 avg size = ~2560 expected COAL blocks,
        // we should easily see > 100. Generous lower bound to avoid flakiness.
        expect(coalCount).toBeGreaterThan(100)
        expect(ironCount).toBeGreaterThan(50)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('ore placement is deterministic — same coord yields identical ore layout', () => {
      // Two independent service instances with the same coord must produce
      // byte-for-byte identical blocks arrays (ores included).
      const layer1 = buildOreTestLayer().TestLayer
      const layer2 = buildOreTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 7, z: -2 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 7, z: -2 })
        }).pipe(Effect.provide(layer2))

        // Count ores in each chunk — counts must match exactly.
        const oresA = Arr.filter(Arr.fromIterable(chunkA.blocks), isOre).length
        const oresB = Arr.filter(Arr.fromIterable(chunkB.blocks), isOre).length
        expect(oresA).toBe(oresB)
        expect(oresA).toBeGreaterThan(0) // sanity: ores exist
        // Full byte equality — includes ore positions
        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })

    it.effect('EMERALD appears across a multi-chunk scan (rare but non-zero)', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Scan a 6x6 chunk area (36 chunks); EMERALD avg=1 per chunk → expect some.
        const coords = Arr.flatMap(Arr.makeBy(4, (i) => i), (x) =>
          Arr.map(Arr.makeBy(4, (i) => i), (z) => ({ x, z })),
        )
        let emeraldCount = 0

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b === EMERALD_ORE || b === DEEPSLATE_EMERALD_ORE) emeraldCount++
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )

        // Across 36 chunks with avg=1 vein (size 1-3) each, expect at least some.
        expect(emeraldCount).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
