import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import * as THREE from 'three'
import {
  QuaternionSchema,
  identity,
  makeQuaternion,
  fromThreeQuaternion,
  toThreeQuaternion,
  fromAxisAngle,
  multiply,
  slerp,
} from './quaternion'

describe('QuaternionSchema', () => {
  it('should decode a valid quaternion', () => {
    const result = Schema.decodeUnknownSync(QuaternionSchema)({ x: 0, y: 0, z: 0, w: 1 })
    expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('should decode a quaternion with non-trivial values', () => {
    const result = Schema.decodeUnknownSync(QuaternionSchema)({ x: 0.5, y: 0.5, z: 0.5, w: 0.5 })
    expect(result).toEqual({ x: 0.5, y: 0.5, z: 0.5, w: 0.5 })
  })

  it('should fail on NaN x', () => {
    expect(() => Schema.decodeUnknownSync(QuaternionSchema)({ x: NaN, y: 0, z: 0, w: 1 })).toThrow()
  })

  it('should fail on Infinity w', () => {
    expect(() => Schema.decodeUnknownSync(QuaternionSchema)({ x: 0, y: 0, z: 0, w: Infinity })).toThrow()
  })

  it('should fail on missing w field', () => {
    expect(() => Schema.decodeUnknownSync(QuaternionSchema)({ x: 0, y: 0, z: 0 })).toThrow()
  })

  it('should encode a Quaternion back to plain object', () => {
    const q = Schema.decodeUnknownSync(QuaternionSchema)({ x: 0, y: 0, z: 0, w: 1 })
    const encoded = Schema.encodeSync(QuaternionSchema)(q)
    expect(encoded).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })
})

describe('identity', () => {
  it('should be the identity quaternion { x: 0, y: 0, z: 0, w: 1 }', () => {
    expect(identity).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })
})

describe('makeQuaternion', () => {
  it('should create a quaternion from components', () => {
    expect(makeQuaternion(0, 0, 0, 1)).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('should create a quaternion with non-trivial values', () => {
    expect(makeQuaternion(0.1, 0.2, 0.3, 0.9)).toEqual({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 })
  })
})

describe('fromThreeQuaternion / toThreeQuaternion', () => {
  it('fromThreeQuaternion should extract x, y, z, w from THREE.Quaternion', () => {
    const threeQuat = new THREE.Quaternion(0, 0, 0, 1)
    const result = fromThreeQuaternion(threeQuat)
    expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('toThreeQuaternion should create a THREE.Quaternion with correct values', () => {
    const q = { x: 0, y: 0, z: 0, w: 1 }
    const threeQuat = toThreeQuaternion(q)
    expect(threeQuat).toBeInstanceOf(THREE.Quaternion)
    expect(threeQuat.x).toBe(0)
    expect(threeQuat.y).toBe(0)
    expect(threeQuat.z).toBe(0)
    expect(threeQuat.w).toBe(1)
  })

  it('roundtrip fromThreeQuaternion(toThreeQuaternion(q)) should equal q', () => {
    const q = { x: 0.5, y: 0.5, z: 0.5, w: 0.5 }
    const result = fromThreeQuaternion(toThreeQuaternion(q))
    expect(result.x).toBeCloseTo(q.x)
    expect(result.y).toBeCloseTo(q.y)
    expect(result.z).toBeCloseTo(q.z)
    expect(result.w).toBeCloseTo(q.w)
  })
})

describe('fromAxisAngle', () => {
  it('rotation of 0 around any axis should produce identity quaternion', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, 0)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(1)
  })

  it('rotation of PI around Y axis should produce (0, 1, 0, 0)', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(0)
  })

  it('rotation of PI/2 around Y axis should produce (0, ~0.707, 0, ~0.707)', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(Math.SQRT1_2)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(Math.SQRT1_2)
  })
})

describe('multiply', () => {
  it('identity * identity = identity', () => {
    const result = multiply(identity, identity)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(1)
  })

  it('q * identity = q', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4)
    const result = multiply(q, identity)
    expect(result.x).toBeCloseTo(q.x)
    expect(result.y).toBeCloseTo(q.y)
    expect(result.z).toBeCloseTo(q.z)
    expect(result.w).toBeCloseTo(q.w)
  })

  it('90deg Y * 90deg Y = 180deg Y', () => {
    const q90 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const q180 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI)
    const result = multiply(q90, q90)
    expect(Math.abs(result.y)).toBeCloseTo(Math.abs(q180.y))
    expect(Math.abs(result.w)).toBeCloseTo(Math.abs(q180.w))
  })
})

describe('slerp', () => {
  it('slerp(a, b, 0) should equal a', () => {
    const a = identity
    const b = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const result = slerp(a, b, 0)
    expect(result.x).toBeCloseTo(a.x)
    expect(result.y).toBeCloseTo(a.y)
    expect(result.z).toBeCloseTo(a.z)
    expect(result.w).toBeCloseTo(a.w)
  })

  it('slerp(a, b, 1) should equal b', () => {
    const a = identity
    const b = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const result = slerp(a, b, 1)
    expect(result.x).toBeCloseTo(b.x)
    expect(result.y).toBeCloseTo(b.y)
    expect(result.z).toBeCloseTo(b.z)
    expect(result.w).toBeCloseTo(b.w)
  })

  it('slerp(a, b, 0.5) should be halfway between a and b', () => {
    const a = identity
    const b = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const half = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4)
    const result = slerp(a, b, 0.5)
    expect(result.y).toBeCloseTo(half.y)
    expect(result.w).toBeCloseTo(half.w)
  })
})
