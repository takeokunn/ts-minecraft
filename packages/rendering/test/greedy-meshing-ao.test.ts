import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import {
  aoXPos,
  aoXNeg,
  aoYPos,
  aoYNeg,
  aoZPos,
  aoZNeg,
} from '../infrastructure/meshing/greedy-meshing-ao'

// The six per-face AO functions are copy-paste variants: each counts how many of
// the four EDGE neighbours (in the face plane, one voxel out on the air side) are
// solid, clamped to 3. They must behave identically for an equivalent neighbour
// configuration — an asymmetry (flipped axis, wrong clamp, off-by-one plane)
// would show as inconsistent corner shading between faces. These tests pin that
// symmetry so a future edit to one function can't silently drift from the rest.

const STONE = blockTypeToIndex('STONE')
const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
const setSolid = (b: Uint8Array, lx: number, y: number, lz: number): void => {
  b[blockIdx(lx, y, lz)] = STONE
}

// Centre voxel well inside the chunk so every face plane is in bounds.
const CX = 8
const CY = 128
const CZ = 8

type AoFn = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number) => number

// For each face direction: the AO function and its four edge-neighbour coords
// (the voxels in the air-side plane that the function samples).
const cases: ReadonlyArray<{ name: string; fn: AoFn; neighbors: ReadonlyArray<readonly [number, number, number]> }> = [
  { name: 'aoXPos', fn: aoXPos, neighbors: [[CX + 1, CY - 1, CZ], [CX + 1, CY + 1, CZ], [CX + 1, CY, CZ - 1], [CX + 1, CY, CZ + 1]] },
  { name: 'aoXNeg', fn: aoXNeg, neighbors: [[CX - 1, CY - 1, CZ], [CX - 1, CY + 1, CZ], [CX - 1, CY, CZ - 1], [CX - 1, CY, CZ + 1]] },
  { name: 'aoYPos', fn: aoYPos, neighbors: [[CX + 1, CY + 1, CZ], [CX - 1, CY + 1, CZ], [CX, CY + 1, CZ + 1], [CX, CY + 1, CZ - 1]] },
  { name: 'aoYNeg', fn: aoYNeg, neighbors: [[CX + 1, CY - 1, CZ], [CX - 1, CY - 1, CZ], [CX, CY - 1, CZ + 1], [CX, CY - 1, CZ - 1]] },
  { name: 'aoZPos', fn: aoZPos, neighbors: [[CX + 1, CY, CZ + 1], [CX - 1, CY, CZ + 1], [CX, CY + 1, CZ + 1], [CX, CY - 1, CZ + 1]] },
  { name: 'aoZNeg', fn: aoZNeg, neighbors: [[CX + 1, CY, CZ - 1], [CX - 1, CY, CZ - 1], [CX, CY + 1, CZ - 1], [CX, CY - 1, CZ - 1]] },
]

describe('greedy-meshing AO — per-face edge-occlusion symmetry', () => {
  for (const { name, fn, neighbors } of cases) {
    it(`${name}: 0 solid edge-neighbours → AO 0`, () => {
      const blocks = makeBlocks()
      setSolid(blocks, CX, CY, CZ) // the face's own block; must not count
      expect(fn(blocks, CX, CY, CZ)).toBe(0)
    })

    it(`${name}: 2 solid edge-neighbours → AO 2`, () => {
      const blocks = makeBlocks()
      setSolid(blocks, ...neighbors[0]!)
      setSolid(blocks, ...neighbors[1]!)
      expect(fn(blocks, CX, CY, CZ)).toBe(2)
    })

    it(`${name}: all 4 solid edge-neighbours → AO clamps to 3`, () => {
      const blocks = makeBlocks()
      for (const n of neighbors) setSolid(blocks, ...n)
      expect(fn(blocks, CX, CY, CZ)).toBe(3)
    })
  }

  it('all six functions agree for the same logical configuration (no asymmetry)', () => {
    // Build, per direction, a chunk with exactly one solid edge-neighbour, and
    // assert every function reports the same count (1). A drift in any single
    // function would break this.
    const counts = cases.map(({ fn, neighbors }) => {
      const blocks = makeBlocks()
      setSolid(blocks, ...neighbors[0]!)
      return fn(blocks, CX, CY, CZ)
    })
    expect(counts).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('returns 0 at the chunk boundary on the face side (no cross-chunk sampling)', () => {
    const blocks = makeBlocks()
    // +X face at the +X boundary: lx = CHUNK_SIZE - 1 → aoXPos short-circuits.
    expect(aoXPos(blocks, CHUNK_SIZE - 1, CY, CZ)).toBe(0)
    expect(aoXNeg(blocks, 0, CY, CZ)).toBe(0)
    expect(aoYPos(blocks, CX, CHUNK_HEIGHT - 1, CZ)).toBe(0)
    expect(aoYNeg(blocks, CX, 0, CZ)).toBe(0)
    expect(aoZPos(blocks, CX, CY, CHUNK_SIZE - 1)).toBe(0)
    expect(aoZNeg(blocks, CX, CY, 0)).toBe(0)
  })
})
