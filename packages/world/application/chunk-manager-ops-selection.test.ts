import { describe, expect, it } from 'vitest'
import { HashMap, HashSet, Option } from 'effect'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { insertChunkWithEviction } from './chunk-manager-ops-selection'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import type { Chunk } from '../domain/chunk'

const key = (x: number, z: number): ChunkCacheKey => ChunkCacheKey.make({ x, z })

const chunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(16 * 256 * 16),
  fluid: Option.none(),
  maxY: 0,
})

const entry = (coordX: number, coordZ: number, lastAccessed: number, worldId = 'world-1'): ChunkCacheEntry => ({
  chunk: chunk(coordX, coordZ),
  lastAccessed,
  worldId,
})

const emptyCache = (): ChunkCache => ({
  chunks: HashMap.empty(),
  dirtyChunks: HashSet.empty(),
  renderDirtyChunks: HashSet.empty(),
  renderDirtyAABBs: HashMap.empty(),
})

describe('insertChunkWithEviction', () => {
  it('inserts without eviction while under capacity', () => {
    const existingKey = key(0, 0)
    const insertedKey = key(1, 0)
    const state: ChunkCache = {
      ...emptyCache(),
      chunks: HashMap.make([existingKey, entry(0, 0, 1)]),
      dirtyChunks: HashSet.make(existingKey),
      renderDirtyChunks: HashSet.make(existingKey),
      renderDirtyAABBs: HashMap.set(emptyCache().renderDirtyAABBs, existingKey, {
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
        minZ: 0,
        maxZ: 1,
      }),
    }

    const result = insertChunkWithEviction(state, insertedKey, chunk(1, 0), 'world-1', 2, 4)

    expect(Option.isNone(result.evictedDirtyEntry)).toBe(true)
    expect(HashMap.size(result.cache.chunks)).toBe(2)
    expect(Option.getOrThrow(HashMap.get(result.cache.chunks, existingKey))).toEqual(
      Option.getOrThrow(HashMap.get(state.chunks, existingKey)),
    )
    expect(Option.getOrThrow(HashMap.get(result.cache.chunks, insertedKey)).worldId).toBe('world-1')
    expect(HashSet.has(result.cache.dirtyChunks, existingKey)).toBe(true)
    expect(HashSet.has(result.cache.renderDirtyChunks, existingKey)).toBe(true)
    expect(Option.isSome(HashMap.get(result.cache.renderDirtyAABBs, existingKey))).toBe(true)
  })

  it('evicts a dirty LRU entry and clears all of its cache metadata', () => {
    const dirtyKey = key(0, 0)
    const survivorKey = key(1, 0)
    const insertedKey = key(2, 0)
    const dirtyAABB = {
      minX: 0,
      maxX: 1,
      minY: 0,
      maxY: 1,
      minZ: 0,
      maxZ: 1,
    }
    const dirtyEntry = entry(0, 0, 1)
    const survivorEntry = entry(1, 0, 5)
    const state: ChunkCache = {
      ...emptyCache(),
      chunks: HashMap.make(
        [dirtyKey, dirtyEntry],
        [survivorKey, survivorEntry],
      ),
      dirtyChunks: HashSet.make(dirtyKey),
      renderDirtyChunks: HashSet.make(dirtyKey),
      renderDirtyAABBs: HashMap.set(emptyCache().renderDirtyAABBs, dirtyKey, dirtyAABB),
    }

    const result = insertChunkWithEviction(state, insertedKey, chunk(2, 0), 'world-1', 10, 2)

    expect(Option.getOrThrow(result.evictedDirtyEntry)).toEqual(dirtyEntry)
    expect(HashMap.size(result.cache.chunks)).toBe(2)
    expect(Option.isNone(HashMap.get(result.cache.chunks, dirtyKey))).toBe(true)
    expect(Option.isSome(HashMap.get(result.cache.chunks, survivorKey))).toBe(true)
    expect(Option.isSome(HashMap.get(result.cache.chunks, insertedKey))).toBe(true)
    expect(HashSet.has(result.cache.dirtyChunks, dirtyKey)).toBe(false)
    expect(HashSet.has(result.cache.renderDirtyChunks, dirtyKey)).toBe(false)
    expect(Option.isNone(HashMap.get(result.cache.renderDirtyAABBs, dirtyKey))).toBe(true)
  })

  it('evicts a clean LRU entry without returning a dirty payload', () => {
    const cleanKey = key(0, 0)
    const survivorKey = key(1, 0)
    const insertedKey = key(2, 0)
    const cleanEntry = entry(0, 0, 1)
    const survivorEntry = entry(1, 0, 5)
    const state: ChunkCache = {
      ...emptyCache(),
      chunks: HashMap.make(
        [cleanKey, cleanEntry],
        [survivorKey, survivorEntry],
      ),
      renderDirtyAABBs: HashMap.set(emptyCache().renderDirtyAABBs, cleanKey, {
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
        minZ: 0,
        maxZ: 1,
      }),
    }

    const result = insertChunkWithEviction(state, insertedKey, chunk(2, 0), 'world-1', 10, 2)

    expect(Option.isNone(result.evictedDirtyEntry)).toBe(true)
    expect(HashMap.size(result.cache.chunks)).toBe(2)
    expect(Option.isNone(HashMap.get(result.cache.chunks, cleanKey))).toBe(true)
    expect(Option.isNone(HashMap.get(result.cache.renderDirtyAABBs, cleanKey))).toBe(true)
  })
})
