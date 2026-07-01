import { describe, expect, it } from 'vitest'
import {
  applyArmorReduction,
  computeAttackDamage,
  computeAttackCharge,
  computeChargedDamage,
  getWeaponBaseDamage,
  computeWeaponEnchantBonus,
  computeAttackKnockbackHorizontalMultiplier,
  computeKnockback,
} from '@ts-minecraft/entity/domain/combat-resolution'
import {
  ARMOR_REDUCTION_PER_POINT,
  CRITICAL_DAMAGE_MULTIPLIER,
  KNOCKBACK_HORIZONTAL_SPEED,
  KNOCKBACK_VERTICAL_SPEED,
  MAX_ARMOR_POINTS,
  PLAYER_ATTACK_DAMAGE,
  SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS,
} from '@ts-minecraft/entity/domain/combat.config'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'

// ─── applyArmorReduction ──────────────────────────────────────────────────────
describe('applyArmorReduction', () => {
  it('returns full damage when no armor is equipped (0 points)', () => {
    expect(applyArmorReduction(10, 0)).toBeCloseTo(10)
  })

  it('reduces damage by 4% per armor point', () => {
    // 5 armor points → 5 * 0.04 = 20% reduction → 10 * 0.8 = 8
    expect(applyArmorReduction(10, 5)).toBeCloseTo(8)
  })

  it('caps armor at MAX_ARMOR_POINTS (80% reduction at 20 points)', () => {
    const fullyArmored = applyArmorReduction(10, MAX_ARMOR_POINTS)
    expect(fullyArmored).toBeCloseTo(10 * (1 - MAX_ARMOR_POINTS * ARMOR_REDUCTION_PER_POINT))
  })

  it('clamps excess armor beyond MAX_ARMOR_POINTS', () => {
    const capped = applyArmorReduction(10, MAX_ARMOR_POINTS)
    const excess = applyArmorReduction(10, MAX_ARMOR_POINTS + 10)
    expect(excess).toBeCloseTo(capped)
  })

  it('returns 0 for non-positive raw damage', () => {
    expect(applyArmorReduction(0, 5)).toBe(0)
    expect(applyArmorReduction(-3, 5)).toBe(0)
  })

  it('ignores negative armor (treats as 0)', () => {
    expect(applyArmorReduction(10, -5)).toBeCloseTo(10)
  })
})

// ─── computeAttackDamage ──────────────────────────────────────────────────────
describe('computeAttackDamage', () => {
  it('returns base damage for a non-critical hit with no armor', () => {
    expect(computeAttackDamage(4, false)).toBeCloseTo(4)
  })

  it('multiplies by CRITICAL_DAMAGE_MULTIPLIER for a critical hit', () => {
    expect(computeAttackDamage(4, true)).toBeCloseTo(4 * CRITICAL_DAMAGE_MULTIPLIER)
  })

  it('applies armor reduction after the crit multiplier', () => {
    // base=10, crit=true → 15; 5 armor points → 15 * 0.8 = 12
    expect(computeAttackDamage(10, true, 5)).toBeCloseTo(15 * 0.8)
  })

  it('returns 0 for non-positive base damage', () => {
    expect(computeAttackDamage(0, true)).toBe(0)
    expect(computeAttackDamage(-1, false)).toBe(0)
  })
})

// ─── computeAttackCharge ──────────────────────────────────────────────────────
describe('computeAttackCharge', () => {
  it('returns 1 when cooldown is 0 (instant weapon)', () => {
    expect(computeAttackCharge(0, 0)).toBe(1)
  })

  it('returns 0 immediately after an attack (0 secs elapsed)', () => {
    expect(computeAttackCharge(0, 1.0)).toBe(0)
  })

  it('returns 1 at exactly the cooldown duration', () => {
    expect(computeAttackCharge(1.0, 1.0)).toBe(1)
  })

  it('clamps to 1 beyond the cooldown duration', () => {
    expect(computeAttackCharge(5.0, 1.0)).toBe(1)
  })

  it('returns 0.5 at half the cooldown duration', () => {
    expect(computeAttackCharge(0.5, 1.0)).toBeCloseTo(0.5)
  })
})

// ─── computeChargedDamage ─────────────────────────────────────────────────────
describe('computeChargedDamage', () => {
  it('deals 20% damage at charge=0 (instant re-attack)', () => {
    expect(computeChargedDamage(10, 0)).toBeCloseTo(10 * 0.2)
  })

  it('deals 100% damage at charge=1 (fully charged)', () => {
    expect(computeChargedDamage(10, 1)).toBeCloseTo(10)
  })

  it('clamps negative charge to 0', () => {
    expect(computeChargedDamage(10, -1)).toBeCloseTo(2)
  })

  it('clamps charge above 1 to 1', () => {
    expect(computeChargedDamage(10, 2)).toBeCloseTo(10)
  })

  it('scales quadratically: half charge deals 60% (0.2 + 0.8 * 0.25)', () => {
    // charge=0.5 → 0.2 + 0.8 * 0.25 = 0.4 → 10 * 0.4 = 4
    expect(computeChargedDamage(10, 0.5)).toBeCloseTo(4)
  })
})

