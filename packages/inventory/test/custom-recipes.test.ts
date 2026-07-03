import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Recipe, RecipeIngredient } from '@ts-minecraft/inventory/domain/crafting'
import { RecipeId } from '@ts-minecraft/core'
import {
  decodeCustomRecipes,
  mergeCustomRecipes,
} from '@ts-minecraft/inventory/domain/custom-recipes'

const rawRecipe = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  station: 'inventory',
  ingredients: [{ itemType: 'DIRT', count: 4 }],
  output: { itemType: 'STONE', count: 1 },
  ...overrides,
})

describe('decodeCustomRecipes', () => {
  it('accepts a valid recipe array', () => {
    const result = decodeCustomRecipes([rawRecipe('pack:dirt-to-stone')])
    expect(result.errors).toEqual([])
    expect(result.recipes).toHaveLength(1)
    expect(String(result.recipes[0]!.id)).toBe('pack:dirt-to-stone')
    expect(result.recipes[0]!.output.itemType).toBe('STONE')
  })

  it('rejects invalid entries individually and keeps the valid ones', () => {
    const result = decodeCustomRecipes([
      rawRecipe('pack:good'),
      rawRecipe('pack:bad-item', { output: { itemType: 'NOT_A_REAL_ITEM', count: 1 } }),
      rawRecipe('pack:bad-count', { ingredients: [{ itemType: 'DIRT', count: 999 }] }),
    ])
    expect(result.recipes).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('[1]')
    expect(result.errors[1]).toContain('[2]')
  })

  it('rejects a non-array payload wholesale', () => {
    const result = decodeCustomRecipes({ not: 'an array' })
    expect(result.recipes).toEqual([])
    expect(result.errors).toHaveLength(1)
  })
})

describe('mergeCustomRecipes', () => {
  const builtin = new Recipe({
    id: RecipeId.make('wood-to-planks'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'WOOD', count: 1 })],
    output: { itemType: 'PLANKS', count: 4 },
  })

  it('appends custom recipes after the built-ins', () => {
    const custom = decodeCustomRecipes([rawRecipe('pack:extra')]).recipes
    const { recipes, skippedIds } = mergeCustomRecipes([builtin], custom)
    expect(recipes).toHaveLength(2)
    expect(skippedIds).toEqual([])
  })

  it('skips custom ids that collide with built-ins', () => {
    const custom = decodeCustomRecipes([rawRecipe('wood-to-planks')]).recipes
    const { recipes, skippedIds } = mergeCustomRecipes([builtin], custom)
    expect(recipes).toHaveLength(1)
    expect(skippedIds).toEqual(['wood-to-planks'])
  })

  it('deduplicates within the custom pack itself', () => {
    const custom = decodeCustomRecipes([rawRecipe('pack:dup'), rawRecipe('pack:dup')]).recipes
    const { recipes, skippedIds } = mergeCustomRecipes([builtin], custom)
    expect(recipes).toHaveLength(2)
    expect(skippedIds).toEqual(['pack:dup'])
  })
})
