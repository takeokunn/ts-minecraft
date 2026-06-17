import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const ARMOR_RECIPES: ReadonlyArray<Recipe> = [
  // ── Leather armor ───────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('leather-to-leather-helmet'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'LEATHER', count: 5 })],
    output: { itemType: 'LEATHER_HELMET', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('leather-to-leather-chestplate'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'LEATHER', count: 8 })],
    output: { itemType: 'LEATHER_CHESTPLATE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('leather-to-leather-leggings'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'LEATHER', count: 7 })],
    output: { itemType: 'LEATHER_LEGGINGS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('leather-to-leather-boots'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'LEATHER', count: 4 })],
    output: { itemType: 'LEATHER_BOOTS', count: 1 },
  }),
  // ── Iron armor ──────────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('iron-ingot-to-iron-helmet'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 5 })],
    output: { itemType: 'IRON_HELMET', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingot-to-iron-chestplate'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 8 })],
    output: { itemType: 'IRON_CHESTPLATE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingot-to-iron-leggings'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 7 })],
    output: { itemType: 'IRON_LEGGINGS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingot-to-iron-boots'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 4 })],
    output: { itemType: 'IRON_BOOTS', count: 1 },
  }),
  // ── Gold armor ──────────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('gold-ingot-to-gold-helmet'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 5 })],
    output: { itemType: 'GOLD_HELMET', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-ingot-to-gold-chestplate'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 8 })],
    output: { itemType: 'GOLD_CHESTPLATE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-ingot-to-gold-leggings'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 7 })],
    output: { itemType: 'GOLD_LEGGINGS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-ingot-to-gold-boots'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 4 })],
    output: { itemType: 'GOLD_BOOTS', count: 1 },
  }),
  // ── Diamond armor ───────────────────────────────────────────────────────────
  new Recipe({
    id: RecipeId.make('diamond-to-diamond-helmet'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND', count: 5 })],
    output: { itemType: 'DIAMOND_HELMET', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamond-to-diamond-chestplate'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND', count: 8 })],
    output: { itemType: 'DIAMOND_CHESTPLATE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamond-to-diamond-leggings'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND', count: 7 })],
    output: { itemType: 'DIAMOND_LEGGINGS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamond-to-diamond-boots'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND', count: 4 })],
    output: { itemType: 'DIAMOND_BOOTS', count: 1 },
  }),
]
