import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const EQUIPMENT_MISC_RECIPES: ReadonlyArray<Recipe> = [
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
  // R70: bed — 3 WOOL + 3 PLANKS (vanilla). The BED block was fully wired (respawn-point
  // setting + night-skip in interaction-placement-handler) but had no recipe, so a survival
  // player with wool and planks couldn't craft one — only village-generated beds existed.
  new Recipe({
    id: RecipeId.make('wool-and-planks-to-bed'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'WOOL', count: 3 }),
      new RecipeIngredient({ itemType: 'PLANKS', count: 3 }),
    ],
    output: { itemType: 'BED', count: 1 },
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
  // R32: Arrows — vanilla ingredients: FLINT×1 + STICKS×1 + FEATHER×1 → ARROW×4.
  new Recipe({
    id: RecipeId.make('flint-stick-feather-to-arrows'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'FLINT', count: 1 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
      new RecipeIngredient({ itemType: 'FEATHER', count: 1 }),
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
