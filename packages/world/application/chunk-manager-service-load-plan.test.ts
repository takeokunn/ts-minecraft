import { HashMap, HashSet } from 'effect'
import { describe, expect, it } from 'vitest'
import { type Chunk } from '../domain/chunk'
import { chunkCoordToWorldKey, countChunksInRadius } from '../domain/chunk-coord-utils'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { MAX_CACHED_CHUNKS } from './chunk-manager-constants'
import { CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, MAX_CHUNK_LOADS_PER_CALL } from './chunk-manager-service-model'
import { resolveChunkCacheCapacity, resolveChunkLoadPlan } from './chunk-manager-service-load-plan'

const worldId = 'world-1'
const centerChunk = { x: 0, z: 0 }

const key = (x: number, z: number): string => chunkCoordToWorldKey({ x, z }, worldId)

const makeChunk = (x: number, z: number): Chunk =>
  ({
    coord: { x, z },
    blocks: new Uint8Array(16 * 16 * 256),
    maxY: -1,
  } as Chunk)

const makeEntry = (chunk: Chunk, lastAccessed = 1): ChunkCacheEntry => ({
  chunk,
  lastAccessed,
})

const makeCache = (...entries: ReadonlyArray<ChunkCacheEntry>): ChunkCache => ({
  chunks: entries.reduce(
    (cache, entry) => HashMap.set(cache, key(entry.chunk.coord.x, entry.chunk.coord.z), entry),
    HashMap.empty(),
  ),
  dirtyChunks: HashSet.empty(),
  renderDirtyChunks: HashSet.empty(),
  renderDirtyAABBs: HashMap.empty(),
})

describe('chunk-manager-service-load-plan', () => {
  it('resolves chunk cache capacity with the global floor', () => {
    expect(resolveChunkCacheCapacity(0)).toBe(MAX_CACHED_CHUNKS)
    expect(resolveChunkCacheCapacity(8)).toBeGreaterThanOrEqual(MAX_CACHED_CHUNKS)
    expect(resolveChunkCacheCapacity(12)).toBe(countChunksInRadius(14))
  })

  it('returns missing load candidates and unload candidates from the current cache state', () => {
    const cachedInside = makeEntry(makeChunk(0, 0))
    const cachedOutside = makeEntry(makeChunk(6, 0))
    const cache = makeCache(cachedInside, cachedOutside)

    const plan = resolveChunkLoadPlan(cache, worldId, centerChunk, 3)

    expect(plan.chunksToLoad).toHaveLength(countChunksInRadius(3))
    expect(plan.missingChunksToLoad).not.toEqual([])
    expect(plan.chunkLoadBatch).toEqual(plan.missingChunksToLoad.slice(0, MAX_CHUNK_LOADS_PER_CALL))
    expect(plan.chunksToUnload).toEqual([cachedOutside])
    expect(plan.chunkCacheCapacity).toBe(resolveChunkCacheCapacity(3))
  })

  it('does not batch missing chunks when eager loading is enabled', () => {
    const cache = makeCache(makeEntry(makeChunk(0, 0)))

    const plan = resolveChunkLoadPlan(cache, worldId, centerChunk, CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, true)

    expect(plan.missingChunksToLoad.length).toBeGreaterThan(MAX_CHUNK_LOADS_PER_CALL)
    expect(plan.chunkLoadBatch).toHaveLength(plan.missingChunksToLoad.length)
    expect(plan.chunkLoadBatch).toEqual(plan.missingChunksToLoad)
  })
})
