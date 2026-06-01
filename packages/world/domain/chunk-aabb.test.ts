import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  aabbContainsVoxel,
  aabbCoversChunk,
  aabbFromVoxel,
  aabbFromVoxels,
  expandAABB,
  fullChunkAABB,
  unionAABB,
} from './chunk-aabb'

describe('domain/chunk-aabb', () => {
  it('aabbFromVoxel produces a 1-voxel inclusive AABB', () => {
    const a = aabbFromVoxel({ lx: 5, y: 100, lz: 7 })
    expect(a).toEqual({ minX: 5, maxX: 5, minY: 100, maxY: 100, minZ: 7, maxZ: 7 })
  })

  it('aabbFromVoxel clamps out-of-range inputs', () => {
    const a = aabbFromVoxel({ lx: -3, y: -10, lz: 99 })
    expect(a.minX).toBe(0)
    expect(a.minY).toBe(0)
    expect(a.maxZ).toBe(CHUNK_SIZE - 1)
  })

  it('aabbFromVoxels returns none for empty array', () => {
    expect(Option.isNone(aabbFromVoxels([]))).toBe(true)
  })

  it('aabbFromVoxels returns the union bounding box for non-empty input', () => {
    const a = aabbFromVoxels([
      { lx: 1, y: 10, lz: 2 },
      { lx: 5, y: 20, lz: 4 },
      { lx: 3, y: 5, lz: 8 },
    ])
    expect(Option.isSome(a)).toBe(true)
    expect(Option.getOrThrow(a)).toEqual({
      minX: 1, maxX: 5, minY: 5, maxY: 20, minZ: 2, maxZ: 8,
    })
  })

  it('unionAABB takes the per-axis min/max', () => {
    const a = { minX: 1, maxX: 3, minY: 10, maxY: 20, minZ: 2, maxZ: 5 }
    const b = { minX: 0, maxX: 4, minY: 15, maxY: 18, minZ: 4, maxZ: 6 }
    expect(unionAABB(a, b)).toEqual({
      minX: 0, maxX: 4, minY: 10, maxY: 20, minZ: 2, maxZ: 6,
    })
  })

  it('expandAABB grows by pad and clamps at chunk bounds', () => {
    const a = { minX: 2, maxX: 13, minY: 100, maxY: 200, minZ: 1, maxZ: 14 }
    const padded = expandAABB(a, 5)
    expect(padded).toEqual({
      minX: 0, maxX: CHUNK_SIZE - 1,
      minY: 95, maxY: 205,
      minZ: 0, maxZ: CHUNK_SIZE - 1,
    })
  })

  it('aabbCoversChunk detects full-chunk extent', () => {
    expect(aabbCoversChunk(fullChunkAABB)).toBe(true)
    expect(aabbCoversChunk({ minX: 1, maxX: 14, minY: 0, maxY: CHUNK_HEIGHT - 1, minZ: 0, maxZ: CHUNK_SIZE - 1 })).toBe(false)
  })

  it('aabbContainsVoxel respects inclusive bounds', () => {
    const a = { minX: 2, maxX: 5, minY: 10, maxY: 12, minZ: 3, maxZ: 8 }
    expect(aabbContainsVoxel(a, 2, 10, 3)).toBe(true) // lower corner
    expect(aabbContainsVoxel(a, 5, 12, 8)).toBe(true) // upper corner
    expect(aabbContainsVoxel(a, 1, 10, 3)).toBe(false) // out on lx
    expect(aabbContainsVoxel(a, 5, 13, 3)).toBe(false) // out on y
  })

  it('union is associative and commutative on a small example', () => {
    const a = aabbFromVoxel({ lx: 1, y: 10, lz: 2 })
    const b = aabbFromVoxel({ lx: 5, y: 20, lz: 4 })
    const c = aabbFromVoxel({ lx: 3, y: 5, lz: 8 })
    expect(unionAABB(unionAABB(a, b), c)).toEqual(unionAABB(a, unionAABB(b, c)))
    expect(unionAABB(a, b)).toEqual(unionAABB(b, a))
  })
})