// ─── getWeaponBaseDamage ──────────────────────────────────────────────────────
describe('getWeaponBaseDamage', () => {
  it('returns the configured damage for IRON_SWORD', () => {
    const damage = getWeaponBaseDamage('IRON_SWORD')
    expect(damage).toBeGreaterThan(PLAYER_ATTACK_DAMAGE)
  })

  it('returns PLAYER_ATTACK_DAMAGE for an unknown/bare-hand item', () => {
    expect(getWeaponBaseDamage(undefined)).toBe(PLAYER_ATTACK_DAMAGE)
    expect(getWeaponBaseDamage('DIRT')).toBe(PLAYER_ATTACK_DAMAGE)
  })

  it('returns increasing damage: WOODEN < STONE < IRON < DIAMOND sword', () => {
    const wood = getWeaponBaseDamage('WOODEN_SWORD')
    const stone = getWeaponBaseDamage('STONE_SWORD')
    const iron = getWeaponBaseDamage('IRON_SWORD')
    const diamond = getWeaponBaseDamage('DIAMOND_SWORD')
    expect(wood).toBeLessThan(stone)
    expect(stone).toBeLessThan(iron)
    expect(iron).toBeLessThan(diamond)
  })
})

// ─── computeWeaponEnchantBonus ────────────────────────────────────────────────
describe('computeWeaponEnchantBonus', () => {
  const enchant = (type: Enchantment['type'], level: Enchantment['level'] = 1): Enchantment =>
    ({ type, level })

  it('returns 0 with no enchantments', () => {
    expect(computeWeaponEnchantBonus([], 'Zombie')).toBe(0)
  })

  it('SHARPNESS applies to any mob type', () => {
    const bonus = computeWeaponEnchantBonus([enchant('SHARPNESS')], 'Zombie')
    expect(bonus).toBeGreaterThan(0)
  })

  it('SMITE applies only to undead mobs', () => {
    expect(computeWeaponEnchantBonus([enchant('SMITE')], 'Zombie')).toBeGreaterThan(0)
    expect(computeWeaponEnchantBonus([enchant('SMITE')], 'Cow')).toBe(0)
  })

  it('BANE_OF_ARTHROPODS applies only to arthropod mobs', () => {
    expect(computeWeaponEnchantBonus([enchant('BANE_OF_ARTHROPODS')], 'Spider')).toBeGreaterThan(0)
    expect(computeWeaponEnchantBonus([enchant('BANE_OF_ARTHROPODS')], 'Zombie')).toBe(0)
  })

  it('SHARPNESS takes priority over SMITE when both are present', () => {
    const bonusSharpness = computeWeaponEnchantBonus([enchant('SHARPNESS')], 'Zombie')
    const bothPresent = computeWeaponEnchantBonus([enchant('SHARPNESS'), enchant('SMITE')], 'Zombie')
    expect(bothPresent).toBe(bonusSharpness)
  })
})

// ─── computeAttackKnockbackHorizontalMultiplier ───────────────────────────────
describe('computeAttackKnockbackHorizontalMultiplier', () => {
  it('returns the base multiplier for a non-sprint attack', () => {
    expect(computeAttackKnockbackHorizontalMultiplier(1.0, false)).toBe(1.0)
  })

  it('adds SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS for a sprint attack', () => {
    const expected = 1.0 + SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS
    expect(computeAttackKnockbackHorizontalMultiplier(1.0, true)).toBeCloseTo(expected)
  })
})

// ─── computeKnockback ─────────────────────────────────────────────────────────
describe('computeKnockback', () => {
  it('produces a straight-up impulse for a zero-length direction (point-blank)', () => {
    const result = computeKnockback(0, 0)
    expect(result.x).toBe(0)
    expect(result.z).toBe(0)
    expect(result.y).toBe(KNOCKBACK_VERTICAL_SPEED)
  })

  it('normalizes horizontal direction and applies KNOCKBACK_HORIZONTAL_SPEED', () => {
    // Pure east: dirX=1, dirZ=0 → normalized=(1,0) → x=5, z=0
    const result = computeKnockback(1, 0)
    expect(result.x).toBeCloseTo(KNOCKBACK_HORIZONTAL_SPEED)
    expect(result.z).toBeCloseTo(0)
  })

  it('always produces KNOCKBACK_VERTICAL_SPEED on the y axis', () => {
    expect(computeKnockback(3, 4).y).toBe(KNOCKBACK_VERTICAL_SPEED)
    expect(computeKnockback(-1, 0).y).toBe(KNOCKBACK_VERTICAL_SPEED)
  })

  it('produces a unit-length horizontal vector for any non-zero direction', () => {
    const result = computeKnockback(3, 4)
    const magnitude = Math.hypot(result.x, result.z)
    expect(magnitude).toBeCloseTo(KNOCKBACK_HORIZONTAL_SPEED)
  })
})
