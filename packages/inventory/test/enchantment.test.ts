import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import {
  getSharpnessDamageBonus,
  getSmiteDamageBonus,
  getProtectionDamageReduction,
  getUnbreakingSkipChance,
  getFortuneDropMultiplier,
  rollFortuneExtraDrops,
  getPowerDamageMultiplier,
  getKnockbackHorizontalMultiplier,
  getPunchKnockbackBonus,
  getFeatherFallingReduction,
  getFireProtectionReduction,
  getRespirationBonusSecs,
  getLureWaitReductionSecs,
  getLuckTreasureChance,
  canEnchantItem,
  getMaxEnchantmentLevel,
  getBaneOfArthropodsDamageBonus,
  selectEnchantment,
  enchantXPCost,
  type EnchantmentLevel,
} from '../domain/enchantment'

describe('domain/enchantment', () => {
  describe('getSharpnessDamageBonus', () => {
    it('level 1 gives +1 bonus', () => {
      expect(getSharpnessDamageBonus(1)).toBe(1)
    })

    it('adds exactly +0.5 per level above 1 (vanilla 0.5·level + 0.5)', () => {
      // Pin the exact per-level increment, not just monotonicity — otherwise a
      // wrong formula (e.g. +1.25/level) would still pass a `> ` check. L1=1,
      // L2=1.5, L3=2, L4=2.5, L5=3.
      expect(getSharpnessDamageBonus(1)).toBeCloseTo(1)
      expect(getSharpnessDamageBonus(2)).toBeCloseTo(1.5)
      expect(getSharpnessDamageBonus(3)).toBeCloseTo(2)
      expect(getSharpnessDamageBonus(4)).toBeCloseTo(2.5)
      expect(getSharpnessDamageBonus(5)).toBeCloseTo(3)
    })

    it('level 5 gives exactly 3 (3× the level-1 bonus of 1)', () => {
      expect(getSharpnessDamageBonus(5)).toBeCloseTo(3)
      expect(getSharpnessDamageBonus(5)).toBeCloseTo(3 * getSharpnessDamageBonus(1))
    })
  })

  describe('getSmiteDamageBonus', () => {
    it('equals 2.5 × level', () => {
      for (const level of [1, 2, 3, 4, 5] as EnchantmentLevel[]) {
        expect(getSmiteDamageBonus(level)).toBe(2.5 * level)
      }
    })

    it('level 5 gives 12.5 bonus', () => {
      expect(getSmiteDamageBonus(5)).toBe(12.5)
    })
  })

  describe('getBaneOfArthropodsDamageBonus', () => {
    it('same formula as Smite', () => {
      for (const level of [1, 2, 3] as EnchantmentLevel[]) {
        expect(getBaneOfArthropodsDamageBonus(level)).toBe(getSmiteDamageBonus(level))
      }
    })
  })

  describe('getProtectionDamageReduction', () => {
    it('returns 4% per level', () => {
      expect(getProtectionDamageReduction(1)).toBeCloseTo(0.04)
      expect(getProtectionDamageReduction(4)).toBeCloseTo(0.16)
    })
  })

  describe('getUnbreakingSkipChance', () => {
    it('level 1 gives 50% skip chance', () => {
      expect(getUnbreakingSkipChance(1)).toBeCloseTo(0.5)
    })

    it('level 3 gives 75% skip chance', () => {
      expect(getUnbreakingSkipChance(3)).toBeCloseTo(0.75)
    })

    it('skip chance always stays below 1', () => {
      for (const level of [1, 2, 3] as EnchantmentLevel[]) {
        expect(getUnbreakingSkipChance(level)).toBeLessThan(1)
      }
    })
  })

  describe('getFortuneDropMultiplier', () => {
    it('multiplier increases from level 1 to 3', () => {
      expect(getFortuneDropMultiplier(1)).toBeLessThan(getFortuneDropMultiplier(2))
      expect(getFortuneDropMultiplier(2)).toBeLessThan(getFortuneDropMultiplier(3))
    })

    it('level 3 gives 2.5× multiplier', () => {
      expect(getFortuneDropMultiplier(3)).toBe(2.5)
    })
  })

  describe('rollFortuneExtraDrops', () => {
    it('Fortune I (×1.33) grants a bonus drop ~1/3 of the time, not a flat zero (regression)', () => {
      // expectedExtra = 0.33: rng below the fraction → +1, above → 0. (The exact 0.33
      // boundary is float-fuzzy since 1.33 - 1 ≈ 0.3300000000000001, so test either side.)
      expect(rollFortuneExtraDrops(1, 0.1)).toBe(1)
      expect(rollFortuneExtraDrops(1, 0.32)).toBe(1)
      expect(rollFortuneExtraDrops(1, 0.34)).toBe(0)
      expect(rollFortuneExtraDrops(1, 0.9)).toBe(0)
    })

    it('Fortune II (×1.75) extra is stochastic around +0.75 (not a fixed +1)', () => {
      expect(rollFortuneExtraDrops(2, 0.5)).toBe(1)
      expect(rollFortuneExtraDrops(2, 0.74)).toBe(1)
      expect(rollFortuneExtraDrops(2, 0.75)).toBe(0)
    })

    it('Fortune III (×2.5) guarantees +1 and adds a second with 50% chance', () => {
      // expectedExtra = 1.5: guaranteed 1, fractional 0.5.
      expect(rollFortuneExtraDrops(3, 0.49)).toBe(2)
      expect(rollFortuneExtraDrops(3, 0.5)).toBe(1)
      expect(rollFortuneExtraDrops(3, 0.0)).toBe(2)
    })

    it('the long-run average extra matches the expected multiplier minus 1', () => {
      let total = 0
      const N = 30000
      for (let i = 0; i < N; i++) total += rollFortuneExtraDrops(1, (i + 0.5) / N)
      // Fortune I expectedExtra = 0.33; the deterministic sweep over [0,1) hits it exactly.
      expect(total / N).toBeCloseTo(0.33, 2)
    })
  })

  describe('canEnchantItem', () => {
    it('SHARPNESS applies to swords and axes', () => {
      expect(canEnchantItem('IRON_SWORD', 'SHARPNESS')).toBe(true)
      expect(canEnchantItem('DIAMOND_AXE', 'SHARPNESS')).toBe(true)
    })

    it('SHARPNESS does NOT apply to pickaxes', () => {
      expect(canEnchantItem('DIAMOND_PICKAXE', 'SHARPNESS')).toBe(false)
    })

    it('PROTECTION applies to all armor tiers', () => {
      expect(canEnchantItem('LEATHER_HELMET', 'PROTECTION')).toBe(true)
      expect(canEnchantItem('IRON_CHESTPLATE', 'PROTECTION')).toBe(true)
      expect(canEnchantItem('DIAMOND_BOOTS', 'PROTECTION')).toBe(true)
    })

    it('EFFICIENCY applies to pickaxes, axes, and hoes', () => {
      expect(canEnchantItem('IRON_PICKAXE', 'EFFICIENCY')).toBe(true)
      expect(canEnchantItem('IRON_AXE', 'EFFICIENCY')).toBe(true)
      expect(canEnchantItem('IRON_HOE', 'EFFICIENCY')).toBe(true)
    })

    it('INFINITY only applies to BOW', () => {
      expect(canEnchantItem('BOW', 'INFINITY')).toBe(true)
      expect(canEnchantItem('IRON_SWORD', 'INFINITY')).toBe(false)
    })

    it('FORTUNE applies to pickaxes (not swords)', () => {
      expect(canEnchantItem('DIAMOND_PICKAXE', 'FORTUNE')).toBe(true)
      expect(canEnchantItem('DIAMOND_SWORD', 'FORTUNE')).toBe(false)
    })

    it('EFFICIENCY applies to pickaxes, axes, and hoes', () => {
      expect(canEnchantItem('IRON_PICKAXE', 'EFFICIENCY')).toBe(true)
      expect(canEnchantItem('IRON_AXE', 'EFFICIENCY')).toBe(true)
      expect(canEnchantItem('IRON_HOE', 'EFFICIENCY')).toBe(true)
      expect(canEnchantItem('IRON_SWORD', 'EFFICIENCY')).toBe(false)
    })

    it('SILK_TOUCH applies to pickaxes and axes (not swords)', () => {
      expect(canEnchantItem('DIAMOND_PICKAXE', 'SILK_TOUCH')).toBe(true)
      expect(canEnchantItem('IRON_AXE', 'SILK_TOUCH')).toBe(true)
      expect(canEnchantItem('IRON_SWORD', 'SILK_TOUCH')).toBe(false)
    })

    it('UNBREAKING applies to all armor slots, tools, bow, fishing rod, shield', () => {
      expect(canEnchantItem('IRON_CHESTPLATE', 'UNBREAKING')).toBe(true)
      expect(canEnchantItem('DIAMOND_LEGGINGS', 'UNBREAKING')).toBe(true)
      expect(canEnchantItem('LEATHER_BOOTS', 'UNBREAKING')).toBe(true)
      expect(canEnchantItem('DIAMOND_HOE', 'UNBREAKING')).toBe(true)
    })
  })

  describe('getMaxEnchantmentLevel', () => {
    it('SHARPNESS has max level 5', () => {
      expect(getMaxEnchantmentLevel('SHARPNESS')).toBe(5)
    })

    it('PROTECTION has max level 4', () => {
      expect(getMaxEnchantmentLevel('PROTECTION')).toBe(4)
    })

    it('SILK_TOUCH has max level 1', () => {
      expect(getMaxEnchantmentLevel('SILK_TOUCH')).toBe(1)
    })

    it('FORTUNE has max level 3', () => {
      expect(getMaxEnchantmentLevel('FORTUNE')).toBe(3)
    })

    it('POWER has max level 5', () => {
      expect(getMaxEnchantmentLevel('POWER')).toBe(5)
    })

    it('INFINITY has max level 1', () => {
      expect(getMaxEnchantmentLevel('INFINITY')).toBe(1)
    })
  })

  describe('getPowerDamageMultiplier', () => {
    it('POWER I gives 1.5× multiplier', () => {
      expect(getPowerDamageMultiplier(1)).toBeCloseTo(1.5)
    })

    it('POWER II gives 2.0× multiplier', () => {
      expect(getPowerDamageMultiplier(2)).toBeCloseTo(2.0)
    })

    it('POWER V gives 3.5× multiplier', () => {
      expect(getPowerDamageMultiplier(5)).toBeCloseTo(3.5)
    })

    it('POWER is applicable to BOW', () => {
      expect(canEnchantItem('BOW', 'POWER')).toBe(true)
    })

    it('POWER is not applicable to swords', () => {
      expect(canEnchantItem('IRON_SWORD', 'POWER')).toBe(false)
    })
  })

  describe('getKnockbackHorizontalMultiplier (R40)', () => {
    it('KNOCKBACK I scales horizontal impulse by 1.5×', () => {
      expect(getKnockbackHorizontalMultiplier(1)).toBeCloseTo(1.5)
    })

    it('KNOCKBACK II scales horizontal impulse by 2.0×', () => {
      expect(getKnockbackHorizontalMultiplier(2)).toBeCloseTo(2.0)
    })

    it('KNOCKBACK applies only to swords', () => {
      expect(canEnchantItem('IRON_SWORD', 'KNOCKBACK')).toBe(true)
      expect(canEnchantItem('BOW', 'KNOCKBACK')).toBe(false)
    })

    it('KNOCKBACK has max level 2', () => {
      expect(getMaxEnchantmentLevel('KNOCKBACK')).toBe(2)
    })
  })

  describe('getFeatherFallingReduction (R41)', () => {
    it('FEATHER_FALLING I reduces fall damage by 12%', () => {
      expect(getFeatherFallingReduction(1)).toBeCloseTo(0.12)
    })

    it('FEATHER_FALLING IV reduces fall damage by 48%', () => {
      expect(getFeatherFallingReduction(4)).toBeCloseTo(0.48)
    })

    it('FEATHER_FALLING applies only to boots', () => {
      expect(canEnchantItem('IRON_BOOTS', 'FEATHER_FALLING')).toBe(true)
      expect(canEnchantItem('IRON_HELMET', 'FEATHER_FALLING')).toBe(false)
    })

    it('FEATHER_FALLING has max level 4', () => {
      expect(getMaxEnchantmentLevel('FEATHER_FALLING')).toBe(4)
    })
  })

  describe('getRespirationBonusSecs (R42)', () => {
    it('RESPIRATION I adds 15s of air', () => {
      expect(getRespirationBonusSecs(1)).toBe(15)
    })

    it('RESPIRATION III adds 45s of air', () => {
      expect(getRespirationBonusSecs(3)).toBe(45)
    })

    it('RESPIRATION applies only to helmets', () => {
      expect(canEnchantItem('IRON_HELMET', 'RESPIRATION')).toBe(true)
      expect(canEnchantItem('IRON_BOOTS', 'RESPIRATION')).toBe(false)
    })

    it('RESPIRATION has max level 3', () => {
      expect(getMaxEnchantmentLevel('RESPIRATION')).toBe(3)
    })
  })

  describe('getPunchKnockbackBonus (R43)', () => {
    it('PUNCH I adds 3 blocks of horizontal distance', () => {
      expect(getPunchKnockbackBonus(1)).toBe(3)
    })

    it('PUNCH II adds 6 blocks of horizontal distance', () => {
      expect(getPunchKnockbackBonus(2)).toBe(6)
    })

    it('PUNCH applies only to BOW', () => {
      expect(canEnchantItem('BOW', 'PUNCH')).toBe(true)
      expect(canEnchantItem('IRON_SWORD', 'PUNCH')).toBe(false)
    })

    it('PUNCH has max level 2', () => {
      expect(getMaxEnchantmentLevel('PUNCH')).toBe(2)
    })
  })

  describe('getFireProtectionReduction (R44)', () => {
    it('FIRE_PROTECTION I reduces fire damage by 8%', () => {
      expect(getFireProtectionReduction(1)).toBeCloseTo(0.08)
    })

    it('FIRE_PROTECTION IV reduces fire damage by 32%', () => {
      expect(getFireProtectionReduction(4)).toBeCloseTo(0.32)
    })

    it('FIRE_PROTECTION applies to all armor tiers', () => {
      expect(canEnchantItem('IRON_HELMET', 'FIRE_PROTECTION')).toBe(true)
      expect(canEnchantItem('LEATHER_BOOTS', 'FIRE_PROTECTION')).toBe(true)
      expect(canEnchantItem('DIAMOND_CHESTPLATE', 'FIRE_PROTECTION')).toBe(true)
    })

    it('FIRE_PROTECTION does not apply to tools', () => {
      expect(canEnchantItem('IRON_SWORD', 'FIRE_PROTECTION')).toBe(false)
      expect(canEnchantItem('IRON_PICKAXE', 'FIRE_PROTECTION')).toBe(false)
    })

    it('FIRE_PROTECTION has max level 4', () => {
      expect(getMaxEnchantmentLevel('FIRE_PROTECTION')).toBe(4)
    })
  })

  describe('LURE (fishing wait reduction)', () => {
    it('LURE I reduces wait by 5 seconds', () => {
      expect(getLureWaitReductionSecs(1)).toBe(5)
    })

    it('LURE III reduces wait by 15 seconds', () => {
      expect(getLureWaitReductionSecs(3)).toBe(15)
    })

    it('LURE only applies to FISHING_ROD', () => {
      expect(canEnchantItem('FISHING_ROD', 'LURE')).toBe(true)
      expect(canEnchantItem('BOW', 'LURE')).toBe(false)
    })
  })

  describe('LUCK_OF_THE_SEA (treasure chance bonus)', () => {
    it('LUCK_OF_THE_SEA I increases base treasure chance by 2%', () => {
      expect(getLuckTreasureChance(1)).toBeCloseTo(0.07)
    })

    it('LUCK_OF_THE_SEA III increases treasure chance by 6%', () => {
      expect(getLuckTreasureChance(3)).toBeCloseTo(0.11)
    })

    it('LUCK_OF_THE_SEA only applies to FISHING_ROD', () => {
      expect(canEnchantItem('FISHING_ROD', 'LUCK_OF_THE_SEA')).toBe(true)
      expect(canEnchantItem('BOW', 'LUCK_OF_THE_SEA')).toBe(false)
    })
  })

  describe('selectEnchantment', () => {
    it('returns None for items with no applicable enchantments', () => {
      expect(Option.isNone(selectEnchantment('APPLE', 10))).toBe(true)
      expect(Option.isNone(selectEnchantment('COBBLESTONE', 30))).toBe(true)
    })

    it('returns Some enchantment for an enchantable item', () => {
      const result = selectEnchantment('IRON_SWORD', 10)
      expect(Option.isSome(result)).toBe(true)
      const ench = Option.getOrThrow(result)
      expect(typeof ench.type).toBe('string')
      expect(ench.level).toBeGreaterThanOrEqual(1)
    })

    it('is deterministic — same item + same XP level always produces the same enchantment', () => {
      const a = selectEnchantment('DIAMOND_PICKAXE', 20)
      const b = selectEnchantment('DIAMOND_PICKAXE', 20)
      expect(a).toEqual(b)
    })

    it('produces a different enchantment for different XP levels', () => {
      // Not guaranteed to differ every time (depends on the hash), but across a wide range
      // at least some pair should differ — confirms XP level influences the selection.
      const results = new Set(
        [5, 10, 20, 30, 50].map((xp) => {
          const r = selectEnchantment('IRON_SWORD', xp)
          return Option.isSome(r) ? `${r.value.type}:${r.value.level}` : 'none'
        }),
      )
      expect(results.size).toBeGreaterThan(1)
    })

    it('enchantment level scales with XP (higher XP produces higher or equal level)', () => {
      const lowXP = selectEnchantment('DIAMOND_SWORD', 1)
      const highXP = selectEnchantment('DIAMOND_SWORD', 50)
      if (Option.isSome(lowXP) && Option.isSome(highXP)
        && lowXP.value.type === highXP.value.type) {
        expect(highXP.value.level).toBeGreaterThanOrEqual(lowXP.value.level)
      }
    })

    it('the selected enchantment is applicable to the given item', () => {
      const result = selectEnchantment('IRON_PICKAXE', 15)
      if (Option.isSome(result)) {
        expect(canEnchantItem('IRON_PICKAXE', result.value.type)).toBe(true)
      }
    })
  })

  describe('enchantXPCost', () => {
    it('costs 1 XP level for an enchantment at level 1', () => {
      expect(enchantXPCost(1)).toBe(1)
    })

    it('costs exactly the enchantment level in XP levels', () => {
      for (const level of [1, 2, 3] as EnchantmentLevel[]) {
        expect(enchantXPCost(level)).toBe(level)
      }
    })
  })
})
