import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { StorageService } from '@/infrastructure/storage/storage-service'
import { NoiseServiceLive } from '@/infrastructure/noise/noise-service'
import { BiomeServiceLive } from '@/application/biome/biome-service'
import { ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { WorldIdSchema } from '@/shared/kernel'
import { ChunkManagerService, ChunkManagerServiceLive, RENDER_DISTANCE } from './chunk-manager-service'

// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

const makeInMemoryStorage = () => {
  const chunks = new Map<string, Uint8Array>()
  const metadata = new Map<string, unknown>()

  return StorageService.of({
    initialize: Effect.void,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        chunks.set(`${worldId}:${coord.x}:${coord.z}`, data)
      }),
    loadChunk: (worldId, coord) =>
      Effect.sync(() => {
        const data = chunks.get(`${worldId}:${coord.x}:${coord.z}`)
        return data !== undefined ? Option.some(data) : Option.none()
      }),
    saveWorldMetadata: (worldId, meta) =>
      Effect.sync(() => {
        metadata.set(worldId, meta)
      }),
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
      }),
  })
}

// ---------------------------------------------------------------------------
// Test layer composition
// ---------------------------------------------------------------------------

const buildTestLayer = () => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageService, storage)
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
})
