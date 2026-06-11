import { describe, it, expect } from 'vitest'
import {
  computeCirclingVelocity,
  computeStrafingVelocity,
  computeLandingVelocity,
  computeTakeoffVelocity,
} from './dragon-flight'

const SPEED = 1

// Helper: vector magnitude
const mag = (v: { x: number; y: number; z: number }): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

describe('computeTakeoffVelocity', () => {
  it('always returns upward velocity (positive y)', () => {
    const v = computeTakeoffVelocity({ x: 0, y: 64, z: 0 }, SPEED)
    expect(v.y).toBeGreaterThan(0)
    expect(v.x).toBe(0)
    expect(v.z).toBe(0)
  })
  it('magnitude equals speed', () => {
    const v = computeTakeoffVelocity({ x: 10, y: 80, z: -5 }, 2)
    expect(mag(v)).toBeCloseTo(2)
  })
  it('current position does not affect direction', () => {
    const v1 = computeTakeoffVelocity({ x: 0, y: 0, z: 0 }, SPEED)
    const v2 = computeTakeoffVelocity({ x: 100, y: 200, z: 300 }, SPEED)
    expect(v1).toEqual(v2)
  })
})

describe('computeLandingVelocity', () => {
  it('points toward portal from above', () => {
    const dragon = { x: 0, y: 90, z: 0 }
    const portal = { x: 0, y: 64, z: 0 }
    const v = computeLandingVelocity(dragon, portal, SPEED)
    expect(v.y).toBeLessThan(0)
    expect(v.x).toBe(0)
    expect(v.z).toBe(0)
  })
  it('magnitude equals speed', () => {
    const v = computeLandingVelocity({ x: 5, y: 80, z: 3 }, { x: 0, y: 64, z: 0 }, 2)
    expect(mag(v)).toBeCloseTo(2)
  })
})

describe('computeStrafingVelocity', () => {
  it('points from dragon toward player', () => {
    const dragon = { x: 0, y: 80, z: 0 }
    const player = { x: 10, y: 64, z: 0 }
    const v = computeStrafingVelocity(dragon, player, SPEED)
    expect(v.x).toBeGreaterThan(0)
    expect(v.z).toBe(0)
  })
  it('magnitude equals speed', () => {
    const v = computeStrafingVelocity({ x: 0, y: 80, z: 0 }, { x: 3, y: 64, z: 4 }, 1.5)
    expect(mag(v)).toBeCloseTo(1.5)
  })
  it('is symmetric in direction: swapping dragon/player reverses velocity', () => {
    const a = { x: 0, y: 80, z: 0 }
    const b = { x: 10, y: 64, z: 0 }
    const v1 = computeStrafingVelocity(a, b, SPEED)
    const v2 = computeStrafingVelocity(b, a, SPEED)
    expect(v1.x).toBeCloseTo(-v2.x)
    expect(v1.y).toBeCloseTo(-v2.y)
    expect(v1.z).toBeCloseTo(-v2.z)
  })
})

describe('computeCirclingVelocity', () => {
  it('returns a non-zero velocity', () => {
    const v = computeCirclingVelocity({ x: 0, y: 64, z: 0 }, 20, 80, 0, SPEED)
    expect(mag(v)).toBeGreaterThan(0)
  })
  it('magnitude equals speed', () => {
    const v = computeCirclingVelocity({ x: 0, y: 64, z: 0 }, 20, 80, 0, 2)
    expect(mag(v)).toBeCloseTo(2)
  })
  it('direction rotates with angle', () => {
    const center = { x: 0, y: 64, z: 0 }
    const v0 = computeCirclingVelocity(center, 20, 80, 0, SPEED)
    const vPi = computeCirclingVelocity(center, 20, 80, Math.PI, SPEED)
    // At angle 0: x=0, z=1; at π: x=0, z=-1 (approximately — ignoring y)
    expect(v0.z).toBeGreaterThan(0)
    expect(vPi.z).toBeLessThan(0)
  })
})
