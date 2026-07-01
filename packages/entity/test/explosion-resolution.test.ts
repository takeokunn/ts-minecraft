import { describe, expect, it } from 'vitest'
import {
  explosionRadius,
  computeExplosionDamage,
  computeExplosionDamageAt,
} from '@ts-minecraft/entity/domain/explosion-resolution'
import type { Position } from '@ts-minecraft/core'

// ─── helpers ─────────────────────────────────────────────────────────────────

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })
const origin = pos(0, 0, 0)

// ─── explosionRadius ──────────────────────────────────────────────────────────
describe('explosionRadius', () => {
  it('returns power * 2', () => {
    expect(explosionRadius(4)).toBe(8)
  })

  it('returns 0 for power = 0', () => {
    expect(explosionRadius(0)).toBe(0)
  })

  it('scales linearly with power', () => {
    expect(explosionRadius(1)).toBe(2)
    expect(explosionRadius(2)).toBe(4)
    expect(explosionRadius(3)).toBe(6)
  })
})

// ─── computeExplosionDamage ───────────────────────────────────────────────────
describe('computeExplosionDamage', () => {
  it('returns non-zero damage at the blast center (distance = 0)', () => {
    const damage = computeExplosionDamage(4, 0, 1)
    expect(damage).toBeGreaterThan(0)
  })

  it('returns 0 beyond the blast radius', () => {
    // blast radius = 4*2 = 8; distance 9 is beyond
    expect(computeExplosionDamage(4, 9, 1)).toBe(0)
  })

  it('returns 0 strictly beyond the blast radius', () => {
    const power = 4
    const radius = explosionRadius(power)
    // normalized > 1 → early return 0 (no +1 applied)
    expect(computeExplosionDamage(power, radius + 0.01, 1)).toBe(0)
  })

  it('returns at least 1 at exactly the blast radius boundary (formula +1 floor)', () => {
    // normalized = 1 → impact = 0 → Math.floor(0 + 1) = 1
    const power = 4
    const radius = explosionRadius(power)
    expect(computeExplosionDamage(power, radius, 1)).toBe(1)
  })

  it('full exposure (1.0) deals more damage than partial exposure (0.5) at same distance', () => {
    const full = computeExplosionDamage(4, 2, 1.0)
    const half = computeExplosionDamage(4, 2, 0.5)
    expect(full).toBeGreaterThan(half)
  })

  it('zero exposure yields minimum damage (1) within the blast radius', () => {
    // impact = 0 but the formula always adds +1 for entities within the radius
    expect(computeExplosionDamage(4, 2, 0)).toBe(1)
  })

  it('damage decreases as distance increases (for full exposure)', () => {
    const d0 = computeExplosionDamage(4, 0, 1)
    const d2 = computeExplosionDamage(4, 2, 1)
    const d4 = computeExplosionDamage(4, 4, 1)
    expect(d0).toBeGreaterThan(d2)
    expect(d2).toBeGreaterThan(d4)
  })

  it('always returns an integer (Math.floor is applied)', () => {
    for (const d of [0, 1, 2, 3, 4, 7]) {
      expect(Number.isInteger(computeExplosionDamage(4, d, 0.7))).toBe(true)
    }
  })

  it('minimum damage at center with full exposure is at least 1', () => {
    // Formula guarantees +1 at the end
    expect(computeExplosionDamage(1, 0, 1)).toBeGreaterThanOrEqual(1)
  })
})

// ─── computeExplosionDamageAt ─────────────────────────────────────────────────
describe('computeExplosionDamageAt', () => {
  it('returns non-zero damage for a target at the blast center', () => {
    const damage = computeExplosionDamageAt(origin, 4, origin)
    expect(damage).toBeGreaterThan(0)
  })

  it('returns 0 for a target beyond blast radius', () => {
    const farTarget = pos(100, 0, 0)
    expect(computeExplosionDamageAt(origin, 4, farTarget)).toBe(0)
  })

  it('agrees with computeExplosionDamage for the same inputs', () => {
    const target = pos(3, 0, 0)
    const directDamage = computeExplosionDamage(4, 3, 1)
    const positionalDamage = computeExplosionDamageAt(origin, 4, target, 1)
    expect(positionalDamage).toBe(directDamage)
  })

  it('defaults to full exposure (1.0) when no exposure argument is passed', () => {
    const target = pos(2, 0, 0)
    const defaultExposure = computeExplosionDamageAt(origin, 4, target)
    const fullExposure = computeExplosionDamageAt(origin, 4, target, 1.0)
    expect(defaultExposure).toBe(fullExposure)
  })

  it('uses 3D distance (diagonal counts the same as the straight-line distance)', () => {
    // (3, 4, 0) → distance = 5
    const diagonal = computeExplosionDamageAt(origin, 4, pos(3, 4, 0), 1)
    const straight = computeExplosionDamage(4, 5, 1)
    expect(diagonal).toBe(straight)
  })
})
