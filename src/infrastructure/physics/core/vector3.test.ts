import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  Vector3Schema,
  makeVector3,
  zero,
  one,
  up,
  down,
  left,
  right,
  forward,
  backward,
  add,
  subtract,
  scale,
  dot,
  cross,
  length,
  lengthSquared,
  normalize,
  distance,
  toJSON,
  fromJSON,
} from './vector3'

describe('Vector3Schema', () => {
  it('should decode a valid vector3', () => {
    const result = Schema.decodeUnknownSync(Vector3Schema)({ x: 1, y: 2, z: 3 })
    expect(result).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should decode zero values', () => {
    const result = Schema.decodeUnknownSync(Vector3Schema)({ x: 0, y: 0, z: 0 })
    expect(result).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('should decode negative values', () => {
    const result = Schema.decodeUnknownSync(Vector3Schema)({ x: -1, y: -2.5, z: -3 })
    expect(result).toEqual({ x: -1, y: -2.5, z: -3 })
  })

  it('should fail on NaN x', () => {
    expect(() => Schema.decodeUnknownSync(Vector3Schema)({ x: NaN, y: 0, z: 0 })).toThrow()
  })

  it('should fail on Infinity y', () => {
    expect(() => Schema.decodeUnknownSync(Vector3Schema)({ x: 0, y: Infinity, z: 0 })).toThrow()
  })

  it('should fail on -Infinity z', () => {
    expect(() => Schema.decodeUnknownSync(Vector3Schema)({ x: 0, y: 0, z: -Infinity })).toThrow()
  })

  it('should encode a Vector3 back to plain object', () => {
    const v = Schema.decodeUnknownSync(Vector3Schema)({ x: 1, y: 2, z: 3 })
    const encoded = Schema.encodeSync(Vector3Schema)(v)
    expect(encoded).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('constants', () => {
  it('zero should be { x: 0, y: 0, z: 0 }', () => {
    expect(zero).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('one should be { x: 1, y: 1, z: 1 }', () => {
    expect(one).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('up should be { x: 0, y: 1, z: 0 }', () => {
    expect(up).toEqual({ x: 0, y: 1, z: 0 })
  })

  it('down should be { x: 0, y: -1, z: 0 }', () => {
    expect(down).toEqual({ x: 0, y: -1, z: 0 })
  })

  it('left should be { x: -1, y: 0, z: 0 }', () => {
    expect(left).toEqual({ x: -1, y: 0, z: 0 })
  })

  it('right should be { x: 1, y: 0, z: 0 }', () => {
    expect(right).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('forward should be { x: 0, y: 0, z: -1 }', () => {
    expect(forward).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('backward should be { x: 0, y: 0, z: 1 }', () => {
    expect(backward).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('makeVector3', () => {
  it('should create a vector from components', () => {
    expect(makeVector3(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should create a zero vector', () => {
    expect(makeVector3(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('should create a vector with negative values', () => {
    expect(makeVector3(-1, -2, -3)).toEqual({ x: -1, y: -2, z: -3 })
  })
})

describe('add', () => {
  it('should add two vectors', () => {
    expect(add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 })
  })

  it('should add zero vector without changing original (identity)', () => {
    expect(add({ x: 1, y: 2, z: 3 }, zero)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should add negative values', () => {
    expect(add({ x: 1, y: 2, z: 3 }, { x: -1, y: -2, z: -3 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('subtract', () => {
  it('should subtract two vectors', () => {
    expect(subtract({ x: 5, y: 5, z: 5 }, { x: 3, y: 2, z: 1 })).toEqual({ x: 2, y: 3, z: 4 })
  })

  it('should subtract zero vector without changing original', () => {
    expect(subtract({ x: 1, y: 2, z: 3 }, zero)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should give zero when subtracting vector from itself', () => {
    const v = { x: 3, y: 4, z: 5 }
    expect(subtract(v, v)).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('scale', () => {
  it('should scale a vector by a scalar', () => {
    expect(scale({ x: 2, y: 3, z: 4 }, 2)).toEqual({ x: 4, y: 6, z: 8 })
  })

  it('should return zero when scaled by 0', () => {
    expect(scale({ x: 5, y: 10, z: 15 }, 0)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('should negate vector when scaled by -1', () => {
    expect(scale({ x: 1, y: -2, z: 3 }, -1)).toEqual({ x: -1, y: 2, z: -3 })
  })
})

describe('dot', () => {
  it('perpendicular vectors have dot product 0', () => {
    expect(dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0)
  })

  it('should compute dot product of (3,4,0) with itself', () => {
    expect(dot({ x: 3, y: 4, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(25)
  })

  it('parallel unit vectors have dot product 1', () => {
    expect(dot(up, up)).toBe(1)
  })

  it('anti-parallel unit vectors have dot product -1', () => {
    expect(dot(up, down)).toBe(-1)
  })
})

describe('cross', () => {
  it('x cross y = z (right-hand rule)', () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('y cross x = -z (anti-commutative)', () => {
    expect(cross({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('cross product of parallel vectors is zero', () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('length', () => {
  it('should compute length of a 3-4-5 vector', () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5)
  })

  it('should compute length of a unit vector', () => {
    expect(length(up)).toBeCloseTo(1)
  })

  it('zero vector has length 0', () => {
    expect(length(zero)).toBe(0)
  })
})

describe('lengthSquared', () => {
  it('should compute squared length of a 3-4-5 vector', () => {
    expect(lengthSquared({ x: 3, y: 4, z: 0 })).toBe(25)
  })

  it('zero vector has squared length 0', () => {
    expect(lengthSquared(zero)).toBe(0)
  })

  it('unit vector has squared length 1', () => {
    expect(lengthSquared(up)).toBe(1)
  })
})

describe('normalize', () => {
  it('should normalize a vector to unit length', () => {
    const result = normalize({ x: 3, y: 0, z: 0 })
    expect(result).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('normalizing zero vector should return zero (safe, no division by zero)', () => {
    expect(normalize(zero)).toEqual(zero)
  })

  it('normalized vector should have unit length', () => {
    const result = normalize({ x: 3, y: 4, z: 0 })
    expect(length(result)).toBeCloseTo(1)
  })

  it('normalizing a unit vector should return the same vector', () => {
    const result = normalize(up)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
  })
})

describe('distance', () => {
  it('should compute distance between origin and (3, 4, 0)', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5)
  })

  it('distance from point to itself is 0', () => {
    const v = { x: 5, y: 10, z: 15 }
    expect(distance(v, v)).toBe(0)
  })

  it('distance should be symmetric', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { x: 4, y: 6, z: 3 }
    expect(distance(a, b)).toBeCloseTo(distance(b, a))
  })
})

describe('toJSON / fromJSON', () => {
  it('toJSON should return plain object with x, y, z', () => {
    expect(toJSON({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('fromJSON should reconstruct a Vector3', () => {
    expect(fromJSON({ x: 4, y: 5, z: 6 })).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('fromJSON(toJSON(v)) roundtrip should deep-equal original', () => {
    const v = { x: 1, y: 2, z: 3 }
    expect(fromJSON(toJSON(v))).toEqual(v)
  })
})
