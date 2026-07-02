import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { RecipeId } from '@ts-minecraft/core'
import { Recipe, RecipeIngredient } from '@ts-minecraft/inventory/domain/crafting'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import {
  consumeCraftingGridCells,
  emptyCraftingGridCells,
  findShapedGridMatch,
  toCraftingGrid,
} from './crafting-grid'

const chestRecipe = new Recipe({
  id: RecipeId.make('planks-to-chest-test'),
  station: 'crafting_table',
  ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 8 })],
  output: { itemType: 'CHEST', count: 1 },
  shaped: { pattern: ['PPP', 'P P', 'PPP'], key: { P: 'PLANKS' } },
})

const sticksRecipe = new Recipe({
  id: RecipeId.make('planks-to-sticks-test'),
  station: 'inventory',
  ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 2 })],
  output: { itemType: 'STICKS', count: 4 },
  shaped: { pattern: ['P', 'P'], key: { P: 'PLANKS' } },
})

const recipes = [chestRecipe, sticksRecipe]

const cellsFromTypes = (types: ReadonlyArray<string | null>) =>
  types.map((itemType) => (itemType === null ? Option.none() : Option.some(createStack(itemType as never))))

describe('crafting-grid', () => {
  it('projects cells to a shape grid of item types', () => {
    const cells = cellsFromTypes(['PLANKS', null, null, 'PLANKS', null, null, null, null, null])
    expect(toCraftingGrid(cells)).toEqual(['PLANKS', null, null, 'PLANKS', null, null, null, null, null])
  })

  it('matches a translated shaped pattern (sticks column anywhere in the grid)', () => {
    const cells = cellsFromTypes([null, null, 'PLANKS', null, null, 'PLANKS', null, null, null])
    expect(findShapedGridMatch(recipes, cells, false)?.id).toBe('planks-to-sticks-test')
  })

  it('gates crafting_table recipes on table access', () => {
    const ring = cellsFromTypes(['PLANKS', 'PLANKS', 'PLANKS', 'PLANKS', null, 'PLANKS', 'PLANKS', 'PLANKS', 'PLANKS'])
    expect(findShapedGridMatch(recipes, ring, false)).toBeNull()
    expect(findShapedGridMatch(recipes, ring, true)?.id).toBe('planks-to-chest-test')
  })

  it('returns null for an empty grid', () => {
    expect(findShapedGridMatch(recipes, emptyCraftingGridCells(), true)).toBeNull()
  })

  it('consumes one item from every occupied cell, clearing singletons', () => {
    const cells = [
      Option.some(createStack('PLANKS', 3)),
      Option.some(createStack('PLANKS', 1)),
      Option.none(),
      ...emptyCraftingGridCells().slice(3),
    ]
    const consumed = consumeCraftingGridCells(cells)
    expect(Option.getOrNull(consumed[0]!)?.count).toBe(2)
    expect(Option.isNone(consumed[1]!)).toBe(true)
    expect(Option.isNone(consumed[2]!)).toBe(true)
  })
})
