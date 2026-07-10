import { describe, expect, it } from 'vitest'
import {
  isAscendingAhead,
  projectMinecartVelocity,
  resolveRailShape,
  type IsRailAt,
} from '../domain/rail-shape'

// Rail world as a set of "x,y,z" cells.
const railsAt = (cells: ReadonlyArray<readonly [number, number, number]>): IsRailAt => {
  const set = new Set(cells.map(([x, y, z]) => `${x},${y},${z}`))
  return (wx, wy, wz) => set.has(`${wx},${wy},${wz}`)
}

describe('resolveRailShape', () => {
  it('a straight north-south run resolves ns; east-west resolves ew', () => {
    const ns = railsAt([[0, 60, -1], [0, 60, 0], [0, 60, 1]])
    expect(resolveRailShape(ns, 0, 60, 0)).toBe('ns')
    const ew = railsAt([[-1, 60, 0], [0, 60, 0], [1, 60, 0]])
    expect(resolveRailShape(ew, 0, 60, 0)).toBe('ew')
  })

  it('a single neighbour extends that axis', () => {
    const stub = railsAt([[0, 60, 0], [0, 60, 1]])
    expect(resolveRailShape(stub, 0, 60, 0)).toBe('ns')
  })

  it('perpendicular neighbours resolve a curve', () => {
    const corner = railsAt([[0, 60, 0], [0, 60, -1], [1, 60, 0]])
    expect(resolveRailShape(corner, 0, 60, 0)).toBe('curve')
  })

  it('slope neighbours (one block up or down) still connect', () => {
    const slope = railsAt([[0, 60, 0], [0, 61, 1]])
    expect(resolveRailShape(slope, 0, 60, 0)).toBe('ns')
  })

  it('no neighbours resolves isolated', () => {
    expect(resolveRailShape(railsAt([[0, 60, 0]]), 0, 60, 0)).toBe('isolated')
  })
})

describe('projectMinecartVelocity', () => {
  it('straights zero the cross-axis component', () => {
    expect(projectMinecartVelocity('ns', 3, 5)).toEqual({ vx: 0, vz: 5 })
    expect(projectMinecartVelocity('ew', 3, 5)).toEqual({ vx: 3, vz: 0 })
  })

  it('curves redirect the full speed onto the dominant axis', () => {
    const out = projectMinecartVelocity('curve', 1, -4)
    expect(out.vx).toBe(0)
    expect(out.vz).toBeCloseTo(-Math.hypot(1, 4))
  })

  it('isolated rails leave velocity untouched', () => {
    expect(projectMinecartVelocity('isolated', 2, 7)).toEqual({ vx: 2, vz: 7 })
  })
})

describe('isAscendingAhead', () => {
  it('detects a rail one block up along the motion direction', () => {
    const slope = railsAt([[0, 60, 0], [0, 61, 1]])
    expect(isAscendingAhead(slope, 0, 60, 0, 0, 2)).toBe(true) // moving south, rail up ahead
    expect(isAscendingAhead(slope, 0, 60, 0, 0, -2)).toBe(false) // moving north, nothing up
  })

  it('a stationary cart never climbs', () => {
    const slope = railsAt([[0, 60, 0], [0, 61, 1]])
    expect(isAscendingAhead(slope, 0, 60, 0, 0, 0)).toBe(false)
  })
})
