import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { toDirtyVoxels, toPlacedBlock } from './placed-block'

describe('placed-block', () => {
  it('builds a placed block from local coordinates and world position', () => {
    expect(
      toPlacedBlock(3, 64, 5, { x: 12.5, y: 64.2, z: -8.75 }),
    ).toEqual({
      lx: 3,
      y: 64,
      lz: 5,
      position: { x: 12.5, y: 64.2, z: -8.75 },
    })
  })

  it('projects placed blocks into dirty voxel coordinates', () => {
    expect(
      toDirtyVoxels([
        toPlacedBlock(1, 2, 3, { x: 10, y: 20, z: 30 }),
        toPlacedBlock(4, 5, 6, { x: 40, y: 50, z: 60 }),
      ]),
    ).toEqual([
      { lx: 1, y: 2, lz: 3 },
      { lx: 4, y: 5, lz: 6 },
    ])
  })
})
