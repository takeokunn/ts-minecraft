import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { type Chunk } from '../domain/chunk'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import { type DirtyVoxel, type IncrementalLightResult } from '../domain/light-engine-model'
import { type ChunkCacheKey, type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'
import { type ChunkOpsContext } from './chunk-manager-ops'
import { resolveDirtyChunkLighting } from './chunk-manager-service-dirty-update'

const worldId = 'world-1'
const chunkKey = chunkCoordToWorldKey({ x: 0, z: 0 }, worldId)

const makeChunk = (overrides: Partial<Chunk> = {}): Chunk =>
  ({
    coord: { x: 0, z: 0 },
    blocks: new Uint8Array(16 * 16 * 256),
    maxY: -1,
    ...overrides,
  }) as Chunk

const makeEntry = (chunk: Chunk): ChunkCacheEntry => ({
  chunk,
  lastAccessed: 1,
})

const makeCache = (): ChunkCache => ({
  chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
  dirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyAABBs: HashMap.empty<ChunkCacheKey, never>(),
})

const makeContext = (lightEngineOverrides: Partial<ChunkOpsContext['lightEngine']> = {}): ChunkOpsContext => {
  const propagateLightIncremental = vi.fn()
  const updateLight = vi.fn()

  return {
    worldIdRef: Effect.runSync(Ref.make(worldId)),
    dimensionRef: Effect.runSync(Ref.make('overworld')),
    cache: Effect.runSync(Ref.make(makeCache())),
    cachedLoadedChunksRef: Effect.runSync(Ref.make(HashMap.empty<ChunkCacheKey, never>())),
    maxCachedChunksRef: Effect.runSync(Ref.make(64)),
    accessCounterRef: Effect.runSync(Ref.make(0)),
    storageService: {},
    noiseService: {},
    terrainPool: {},
    lightEngine: {
      propagateLightIncremental,
      updateLight,
      ...lightEngineOverrides,
    },
  } as ChunkOpsContext
}

const dirtyVoxels: ReadonlyArray<DirtyVoxel> = [{ lx: 3, y: 42, lz: 7 }]

describe('chunk-manager-service-dirty-update', () => {
  it('returns an empty BFS result when the cache entry is missing', () => {
    const ctx = makeContext()

    const result = Effect.runSync(resolveDirtyChunkLighting(ctx, chunkKey, null, dirtyVoxels))

    expect(Option.isNone(result)).toBe(true)
  })

  it('delegates to incremental lighting when a cache entry exists', () => {
    const incrementalResult: IncrementalLightResult = {
      skyLight: new Uint8Array(16 * 16 * 256 / 2),
      blockLight: new Uint8Array(16 * 16 * 256 / 2),
      boundary: { nx: true, px: false, nz: false, pz: true },
      affectedAABB: Option.none(),
    }
    const propagateLightIncremental = vi.fn(() => Effect.succeed(incrementalResult))
    const ctx = makeContext({ propagateLightIncremental })
    const entry = makeEntry(
      makeChunk({
        skyLight: new Uint8Array(16 * 16 * 256 / 2),
        blockLight: new Uint8Array(16 * 16 * 256 / 2),
      }),
    )

    const result = Effect.runSync(resolveDirtyChunkLighting(ctx, chunkKey, entry, dirtyVoxels))

    expect(Option.isSome(result)).toBe(true)
    expect(propagateLightIncremental).toHaveBeenCalledTimes(1)
    expect(propagateLightIncremental).toHaveBeenCalledWith(entry.chunk, dirtyVoxels)
  })
})
