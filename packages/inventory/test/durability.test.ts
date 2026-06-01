import { describe, it } from '@effect/vitest'
import { getMaxDurability, isDurable, damageDurability, isBroken } from '@ts-minecraft/inventory'
import type { InventoryItem } from '@ts-minecraft/core'
import { Array as Arr, Option } from 'effect'
import { expect } from 'vitest'

describe('getMaxDurability', () => {
  const cases: ReadonlyArray<readonly [InventoryItem, number]> = [
    ['WOODEN_SWORD', 59],
    ['WOODEN_PICKAXE', 59],
    ['STONE_SWORD', 131],
    ['IRON_PICKAXE', 250],
    ['DIAMOND_SWORD', 1561],
  ]

  Arr.forEach(cases, ([item, max]) => {
    it(`returns ${max} for ${item}`, () => {
      expect(Option.getOrThrow(getMaxDurability(item))).toBe(max)
    })
  })

  it('returns none for non-tool items', () => {
    expect(Option.isNone(getMaxDurability('DIRT'))).toBe(true)
    expect(Option.isNone(getMaxDurability('APPLE'))).toBe(true)
    expect(Option.isNone(getMaxDurability('COAL'))).toBe(true)
  })
})

describe('isDurable', () => {
  it('is true for tools and weapons', () => {
    expect(isDurable('IRON_SWORD')).toBe(true)
    expect(isDurable('STONE_PICKAXE')).toBe(true)
  })

  it('is false for blocks, food, and ingredients', () => {
    expect(isDurable('STONE')).toBe(false)
    expect(isDurable('BREAD')).toBe(false)
    expect(isDurable('IRON_INGOT')).toBe(false)
  })
})

describe('damageDurability', () => {
  it('reduces durability by 1 use by default', () => {
    expect(damageDurability(59)).toBe(58)
  })

  it('reduces by a given amount', () => {
    expect(damageDurability(100, 5)).toBe(95)
  })

  it('clamps at 0 (never negative)', () => {
    expect(damageDurability(2, 10)).toBe(0)
  })

  it('ignores negative damage amounts', () => {
    expect(damageDurability(50, -5)).toBe(50)
  })
})

describe('isBroken', () => {
  it('is true at or below 0', () => {
    expect(isBroken(0)).toBe(true)
    expect(isBroken(-1)).toBe(true)
  })

  it('is false while durability remains', () => {
    expect(isBroken(1)).toBe(false)
    expect(isBroken(59)).toBe(false)
  })
})
