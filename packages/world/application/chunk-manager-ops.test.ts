import { describe, it, expect } from 'vitest'
import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { Chunk } from '../domain/chunk'
import { findLRUKey } from './chunk-manager-ops-selection'
import { unloadChunk, type ChunkOpsContext } from './chunk-manager-ops'
import type { ChunkCacheEntry } from './chunk-manager-cache'

// Minimal fake chunk for building cache entries (only lastAccessed matters for LRU)
const makeEntry = (lastAccessed: number): ChunkCacheEntry => ({
  chunk: {
    coord: { x: 0, z: 0 },
    blocks: new Uint8Array(16 * 256 * 16),
    fluid: Option.none(),
    maxY: 0,
  },
  lastAccessed,
})

const key = (cx: number, cz: number): ChunkCacheKey => ChunkCacheKey.make(`world-1:${cx},${cz}`)

const worldId = 'world-1'

const makeChunk = (x = 0, z = 0): Chunk =>
  ({
    coord: { x, z },
    blocks: new Uint8Array(16 * 16 * 256),
    maxY: 0,
  } as Chunk)

const makeContext = (cache: ChunkOpsContext['cache']): ChunkOpsContext =>
  ({
    worldIdRef: Effect.runSync(Ref.make(worldId)),
    dimensionRef: Effect.runSync(Ref.make('overworld')),
    cache,
    cachedLoadedChunksRef: Effect.runSync(Ref.make(Option.none())),
    maxCachedChunksRef: Effect.runSync(Ref.make(64)),
    accessCounterRef: Effect.runSync(Ref.make(0)),
    storageService: {},
    noiseService: {},
    terrainPool: {},
    lightEngine: {} as never,
  }) as ChunkOpsContext

describe('findLRUKey', () => {
  it('returns none for empty map', () => {
    const result = findLRUKey(HashMap.empty())
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns the single key when map has one entry', () => {
    const k = key(0, 0)
    const map = HashMap.make([k, makeEntry(5)])
    const result = findLRUKey(map)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toBe(k)
    }
  })

  it('returns the key with lowest lastAccessed', () => {
    const k0 = key(0, 0)
    const k1 = key(1, 0)
    const k2 = key(0, 1)
    const map = HashMap.make(
      [k0, makeEntry(10)],
      [k1, makeEntry(5)],
      [k2, makeEntry(20)],
    )
    const result = findLRUKey(map)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toBe(k1)
    }
  })

  it('handles tie in lastAccessed (returns one of the tied keys)', () => {
    const k0 = key(0, 0)
    const k1 = key(1, 0)
    const map = HashMap.make(
      [k0, makeEntry(5)],
      [k1, makeEntry(5)],
    )
    const result = findLRUKey(map)
    expect(Option.isSome(result)).toBe(true)
  })

  it('with many entries always picks minimum', () => {
    const entries: [ChunkCacheKey, ChunkCacheEntry][] = []
    for (let i = 0; i < 20; i++) {
      entries.push([key(i, 0), makeEntry(i * 10)])
    }
    const map = HashMap.fromIterable(entries)
    const result = findLRUKey(map)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toBe(key(0, 0))
    }
  })
})

describe('unloadChunk', () => {
  it('removes render dirty metadata when unloading a clean chunk', () => {
    const coord = { x: 0, z: 0 }
    const chunkKey = chunkCoordToWorldKey(coord, worldId)
    const cache = Effect.runSync(Ref.make({
      chunks: HashMap.make([chunkKey, {
        chunk: makeChunk(),
        lastAccessed: 1,
      }]),
      dirtyChunks: HashSet.empty<ChunkCacheKey>(),
      renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
      renderDirtyAABBs: HashMap.make([chunkKey, {
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
        minZ: 0,
        maxZ: 1,
      }]),
    }))
    const ctx = makeContext(cache)

    Effect.runSync(unloadChunk(ctx, coord))

    const next = Effect.runSync(Ref.get(cache))
    expect(HashMap.get(next.chunks, chunkKey)).toEqual(Option.none())
    expect(HashMap.get(next.renderDirtyAABBs, chunkKey)).toEqual(Option.none())
  })
})
