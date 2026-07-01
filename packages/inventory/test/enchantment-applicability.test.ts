import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  canEnchantItem,
  areEnchantmentTypesMutuallyExclusive,
  isEnchantableItem,
  getApplicableEnchantments,
  selectEnchantment,
} from '@ts-minecraft/inventory/domain/enchantment-applicability'
import type { EnchantmentType } from '@ts-minecraft/inventory/domain/enchantment.types'

// ─── canEnchantItem ───────────────────────────────────────────────────────────
describe('canEnchantItem', () => {
  it('returns true for IRON_SWORD + SHARPNESS', () => {
    expect(canEnchantItem('IRON_SWORD', 'SHARPNESS')).toBe(true)
  })

  it('returns true for IRON_PICKAXE + EFFICIENCY', () => {
    expect(canEnchantItem('IRON_PICKAXE', 'EFFICIENCY')).toBe(true)
  })

  it('returns false for IRON_PICKAXE + SHARPNESS (sword-only enchantment)', () => {
    expect(canEnchantItem('IRON_PICKAXE', 'SHARPNESS')).toBe(false)
  })

  it('returns false for DIRT + any enchantment', () => {
    expect(canEnchantItem('DIRT', 'SHARPNESS')).toBe(false)
    expect(canEnchantItem('DIRT', 'PROTECTION')).toBe(false)
  })
})

// ─── areEnchantmentTypesMutuallyExclusive ────────────────────────────────────
describe('areEnchantmentTypesMutuallyExclusive', () => {
  it('SHARPNESS and SMITE are mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('SHARPNESS', 'SMITE')).toBe(true)
  })

  it('SMITE and BANE_OF_ARTHROPODS are mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('SMITE', 'BANE_OF_ARTHROPODS')).toBe(true)
  })

  it('FORTUNE and SILK_TOUCH are mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('FORTUNE', 'SILK_TOUCH')).toBe(true)
  })

  it('INFINITY and MENDING are mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('INFINITY', 'MENDING')).toBe(true)
  })

  it('PROTECTION and PROJECTILE_PROTECTION are mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('PROTECTION', 'PROJECTILE_PROTECTION')).toBe(true)
  })

  it('SHARPNESS and EFFICIENCY are NOT mutually exclusive', () => {
    expect(areEnchantmentTypesMutuallyExclusive('SHARPNESS', 'EFFICIENCY')).toBe(false)
  })

  it('an enchantment is NOT mutually exclusive with itself', () => {
    expect(areEnchantmentTypesMutuallyExclusive('SHARPNESS', 'SHARPNESS')).toBe(false)
  })

  it('is symmetric: a→b same as b→a', () => {
    const ab = areEnchantmentTypesMutuallyExclusive('SHARPNESS', 'SMITE')
    const ba = areEnchantmentTypesMutuallyExclusive('SMITE', 'SHARPNESS')
    expect(ab).toBe(ba)
  })
})

// ─── isEnchantableItem ────────────────────────────────────────────────────────
describe('isEnchantableItem', () => {
  it('returns true for IRON_SWORD', () => {
    expect(isEnchantableItem('IRON_SWORD')).toBe(true)
  })

  it('returns true for IRON_PICKAXE', () => {
    expect(isEnchantableItem('IRON_PICKAXE')).toBe(true)
  })

  it('returns false for DIRT', () => {
    expect(isEnchantableItem('DIRT')).toBe(false)
  })

  it('returns false for APPLE', () => {
    expect(isEnchantableItem('APPLE')).toBe(false)
  })
})

// ─── getApplicableEnchantments ────────────────────────────────────────────────
describe('getApplicableEnchantments', () => {
  it('returns a non-empty list for IRON_SWORD', () => {
    const enchantments = getApplicableEnchantments('IRON_SWORD')
    expect(enchantments.length).toBeGreaterThan(0)
  })

  it('includes SHARPNESS for IRON_SWORD', () => {
    const enchantments = getApplicableEnchantments('IRON_SWORD') as EnchantmentType[]
    expect(enchantments).toContain('SHARPNESS')
  })

  it('returns an empty array for DIRT', () => {
    expect(getApplicableEnchantments('DIRT')).toHaveLength(0)
  })

  it('returns the same reference for repeated calls (frozen array)', () => {
    const a = getApplicableEnchantments('IRON_PICKAXE')
    const b = getApplicableEnchantments('IRON_PICKAXE')
    expect(a).toBe(b)
  })
})

// ─── selectEnchantment ────────────────────────────────────────────────────────
describe('selectEnchantment', () => {
  it('returns None for a non-enchantable item', () => {
    expect(Option.isNone(selectEnchantment('DIRT', 10))).toBe(true)
  })

  it('returns Some for an enchantable item', () => {
    expect(Option.isSome(selectEnchantment('IRON_SWORD', 10))).toBe(true)
  })

  it('is deterministic: same item + level always picks the same enchantment', () => {
    const a = selectEnchantment('IRON_SWORD', 15)
    const b = selectEnchantment('IRON_SWORD', 15)
    expect(a).toEqual(b)
  })

  it('varies with xpLevel: different levels can produce different enchantments', () => {
    const results = new Set<string>()
    for (let level = 1; level <= 30; level++) {
      const result = selectEnchantment('IRON_SWORD', level)
      if (Option.isSome(result)) results.add(result.value.type)
    }
    // Over 30 levels, at least 2 different enchantment types should appear
    expect(results.size).toBeGreaterThan(1)
  })

  it('level 1 produces an enchantment at level 1', () => {
    // floor(1/5)=0, max(1,0)=1 → enchantment level=1
    const result = selectEnchantment('IRON_SWORD', 1)
    if (Option.isSome(result)) expect(result.value.level).toBe(1)
  })

  it('returns a valid enchantment type applicable to the item', () => {
    const result = selectEnchantment('IRON_PICKAXE', 20)
    if (Option.isSome(result)) {
      const applicableForPickaxe = getApplicableEnchantments('IRON_PICKAXE') as EnchantmentType[]
      expect(applicableForPickaxe).toContain(result.value.type)
    }
  })
})
