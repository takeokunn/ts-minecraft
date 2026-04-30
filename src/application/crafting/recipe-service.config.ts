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
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ blockType: 'PLANKS', count: 3 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 2 }),
    ],
    output: { blockType: 'WOODEN_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-and-sticks-to-stone-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ blockType: 'COBBLESTONE', count: 3 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 2 }),
    ],
    output: { blockType: 'STONE_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-iron-to-iron-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ blockType: 'RAW_IRON', count: 1 })],
    output: { blockType: 'IRON_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ blockType: 'IRON_INGOT', count: 3 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 2 }),
    ],
    output: { blockType: 'IRON_PICKAXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-gold-to-gold-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ blockType: 'RAW_GOLD', count: 1 })],
    output: { blockType: 'GOLD_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-and-sticks-to-diamond-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ blockType: 'DIAMOND', count: 3 }),
      new RecipeIngredient({ blockType: 'STICKS', count: 2 }),
    ],
    output: { blockType: 'DIAMOND_PICKAXE', count: 1 },
  }),
]
