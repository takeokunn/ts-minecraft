import { describe, expect, it } from 'vitest'
import {
  squaredXpOrbDistance,
  isWithinXpOrbPickupDistance,
} from '@ts-minecraft/entity/domain/dropped-xp-orb-resolution'
import { XP_ORB_PICKUP_DISTANCE } from '@ts-minecraft/entity/domain/dropped-xp-orb'

// ─── squaredXpOrbDistance ─────────────────────────────────────────────────────
describe('squaredXpOrbDistance', () => {
  it('returns 0 for identical positions', () => {
    expect(squaredXpOrbDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0)
  })

  it('computes squared distance along X', () => {
    expect(squaredXpOrbDistance({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 })).toBe(16)
  })

  it('computes squared distance along Y', () => {
    expect(squaredXpOrbDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 0 })).toBe(9)
  })

  it('computes squared distance along Z', () => {
    expect(squaredXpOrbDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 })).toBe(25)
  })

  it('combines all three axes', () => {
    // sqrt(4+4+16)=sqrt(24)^2=24
    expect(squaredXpOrbDistance({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 4 })).toBe(24)
  })

  it('is symmetric', () => {
    const a = { x: 3, y: 1, z: 2 }
    const b = { x: 0, y: 4, z: 0 }
    expect(squaredXpOrbDistance(a, b)).toBe(squaredXpOrbDistance(b, a))
  })
})

// ─── isWithinXpOrbPickupDistance ─────────────────────────────────────────────
describe('isWithinXpOrbPickupDistance', () => {
  const origin = { x: 0, y: 0, z: 0 }

  it('returns true at identical position', () => {
    expect(isWithinXpOrbPickupDistance(origin, origin)).toBe(true)
  })

  it('returns true just inside the pickup radius', () => {
    const orb = { x: XP_ORB_PICKUP_DISTANCE - 0.01, y: 0, z: 0 }
    expect(isWithinXpOrbPickupDistance(origin, orb)).toBe(true)
  })

  it('returns true exactly at the boundary', () => {
    const orb = { x: XP_ORB_PICKUP_DISTANCE, y: 0, z: 0 }
    expect(isWithinXpOrbPickupDistance(origin, orb)).toBe(true)
  })

  it('returns false just beyond the pickup radius', () => {
    const orb = { x: XP_ORB_PICKUP_DISTANCE + 0.01, y: 0, z: 0 }
    expect(isWithinXpOrbPickupDistance(origin, orb)).toBe(false)
  })

  it('accepts a custom pickupDistance override', () => {
    const orb = { x: 10, y: 0, z: 0 }
    expect(isWithinXpOrbPickupDistance(origin, orb, 10)).toBe(true)
    expect(isWithinXpOrbPickupDistance(origin, orb, 9)).toBe(false)
  })
})
