import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { type ChunkAABB } from '../domain/chunk-aabb'
import type { DirtyVoxel } from '../domain/light-engine-model'
import type { DirtyBfsResult } from './chunk-manager-service-helpers'
import { resolveDirtyChunkSelection } from './chunk-manager-service-dirty-selection'

const dirtyVoxels: ReadonlyArray<DirtyVoxel> = [{ lx: 1, y: 2, lz: 3 }]

const bfsResult: DirtyBfsResult = Option.some({
  boundary: { nx: true, px: false, nz: true, pz: false },
  affectedAABB: Option.some<ChunkAABB>({ minX: 1, maxX: 4, minY: 5, maxY: 6, minZ: 7, maxZ: 8 }),
})

describe('chunk-manager-service-dirty-selection', () => {
  it('returns both dirty offsets and the edited chunk aabb from the shared bfs result', () => {
    const selection = resolveDirtyChunkSelection(dirtyVoxels, bfsResult)

    expect(selection.offsets).toEqual([[0, 0], [-1, -1], [-1, 0], [0, -1]])
    expect(selection.editedChunkAABB).toEqual({ minX: 1, maxX: 1, minY: 2, maxY: 2, minZ: 3, maxZ: 3 })
  })

  it('falls back to the full chunk aabb when there are no dirty voxels and no bfs area', () => {
    const selection = resolveDirtyChunkSelection(undefined, Option.none())

    expect(selection.offsets).toEqual([
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
    expect(selection.editedChunkAABB).toEqual({
      minX: 0,
      maxX: 15,
      minY: 0,
      maxY: 255,
      minZ: 0,
      maxZ: 15,
    })
  })
})
