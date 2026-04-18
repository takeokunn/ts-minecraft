import { Recipe, RecipeIngredient } from '@/domain/crafting'
import { RecipeId } from '@/shared/kernel'

export const RECIPE_DEFINITIONS: ReadonlyArray<Recipe> = [
  new Recipe({
    id: RecipeId.make('wood-to-planks'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ blockType: 'WOOD', count: 1 })],
    output: { blockType: 'PLANKS', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-sticks'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ blockType: 'PLANKS', count: 2 })],
    output: { blockType: 'STICKS', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-crafting-table'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ blockType: 'PLANKS', count: 4 })],
    output: { blockType: 'CRAFTING_TABLE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-to-furnace'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ blockType: 'COBBLESTONE', count: 8 })],
    output: { blockType: 'FURNACE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('coal-and-stick-to-torches'),
    station: 'inventory',
    ingredients: [
      new RecipeIngredient({ blockType: 'COAL', count: 1 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 1 }),
    ],
    output: { blockType: 'TORCH', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-sword'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ blockType: 'PLANKS', count: 2 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 1 }),
    ],
    output: { blockType: 'WOODEN_SWORD', count: 1 },
  }),
]
