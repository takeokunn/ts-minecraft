import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  isSmeltingXpItem,
  getSmeltingXpRate,
  calculateSmeltingXp,
} from '@ts-minecraft/inventory/application/furnace-service-xp'
import { SMELTING_XP_PER_ITEM } from '@ts-minecraft/inventory/application/furnace-service.config'

// ─── isSmeltingXpItem ─────────────────────────────────────────────────────────
describe('isSmeltingXpItem', () => {
  it('returns true for IRON_INGOT (a valid smelting XP item)', () => {
    expect(isSmeltingXpItem('IRON_INGOT')).toBe(true)
  })

  it('returns true for GOLD_INGOT', () => {
    expect(isSmeltingXpItem('GOLD_INGOT')).toBe(true)
  })

  it('returns false for DIRT (not a smelting output)', () => {
    expect(isSmeltingXpItem('DIRT')).toBe(false)
  })

  it('returns false for STONE (wait — STONE IS a smelting XP item)', () => {
    // STONE is in SMELTING_XP_PER_ITEM at 0.1 XP/item
    expect(isSmeltingXpItem('STONE')).toBe(true)
  })

  it('returns true for all keys in SMELTING_XP_PER_ITEM', () => {
    for (const item of Object.keys(SMELTING_XP_PER_ITEM)) {
      expect(isSmeltingXpItem(item as Parameters<typeof isSmeltingXpItem>[0])).toBe(true)
    }
  })

  it('returns false for COAL (fuel item, not smelting output)', () => {
    expect(isSmeltingXpItem('COAL')).toBe(false)
  })
})

// ─── getSmeltingXpRate ────────────────────────────────────────────────────────
describe('getSmeltingXpRate', () => {
  it('returns Some with IRON_INGOT rate', () => {
    const result = getSmeltingXpRate('IRON_INGOT')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(SMELTING_XP_PER_ITEM['IRON_INGOT'])
  })

  it('returns Some with GOLD_INGOT rate (the highest at 1.0)', () => {
    const result = getSmeltingXpRate('GOLD_INGOT')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(1.0)
  })

  it('returns None for an item not in the XP table', () => {
    const result = getSmeltingXpRate('DIRT')
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None for COAL', () => {
    const result = getSmeltingXpRate('COAL')
    expect(Option.isNone(result)).toBe(true)
  })
})

// ─── calculateSmeltingXp ─────────────────────────────────────────────────────
describe('calculateSmeltingXp', () => {
  it('returns 0 for an item not in the XP table', () => {
    expect(calculateSmeltingXp({ itemType: 'DIRT', count: 10 })).toBe(0)
  })

  it('returns 0 for count = 0', () => {
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 0 })).toBe(0)
  })

  it('returns 0 for negative count', () => {
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: -1 })).toBe(0)
  })

  it('returns at least 1 for a low-value item with count=1 (minimum floor)', () => {
    // STONE: rate=0.1, count=1 → 0.1 → Math.round=0 → Math.max(1,0) = 1
    expect(calculateSmeltingXp({ itemType: 'STONE', count: 1 })).toBe(1)
  })

  it('scales linearly for IRON_INGOT (rate=0.7)', () => {
    // 10 iron ingots → 10 * 0.7 = 7 → Math.round(7) = 7
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 10 })).toBe(7)
  })

  it('returns count*rate rounded for GOLD_INGOT (rate=1.0)', () => {
    // 5 gold ingots → 5 * 1.0 = 5
    expect(calculateSmeltingXp({ itemType: 'GOLD_INGOT', count: 5 })).toBe(5)
  })

  it('rounds fractional XP results', () => {
    // IRON_INGOT rate=0.7, count=3 → 2.1 → Math.round = 2
    expect(calculateSmeltingXp({ itemType: 'IRON_INGOT', count: 3 })).toBe(2)
  })

  it('returns 0 for CHARCOAL with count=0 (not the floor — rate=0.15 but count=0)', () => {
    expect(calculateSmeltingXp({ itemType: 'CHARCOAL', count: 0 })).toBe(0)
  })

  it('returns at least 1 for cooked food with count=1', () => {
    // COOKED_BEEF rate=0.35, count=1 → 0.35 → round=0 → max(1,0)=1
    expect(calculateSmeltingXp({ itemType: 'COOKED_BEEF', count: 1 })).toBe(1)
  })
})
