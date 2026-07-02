import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  matchesShapedGrid,
  resolveShapedDefinition,
  shapedIngredientCounts,
  type CraftingGrid,
  type ShapedRecipeDefinition,
} from '@ts-minecraft/inventory/domain/shaped-crafting'
import { RECIPE_DEFINITIONS } from '@ts-minecraft/inventory/application/recipes'

const SWORD: ShapedRecipeDefinition = {
  pattern: ['M', 'M', 'S'],
  key: { M: 'PLANKS', S: 'STICKS' },
}

const grid = (cells: ReadonlyArray<string | null>): CraftingGrid =>
  cells.map((cell) => (cell === null ? null : (cell as CraftingGrid[number])))

describe('shaped crafting', () => {
  it('matches the exact placement', () => {
    expect(matchesShapedGrid(SWORD, grid([
      'PLANKS', null, null,
      'PLANKS', null, null,
      'STICKS', null, null,
    ]))).toBe(true)
  })

  it('matching is translation-invariant', () => {
    expect(matchesShapedGrid(SWORD, grid([
      null, null, 'PLANKS',
      null, null, 'PLANKS',
      null, null, 'STICKS',
    ]))).toBe(true)
  })

  it('rejects the wrong arrangement of the same items', () => {
    expect(matchesShapedGrid(SWORD, grid([
      'PLANKS', 'PLANKS', 'STICKS',
      null, null, null,
      null, null, null,
    ]))).toBe(false)
  })

  it('rejects extra items outside the shape', () => {
    expect(matchesShapedGrid(SWORD, grid([
      'PLANKS', 'DIRT', null,
      'PLANKS', null, null,
      'STICKS', null, null,
    ]))).toBe(false)
  })

  it('accepts a horizontally mirrored placement', () => {
    const hoe: ShapedRecipeDefinition = {
      pattern: ['MM', ' S', ' S'],
      key: { M: 'PLANKS', S: 'STICKS' },
    }
    expect(matchesShapedGrid(hoe, grid([
      'PLANKS', 'PLANKS', null,
      'STICKS', null, null,
      'STICKS', null, null,
    ]))).toBe(true)
  })

  it('resolveShapedDefinition rejects unknown key characters', () => {
    expect(Option.isNone(resolveShapedDefinition({ pattern: ['X'], key: {} }))).toBe(true)
  })

  it('shapedIngredientCounts totals the pattern cells', () => {
    const counts = shapedIngredientCounts(SWORD)
    expect(counts).toContainEqual({ itemType: 'PLANKS', count: 2 })
    expect(counts).toContainEqual({ itemType: 'STICKS', count: 1 })
  })

  it('every shaped recipe pattern agrees with its count-based ingredients (no drift)', () => {
    for (const recipe of RECIPE_DEFINITIONS) {
      if (recipe.shaped === undefined) continue
      const fromPattern = new Map(
        shapedIngredientCounts(recipe.shaped).map((entry) => [entry.itemType, entry.count]),
      )
      const fromIngredients = new Map(
        recipe.ingredients.map((ingredient) => [ingredient.itemType, ingredient.count]),
      )
      expect(fromPattern, `recipe ${recipe.id}`).toEqual(fromIngredients)
      expect(Option.isSome(resolveShapedDefinition(recipe.shaped)), `recipe ${recipe.id} keys`).toBe(true)
    }
  })
})
