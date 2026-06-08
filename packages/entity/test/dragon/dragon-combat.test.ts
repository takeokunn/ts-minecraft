import { describe, expect, it } from 'vitest'
import { DragonPhase } from '../../domain/mob/ender-dragon/dragon-phase'
import {
  computeDragonMeleeDamage,
  dragonBreathAttackRange,
  dragonChargeAttackRange,
  dragonDamageMultiplier,
  shouldUseBreathAttack,
} from '../../domain/mob/ender-dragon/dragon-combat'

describe('dragon combat rules', () => {
  it('uses reduced incoming damage while perched', () => {
    expect(dragonDamageMultiplier(DragonPhase.Perched)).toBe(0.25)
    expect(dragonDamageMultiplier(DragonPhase.Circling)).toBe(1)
  })

  it('uses vanilla combat formulas before applying the phase multiplier', () => {
    expect(computeDragonMeleeDamage(10, true, 5, DragonPhase.Perched)).toBeCloseTo(3)
    expect(computeDragonMeleeDamage(10, false, 0, DragonPhase.Strafing)).toBeCloseTo(10)
  })

  it('defines dragon attack ranges', () => {
    expect(dragonBreathAttackRange).toBe(6)
    expect(dragonChargeAttackRange).toBe(4)
  })

  it('uses breath only while perched, in range, and below the random threshold', () => {
    expect(shouldUseBreathAttack(DragonPhase.Perched, 6, 0.2)).toBe(true)
    expect(shouldUseBreathAttack(DragonPhase.Perched, 7, 0.2)).toBe(false)
    expect(shouldUseBreathAttack(DragonPhase.Perched, 6, 0.9)).toBe(false)
    expect(shouldUseBreathAttack(DragonPhase.Circling, 4, 0.2)).toBe(false)
  })
})
