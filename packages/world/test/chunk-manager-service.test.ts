import { describe,it } from '@effect/vitest'
import { DEFAULT_WORLD_ID, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import {
  BiomeService,
  ChunkManagerService,
  ChunkError,
  ChunkService,
  NoiseService,
  NoiseServicePort,
  StorageServicePort,
} from '@ts-minecraft/world'
import { TerrainGenerationError, TerrainWorkerPoolPort } from '@ts-minecraft/worker'
import { Array as Arr,Effect,Either,Layer,Option } from 'effect'
import { expect } from 'vitest'
import {
EXPECTED_BLOCKS_LENGTH,
LightEngineNoopLayer,
buildTestLayer,
chunkStorageBlocks
} from './chunk-manager-test-utils'

const buildTerrainFailureLayer = () => {
  const storage = buildTestLayer().storage
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(NoiseLayer))
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

  return ChunkManagerService.Default.pipe(
    Layer.provide(ChunkService.Default),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseService.Default),
    Layer.provide(FailingTerrainPoolLayer),
    Layer.provide(LightEngineNoopLayer),
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
  if (!(error instanceof ChunkError)) expect.fail('Expected ChunkError')
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

    it.effect('clears the dirty set after save so an immediate re-save (no new edits) persists nothing', () => {
      // Without clearing the dirty set, every loaded-and-once-edited chunk would
      // be re-written on every autosave tick forever. A redundant re-save writes
      // identical bytes, so loadChunk cannot detect it — assert via the save-call
      // counter that the SECOND saveDirtyChunks issues no further writes.
      const { TestLayer, storage } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        yield* service.getChunk({ x: 3, z: 3 })
        yield* service.markChunkDirty({ x: 3, z: 3 })

        yield* service.saveDirtyChunks()
        const afterFirst = storage._saveChunkCount()
        expect(afterFirst).toBeGreaterThan(0)

        // No new edits between saves → the dirty set must now be empty.
        yield* service.saveDirtyChunks()
        expect(storage._saveChunkCount()).toBe(afterFirst)
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

    // FR-4.2: dirty AABB tracking — drainRenderDirtyChunkEntries pairs each
    // dirty chunk with the union of voxel AABBs accumulated since last drain.
    it.effect('drainRenderDirtyChunkEntries reports unioned AABB per chunk and is reset on drain', () => {
      const { TestLayer } = buildTestLayer()
      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 0, z: 0 })
        // First mark with a single voxel.
        yield* service.markChunkDirty({ x: 0, z: 0 }, [{ lx: 3, y: 60, lz: 5 }])
        // Second mark with a different voxel — AABB should be unioned.
        yield* service.markChunkDirty({ x: 0, z: 0 }, [{ lx: 7, y: 70, lz: 2 }])

        const entries = yield* service.drainRenderDirtyChunkEntries()
      // Edited chunk plus all 9 neighbors get marked when no BFS is available, or
        // BFS-trimmed). Find the (0,0) entry.
        const target = entries.find((e) => e.chunk.coord.x === 0 && e.chunk.coord.z === 0)
        expect(target).toBeDefined()
  if (target === undefined) expect.fail('expected (0,0) entry')
        expect(Option.isSome(target.dirtyAABB)).toBe(true)
        const aabb = Option.getOrThrow(target.dirtyAABB)
        // The union covers both voxels — first voxel set lower bounds, second
        // raises maxX/maxY beyond the first while pulling minZ down.
        expect(aabb.minX).toBeLessThanOrEqual(3)
        expect(aabb.maxX).toBeGreaterThanOrEqual(7)
        expect(aabb.minY).toBeLessThanOrEqual(60)
        expect(aabb.maxY).toBeGreaterThanOrEqual(70)
        expect(aabb.minZ).toBeLessThanOrEqual(2)
        expect(aabb.maxZ).toBeGreaterThanOrEqual(5)

        // Drain resets state — second drain returns empty.
        const second = yield* service.drainRenderDirtyChunkEntries()
        expect(second).toEqual([])
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('drainRenderDirtyChunkEntries falls back to full-chunk (Option.none) when no voxels supplied', () => {
      const { TestLayer } = buildTestLayer()
      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        yield* service.getChunk({ x: 0, z: 0 })
        // markChunkDirty WITHOUT voxels → caller signals "full chunk dirty".
        yield* service.markChunkDirty({ x: 0, z: 0 })

        const entries = yield* service.drainRenderDirtyChunkEntries()
        const target = entries.find((e) => e.chunk.coord.x === 0 && e.chunk.coord.z === 0)
        expect(target).toBeDefined()
  if (target === undefined) expect.fail('expected (0,0) entry')
        // No voxels supplied AND noop light engine ⇒ fallback to full-chunk
        // AABB stored as a concrete value (not Option.none).
        expect(Option.isSome(target.dirtyAABB)).toBe(true)
        const aabb = Option.getOrThrow(target.dirtyAABB)
        expect(aabb.minX).toBe(0)
        expect(aabb.maxX).toBe(15)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('drainRenderDirtyChunks clears only render-dirty state and preserves persistence dirty chunks', () => {
      const { TestLayer, storage } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 1, z: 1 })
        yield* service.markChunkDirty({ x: 1, z: 1 })

        const renderDirtyChunks = yield* service.drainRenderDirtyChunks()
        expect(renderDirtyChunks).toHaveLength(1)
        expect(renderDirtyChunks[0]?.coord).toEqual({ x: 1, z: 1 })

        const drainedAgain = yield* service.drainRenderDirtyChunks()
        expect(drainedAgain).toEqual([])

        yield* service.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 1, z: 1 })
        expect(Option.isSome(stored)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    // FR-3.3: markChunkDirty must refresh chunk.maxY after in-place block edits.
    // Without this, building above the original maxY (e.g. tower construction)
    // leaves a stale AABB upper bound and the new geometry is frustum-culled.
    it.effect('refreshes chunk.maxY when a block is added above the original maxY', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const chunk = yield* service.getChunk({ x: 0, z: 0 })
        const originalMaxY = chunk.maxY ?? -1

        // Place a STONE block well above the existing terrain top (mimics tower build).
        const towerY = Math.min(originalMaxY + 50, 250)
        chunk.blocks[blockIndexUnsafe(0, towerY, 0)] = blockTypeToIndex('STONE')

        yield* service.markChunkDirty({ x: 0, z: 0 })

        const refreshed = Arr.fromIterable(yield* service.getLoadedChunks())
        const updated = refreshed.find((c) => c.coord.x === 0 && c.coord.z === 0)
        expect(updated).toBeDefined()
        expect(updated!.maxY).toBe(towerY)
        expect(updated!.maxY).toBeGreaterThan(originalMaxY)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('refreshes chunk.maxY downward when the highest block is removed', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const chunk = yield* service.getChunk({ x: 0, z: 0 })
        const originalMaxY = chunk.maxY ?? -1

        // Wipe the entire y=originalMaxY plane so maxY must drop.
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            chunk.blocks[blockIndexUnsafe(x, originalMaxY, z)] = 0
          }
        }

        yield* service.markChunkDirty({ x: 0, z: 0 })

        const refreshed = Arr.fromIterable(yield* service.getLoadedChunks())
        const updated = refreshed.find((c) => c.coord.x === 0 && c.coord.z === 0)
        expect(updated).toBeDefined()
        expect(updated!.maxY).toBeLessThan(originalMaxY)
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
