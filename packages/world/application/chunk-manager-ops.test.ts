import { describe, it, expect } from 'vitest'
import { Option, HashMap } from 'effect'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { findLRUKey } from './chunk-manager-ops'
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
