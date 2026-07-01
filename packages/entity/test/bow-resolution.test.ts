import { describe, expect, it } from 'vitest'
import {
  computeBowCharge,
  computeBowDamage,
  canFireBow,
} from '@ts-minecraft/entity/domain/bow-resolution'
import {
  BOW_MIN_CHARGE_SECS,
  BOW_FULL_CHARGE_SECS,
  BOW_MIN_DAMAGE,
  BOW_MAX_DAMAGE,
} from '@ts-minecraft/entity/domain/bow.config'

// ─── computeBowCharge ─────────────────────────────────────────────────────────
describe('computeBowCharge', () => {
  it('returns 0 for zero time held', () => {
    expect(computeBowCharge(0)).toBe(0)
  })

  it('returns 1.0 exactly at full charge duration', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS)).toBe(1.0)
  })

  it('clamps to 1.0 when held beyond full charge duration', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS * 5)).toBe(1.0)
  })

  it('returns 0.5 at half the full charge duration', () => {
    expect(computeBowCharge(BOW_FULL_CHARGE_SECS / 2)).toBeCloseTo(0.5)
  })

  it('returns a value in (0, 1) for a partial hold', () => {
    const charge = computeBowCharge(BOW_MIN_CHARGE_SECS)
    expect(charge).toBeGreaterThan(0)
    expect(charge).toBeLessThanOrEqual(1)
  })
})

// ─── computeBowDamage ─────────────────────────────────────────────────────────
describe('computeBowDamage', () => {
  it('returns BOW_MIN_DAMAGE at charge = 0', () => {
    expect(computeBowDamage(0)).toBe(BOW_MIN_DAMAGE)
  })

  it('returns BOW_MAX_DAMAGE at charge = 1', () => {
    expect(computeBowDamage(1)).toBe(BOW_MAX_DAMAGE)
  })

  it('clamps negative charge to BOW_MIN_DAMAGE', () => {
    expect(computeBowDamage(-1)).toBe(BOW_MIN_DAMAGE)
  })

  it('clamps charge > 1 to BOW_MAX_DAMAGE', () => {
    expect(computeBowDamage(2)).toBe(BOW_MAX_DAMAGE)
  })

  it('uses quadratic scaling: half charge yields well below half max damage', () => {
    // c=0.5 → c²=0.25 → damage = min + 0.25*(max-min) = 1 + 0.25*8 = 3
    const halfChargeDamage = computeBowDamage(0.5)
    const halfMaxDamage = (BOW_MIN_DAMAGE + BOW_MAX_DAMAGE) / 2
    expect(halfChargeDamage).toBeLessThan(halfMaxDamage)
  })

  it('returns an integer (Math.round is applied)', () => {
    expect(Number.isInteger(computeBowDamage(0.33))).toBe(true)
    expect(Number.isInteger(computeBowDamage(0.77))).toBe(true)
  })

  it('damage is non-decreasing as charge increases', () => {
    const charges = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
    const damages = charges.map(computeBowDamage)
    for (let i = 1; i < damages.length; i++) {
      expect(damages[i]).toBeGreaterThanOrEqual(damages[i - 1]!)
    }
  })
})

// ─── canFireBow ───────────────────────────────────────────────────────────────
describe('canFireBow', () => {
  it('returns false for zero hold time', () => {
    expect(canFireBow(0)).toBe(false)
  })

  it('returns false just below the minimum charge time', () => {
    expect(canFireBow(BOW_MIN_CHARGE_SECS - 0.01)).toBe(false)
  })

  it('returns true exactly at the minimum charge time', () => {
    expect(canFireBow(BOW_MIN_CHARGE_SECS)).toBe(true)
  })

  it('returns true for a fully charged bow', () => {
    expect(canFireBow(BOW_FULL_CHARGE_SECS)).toBe(true)
  })

  it('returns true when held longer than full charge', () => {
    expect(canFireBow(BOW_FULL_CHARGE_SECS * 2)).toBe(true)
  })
})
