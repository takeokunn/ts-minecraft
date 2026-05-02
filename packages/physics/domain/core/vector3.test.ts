import { describe, it, expect } from 'vitest'
import {
  makeVector3,
  zero, one, up, down, left, right, forward, backward,
  add, subtract, scale, dot, cross,
  length, lengthSquared, normalize, distance,
  toJSON, fromJSON,
} from './vector3'

describe('constants', () => {
  it('zero is { x: 0, y: 0, z: 0 }', () => {
    expect(zero).toEqual({ x: 0, y: 0, z: 0 })
  })
  it('one is { x: 1, y: 1, z: 1 }', () => {
    expect(one).toEqual({ x: 1, y: 1, z: 1 })
  })
  it('up is { x: 0, y: 1, z: 0 }', () => {
    expect(up).toEqual({ x: 0, y: 1, z: 0 })
  })
  it('down is { x: 0, y: -1, z: 0 }', () => {
    expect(down).toEqual({ x: 0, y: -1, z: 0 })
  })
  it('left is { x: -1, y: 0, z: 0 }', () => {
    expect(left).toEqual({ x: -1, y: 0, z: 0 })
  })
  it('right is { x: 1, y: 0, z: 0 }', () => {
    expect(right).toEqual({ x: 1, y: 0, z: 0 })
  })
  it('forward is { x: 0, y: 0, z: -1 }', () => {
    expect(forward).toEqual({ x: 0, y: 0, z: -1 })
  })
  it('backward is { x: 0, y: 0, z: 1 }', () => {
    expect(backward).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('makeVector3', () => {
  it('returns a vector with the given components', () => {
    expect(makeVector3(3, -2, 7)).toEqual({ x: 3, y: -2, z: 7 })
  })
  it('preserves fractional values', () => {
    expect(makeVector3(0.5, 1.5, -0.25)).toEqual({ x: 0.5, y: 1.5, z: -0.25 })
  })
})

describe('add', () => {
  it('adds two vectors component-wise', () => {
    expect(add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 })
  })
  it('adding zero vector is identity', () => {
    const v = { x: 3, y: -1, z: 7 }
    expect(add(v, zero)).toEqual(v)
  })
})

describe('subtract', () => {
  it('subtracts two vectors component-wise', () => {
    expect(subtract({ x: 5, y: 7, z: 9 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 4, y: 5, z: 6 })
  })
  it('subtracting zero vector is identity', () => {
    const v = { x: 3, y: -1, z: 7 }
    expect(subtract(v, zero)).toEqual(v)
  })
  it('subtracting self yields zero vector', () => {
    const v = { x: 3, y: -1, z: 7 }
    expect(subtract(v, v)).toEqual(zero)
  })
})

describe('scale', () => {
  it('multiplies each component by the scalar', () => {
    expect(scale({ x: 1, y: 2, z: 3 }, 3)).toEqual({ x: 3, y: 6, z: 9 })
  })
  it('scaling by 0 yields zero vector', () => {
    // Use all-positive components to avoid IEEE 754 -0 in deep equality check
    expect(scale({ x: 5, y: 3, z: 8 }, 0)).toEqual(zero)
  })
  it('scaling by -1 negates the vector', () => {
    expect(scale({ x: 1, y: -2, z: 3 }, -1)).toEqual({ x: -1, y: 2, z: -3 })
  })
})

describe('dot', () => {
  it('computes the dot product', () => {
    expect(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32)
  })
  it('dot with zero vector is 0', () => {
    expect(dot({ x: 5, y: -3, z: 8 }, zero)).toBe(0)
  })
  it('perpendicular unit vectors have dot product 0', () => {
    expect(dot(up, right)).toBe(0)
    expect(dot(forward, up)).toBe(0)
  })
})

describe('cross', () => {
  it('up × right = forward ({ x:0, y:0, z:-1 })', () => {
    expect(cross(up, right)).toEqual(forward)
  })
  it('right × up = backward ({ x:0, y:0, z:1 })', () => {
    expect(cross(right, up)).toEqual(backward)
  })
  it('cross product of a vector with itself is zero', () => {
    const v = { x: 1, y: 2, z: 3 }
    expect(cross(v, v)).toEqual(zero)
  })
  it('anti-commutative: a×b = -(b×a)', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { x: 4, y: 5, z: 6 }
    expect(cross(a, b)).toEqual(scale(cross(b, a), -1))
  })
})

describe('length', () => {
  it('length of zero vector is 0', () => {
    expect(length(zero)).toBe(0)
  })
  it('length of a unit axis vector is 1', () => {
    expect(length(up)).toBe(1)
    expect(length(right)).toBe(1)
  })
  it('length of { 3, 4, 0 } is 5', () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5, 10)
  })
})

describe('lengthSquared', () => {
  it('lengthSquared of zero is 0', () => {
    expect(lengthSquared(zero)).toBe(0)
  })
  it('lengthSquared of { 1, 2, 3 } is 14', () => {
    expect(lengthSquared({ x: 1, y: 2, z: 3 })).toBe(14)
  })
  it('matches length(v)^2', () => {
    const v = { x: 3, y: -4, z: 5 }
    expect(lengthSquared(v)).toBeCloseTo(length(v) ** 2, 10)
  })
})

describe('normalize', () => {
  it('normalizing a unit vector is identity', () => {
    const n = normalize(up)
    expect(n.x).toBeCloseTo(0, 10)
    expect(n.y).toBeCloseTo(1, 10)
    expect(n.z).toBeCloseTo(0, 10)
  })
  it('normalized vector has length 1', () => {
    const v = { x: 3, y: 4, z: 0 }
    expect(length(normalize(v))).toBeCloseTo(1, 10)
  })
  it('normalizing the zero vector returns zero (safe guard)', () => {
    expect(normalize(zero)).toBe(zero)
  })
})

describe('distance', () => {
  it('distance between the same point is 0', () => {
    const p = { x: 1, y: 2, z: 3 }
    expect(distance(p, p)).toBe(0)
  })
  it('distance between { 0,0,0 } and { 3,4,0 } is 5', () => {
    expect(distance(zero, { x: 3, y: 4, z: 0 })).toBeCloseTo(5, 10)
  })
  it('distance is symmetric', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { x: 4, y: 6, z: 3 }
    expect(distance(a, b)).toBeCloseTo(distance(b, a), 10)
  })
})

describe('toJSON / fromJSON', () => {
  it('toJSON returns a plain { x, y, z } object', () => {
    const v = { x: 1, y: -2, z: 3 }
    expect(toJSON(v)).toEqual({ x: 1, y: -2, z: 3 })
  })
  it('fromJSON reconstructs a Vector3 from a plain object', () => {
    const json = { x: 5, y: 0, z: -7 }
    expect(fromJSON(json)).toEqual({ x: 5, y: 0, z: -7 })
  })
  it('round-trip: fromJSON(toJSON(v)) equals v', () => {
    const v = { x: 2.5, y: -3.14, z: 0 }
    expect(fromJSON(toJSON(v))).toEqual(v)
  })
})
