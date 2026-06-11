import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  aabbFromVoxel,
  aabbFromVoxels,
  unionAABB,
  expandAABB,
  aabbCoversChunk,
  aabbContainsVoxel,
  fullChunkAABB,
  type ChunkAABB,
  type DirtyVoxelLike,
} from '../domain/chunk-aabb'

describe('aabbFromVoxel', () => {
  it('creates a point AABB at the given coordinates', () => {
    const aabb = aabbFromVoxel({ lx: 5, y: 64, lz: 10 })
    expect(aabb).toEqual({ minX: 5, maxX: 5, minY: 64, maxY: 64, minZ: 10, maxZ: 10 })
  })

  it('clamps x/z to [0, CHUNK_SIZE-1]', () => {
    const neg = aabbFromVoxel({ lx: -1, y: 0, lz: -5 })
    expect(neg.minX).toBe(0)
    expect(neg.maxX).toBe(0)
    expect(neg.minZ).toBe(0)

    const over = aabbFromVoxel({ lx: CHUNK_SIZE + 5, y: 0, lz: CHUNK_SIZE + 10 })
    expect(over.minX).toBe(CHUNK_SIZE - 1)
    expect(over.minZ).toBe(CHUNK_SIZE - 1)
  })

  it('clamps y to [0, CHUNK_HEIGHT-1]', () => {
    const low = aabbFromVoxel({ lx: 0, y: -10, lz: 0 })
    expect(low.minY).toBe(0)
    const high = aabbFromVoxel({ lx: 0, y: CHUNK_HEIGHT + 5, lz: 0 })
    expect(high.minY).toBe(CHUNK_HEIGHT - 1)
  })

  it('min equals max (point AABB)', () => {
    const aabb = aabbFromVoxel({ lx: 7, y: 100, lz: 3 })
    expect(aabb.minX).toBe(aabb.maxX)
    expect(aabb.minY).toBe(aabb.maxY)
    expect(aabb.minZ).toBe(aabb.maxZ)
  })
})

describe('aabbFromVoxels', () => {
  it('returns Option.none for empty array', () => {
    const result = aabbFromVoxels([])
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns a point AABB for a single voxel', () => {
    const result = aabbFromVoxels([{ lx: 3, y: 50, lz: 7 }])
    expect(Option.isSome(result)).toBe(true)
    const aabb = Option.getOrThrow(result)
    expect(aabb).toEqual({ minX: 3, maxX: 3, minY: 50, maxY: 50, minZ: 7, maxZ: 7 })
  })

  it('returns bounding box spanning all voxels', () => {
    const voxels: DirtyVoxelLike[] = [
      { lx: 0, y: 10, lz: 0 },
      { lx: 5, y: 50, lz: 3 },
      { lx: 2, y: 30, lz: 8 },
    ]
    const result = aabbFromVoxels(voxels)
    const aabb = Option.getOrThrow(result)
    expect(aabb.minX).toBe(0)
    expect(aabb.maxX).toBe(5)
    expect(aabb.minY).toBe(10)
    expect(aabb.maxY).toBe(50)
    expect(aabb.minZ).toBe(0)
    expect(aabb.maxZ).toBe(8)
  })
})

describe('unionAABB', () => {
  it('returns the encompassing bounding box of two AABBs', () => {
    const a: ChunkAABB = { minX: 0, maxX: 3, minY: 0, maxY: 10, minZ: 0, maxZ: 2 }
    const b: ChunkAABB = { minX: 5, maxX: 7, minY: 8, maxY: 20, minZ: 1, maxZ: 5 }
    const result = unionAABB(a, b)
    expect(result.minX).toBe(0)
    expect(result.maxX).toBe(7)
    expect(result.minY).toBe(0)
    expect(result.maxY).toBe(20)
    expect(result.minZ).toBe(0)
    expect(result.maxZ).toBe(5)
  })

  it('union of a box with itself is the same box', () => {
    const a: ChunkAABB = { minX: 2, maxX: 5, minY: 10, maxY: 30, minZ: 1, maxZ: 4 }
    expect(unionAABB(a, a)).toEqual(a)
  })

  it('is commutative', () => {
    const a: ChunkAABB = { minX: 1, maxX: 3, minY: 5, maxY: 15, minZ: 0, maxZ: 2 }
    const b: ChunkAABB = { minX: 4, maxX: 8, minY: 2, maxY: 20, minZ: 3, maxZ: 6 }
    expect(unionAABB(a, b)).toEqual(unionAABB(b, a))
  })
})

