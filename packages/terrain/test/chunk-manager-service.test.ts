import { describe,it } from '@effect/vitest'
import { DEFAULT_WORLD_ID } from '@ts-minecraft/kernel'
import {
BiomeServiceLive,
ChunkManagerService,
  ChunkManagerServiceLive,
  ChunkError,
  ChunkServiceLive,
NoiseServiceLive,
NoiseServicePort,
StorageServicePort,
TerrainGenerationError,
TerrainWorkerPoolPort,
} from '@ts-minecraft/terrain'
import { Array as Arr,Effect,Either,Layer,Option } from 'effect'
import { expect } from 'vitest'
import {
EXPECTED_BLOCKS_LENGTH,
LightEngineNoopLive,
buildTestLayer,
chunkStorageBlocks
} from './chunk-manager-test-utils'

const buildTerrainFailureLayer = () => {
  const storage = buildTestLayer().storage
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))
  const FailingTerrainPoolLayer = Layer.succeed(
    TerrainWorkerPoolPort,
    TerrainWorkerPoolPort.of({
      _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
      generateTerrain: (coord) =>
        Effect.fail(new TerrainGenerationError({
          chunk: coord,
          reason: 'simulated terrain generation failure',
        })),
    })
  )

  return ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(FailingTerrainPoolLayer),
    Layer.provide(LightEngineNoopLive),
  )
}

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
        yield* storage.saveChunk(DEFAULT_WORLD_ID, { x: 3, z: 7 }, { blocks: savedBlocks, fluid: undefined })

        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 3, z: 7 })

        expect(chunk.coord.x).toBe(3)
        expect(chunk.coord.z).toBe(7)
        expect(chunk.blocks).toEqual(savedBlocks)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('converts terrain generation failures into ChunkError', () => {
      const TestLayer = buildTerrainFailureLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const result = yield* Effect.either(service.getChunk({ x: 11, z: 13 }))

        expect(Either.isLeft(result)).toBe(true)
        const error = Option.getOrThrow(Either.getLeft(result))
        expect(error._tag).toBe('ChunkError')
        if (!(error instanceof ChunkError)) throw new Error('Expected ChunkError')
        expect(error.reason).toBe('simulated terrain generation failure')
        expect(error.chunkCoord).toEqual({ x: 11, z: 13 })
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('markChunkDirty and saveDirtyChunks', () => {
    it.effect('markChunkDirty on non-loaded chunk is a no-op (onNone path)', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        // Call markChunkDirty WITHOUT loading the chunk — triggers onNone: () => Effect.void
        yield* service.markChunkDirty({ x: 99, z: 99 })
        // No error and no chunk loaded
        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

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

    it.effect('returns cached result on second consecutive call (cache-hit onSome path)', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 0, z: 0 })

        // First call: cache is None → computes array and caches it
        const first = yield* service.getLoadedChunks()
        expect(first.length).toBe(1)

        // Second call: cache is Some → onSome: Effect.succeed path is exercised
        const second = yield* service.getLoadedChunks()
        expect(second.length).toBe(1)
        expect(second).toBe(first)
      }).pipe(Effect.provide(TestLayer))
    })
  })

})
