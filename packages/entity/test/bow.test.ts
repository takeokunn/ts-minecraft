import { describe, it, expect } from 'vitest'
import {
  computeBowCharge,
  computeBowDamage,
  canFireBow,
} from '../domain/bow-resolution'
import {
  BOW_MAX_DAMAGE,
  BOW_MIN_DAMAGE,
  BOW_MIN_CHARGE_SECS,
  BOW_FULL_CHARGE_SECS,
} from '../domain/bow.config'

describe('computeBowCharge', () => {
  it('returns 0 at 0 seconds held', () => {
    expect(computeBowCharge(0)).toBe(0)
  })

  it('returns 1 at full charge time', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS)).toBe(1)
  })

  it('clamps to 1 beyond full charge time', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS * 2)).toBe(1)
  })

  it('returns 0.5 at half charge time', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS / 2)).toBeCloseTo(0.5)
  })
})

describe('computeBowDamage', () => {
  it('returns BOW_MIN_DAMAGE at charge 0', () => {
    expect(computeBowDamage(0)).toBe(BOW_MIN_DAMAGE)
  })

  it('returns BOW_MAX_DAMAGE at charge 1', () => {
    expect(computeBowDamage(1)).toBe(BOW_MAX_DAMAGE)
  })

  it('is less than max damage at partial charge', () => {
    expect(computeBowDamage(0.5)).toBeLessThan(BOW_MAX_DAMAGE)
  })

  it('clamps charge below 0 to BOW_MIN_DAMAGE', () => {
    expect(computeBowDamage(-1)).toBe(BOW_MIN_DAMAGE)
  })

  it('clamps charge above 1 to BOW_MAX_DAMAGE', () => {
    expect(computeBowDamage(2)).toBe(BOW_MAX_DAMAGE)
  })

  it('scales quadratically (partial charge much weaker than full)', () => {
    // At 50% charge, damage = min + 0.25 * (max - min); much less than half of max
    const half = computeBowDamage(0.5)
    expect(half).toBeLessThan((BOW_MAX_DAMAGE + BOW_MIN_DAMAGE) / 2)
  })
})

describe('canFireBow', () => {
  it('returns false below minimum charge time', () => {
    expect(canFireBow(0)).toBe(false)
    expect(canFireBow(BOW_MIN_CHARGE_SECS - 0.01)).toBe(false)
  })

  it('returns true at or above minimum charge time', () => {
    expect(canFireBow(BOW_MIN_CHARGE_SECS)).toBe(true)
    expect(canFireBow(BOW_FULL_CHARGE_SECS)).toBe(true)
    expect(canFireBow(BOW_FULL_CHARGE_SECS * 2)).toBe(true)
  })
})
