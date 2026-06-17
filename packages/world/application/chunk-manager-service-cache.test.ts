import { describe, expect, it } from 'vitest'
import { HashMap, HashSet, Option } from 'effect'
import { blockIndexUnsafe, blockTypeToIndex, ChunkCacheKey } from '@ts-minecraft/core'
import { computeMaxY, type Chunk } from '../domain/chunk'
import { fullChunkAABB, unionAABB, type ChunkAABB } from '../domain/chunk-aabb'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { markDirtyChunkOffsets, updateLitChunk } from './chunk-manager-service-cache'

const worldId = 'world-1'

const key = (x: number, z: number): ChunkCacheKey => chunkCoordToWorldKey({ x, z }, worldId)

const makeChunk = (): Chunk => {
  const blocks = new Uint8Array(16 * 16 * 256)
  blocks[blockIndexUnsafe(4, 42, 7)] = blockTypeToIndex('STONE')
  return {
    coord: { x: 0, z: 0 },
    blocks,
    maxY: -1,
  } as Chunk
}

const makeEntry = (chunk: Chunk, lastAccessed = 1): ChunkCacheEntry => ({
  chunk,
  lastAccessed,
})

const emptyCache = (): ChunkCache => ({
  chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
  dirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
})

const editedAABB: ChunkAABB = { minX: 2, maxX: 3, minY: 10, maxY: 12, minZ: 4, maxZ: 5 }

describe('chunk-manager-service-cache', () => {
  describe('updateLitChunk', () => {
    it('updates the stored chunk lighting and recomputes maxY from blocks', () => {
      const chunk = makeChunk()
      const cache = emptyCache()
      const nextCache = {
        ...cache,
        chunks: HashMap.set(cache.chunks, key(0, 0), makeEntry(chunk)),
      }
      const skyLight = new Uint8Array(16 * 16 * 256 / 2)
      const blockLight = new Uint8Array(16 * 16 * 256 / 2)

      const next = updateLitChunk(nextCache, key(0, 0), skyLight, blockLight)
      const updated = Option.getOrThrow(HashMap.get(next.chunks, key(0, 0)))

      expect(updated.chunk.skyLight).toBe(skyLight)
      expect(updated.chunk.blockLight).toBe(blockLight)
      expect(updated.chunk.maxY).toBe(computeMaxY(chunk.blocks))
    })

    it('returns the cache unchanged when the chunk key is missing', () => {
      const cache = emptyCache()
      const skyLight = new Uint8Array(16 * 16 * 256 / 2)
      const blockLight = new Uint8Array(16 * 16 * 256 / 2)

      const next = updateLitChunk(cache, key(0, 0), skyLight, blockLight)

      expect(next).toBe(cache)
    })
  })

  describe('markDirtyChunkOffsets', () => {
    it('marks dirty chunks and unions render AABBs per key', () => {
      const editedKey = key(0, 0)
      const neighborKey = key(1, 0)
      const cache = {
        ...emptyCache(),
        renderDirtyAABBs: HashMap.set(
          HashMap.set(emptyCache().renderDirtyAABBs, editedKey, { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }),
          neighborKey,
          { minX: 8, maxX: 8, minY: 8, maxY: 8, minZ: 8, maxZ: 8 },
        ),
      }

      const next = markDirtyChunkOffsets(
        cache,
        [[0, 0], [1, 0]],
        { x: 0, z: 0 },
        worldId,
        editedKey,
        editedAABB,
      )

      expect(HashSet.has(next.dirtyChunks, editedKey)).toBe(true)
      expect(HashSet.has(next.dirtyChunks, neighborKey)).toBe(true)
      expect(HashSet.has(next.renderDirtyChunks, editedKey)).toBe(true)
      expect(HashSet.has(next.renderDirtyChunks, neighborKey)).toBe(true)
      expect(Option.getOrThrow(HashMap.get(next.renderDirtyAABBs, editedKey))).toEqual(
        unionAABB({ minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }, editedAABB),
      )
      expect(Option.getOrThrow(HashMap.get(next.renderDirtyAABBs, neighborKey))).toEqual(
        unionAABB({ minX: 8, maxX: 8, minY: 8, maxY: 8, minZ: 8, maxZ: 8 }, fullChunkAABB),
      )
    })

    it('stores the incoming AABB when a dirty key has no existing render entry', () => {
      const editedKey = key(0, 0)
      const next = markDirtyChunkOffsets(
        emptyCache(),
        [[0, 0]],
        { x: 0, z: 0 },
        worldId,
        editedKey,
        editedAABB,
      )

      expect(HashSet.has(next.dirtyChunks, editedKey)).toBe(true)
      expect(HashSet.has(next.renderDirtyChunks, editedKey)).toBe(true)
      expect(Option.getOrThrow(HashMap.get(next.renderDirtyAABBs, editedKey))).toEqual(editedAABB)
    })
  })
})
