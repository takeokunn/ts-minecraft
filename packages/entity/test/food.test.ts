import { describe, it } from '@effect/vitest'
import { getFoodProperties, isFood, FOOD_TABLE } from '@ts-minecraft/entity'
import type { ItemType } from '@ts-minecraft/core'
import { Array as Arr, Option } from 'effect'
import { expect } from 'vitest'

// ─── getFoodProperties ──────────────────────────────────────────────────────

describe('getFoodProperties', () => {
  const cases: ReadonlyArray<readonly [ItemType, number, number]> = [
    ['APPLE', 4, 0.3],
    ['BREAD', 5, 0.6],
    ['CARROT', 3, 0.6],
    ['COOKED_PORKCHOP', 8, 0.8],
    ['COOKED_BEEF', 8, 0.8],
    ['RAW_BEEF', 3, 0.3],
    ['GOLDEN_APPLE', 4, 1.2],
    ['SPIDER_EYE', 2, 0.1],
    ['ROTTEN_FLESH', 4, 0.1],
  ]

  Arr.forEach(cases, ([item, foodLevel, saturationModifier]) => {
    it(`returns the restoration values for ${item}`, () => {
      const props = Option.getOrThrow(getFoodProperties(item))
      expect(props.foodLevel).toBe(foodLevel)
      expect(props.saturationModifier).toBe(saturationModifier)
    })
  })

  it('returns none for a non-food item', () => {
    expect(Option.isNone(getFoodProperties('DIAMOND_PICKAXE'))).toBe(true)
    expect(Option.isNone(getFoodProperties('IRON_INGOT'))).toBe(true)
  })
})

// ─── FOOD_TABLE completeness ─────────────────────────────────────────────────

describe('FOOD_TABLE completeness', () => {
  const allFoodItems = Object.keys(FOOD_TABLE) as ReadonlyArray<ItemType>

  it('every key in FOOD_TABLE is recognized by isFood', () => {
    for (const item of allFoodItems) {
      expect(isFood(item), `${item} is in FOOD_TABLE but isFood returns false`).toBe(true)
    }
  })

  it('every key in FOOD_TABLE yields Some from getFoodProperties', () => {
    for (const item of allFoodItems) {
      expect(
        Option.isSome(getFoodProperties(item)),
        `${item} is in FOOD_TABLE but getFoodProperties returns None`,
      ).toBe(true)
    }
  })

  it('every food entry has positive foodLevel and saturationModifier', () => {
    for (const item of allFoodItems) {
      const props = Option.getOrThrow(getFoodProperties(item))
      expect(props.foodLevel, `${item}.foodLevel must be > 0`).toBeGreaterThan(0)
      expect(props.saturationModifier, `${item}.saturationModifier must be > 0`).toBeGreaterThan(0)
    }
  })

  it('covers all 15 registered food items (prevents silent omissions)', () => {
    expect(allFoodItems.length).toBe(15)
  })
})

// ─── isFood ───────────────────────────────────────────────────────────────────

describe('isFood', () => {
  it('is true for edible items', () => {
    expect(isFood('APPLE')).toBe(true)
    expect(isFood('ROTTEN_FLESH')).toBe(true)
    expect(isFood('COOKED_BEEF')).toBe(true)
    expect(isFood('GOLDEN_APPLE')).toBe(true)
    expect(isFood('SPIDER_EYE')).toBe(true)
  })

  it('is false for non-edible items', () => {
    expect(isFood('STONE_SWORD')).toBe(false)
    expect(isFood('COAL')).toBe(false)
    // Raw WHEAT is a crafting ingredient in vanilla — not food (only BREAD made from it is).
    expect(isFood('WHEAT')).toBe(false)
  })

  // Consistency: every raw meat/fish that a mob can drop is directly edible,
  // matching vanilla. (Cooking them is still better value.) Guards against the
  // earlier gap where raw fish were edible but RAW_BEEF — a cow drop — was not.
  it('treats all raw mob-drop foods as edible', () => {
    expect(isFood('RAW_BEEF')).toBe(true)
    expect(isFood('RAW_COD')).toBe(true)
    expect(isFood('RAW_SALMON')).toBe(true)
  })
})
