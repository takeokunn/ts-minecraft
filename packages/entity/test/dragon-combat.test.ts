import { describe, expect, it } from 'vitest'
import {
  dragonBreathAttackRange,
  dragonChargeAttackRange,
  dragonDamageMultiplier,
  shouldUseBreathAttack,
  computeDragonMeleeDamage,
} from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-combat'
import type { DragonPhase } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-phase'


// ─── dragonDamageMultiplier ───────────────────────────────────────────────────
describe('dragonDamageMultiplier', () => {
  it('returns 0.25 when perched (reduced melee)', () => {
    expect(dragonDamageMultiplier('Perched')).toBe(0.25)
  })

  it('returns 1 for all active-flight phases', () => {
    const activePhases: DragonPhase[] = ['Circling', 'Strafing', 'Landing', 'Takeoff', 'DeathSequence']
    for (const phase of activePhases) {
      expect(dragonDamageMultiplier(phase)).toBe(1)
    }
  })
})

// ─── shouldUseBreathAttack ────────────────────────────────────────────────────
describe('shouldUseBreathAttack', () => {
  it('returns false when not perched', () => {
    const nonPerchedPhases: DragonPhase[] = ['Circling', 'Strafing', 'Landing', 'Takeoff', 'DeathSequence']
    for (const phase of nonPerchedPhases) {
      expect(shouldUseBreathAttack(phase, 1, 0.1)).toBe(false)
    }
  })

  it('returns false when perched but player is out of breath range', () => {
    expect(shouldUseBreathAttack('Perched', dragonBreathAttackRange + 0.1, 0.1)).toBe(false)
  })

  it('returns false when perched and in range but random roll ≥ 0.35', () => {
    expect(shouldUseBreathAttack('Perched', 3, 0.35)).toBe(false)
    expect(shouldUseBreathAttack('Perched', 3, 0.99)).toBe(false)
  })

  it('returns true when perched, in range, and random roll < 0.35', () => {
    expect(shouldUseBreathAttack('Perched', dragonBreathAttackRange, 0.34)).toBe(true)
    expect(shouldUseBreathAttack('Perched', 1, 0)).toBe(true)
  })
})

// ─── computeDragonMeleeDamage ─────────────────────────────────────────────────
describe('computeDragonMeleeDamage', () => {
  it('applies 0.25 multiplier when perched', () => {
    // base 8, no crit, no armor → computeAttackDamage = 8 → * 0.25 = 2
    expect(computeDragonMeleeDamage(8, false, 0, 'Perched')).toBe(2)
  })

  it('applies full damage when circling', () => {
    // base 8, no crit, no armor → computeAttackDamage = 8 → * 1 = 8
    expect(computeDragonMeleeDamage(8, false, 0, 'Circling')).toBe(8)
  })

  it('stacks crit multiplier with phase multiplier', () => {
    // base 8, crit → 12, phase circling * 1 = 12
    expect(computeDragonMeleeDamage(8, true, 0, 'Circling')).toBe(12)
  })
})

// ─── range constants ──────────────────────────────────────────────────────────
describe('dragon range constants', () => {
  it('breath attack range exceeds charge attack range', () => {
    expect(dragonBreathAttackRange).toBeGreaterThan(dragonChargeAttackRange)
  })
})
