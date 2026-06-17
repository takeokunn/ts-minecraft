import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { fullChunkAABB, unionAABB, type ChunkAABB } from '../domain/chunk-aabb'
import {
  dirtyAABBFromVoxels,
  dirtyOffsets,
  editedChunkAABBFromDirty,
  type DirtyBoundary,
  type DirtyBfsResult,
} from './chunk-manager-service-helpers'

const editedAABB: ChunkAABB = { minX: 2, maxX: 3, minY: 10, maxY: 12, minZ: 4, maxZ: 5 }

describe('chunk-manager-service-helpers', () => {
  describe('dirtyOffsets', () => {
    it('returns all offsets when the BFS result is missing', () => {
      const bfsResult: Option.Option<{ readonly boundary: DirtyBoundary }> = Option.none()

      expect(dirtyOffsets(bfsResult)).toEqual([
        [0, 0],
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ])
    })

    it('keeps only offsets that touch the reported boundaries', () => {
      const bfsResult: Option.Option<{ readonly boundary: DirtyBoundary }> = Option.some({
        boundary: { nx: true, px: false, nz: true, pz: false },
      })

      expect(dirtyOffsets(bfsResult)).toEqual([
        [0, 0],
        [-1, -1],
        [-1, 0],
        [0, -1],
      ])
    })
  })

  describe('dirtyAABBFromVoxels', () => {
    it('returns none when no dirty voxels are provided', () => {
      expect(Option.isNone(dirtyAABBFromVoxels())).toBe(true)
    })

    it('builds an AABB from dirty voxels', () => {
      const result = dirtyAABBFromVoxels([
        { lx: 2, y: 11, lz: 4 },
        { lx: 5, y: 14, lz: 8 },
      ])

      expect(Option.getOrThrow(result)).toEqual({
        minX: 2,
        maxX: 5,
        minY: 11,
        maxY: 14,
        minZ: 4,
        maxZ: 8,
      })
    })
  })

  describe('editedChunkAABBFromDirty', () => {
    it('prefers dirty voxels over the BFS AABB', () => {
      const bfsResult: DirtyBfsResult = Option.some({
        boundary: { nx: true, px: true, nz: true, pz: true },
        affectedAABB: Option.some(fullChunkAABB),
      })

      expect(
        editedChunkAABBFromDirty([
          { lx: 2, y: 10, lz: 4 },
          { lx: 3, y: 12, lz: 5 },
        ], bfsResult),
      ).toEqual({
        minX: 2,
        maxX: 3,
        minY: 10,
        maxY: 12,
        minZ: 4,
        maxZ: 5,
      })
    })

    it('falls back to the BFS AABB and then to a full chunk AABB', () => {
      const bfsResult: DirtyBfsResult = Option.some({
        boundary: { nx: false, px: false, nz: false, pz: false },
        affectedAABB: Option.some(editedAABB),
      })

      expect(editedChunkAABBFromDirty([], bfsResult)).toEqual(editedAABB)
      expect(
        editedChunkAABBFromDirty(undefined, Option.some({
          boundary: { nx: false, px: false, nz: false, pz: false },
          affectedAABB: Option.none(),
        })),
      ).toEqual(fullChunkAABB)
    })
  })

})
