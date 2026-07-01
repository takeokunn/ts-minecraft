import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  isFood,
  getFoodProperties,
} from '@ts-minecraft/entity/domain/food-resolution'
import { FOOD_TABLE } from '@ts-minecraft/entity/domain/food'

// ─── isFood ───────────────────────────────────────────────────────────────────
describe('isFood', () => {
  it('returns true for APPLE', () => {
    expect(isFood('APPLE')).toBe(true)
  })

  it('returns true for BREAD', () => {
    expect(isFood('BREAD')).toBe(true)
  })

  it('returns false for DIRT (not an edible item)', () => {
    expect(isFood('DIRT')).toBe(false)
  })

  it('returns false for IRON_PICKAXE (a tool)', () => {
    expect(isFood('IRON_PICKAXE')).toBe(false)
  })

  it('returns true for every item in the FOOD_TABLE', () => {
    for (const item of Object.keys(FOOD_TABLE)) {
      expect(isFood(item as Parameters<typeof isFood>[0])).toBe(true)
    }
  })
})

// ─── getFoodProperties ────────────────────────────────────────────────────────
describe('getFoodProperties', () => {
  it('returns None for a non-food item', () => {
    const result = getFoodProperties('STONE')
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns Some with food properties for APPLE', () => {
    const result = getFoodProperties('APPLE')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.foodLevel).toBeGreaterThan(0)
      expect(result.value.saturationModifier).toBeGreaterThan(0)
    }
  })

  it('returned properties match the FOOD_TABLE entry', () => {
    const result = getFoodProperties('BREAD')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value).toEqual(FOOD_TABLE['BREAD'])
    }
  })

  it('returns Some for every food item in the table', () => {
    for (const item of Object.keys(FOOD_TABLE)) {
      const result = getFoodProperties(item as Parameters<typeof getFoodProperties>[0])
      expect(Option.isSome(result)).toBe(true)
    }
  })

  it('all food items have a positive foodLevel', () => {
    for (const item of Object.keys(FOOD_TABLE)) {
      const result = getFoodProperties(item as Parameters<typeof getFoodProperties>[0])
      if (Option.isSome(result)) {
        expect(result.value.foodLevel).toBeGreaterThan(0)
      }
    }
  })
})
