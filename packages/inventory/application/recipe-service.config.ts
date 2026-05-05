import { Recipe, RecipeIngredient } from '../domain/crafting'
import { RecipeId } from '@ts-minecraft/kernel'

export const RECIPE_DEFINITIONS: ReadonlyArray<Recipe> = [
  new Recipe({
    id: RecipeId.make('wood-to-planks'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'WOOD', count: 1 })],
    output: { itemType: 'PLANKS', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-sticks'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 2 })],
    output: { itemType: 'STICKS', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-crafting-table'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 4 })],
    output: { itemType: 'CRAFTING_TABLE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-to-furnace'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'COBBLESTONE', count: 8 })],
    output: { itemType: 'FURNACE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('coal-and-stick-to-torches'),
    station: 'inventory',
    ingredients: [
      new RecipeIngredient({ itemType: 'COAL', count: 1 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'TORCH', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-sword'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'WOODEN_SWORD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'WOODEN_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-and-sticks-to-stone-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'COBBLESTONE', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'STONE_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-iron-to-iron-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_IRON', count: 1 })],
    output: { itemType: 'IRON_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'IRON_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-gold-to-gold-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_GOLD', count: 1 })],
    output: { itemType: 'GOLD_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-and-sticks-to-diamond-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'DIAMOND', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'DIAMOND_PICKAXE', count: 1 },
  }),
]
