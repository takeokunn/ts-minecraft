import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashMap, Option } from 'effect'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { findLRUKey } from '../application/chunk-manager-ops'

const key = (x: number, z: number): ChunkCacheKey => ChunkCacheKey.make({ x, z })

const entry = (lastAccessed: number) => ({
  chunk: {} as never,
  lastAccessed,
})

describe('findLRUKey', () => {
  it('returns None for empty map', () => {
    expect(Option.isNone(findLRUKey(HashMap.empty()))).toBe(true)
  })

  it('returns the only entry for a single-element map', () => {
    const k = key(0, 0)
    const map = HashMap.make([k, entry(5)])
    expect(Option.getOrThrow(findLRUKey(map))).toBe(k)
  })

  it('returns the key with the smallest lastAccessed', () => {
    const k1 = key(0, 0)
    const k2 = key(1, 0)
    const k3 = key(2, 0)
    const map = HashMap.make(
      [k1, entry(10)],
      [k2, entry(3)],  // LRU
      [k3, entry(7)],
    )
    expect(Option.getOrThrow(findLRUKey(map))).toBe(k2)
  })

  it('finds LRU key at the front of iteration order', () => {
    const keys = Arr.makeBy(5, (i) => key(i, 0))
    const entries: ReadonlyArray<[ChunkCacheKey, ReturnType<typeof entry>]> =
      Arr.map(keys, (k, i) => [k, entry(i + 1)] as [ChunkCacheKey, ReturnType<typeof entry>])
    const map = HashMap.fromIterable(entries)
    // key(0,0) has lastAccessed=1 — oldest
    expect(Option.getOrThrow(findLRUKey(map))).toBe(keys[0])
  })

  it('handles access counter of 0 as the LRU value', () => {
    const k1 = key(0, 0)
    const k2 = key(1, 0)
    const map = HashMap.make([k1, entry(0)], [k2, entry(100)])
    expect(Option.getOrThrow(findLRUKey(map))).toBe(k1)
  })
})
