import { describe, it } from '@effect/vitest'
import { ARTHROPOD_MOB_TYPES, CRITICAL_DAMAGE_MULTIPLIER, KNOCKBACK_HORIZONTAL_SPEED, KNOCKBACK_VERTICAL_SPEED, PLAYER_ATTACK_DAMAGE, SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS, UNDEAD_MOB_TYPES } from '@ts-minecraft/entity/domain/combat.config'
import { applyArmorReduction, computeAttackCharge, computeAttackDamage, computeAttackKnockbackHorizontalMultiplier, computeChargedDamage, computeKnockback, computeWeaponEnchantBonus, getWeaponBaseDamage } from '@ts-minecraft/entity/domain/combat-resolution'
import {
  getBaneOfArthropodsDamageBonus,
  getSharpnessDamageBonus,
  getSmiteDamageBonus,
} from '@ts-minecraft/inventory/domain/enchantment'
import { Array as Arr } from 'effect'
import { expect } from 'vitest'

describe('computeAttackDamage', () => {
  it('returns the base damage with no crit and no armor', () => {
    expect(computeAttackDamage(6, false, 0)).toBe(6)
  })

  it('applies the 1.5× critical multiplier', () => {
    expect(computeAttackDamage(6, true, 0)).toBe(9)
    expect(computeAttackDamage(4, true)).toBe(4 * CRITICAL_DAMAGE_MULTIPLIER)
  })

  it('reduces damage by 4% per armor point', () => {
    // 10 base, 5 armor → 20% reduction → 8
    expect(computeAttackDamage(10, false, 5)).toBeCloseTo(8)
  })

  it('combines crit and armor reduction', () => {
    // 10 × 1.5 × (1 − 0.2) = 12
    expect(computeAttackDamage(10, true, 5)).toBeCloseTo(12)
  })

  it('caps armor reduction at 80% (20 points)', () => {
    // 30 armor points clamps to 20 → 80% reduction → 10 × 0.2 = 2
    expect(computeAttackDamage(10, false, 30)).toBeCloseTo(2)
  })

  it('treats negative armor as zero', () => {
    expect(computeAttackDamage(6, false, -5)).toBe(6)
  })

  const nonPositive: ReadonlyArray<number> = [0, -3]
  Arr.forEach(nonPositive, (base) => {
    it(`returns 0 for non-positive base damage (${base})`, () => {
      expect(computeAttackDamage(base, true, 0)).toBe(0)
    })
  })
})

describe('applyArmorReduction', () => {
  it('returns the raw damage when armor is zero', () => {
    expect(applyArmorReduction(10, 0)).toBe(10)
    expect(applyArmorReduction(10)).toBe(10)
  })

  it('reduces damage by 4% per armor point', () => {
    // 10 raw, 5 armor → 20% reduction → 8
    expect(applyArmorReduction(10, 5)).toBeCloseTo(8)
  })

  it('caps reduction at 80% (20 points)', () => {
    // 30 armor clamps to 20 → 80% reduction → 10 × 0.2 = 2
    expect(applyArmorReduction(10, 30)).toBeCloseTo(2)
  })

  it('treats negative armor as zero', () => {
    expect(applyArmorReduction(6, -5)).toBe(6)
  })

  it('returns 0 for non-positive raw damage', () => {
    expect(applyArmorReduction(0, 5)).toBe(0)
    expect(applyArmorReduction(-3, 5)).toBe(0)
  })

  it('is the mitigation backing computeAttackDamage (no crit)', () => {
    // computeAttackDamage(base, false, armor) === applyArmorReduction(base, armor)
    expect(computeAttackDamage(10, false, 7)).toBeCloseTo(applyArmorReduction(10, 7))
  })
})

describe('computeKnockback', () => {
  it('points horizontally away along the attacker→target direction', () => {
    // direction +x → impulse normalized to horizontal speed on x, none on z
    const k = computeKnockback(5, 0)
    expect(k.x).toBeCloseTo(KNOCKBACK_HORIZONTAL_SPEED)
    expect(k.z).toBeCloseTo(0)
    expect(k.y).toBeCloseTo(KNOCKBACK_VERTICAL_SPEED)
  })

  it('normalizes diagonal directions to a constant horizontal magnitude', () => {
    const k = computeKnockback(3, 4) // magnitude 5
    expect(Math.hypot(k.x, k.z)).toBeCloseTo(KNOCKBACK_HORIZONTAL_SPEED)
  })

  it('pops straight up for a zero-length (point-blank) direction', () => {
    const k = computeKnockback(0, 0)
    expect(k.x).toBe(0)
    expect(k.z).toBe(0)
    expect(k.y).toBe(KNOCKBACK_VERTICAL_SPEED)
  })

  it('always adds the same upward pop regardless of horizontal direction', () => {
    expect(computeKnockback(-2, 7).y).toBeCloseTo(KNOCKBACK_VERTICAL_SPEED)
  })
})

describe('computeAttackKnockbackHorizontalMultiplier', () => {
  it('leaves normal attacks at the enchantment multiplier', () => {
    expect(computeAttackKnockbackHorizontalMultiplier(1, false)).toBe(1)
    expect(computeAttackKnockbackHorizontalMultiplier(1.5, false)).toBe(1.5)
  })

  it('adds one sprint-hit bonus level to horizontal knockback', () => {
    expect(computeAttackKnockbackHorizontalMultiplier(1, true))
      .toBe(1 + SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS)
    expect(computeAttackKnockbackHorizontalMultiplier(1.5, true))
      .toBe(1.5 + SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS)
  })
})

