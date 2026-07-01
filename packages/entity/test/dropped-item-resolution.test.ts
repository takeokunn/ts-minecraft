import { describe, expect, it } from 'vitest'
import {
  squaredDroppedItemDistance,
  isWithinItemPickupDistance,
} from '@ts-minecraft/entity/domain/dropped-item-resolution'
import { ITEM_PICKUP_DISTANCE } from '@ts-minecraft/entity/domain/dropped-item'

// ─── squaredDroppedItemDistance ───────────────────────────────────────────────
describe('squaredDroppedItemDistance', () => {
  it('returns 0 for identical positions', () => {
    expect(squaredDroppedItemDistance({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0)
  })

  it('computes squared distance along the X axis', () => {
    expect(squaredDroppedItemDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })).toBe(9)
  })

  it('computes squared distance along the Y axis', () => {
    expect(squaredDroppedItemDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 })).toBe(16)
  })

  it('computes squared distance along the Z axis', () => {
    expect(squaredDroppedItemDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 })).toBe(25)
  })

  it('combines all three axes (Pythagorean theorem)', () => {
    // distance = sqrt(1+4+4) = 3 → squared = 9
    expect(squaredDroppedItemDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(9)
  })

  it('is symmetric (order of arguments does not matter)', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { x: 4, y: 5, z: 6 }
    expect(squaredDroppedItemDistance(a, b)).toBe(squaredDroppedItemDistance(b, a))
  })
})

// ─── isWithinItemPickupDistance ───────────────────────────────────────────────
describe('isWithinItemPickupDistance', () => {
  const origin = { x: 0, y: 0, z: 0 }

  it('returns true when item is at the exact same position', () => {
    expect(isWithinItemPickupDistance(origin, origin)).toBe(true)
  })

  it('returns true when item is just inside the pickup radius', () => {
    // place item just below pickup distance along X
    const item = { x: ITEM_PICKUP_DISTANCE - 0.01, y: 0, z: 0 }
    expect(isWithinItemPickupDistance(origin, item)).toBe(true)
  })

  it('returns true at exactly the pickup boundary (≤ check)', () => {
    const item = { x: ITEM_PICKUP_DISTANCE, y: 0, z: 0 }
    expect(isWithinItemPickupDistance(origin, item)).toBe(true)
  })

  it('returns false when item is just beyond the pickup radius', () => {
    const item = { x: ITEM_PICKUP_DISTANCE + 0.01, y: 0, z: 0 }
    expect(isWithinItemPickupDistance(origin, item)).toBe(false)
  })

  it('respects a custom pickupDistance override', () => {
    const item = { x: 5, y: 0, z: 0 }
    expect(isWithinItemPickupDistance(origin, item, 5)).toBe(true)
    expect(isWithinItemPickupDistance(origin, item, 4)).toBe(false)
  })
})
