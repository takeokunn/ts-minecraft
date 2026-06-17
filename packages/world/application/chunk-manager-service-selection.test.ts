import { HashMap, HashSet } from 'effect'
import { describe, expect, it } from 'vitest'
import { type Chunk } from '../domain/chunk'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import { CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, MAX_CHUNK_LOADS_PER_CALL } from './chunk-manager-service-model'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { collectChunksToUnload, collectMissingChunkCoords, selectChunkLoadBatch } from './chunk-manager-service-selection'

const worldId = 'world-1'

const key = (x: number, z: number) => chunkCoordToWorldKey({ x, z }, worldId)

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

const makeCache = (...chunks: Array<Chunk>): ChunkCache => ({
  chunks: chunks.reduce(
    (cache, chunk) => HashMap.set(cache, key(chunk.coord.x, chunk.coord.z), makeEntry(chunk)),
    HashMap.empty(),
  ),
  dirtyChunks: HashSet.empty(),
  renderDirtyChunks: HashSet.empty(),
  renderDirtyAABBs: HashMap.empty(),
})

describe('chunk-manager-service-selection', () => {
  describe('collectMissingChunkCoords', () => {
    it('skips coords that are already cached', () => {
      const cached = makeChunk(0, 0)
      const missing = makeChunk(1, 0)
      const cache = makeCache(cached)

      expect(collectMissingChunkCoords(cache, worldId, [cached.coord, missing.coord])).toEqual([missing.coord])
    })
  })

  describe('selectChunkLoadBatch', () => {
    it('batches when render distance is high enough and eager loading is off', () => {
      const coords = Array.from({ length: MAX_CHUNK_LOADS_PER_CALL + 2 }, (_, i) => ({ x: i, z: 0 }))

      expect(selectChunkLoadBatch(coords, CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, false)).toHaveLength(MAX_CHUNK_LOADS_PER_CALL)
    })

    it('returns all chunks when batching is disabled or eager loading is on', () => {
      const coords = Array.from({ length: MAX_CHUNK_LOADS_PER_CALL + 2 }, (_, i) => ({ x: i, z: 0 }))

      expect(selectChunkLoadBatch(coords, CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE - 1, false)).toHaveLength(coords.length)
      expect(selectChunkLoadBatch(coords, CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, true)).toHaveLength(coords.length)
    })
  })

  describe('collectChunksToUnload', () => {
    it('returns only cached chunks outside the hysteresis ring', () => {
      const near = makeChunk(6, 0)
      const far = makeChunk(7, 0)
      const cache = makeCache(near, far)

      expect(collectChunksToUnload(cache, { x: 0, z: 0 }, 4)).toEqual([makeEntry(far)])
    })
  })
})
