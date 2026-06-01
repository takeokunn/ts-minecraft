import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const TOOL_RECIPES: ReadonlyArray<Recipe> = [
  // ── Swords ──────────────────────────────────────────────────────────────────
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
    id: RecipeId.make('cobblestone-and-sticks-to-stone-sword'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'COBBLESTONE', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'STONE_SWORD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-sword'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'IRON_SWORD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-and-sticks-to-diamond-sword'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'DIAMOND', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'DIAMOND_SWORD', count: 1 },
  }),
  // ── Pickaxes ────────────────────────────────────────────────────────────────
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
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-pickaxe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'IRON_PICKAXE', count: 1 },
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
  // ── Hoes ────────────────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-hoe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'WOODEN_HOE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-and-sticks-to-stone-hoe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'COBBLESTONE', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'STONE_HOE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-hoe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'IRON_HOE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-and-sticks-to-diamond-hoe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'DIAMOND', count: 2 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'DIAMOND_HOE', count: 1 },
  }),
  // ── Axes ────────────────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('planks-and-sticks-to-wooden-axe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'WOODEN_AXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-and-sticks-to-stone-axe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'COBBLESTONE', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'STONE_AXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-and-sticks-to-iron-axe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'IRON_AXE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-and-sticks-to-diamond-axe'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'DIAMOND', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 2 }),
    ],
    output: { itemType: 'DIAMOND_AXE', count: 1 },
  }),
]
