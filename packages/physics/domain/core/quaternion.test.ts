import { describe, it, expect } from 'vitest'
import { identity, makeQuaternion, fromAxisAngle, multiply, slerp } from './quaternion'

describe('identity', () => {
  it('is { x: 0, y: 0, z: 0, w: 1 }', () => {
    expect(identity).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })
})

describe('makeQuaternion', () => {
  it('returns object with correct x, y, z, w values', () => {
    const q = makeQuaternion(1, 2, 3, 4)
    expect(q).toEqual({ x: 1, y: 2, z: 3, w: 4 })
  })
})

describe('fromAxisAngle', () => {
  it('0-degree rotation about any axis is close to identity', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, 0)
    expect(q.x).toBeCloseTo(0, 3)
    expect(q.y).toBeCloseTo(0, 3)
    expect(q.z).toBeCloseTo(0, 3)
    expect(q.w).toBeCloseTo(1, 3)
  })

  it('180-degree rotation about Z axis yields approx { x:0, y:0, z:1, w:0 }', () => {
    const q = fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI)
    expect(q.x).toBeCloseTo(0, 3)
    expect(q.y).toBeCloseTo(0, 3)
    expect(q.z).toBeCloseTo(1, 3)
    expect(q.w).toBeCloseTo(0, 3)
  })

  it('90-degree rotation about Y axis yields approx { x:0, y:0.707, z:0, w:0.707 }', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    expect(q.x).toBeCloseTo(0, 3)
    expect(q.y).toBeCloseTo(Math.SQRT1_2, 3)
    expect(q.z).toBeCloseTo(0, 3)
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 3)
  })
})

describe('multiply', () => {
  it('identity * identity = identity', () => {
    const r = multiply(identity, identity)
    expect(r.x).toBeCloseTo(0, 3)
    expect(r.y).toBeCloseTo(0, 3)
    expect(r.z).toBeCloseTo(0, 3)
    expect(r.w).toBeCloseTo(1, 3)
  })

  it('q * identity = q for arbitrary q', () => {
    const q = fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 4)
    const r = multiply(q, identity)
    expect(r.x).toBeCloseTo(q.x, 3)
    expect(r.y).toBeCloseTo(q.y, 3)
    expect(r.z).toBeCloseTo(q.z, 3)
    expect(r.w).toBeCloseTo(q.w, 3)
  })

  it('identity * q = q', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 3)
    const r = multiply(identity, q)
    expect(r.x).toBeCloseTo(q.x, 3)
    expect(r.y).toBeCloseTo(q.y, 3)
    expect(r.z).toBeCloseTo(q.z, 3)
    expect(r.w).toBeCloseTo(q.w, 3)
  })

  it('two 90-degree Z-rotations = 180-degree Z-rotation', () => {
    const q90 = fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2)
    const r = multiply(q90, q90)
    expect(r.z).toBeCloseTo(1, 3)
    expect(r.w).toBeCloseTo(0, 3)
  })
})

describe('slerp', () => {
  it('slerp(a, a, 0.5) returns the same quaternion', () => {
    const q = fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 4)
    const r = slerp(q, q, 0.5)
    expect(r.x).toBeCloseTo(q.x, 3)
    expect(r.y).toBeCloseTo(q.y, 3)
    expect(r.z).toBeCloseTo(q.z, 3)
    expect(r.w).toBeCloseTo(q.w, 3)
  })

  it('slerp(identity, q, 0) ≈ identity', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const r = slerp(identity, q, 0)
    expect(r.x).toBeCloseTo(identity.x, 3)
    expect(r.y).toBeCloseTo(identity.y, 3)
    expect(r.z).toBeCloseTo(identity.z, 3)
    expect(r.w).toBeCloseTo(identity.w, 3)
  })

  it('slerp(identity, q, 1) ≈ q', () => {
    const q = fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    const r = slerp(identity, q, 1)
    expect(r.x).toBeCloseTo(q.x, 3)
    expect(r.y).toBeCloseTo(q.y, 3)
    expect(r.z).toBeCloseTo(q.z, 3)
    expect(r.w).toBeCloseTo(q.w, 3)
  })

  it('t=0.5 between identity and 180-degree Z-rotation triggers negation branch (cosom < 0)', () => {
    const b = fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI)
    const r = slerp(identity, b, 0.5)
    expect(r.x).toBeCloseTo(0, 3)
    expect(r.y).toBeCloseTo(0, 3)
    expect(r.z).toBeCloseTo(Math.SQRT1_2, 3)
    expect(r.w).toBeCloseTo(Math.SQRT1_2, 3)
  })

  it('slerp with cosom < 0 (quaternions more than 90° apart) triggers negation branch', () => {
    // 270° Z-rotation: w = cos(3π/4) = -√2/2 < 0 → cosom = identity.w * b.w = -√2/2 < 0
    const b = fromAxisAngle({ x: 0, y: 0, z: 1 }, 3 * Math.PI / 2)
    const r = slerp(identity, b, 0.5)
    // Unit quaternion magnitude must stay 1
    const magnitude = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z + r.w * r.w)
    expect(magnitude).toBeCloseTo(1, 3)
    // After negating b (equiv. to -90° Z-rotation), midpoint at t=0.5 is -45° Z-rotation
    expect(r.x).toBeCloseTo(0, 3)
    expect(r.y).toBeCloseTo(0, 3)
    expect(r.z).toBeCloseTo(-Math.sin(Math.PI / 8), 3)
    expect(r.w).toBeCloseTo(Math.cos(Math.PI / 8), 3)
  })

  it('very-close quaternions use linear fallback (cosom > 0.999999)', () => {
    const b = makeQuaternion(0.00001, 0, 0, 1)
    const r = slerp(identity, b, 0.5)
    expect(r.x).toBeCloseTo(0.000005, 3)
    expect(r.y).toBeCloseTo(0, 3)
    expect(r.z).toBeCloseTo(0, 3)
    expect(r.w).toBeCloseTo(1, 3)
  })
})
