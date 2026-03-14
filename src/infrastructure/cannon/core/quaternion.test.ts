import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import * as CANNON from 'cannon-es'
import {
  QuaternionSchema,
  identity,
  makeQuaternion,
  fromCannonQuaternion,
  toCannonQuaternion,
  fromAxisAngle,
  multiply,
  slerp,
} from './quaternion'

const quatLength = (q: { x: number; y: number; z: number; w: number }): number =>
  Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)

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
  it('should be { x: 0, y: 0, z: 0, w: 1 }', () => {
    expect(identity).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('should have unit length (is a unit quaternion)', () => {
    expect(quatLength(identity)).toBeCloseTo(1)
  })
})

describe('makeQuaternion', () => {
  it('makeQuaternion(0, 0, 0, 1) equals identity', () => {
    expect(makeQuaternion(0, 0, 0, 1)).toEqual(identity)
  })

  it('should create a quaternion with non-trivial values', () => {
    expect(makeQuaternion(0.1, 0.2, 0.3, 0.9)).toEqual({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 })
  })
})

describe('fromAxisAngle', () => {
  it('rotation of 0 around Y axis should produce identity quaternion', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, 0)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(1)
  })

  it('rotation of PI/2 around Y axis: w ≈ cos(PI/4), y ≈ sin(PI/4)', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(Math.SQRT1_2)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(Math.SQRT1_2)
  })

  it('rotation of PI around Y axis: w ≈ 0, y ≈ 1', () => {
    const result = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
    expect(result.w).toBeCloseTo(0)
  })

  it('result should be a unit quaternion', () => {
    const result = fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 3)
    expect(quatLength(result)).toBeCloseTo(1)
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

  it('90deg Y-rotation × 90deg Y-rotation ≈ 180deg Y-rotation', () => {
    const q90 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const q180 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI)
    const result = multiply(q90, q90)
    expect(Math.abs(result.y)).toBeCloseTo(Math.abs(q180.y))
    expect(Math.abs(result.w)).toBeCloseTo(Math.abs(q180.w))
  })
})

describe('slerp', () => {
  it('slerp(identity, q90, 0.0) ≈ identity', () => {
    const q90 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const result = slerp(identity, q90, 0)
    expect(result.x).toBeCloseTo(identity.x)
    expect(result.y).toBeCloseTo(identity.y)
    expect(result.z).toBeCloseTo(identity.z)
    expect(result.w).toBeCloseTo(identity.w)
  })

  it('slerp(identity, q90, 1.0) ≈ q90', () => {
    const q90 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const result = slerp(identity, q90, 1)
    expect(result.x).toBeCloseTo(q90.x)
    expect(result.y).toBeCloseTo(q90.y)
    expect(result.z).toBeCloseTo(q90.z)
    expect(result.w).toBeCloseTo(q90.w)
  })

  it('slerp(identity, q90, 0.5) should be 45deg rotation (w ≈ cos(PI/8))', () => {
    const q90 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const q45 = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4)
    const result = slerp(identity, q90, 0.5)
    expect(result.y).toBeCloseTo(q45.y)
    expect(result.w).toBeCloseTo(q45.w)
  })
})

describe('fromCannonQuaternion / toCannonQuaternion', () => {
  it('fromCannonQuaternion should extract x, y, z, w from CANNON.Quaternion', () => {
    const cannonQuat = new CANNON.Quaternion(0, 0, 0, 1)
    expect(fromCannonQuaternion(cannonQuat)).toEqual(identity)
  })

  it('toCannonQuaternion should create a CANNON.Quaternion with correct values', () => {
    const cannonQuat = toCannonQuaternion(identity)
    expect(cannonQuat).toBeInstanceOf(CANNON.Quaternion)
    expect(cannonQuat.x).toBe(0)
    expect(cannonQuat.y).toBe(0)
    expect(cannonQuat.z).toBe(0)
    expect(cannonQuat.w).toBe(1)
  })

  it('roundtrip fromCannonQuaternion(toCannonQuaternion(identity)) deep-equals identity', () => {
    const result = fromCannonQuaternion(toCannonQuaternion(identity))
    expect(result).toEqual(identity)
  })

  it('roundtrip preserves non-trivial quaternion values', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 3)
    const result = fromCannonQuaternion(toCannonQuaternion(q))
    expect(result.x).toBeCloseTo(q.x)
    expect(result.y).toBeCloseTo(q.y)
    expect(result.z).toBeCloseTo(q.z)
    expect(result.w).toBeCloseTo(q.w)
  })
})
