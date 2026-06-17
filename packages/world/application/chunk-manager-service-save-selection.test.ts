import { HashMap, HashSet } from 'effect'
import { describe, expect, it } from 'vitest'
import { type Chunk } from '../domain/chunk'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { collectDirtyChunksToSave } from './chunk-manager-service-save-selection'

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

describe('chunk-manager-service-save-selection', () => {
  describe('collectDirtyChunksToSave', () => {
    it('returns only cached entries for dirty keys', () => {
      const cached = makeChunk(0, 0)
      const other = makeChunk(1, 0)
      const cache = {
        ...makeCache(cached, other),
        dirtyChunks: HashSet.make(key(0, 0), key(2, 0), key(1, 0)),
      }

      const entries = collectDirtyChunksToSave(cache, cache.dirtyChunks)
      expect(entries).toEqual(expect.arrayContaining([makeEntry(cached), makeEntry(other)]))
      expect(entries).toHaveLength(2)
    })
  })
})
