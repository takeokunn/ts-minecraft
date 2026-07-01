import { describe, expect, it } from 'vitest'
import {
  distanceSq,
  moveTowards,
} from '@ts-minecraft/entity/domain/village/village-position'

const pos = (x: number, y: number, z: number) => ({ x, y, z })

// ─── distanceSq ───────────────────────────────────────────────────────────────
describe('distanceSq', () => {
  it('returns 0 for identical positions', () => {
    expect(distanceSq(pos(1, 2, 3), pos(1, 2, 3))).toBe(0)
  })

  it('computes squared X distance', () => {
    expect(distanceSq(pos(0, 0, 0), pos(3, 0, 0))).toBe(9)
  })

  it('computes squared Y distance', () => {
    expect(distanceSq(pos(0, 0, 0), pos(0, 4, 0))).toBe(16)
  })

  it('computes squared Z distance', () => {
    expect(distanceSq(pos(0, 0, 0), pos(0, 0, 5))).toBe(25)
  })

  it('combines all three axes (3,4,0 → distance=5)', () => {
    expect(distanceSq(pos(0, 0, 0), pos(3, 4, 0))).toBe(25)
  })

  it('is symmetric', () => {
    const a = pos(1, 2, 3)
    const b = pos(4, 5, 6)
    expect(distanceSq(a, b)).toBe(distanceSq(b, a))
  })
})

// ─── moveTowards ─────────────────────────────────────────────────────────────
describe('moveTowards', () => {
  it('returns the target when from === to (distance 0)', () => {
    const p = pos(3, 3, 3)
    expect(moveTowards(p, p, 1)).toEqual(p)
  })

  it('returns the target when distance ≤ maxDelta (overshoot clamped)', () => {
    const from = pos(0, 0, 0)
    const to = pos(2, 0, 0)
    expect(moveTowards(from, to, 5)).toEqual(to)
  })

  it('advances exactly maxDelta along the X axis', () => {
    const from = pos(0, 0, 0)
    const to = pos(10, 0, 0)
    const result = moveTowards(from, to, 3)
    expect(result.x).toBeCloseTo(3)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
  })

  it('advances maxDelta along a diagonal (normalised direction)', () => {
    const from = pos(0, 0, 0)
    // Direction (1,1,0) normalised is (√2/2, √2/2, 0)
    const to = pos(10, 10, 0)
    const result = moveTowards(from, to, Math.sqrt(2))
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
  })

  it('preserves the exact target when already within one step', () => {
    const from = pos(0, 0, 0)
    const to = pos(0.5, 0, 0)
    expect(moveTowards(from, to, 2)).toEqual(to)
  })
})
