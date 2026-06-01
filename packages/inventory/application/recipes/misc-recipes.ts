import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const MISC_RECIPES: ReadonlyArray<Recipe> = [
  // ── Basic crafting ──────────────────────────────────────────────────────────
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
  // ── Smelting recipes (furnace) ──────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('raw-iron-to-iron-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_IRON', count: 1 })],
    output: { itemType: 'IRON_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-gold-to-gold-ingot'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_GOLD', count: 1 })],
    output: { itemType: 'GOLD_INGOT', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-to-stone'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'COBBLESTONE', count: 1 })],
    output: { itemType: 'STONE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('sand-to-glass'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'SAND', count: 1 })],
    output: { itemType: 'GLASS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-beef-to-cooked-beef'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_BEEF', count: 1 })],
    output: { itemType: 'COOKED_BEEF', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-cod-to-cooked-cod'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_COD', count: 1 })],
    output: { itemType: 'COOKED_COD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-salmon-to-cooked-salmon'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_SALMON', count: 1 })],
    output: { itemType: 'COOKED_SALMON', count: 1 },
  }),
  // ── Equipment & items ──────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('string-and-sticks-to-bow'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'STRING', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 3 }),
    ],
    output: { itemType: 'BOW', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('planks-and-iron-ingot-to-shield'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 6 }),
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 1 }),
    ],
    output: { itemType: 'SHIELD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-and-apple-to-golden-apple'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 8 }),
      new RecipeIngredient({ itemType: 'APPLE', count: 1 }),
    ],
    output: { itemType: 'GOLDEN_APPLE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('sticks-and-string-to-fishing-rod'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'STICKS', count: 3 }),
      new RecipeIngredient({ itemType: 'STRING', count: 2 }),
    ],
    output: { itemType: 'FISHING_ROD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('bone-to-bone-meal'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'BONE', count: 1 })],
    output: { itemType: 'BONE_MEAL', count: 3 },
  }),
  new Recipe({
    id: RecipeId.make('wheat-to-bread'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'WHEAT', count: 3 })],
    output: { itemType: 'BREAD', count: 1 },
  }),
]
