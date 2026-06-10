import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  getSharpnessDamageBonus,
  getSmiteDamageBonus,
  getProtectionDamageReduction,
  getUnbreakingSkipChance,
  getFortuneDropMultiplier,
  getPowerDamageMultiplier,
  canEnchantItem,
  getMaxEnchantmentLevel,
  getBaneOfArthropodsDamageBonus,
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

    it('FORTUNE only applies to pickaxes', () => {
      expect(canEnchantItem('DIAMOND_PICKAXE', 'FORTUNE')).toBe(true)
      expect(canEnchantItem('DIAMOND_SWORD', 'FORTUNE')).toBe(false)
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
})