describe('expandAABB', () => {
  it('grows the AABB by pad on every face', () => {
    const aabb: ChunkAABB = { minX: 5, maxX: 8, minY: 20, maxY: 30, minZ: 5, maxZ: 8 }
    const result = expandAABB(aabb, 2)
    expect(result.minX).toBe(3)
    expect(result.maxX).toBe(10)
    expect(result.minY).toBe(18)
    expect(result.maxY).toBe(32)
    expect(result.minZ).toBe(3)
    expect(result.maxZ).toBe(10)
  })

  it('clamps expansion to chunk bounds — does not go below 0', () => {
    const aabb: ChunkAABB = { minX: 0, maxX: 3, minY: 0, maxY: 5, minZ: 0, maxZ: 3 }
    const result = expandAABB(aabb, 5)
    expect(result.minX).toBe(0)
    expect(result.minY).toBe(0)
    expect(result.minZ).toBe(0)
  })

  it('clamps expansion to chunk bounds — does not exceed max', () => {
    const aabb: ChunkAABB = { minX: CHUNK_SIZE - 2, maxX: CHUNK_SIZE - 1, minY: CHUNK_HEIGHT - 2, maxY: CHUNK_HEIGHT - 1, minZ: CHUNK_SIZE - 2, maxZ: CHUNK_SIZE - 1 }
    const result = expandAABB(aabb, 5)
    expect(result.maxX).toBe(CHUNK_SIZE - 1)
    expect(result.maxY).toBe(CHUNK_HEIGHT - 1)
    expect(result.maxZ).toBe(CHUNK_SIZE - 1)
  })

  it('pad=0 leaves the AABB unchanged', () => {
    const aabb: ChunkAABB = { minX: 2, maxX: 5, minY: 10, maxY: 20, minZ: 3, maxZ: 7 }
    expect(expandAABB(aabb, 0)).toEqual(aabb)
  })
})

describe('aabbCoversChunk', () => {
  it('returns true for fullChunkAABB', () => {
    expect(aabbCoversChunk(fullChunkAABB)).toBe(true)
  })

  it('returns false if any face does not reach the boundary', () => {
    const partial: ChunkAABB = { minX: 1, maxX: CHUNK_SIZE - 1, minY: 0, maxY: CHUNK_HEIGHT - 1, minZ: 0, maxZ: CHUNK_SIZE - 1 }
    expect(aabbCoversChunk(partial)).toBe(false)
  })

  it('returns false for a single-voxel AABB', () => {
    expect(aabbCoversChunk(aabbFromVoxel({ lx: 0, y: 0, lz: 0 }))).toBe(false)
  })
})

describe('aabbContainsVoxel', () => {
  it('returns true for a voxel inside the AABB', () => {
    const aabb: ChunkAABB = { minX: 2, maxX: 6, minY: 10, maxY: 20, minZ: 3, maxZ: 8 }
    expect(aabbContainsVoxel(aabb, 4, 15, 5)).toBe(true)
  })

  it('returns true for a voxel on the boundary', () => {
    const aabb: ChunkAABB = { minX: 2, maxX: 6, minY: 10, maxY: 20, minZ: 3, maxZ: 8 }
    expect(aabbContainsVoxel(aabb, 2, 10, 3)).toBe(true)
    expect(aabbContainsVoxel(aabb, 6, 20, 8)).toBe(true)
  })

  it('returns false for a voxel outside the AABB', () => {
    const aabb: ChunkAABB = { minX: 2, maxX: 6, minY: 10, maxY: 20, minZ: 3, maxZ: 8 }
    expect(aabbContainsVoxel(aabb, 1, 15, 5)).toBe(false)
    expect(aabbContainsVoxel(aabb, 4, 25, 5)).toBe(false)
  })
})

describe('fullChunkAABB', () => {
  it('spans the entire chunk', () => {
    expect(fullChunkAABB.minX).toBe(0)
    expect(fullChunkAABB.maxX).toBe(CHUNK_SIZE - 1)
    expect(fullChunkAABB.minY).toBe(0)
    expect(fullChunkAABB.maxY).toBe(CHUNK_HEIGHT - 1)
    expect(fullChunkAABB.minZ).toBe(0)
    expect(fullChunkAABB.maxZ).toBe(CHUNK_SIZE - 1)
  })
})
