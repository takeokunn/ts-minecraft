import { HashMap, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { Chunk } from '@ts-minecraft/world'
import { mergeDirtyChunkEntries, type DirtyChunkEntry } from './frame-maintenance-dirty'

const makeChunk = (x: number, z: number): Chunk =>
  ({ coord: { x, z } } as unknown as Chunk)

const makeEntry = (
  x: number,
  z: number,
  dirtyAABB: DirtyChunkEntry['dirtyAABB'],
): DirtyChunkEntry => ({
  chunk: makeChunk(x, z),
  dirtyAABB,
})

describe('mergeDirtyChunkEntries', () => {
  it('unions queued dirty regions for the same chunk key', () => {
    const result = mergeDirtyChunkEntries(HashMap.empty(), [
      makeEntry(3, 4, Option.some({ minX: 1, maxX: 4, minY: 2, maxY: 5, minZ: 6, maxZ: 7 })),
      makeEntry(3, 4, Option.some({ minX: 0, maxX: 6, minY: 1, maxY: 8, minZ: 3, maxZ: 9 })),
      makeEntry(8, 9, Option.some({ minX: 10, maxX: 11, minY: 12, maxY: 13, minZ: 14, maxZ: 15 })),
    ])

    expect(HashMap.size(result)).toBe(2)
    expect(Option.getOrNull(HashMap.get(result, '3,4'))).toEqual({
      chunk: makeChunk(3, 4),
      dirtyAABB: Option.some({ minX: 0, maxX: 6, minY: 1, maxY: 8, minZ: 3, maxZ: 9 }),
    })
    expect(Option.getOrNull(HashMap.get(result, '8,9'))).toEqual({
      chunk: makeChunk(8, 9),
      dirtyAABB: Option.some({ minX: 10, maxX: 11, minY: 12, maxY: 13, minZ: 14, maxZ: 15 }),
    })
  })

  it('keeps full-chunk invalidation when any merged entry is unbounded', () => {
    const result = mergeDirtyChunkEntries(HashMap.empty(), [
      makeEntry(1, 2, Option.none()),
      makeEntry(1, 2, Option.some({ minX: 5, maxX: 6, minY: 7, maxY: 8, minZ: 9, maxZ: 10 })),
    ])

    expect(Option.getOrNull(HashMap.get(result, '1,2'))).toEqual({
      chunk: makeChunk(1, 2),
      dirtyAABB: Option.none(),
    })
  })
})
