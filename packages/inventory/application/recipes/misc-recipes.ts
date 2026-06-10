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
  // R66: wood log → charcoal (vanilla bootstrap: burn logs to make charcoal as a coal substitute).
  new Recipe({
    id: RecipeId.make('wood-to-charcoal'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'WOOD', count: 1 })],
    output: { itemType: 'CHARCOAL', count: 1 },
  }),
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
  // R21: shears (2 iron ingots, vanilla). Closes the Round-5 shearing gap —
  // sheep shearing shipped (R11) but SHEARS were only obtainable in creative.
  new Recipe({
    id: RecipeId.make('iron-ingots-to-shears'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 2 })],
    output: { itemType: 'SHEARS', count: 1 },
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
  // R32: Arrows — BONE×1 + STICKS×2 → ARROW×4 (simplified from vanilla flint+stick+feather;
  // uses mob-drop materials available in survival without new item types).
  new Recipe({
    id: RecipeId.make('bone-and-sticks-to-arrows'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'BONE', count: 1 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'ARROW', count: 4 },
  }),
  // R58: Bucket — 3 iron ingots → 1 bucket (vanilla). Allows water/lava collection.
  new Recipe({
    id: RecipeId.make('iron-ingots-to-bucket'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 3 })],
    output: { itemType: 'BUCKET', count: 1 },
  }),
  // R65: Flint + steel — vanilla recipe: FLINT×1 + IRON_INGOT×1 → FLINT_AND_STEEL×1.
  // Gravel always drops FLINT (deterministic; vanilla is 10% random) so this is obtainable.
  new Recipe({
    id: RecipeId.make('flint-and-iron-to-flint-and-steel'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'FLINT', count: 1 }),
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 1 }),
    ],
    output: { itemType: 'FLINT_AND_STEEL', count: 1 },
  }),
]
