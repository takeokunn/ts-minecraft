import { describe, it, expect } from 'vitest'
import {
  makeVector3, zero, one, up, down, left, right, forward, backward,
  add, subtract, scale, dot, cross, length, lengthSquared, normalize, distance,
} from '@ts-minecraft/core'

describe('vector3 constants', () => {
  it('zero is (0,0,0)', () => { expect(zero).toEqual({ x: 0, y: 0, z: 0 }) })
  it('one is (1,1,1)', () => { expect(one).toEqual({ x: 1, y: 1, z: 1 }) })
  it('up is (0,1,0)', () => { expect(up).toEqual({ x: 0, y: 1, z: 0 }) })
  it('down is (0,-1,0)', () => { expect(down).toEqual({ x: 0, y: -1, z: 0 }) })
  it('left is (-1,0,0)', () => { expect(left).toEqual({ x: -1, y: 0, z: 0 }) })
  it('right is (1,0,0)', () => { expect(right).toEqual({ x: 1, y: 0, z: 0 }) })
  it('forward is (0,0,-1)', () => { expect(forward).toEqual({ x: 0, y: 0, z: -1 }) })
  it('backward is (0,0,1)', () => { expect(backward).toEqual({ x: 0, y: 0, z: 1 }) })
})

describe('makeVector3', () => {
  it('constructs a vector from components', () => {
    expect(makeVector3(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('add', () => {
  it('sums two vectors', () => {
    expect(add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 })
  })
  it('adding zero is identity', () => {
    expect(add({ x: 3, y: -1, z: 2 }, zero)).toEqual({ x: 3, y: -1, z: 2 })
  })
})

describe('subtract', () => {
  it('subtracts two vectors', () => {
    expect(subtract({ x: 5, y: 7, z: 9 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 4, y: 5, z: 6 })
  })
  it('v - v = zero', () => {
    expect(subtract({ x: 3, y: 3, z: 3 }, { x: 3, y: 3, z: 3 })).toEqual(zero)
  })
})

describe('scale', () => {
  it('scales a vector by a scalar', () => {
    expect(scale({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 })
  })
  it('scale by 0 gives zero vector', () => {
    expect(scale({ x: 5, y: 3, z: 1 }, 0)).toEqual(zero)
  })
  it('scale by 1 is identity', () => {
    expect(scale({ x: 5, y: -3, z: 1 }, 1)).toEqual({ x: 5, y: -3, z: 1 })
  })
})

describe('dot', () => {
  it('computes dot product', () => {
    expect(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32)
  })
  it('orthogonal vectors have dot product 0', () => {
    expect(dot(up, forward)).toBe(0)
  })
  it('parallel unit vectors have dot product 1', () => {
    expect(dot(up, up)).toBe(1)
  })
  it('anti-parallel unit vectors have dot product -1', () => {
    expect(dot(up, down)).toBe(-1)
  })
})

describe('cross', () => {
  it('x cross y = z', () => {
    expect(cross(right, up)).toEqual(backward)
  })
  it('y cross x = -z', () => {
    expect(cross(up, right)).toEqual(forward)
  })
  it('cross product of parallel vectors is zero', () => {
    expect(cross(up, up)).toEqual(zero)
  })
})

describe('length', () => {
  it('length of zero vector is 0', () => {
    expect(length(zero)).toBe(0)
  })
  it('length of unit vector is 1', () => {
    expect(length(up)).toBe(1)
  })
  it('length of (3,4,0) is 5', () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5)
  })
})

describe('lengthSquared', () => {
  it('lengthSquared of zero is 0', () => {
    expect(lengthSquared(zero)).toBe(0)
  })
  it('lengthSquared of (1,2,2) is 9', () => {
    expect(lengthSquared({ x: 1, y: 2, z: 2 })).toBe(9)
  })
})

describe('normalize', () => {
  it('normalizing a unit vector returns the same vector', () => {
    const n = normalize(up)
    expect(n.x).toBeCloseTo(0)
    expect(n.y).toBeCloseTo(1)
    expect(n.z).toBeCloseTo(0)
  })
  it('normalized vector has length 1', () => {
    expect(length(normalize({ x: 3, y: 4, z: 0 }))).toBeCloseTo(1)
  })
  it('normalizing zero vector returns zero (no division by zero)', () => {
    expect(normalize(zero)).toEqual(zero)
  })
})

describe('distance', () => {
  it('distance between identical points is 0', () => {
    expect(distance({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0)
  })
  it('distance is symmetric', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 3, y: 4, z: 0 }
    expect(distance(a, b)).toBeCloseTo(distance(b, a))
  })
  it('distance (0,0,0) to (3,4,0) is 5', () => {
    expect(distance(zero, { x: 3, y: 4, z: 0 })).toBeCloseTo(5)
  })
})
