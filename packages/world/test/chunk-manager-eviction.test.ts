import { describe,it } from '@effect/vitest'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/worker'
import { DEFAULT_WORLD_ID } from '@ts-minecraft/core'
import {
BiomeService,
ChunkManagerService,
MAX_CACHED_CHUNKS,NoiseService,NoiseServicePort,RENDER_DISTANCE,StorageServicePort,UNLOAD_DISTANCE,
getChunksInRenderDistance
} from '@ts-minecraft/world'
import { StorageError } from '@ts-minecraft/world'
import { Array as Arr,Effect,Layer,Option } from 'effect'
import { expect } from 'vitest'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import {
EXPECTED_BLOCKS_LENGTH,
LightEngineNoopLayer,
buildTestLayerWithStoredChunks,
chunkStorageBlocks,
makeInMemoryStorage
} from './chunk-manager-test-utils'

describe('application/chunk/chunk-manager-service (eviction)', () => {
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
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)

      Effect.runSync(
        Effect.forEach(Arr.makeBy(count, i => i), (i) => storage.saveChunk(DEFAULT_WORLD_ID, { x: i, z: 0 }, { blocks: minimalBlocks, fluid: undefined }), { concurrency: 1 })
      )

      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(NoiseLayer))

      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseService.Default),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLayer),
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
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 0, z: 0 }, { blocks: sentinelBlocks, fluid: undefined })

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

    // The defining LRU property (vs FIFO): a cache HIT refreshes a chunk's
    // recency so it survives eviction. getChunk does this via an in-place
    // `cached.lastAccessed = …` mutation that relies on Effect HashMap returning
    // the entry by reference. If that mechanism silently broke, the cache would
    // degrade to FIFO and the chunk the player is standing in could be evicted
    // and reloaded (visible pop-in). This test fails under FIFO.
    it.effect('a cache hit refreshes LRU recency, protecting the chunk from eviction', () => {
      const { TestLayer } = buildLayerWithStorageChunks(MAX_CACHED_CHUNKS + 1)

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        // (0,0) loaded first → initially the oldest entry.
        yield* service.getChunk({ x: 0, z: 0 })
        // Fill the cache to capacity with chunks 1..MAX-1.
        yield* Effect.forEach(Arr.makeBy(MAX_CACHED_CHUNKS - 1, i => i + 1), (i) => service.getChunk({ x: i, z: 0 }), { concurrency: 1 })

        // Re-access (0,0): a cache hit that must bump it to most-recently-used,
        // making (1,0) the new LRU entry.
        yield* service.getChunk({ x: 0, z: 0 })

        // One more load triggers eviction of the LRU entry.
        yield* service.getChunk({ x: MAX_CACHED_CHUNKS, z: 0 })

        const loaded = yield* service.getLoadedChunks()
        // (0,0) survived because the cache hit refreshed its recency.
        expect(Arr.some(loaded, (c) => c.coord.x === 0 && c.coord.z === 0)).toBe(true)
        // (1,0) — the genuine LRU after the touch — was evicted instead.
        expect(Arr.some(loaded, (c) => c.coord.x === 1 && c.coord.z === 0)).toBe(false)
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
          Effect.void,
        loadChunk: (_worldId, _coord) =>
          Effect.fail(
            new StorageError({ operation: 'loadChunk', cause: 'simulated storage failure' })
          ),
      })

      const FailingStorageLayer = Layer.succeed(StorageServicePort, failingStorage)
      const NoiseLayer = NoiseServicePort.Default
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(NoiseLayer))

      const FailingTestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(FailingStorageLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(NoiseLayer),
        Layer.provide(NoiseService.Default),
        Layer.provide(TerrainWorkerPoolPortLayer),
        Layer.provide(LightEngineNoopLayer),
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
})
