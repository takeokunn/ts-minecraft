import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import {
  selectEnchantment,
  canEnchantItem,
} from '@ts-minecraft/inventory/domain/enchantment-applicability'
import {
  enchantXPCost,
  getSharpnessDamageBonus,
  getProtectionDamageReduction,
} from '@ts-minecraft/inventory/domain/enchantment'
import { createStack, enchantItem } from '@ts-minecraft/inventory/domain/item-stack'

describe('selectEnchantment', () => {
  it('returns Option.none for non-enchantable items', () => {
    expect(Option.isNone(selectEnchantment('DIRT', 10))).toBe(true)
    expect(Option.isNone(selectEnchantment('STONE', 30))).toBe(true)
  })

  it('returns Option.some for enchantable weapons', () => {
    const result = selectEnchantment('DIAMOND_SWORD', 10)
    expect(Option.isSome(result)).toBe(true)
  })

  it('returns Option.some for enchantable armor', () => {
    const result = selectEnchantment('DIAMOND_CHESTPLATE', 10)
    expect(Option.isSome(result)).toBe(true)
  })

  it('is deterministic — same item + xpLevel always gives same enchantment', () => {
    const a = selectEnchantment('IRON_SWORD', 15)
    const b = selectEnchantment('IRON_SWORD', 15)
    expect(a).toEqual(b)
  })

  it('varies with XP level', () => {
    // Different XP levels may produce different enchantments or levels
    const low = selectEnchantment('DIAMOND_PICKAXE', 5)
    const high = selectEnchantment('DIAMOND_PICKAXE', 30)
    // Both should be Some (pickaxes are enchantable)
    expect(Option.isSome(low)).toBe(true)
    expect(Option.isSome(high)).toBe(true)
    // High XP should give a higher enchantment level
    if (Option.isSome(low) && Option.isSome(high) && low.value.type === high.value.type) {
      expect(high.value.level).toBeGreaterThanOrEqual(low.value.level)
    }
  })

  it('enchantment level scales with XP — xpLevel=1 gives level 1', () => {
    const result = selectEnchantment('DIAMOND_SWORD', 1)
    if (Option.isSome(result)) {
      expect(result.value.level).toBe(1)
    }
  })
})

describe('enchantXPCost', () => {
  it('cost equals enchantment level', () => {
    expect(enchantXPCost(1)).toBe(1)
    expect(enchantXPCost(3)).toBe(3)
    expect(enchantXPCost(5)).toBe(5)
  })
})

describe('canEnchantItem', () => {
  it('DIAMOND_SWORD can have SHARPNESS', () => {
    expect(canEnchantItem('DIAMOND_SWORD', 'SHARPNESS')).toBe(true)
  })

  it('DIAMOND_SWORD cannot have PROTECTION', () => {
    expect(canEnchantItem('DIAMOND_SWORD', 'PROTECTION')).toBe(false)
  })

  it('DIAMOND_CHESTPLATE can have PROTECTION', () => {
    expect(canEnchantItem('DIAMOND_CHESTPLATE', 'PROTECTION')).toBe(true)
  })
})

describe('enchantItem', () => {
  it('adds a new enchantment to an item stack', () => {
    const stack = createStack('DIAMOND_SWORD')
    const enchanted = enchantItem(stack, { type: 'SHARPNESS', level: 3 })
    expect(enchanted.enchantments).toEqual([{ type: 'SHARPNESS', level: 3 }])
  })

  it('replaces an existing enchantment of the same type', () => {
    const stack = createStack('DIAMOND_SWORD')
    const first = enchantItem(stack, { type: 'SHARPNESS', level: 1 })
    const upgraded = enchantItem(first, { type: 'SHARPNESS', level: 4 })
    expect(upgraded.enchantments).toEqual([{ type: 'SHARPNESS', level: 4 }])
  })

  it('allows multiple different enchantments', () => {
    const stack = createStack('DIAMOND_SWORD')
    const e1 = enchantItem(stack, { type: 'SHARPNESS', level: 3 })
    const e2 = enchantItem(e1, { type: 'LOOTING', level: 2 })
    expect(e2.enchantments).toHaveLength(2)
  })

  it('preserves itemType, count, durability', () => {
    const stack = createStack('DIAMOND_SWORD')
    const enchanted = enchantItem(stack, { type: 'SHARPNESS', level: 2 })
    expect(enchanted.itemType).toBe('DIAMOND_SWORD')
    expect(enchanted.count).toBe(1)
    expect(enchanted.durability).toBe(stack.durability)
  })
})

describe('enchantment bonus functions', () => {
  it('getSharpnessDamageBonus: L1=1, L3=2, L5=3', () => {
    expect(getSharpnessDamageBonus(1)).toBe(1)
    expect(getSharpnessDamageBonus(3)).toBe(2)
    expect(getSharpnessDamageBonus(5)).toBe(3)
  })

  it('getProtectionDamageReduction: 4% per level', () => {
    expect(getProtectionDamageReduction(1)).toBeCloseTo(0.04)
    expect(getProtectionDamageReduction(4)).toBeCloseTo(0.16)
  })
})