describe('computeAttackCharge', () => {
  it('is 0 immediately after an attack', () => {
    expect(computeAttackCharge(0, 0.625)).toBe(0)
  })

  it('reaches full charge at the cooldown duration', () => {
    expect(computeAttackCharge(0.625, 0.625)).toBe(1)
  })

  it('is partial mid-recharge', () => {
    expect(computeAttackCharge(0.3125, 0.625)).toBeCloseTo(0.5)
  })

  it('clamps above 1 once past the cooldown', () => {
    expect(computeAttackCharge(10, 0.625)).toBe(1)
  })

  it('treats a non-positive cooldown as always fully charged', () => {
    expect(computeAttackCharge(0, 0)).toBe(1)
  })
})

describe('computeChargedDamage', () => {
  it('deals full damage at full charge', () => {
    expect(computeChargedDamage(10, 1)).toBeCloseTo(10)
  })

  it('deals 20% damage at zero charge (instant re-hit)', () => {
    expect(computeChargedDamage(10, 0)).toBeCloseTo(2)
  })

  it('scales quadratically at half charge: 0.2 + 0.8×0.25 = 0.4', () => {
    expect(computeChargedDamage(10, 0.5)).toBeCloseTo(4)
  })

  it('clamps charge outside [0,1]', () => {
    expect(computeChargedDamage(10, 5)).toBeCloseTo(10)
    expect(computeChargedDamage(10, -1)).toBeCloseTo(2)
  })
})

describe('getWeaponBaseDamage', () => {
  it('returns PLAYER_ATTACK_DAMAGE for undefined (bare hand)', () => {
    expect(getWeaponBaseDamage(undefined)).toBe(PLAYER_ATTACK_DAMAGE)
  })

  it('returns PLAYER_ATTACK_DAMAGE for an unknown item type', () => {
    expect(getWeaponBaseDamage('PLANKS')).toBe(PLAYER_ATTACK_DAMAGE)
  })

  it('returns the correct damage for each sword tier', () => {
    expect(getWeaponBaseDamage('WOODEN_SWORD')).toBe(8)
    expect(getWeaponBaseDamage('STONE_SWORD')).toBe(9)
    expect(getWeaponBaseDamage('IRON_SWORD')).toBe(12)
    expect(getWeaponBaseDamage('DIAMOND_SWORD')).toBe(16)
  })

  it('returns the correct damage for each axe tier', () => {
    expect(getWeaponBaseDamage('WOODEN_AXE')).toBe(9)
    expect(getWeaponBaseDamage('STONE_AXE')).toBe(10)
    expect(getWeaponBaseDamage('IRON_AXE')).toBe(11)
    expect(getWeaponBaseDamage('DIAMOND_AXE')).toBe(13)
  })
})

describe('computeWeaponEnchantBonus', () => {
  it('returns 0 with no enchantments', () => {
    expect(computeWeaponEnchantBonus([], 'Zombie')).toBe(0)
  })

  it('applies SHARPNESS bonus regardless of mob type', () => {
    const enchants = [{ type: 'SHARPNESS' as const, level: 3 as const }]
    expect(computeWeaponEnchantBonus(enchants, 'Zombie')).toBeCloseTo(getSharpnessDamageBonus(3))
    expect(computeWeaponEnchantBonus(enchants, 'Spider')).toBeCloseTo(getSharpnessDamageBonus(3))
    expect(computeWeaponEnchantBonus(enchants, 'Creeper')).toBeCloseTo(getSharpnessDamageBonus(3))
  })

  it('applies SMITE only against UNDEAD_MOB_TYPES', () => {
    const enchants = [{ type: 'SMITE' as const, level: 2 as const }]
    expect(UNDEAD_MOB_TYPES.has('Drowned')).toBe(true)
    expect(UNDEAD_MOB_TYPES.has('ZombieVillager')).toBe(true)
    for (const undead of UNDEAD_MOB_TYPES) {
      expect(computeWeaponEnchantBonus(enchants, undead)).toBeCloseTo(getSmiteDamageBonus(2))
    }
    expect(computeWeaponEnchantBonus(enchants, 'Spider')).toBe(0)
    expect(computeWeaponEnchantBonus(enchants, 'Creeper')).toBe(0)
  })

  it('applies BANE_OF_ARTHROPODS only against ARTHROPOD_MOB_TYPES', () => {
    const enchants = [{ type: 'BANE_OF_ARTHROPODS' as const, level: 4 as const }]
    for (const arthropod of ARTHROPOD_MOB_TYPES) {
      expect(computeWeaponEnchantBonus(enchants, arthropod)).toBeCloseTo(getBaneOfArthropodsDamageBonus(4))
    }
    expect(computeWeaponEnchantBonus(enchants, 'Zombie')).toBe(0)
  })

  it('SHARPNESS takes priority over SMITE when both present', () => {
    const enchants = [
      { type: 'SHARPNESS' as const, level: 1 as const },
      { type: 'SMITE' as const, level: 5 as const },
    ]
    expect(computeWeaponEnchantBonus(enchants, 'Zombie')).toBeCloseTo(getSharpnessDamageBonus(1))
  })
})
