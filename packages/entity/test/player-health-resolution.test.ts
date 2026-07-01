import { describe, expect, it } from 'vitest'
import {
  applyDamageToHealth,
  healHealth,
  tickInvincibility,
  computeFallDamage,
} from '@ts-minecraft/entity/domain/player-health-resolution'
import { PlayerHealth } from '@ts-minecraft/entity/domain/player-health'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeHealth = (current: number, max = 20, invincibilityTicks = 0): PlayerHealth =>
  new PlayerHealth({ current, max, invincibilityTicks })

// ─── applyDamageToHealth ──────────────────────────────────────────────────────
describe('applyDamageToHealth', () => {
  it('reduces current health by the damage amount', () => {
    const result = applyDamageToHealth(makeHealth(20), 4)
    expect(result.current).toBe(16)
  })

  it('clamps health to 0 (cannot go negative)', () => {
    const result = applyDamageToHealth(makeHealth(2), 10)
    expect(result.current).toBe(0)
  })

  it('is a no-op for zero damage', () => {
    const h = makeHealth(20)
    expect(applyDamageToHealth(h, 0)).toBe(h)
  })

  it('is a no-op for negative damage', () => {
    const h = makeHealth(20)
    expect(applyDamageToHealth(h, -5)).toBe(h)
  })

  it('is a no-op when the player is already dead (current = 0)', () => {
    const dead = makeHealth(0)
    expect(applyDamageToHealth(dead, 5)).toBe(dead)
  })

  it('is a no-op while invincibility is active', () => {
    const invincible = makeHealth(20, 20, 5)
    expect(applyDamageToHealth(invincible, 4)).toBe(invincible)
  })

  it('sets invincibilityTicks = 10 after a successful hit', () => {
    const result = applyDamageToHealth(makeHealth(20), 4)
    expect(result.invincibilityTicks).toBe(10)
  })
})

// ─── healHealth ───────────────────────────────────────────────────────────────
describe('healHealth', () => {
  it('increases current health by the heal amount', () => {
    const result = healHealth(makeHealth(10), 4)
    expect(result.current).toBe(14)
  })

  it('clamps healing to max health', () => {
    const result = healHealth(makeHealth(18), 5)
    expect(result.current).toBe(20)
  })

  it('is a no-op for zero heal amount', () => {
    const h = makeHealth(10)
    expect(healHealth(h, 0)).toBe(h)
  })

  it('is a no-op for negative heal amount', () => {
    const h = makeHealth(10)
    expect(healHealth(h, -3)).toBe(h)
  })

  it('preserves invincibilityTicks (heal does not reset immunity)', () => {
    const h = makeHealth(10, 20, 5)
    const result = healHealth(h, 4)
    expect(result.invincibilityTicks).toBe(5)
  })
})

// ─── tickInvincibility ────────────────────────────────────────────────────────
describe('tickInvincibility', () => {
  it('decrements invincibilityTicks by 1', () => {
    const result = tickInvincibility(makeHealth(20, 20, 5))
    expect(result.invincibilityTicks).toBe(4)
  })

  it('returns the same instance when ticks are already 0', () => {
    const h = makeHealth(20, 20, 0)
    expect(tickInvincibility(h)).toBe(h)
  })

  it('decrements from 1 to 0 correctly', () => {
    const result = tickInvincibility(makeHealth(20, 20, 1))
    expect(result.invincibilityTicks).toBe(0)
  })

  it('preserves current and max health', () => {
    const result = tickInvincibility(makeHealth(15, 20, 3))
    expect(result.current).toBe(15)
    expect(result.max).toBe(20)
  })
})

// ─── computeFallDamage ────────────────────────────────────────────────────────
describe('computeFallDamage', () => {
  it('returns 0 when not grounded', () => {
    expect(computeFallDamage(70, 66, true, false)).toBe(0)
  })

  it('returns 0 when not previously falling', () => {
    expect(computeFallDamage(70, 66, false, true)).toBe(0)
  })

  it('returns 0 for a fall of exactly 3 blocks (free distance)', () => {
    // fallDistance = 3, ceil(3 - 3) = 0
    expect(computeFallDamage(70, 67, true, true)).toBe(0)
  })

  it('returns 1 for a fall of exactly 4 blocks', () => {
    // fallDistance = 4, ceil(4 - 3) = 1
    expect(computeFallDamage(70, 66, true, true)).toBe(1)
  })

  it('uses Math.ceil for fractional falls (4.5 blocks → 2 damage)', () => {
    // fallDistance = 4.5, ceil(4.5 - 3) = ceil(1.5) = 2
    expect(computeFallDamage(70, 65.5, true, true)).toBe(2)
  })

  it('scales damage linearly with fall height beyond the free distance', () => {
    // fallDistance = 10, ceil(10 - 3) = 7
    expect(computeFallDamage(70, 60, true, true)).toBe(7)
  })

  it('returns 0 when prevY <= currentY (rising or flat)', () => {
    expect(computeFallDamage(60, 60, true, true)).toBe(0)
    expect(computeFallDamage(60, 61, true, true)).toBe(0)
  })
})
