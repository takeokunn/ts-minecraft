import { HashMap, HashSet, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { type Chunk } from '../domain/chunk'
import { type ChunkAABB } from '../domain/chunk-aabb'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import { type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'
import { collectChunks, collectDirtyChunkEntries, collectDirtyChunks } from './chunk-manager-service-read-collection'

const worldId = 'world-1'

const key = (x: number, z: number) => chunkCoordToWorldKey({ x, z }, worldId)

const makeChunk = (x: number, z: number): Chunk =>
  ({
    coord: { x, z },
    blocks: new Uint8Array(16 * 16 * 256),
    maxY: -1,
  } as Chunk)

const makeEntry = (chunk: Chunk): ChunkCacheEntry => ({
  chunk,
  lastAccessed: 1,
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

describe('chunk-manager-service-read-collection', () => {
  describe('collectChunks', () => {
    it('returns all cached chunks', () => {
      const chunks = [makeChunk(0, 0), makeChunk(1, 0)]

      expect(collectChunks(makeCache(...chunks))).toEqual(expect.arrayContaining(chunks))
      expect(collectChunks(makeCache(...chunks))).toHaveLength(2)
    })
  })

  describe('collectDirtyChunks', () => {
    it('returns only cached chunks for the provided keys', () => {
      const chunks = [makeChunk(0, 0), makeChunk(1, 0)]
      const cache = makeCache(...chunks)
      const dirtyKeys = new Set([key(1, 0), key(2, 0), key(0, 0)])

      expect(collectDirtyChunks(cache, dirtyKeys)).toEqual(expect.arrayContaining(chunks))
      expect(collectDirtyChunks(cache, dirtyKeys)).toHaveLength(2)
    })
  })

  describe('collectDirtyChunkEntries', () => {
    it('returns cached chunks together with the matching dirty AABBs', () => {
      const chunk = makeChunk(0, 0)
      const cache = makeCache(chunk)
      const dirtyAABB: ChunkAABB = { minX: 1, maxX: 2, minY: 3, maxY: 4, minZ: 5, maxZ: 6 }
      const aabbs = HashMap.set(HashMap.empty(), key(0, 0), dirtyAABB)
      const entries = collectDirtyChunkEntries(cache, new Set([key(0, 0), key(2, 0)]), aabbs)

      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual({
        chunk,
        dirtyAABB: Option.some(dirtyAABB),
      })
    })
  })
})
