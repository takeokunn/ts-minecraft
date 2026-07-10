import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { voxelRaycast } from './voxel-raycast'

const solidAt = (positions: ReadonlyArray<readonly [number, number, number]>) => {
  const keys = new Set(positions.map(([x, y, z]) => `${x},${y},${z}`))
  return (x: number, y: number, z: number) => keys.has(`${x},${y},${z}`)
}

describe('voxelRaycast', () => {
  it('hits the first solid block straight ahead with the entry-face normal', () => {
    const hit = Option.getOrNull(voxelRaycast(
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 1, y: 0, z: 0 },
      5,
      solidAt([[3, 0, 0]]),
    ))
    expect(hit).not.toBeNull()
    expect(hit).toMatchObject({ blockX: 3, blockY: 0, blockZ: 0, normal: { x: -1, y: 0, z: 0 } })
    expect(hit!.distance).toBeCloseTo(2.5, 5)
    expect(hit!.point.x).toBeCloseTo(3, 5)
  })

  it('returns none when nothing is in range', () => {
    const hit = voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5, solidAt([[7, 0, 0]]))
    expect(Option.isNone(hit)).toBe(true)
  })

  it('never targets the cell the origin is inside', () => {
    const hit = voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5, solidAt([[0, 0, 0], [2, 0, 0]]))
    expect(Option.getOrNull(hit)).toMatchObject({ blockX: 2 })
  })

  it('respects maxDistance measured to the entry face', () => {
    // Face of block x=3 is at distance 2.5 from origin 0.5 — just out of a 2.4 reach.
    const miss = voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2.4, solidAt([[3, 0, 0]]))
    expect(Option.isNone(miss)).toBe(true)
    const reach = voxelRaycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2.6, solidAt([[3, 0, 0]]))
    expect(Option.isNone(reach)).toBe(false)
  })

  it('walks negative directions with the opposite face normal', () => {
    const hit = Option.getOrNull(voxelRaycast(
      { x: 0.5, y: 10.5, z: 0.5 },
      { x: 0, y: -1, z: 0 },
      5,
      solidAt([[0, 7, 0]]),
    ))
    expect(hit).toMatchObject({ blockX: 0, blockY: 7, blockZ: 0, normal: { x: 0, y: 1, z: 0 } })
    expect(hit!.distance).toBeCloseTo(2.5, 5)
  })

  it('traverses diagonals cell by cell (no corner skipping past a wall)', () => {
    // A solid wall on the x=2 plane must stop a diagonal ray even though the
    // diagonal "line" grazes cell corners.
    const wall: Array<readonly [number, number, number]> = []
    for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) wall.push([2, y, z] as const)
    const hit = Option.getOrNull(voxelRaycast(
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 1, y: 0.3, z: 0.7 },
      8,
      solidAt(wall),
    ))
    expect(hit).not.toBeNull()
    expect(hit!.blockX).toBe(2)
  })

  it('normalizes non-unit directions (distance stays metric)', () => {
    const hit = Option.getOrNull(voxelRaycast(
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 100, y: 0, z: 0 },
      5,
      solidAt([[3, 0, 0]]),
    ))
    expect(hit!.distance).toBeCloseTo(2.5, 5)
  })

  it('rejects degenerate inputs', () => {
    expect(Option.isNone(voxelRaycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 5, () => true))).toBe(true)
    expect(Option.isNone(voxelRaycast({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0, () => true))).toBe(true)
    expect(Option.isNone(voxelRaycast({ x: 0, y: 0, z: 0 }, { x: Infinity, y: 0, z: 0 }, 5, () => true))).toBe(true)
  })
})
