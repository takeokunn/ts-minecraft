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
  // Smelting raw beef → cooked beef
  new Recipe({
    id: RecipeId.make('raw-beef-to-cooked-beef'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_BEEF', count: 1 })],
    output: { itemType: 'COOKED_BEEF', count: 1 },
  }),
  // Smelting fish
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
  // ── Armor recipes (crafting_table) ──────────────────────────────────────
  // Leather armor (5 leather → helmet, 8 → chestplate, 7 → leggings, 4 → boots)
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
  // Iron armor
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
  // Diamond armor
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
  // BOW: 3 string + 3 sticks (simplified — vanilla uses a 3x3 shaped recipe)
  new Recipe({
    id: RecipeId.make('string-and-sticks-to-bow'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'STRING', count: 3 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 3 }),
    ],
    output: { itemType: 'BOW', count: 1 },
  }),
  // Shield: 6 planks + 1 iron ingot (vanilla 1.9+)
  new Recipe({
    id: RecipeId.make('planks-and-iron-ingot-to-shield'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PLANKS', count: 6 }),
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 1 }),
    ],
    output: { itemType: 'SHIELD', count: 1 },
  }),
  // Golden apple: 8 gold ingots + 1 apple
  new Recipe({
    id: RecipeId.make('gold-and-apple-to-golden-apple'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 8 }),
      new RecipeIngredient({ itemType: 'APPLE', count: 1 }),
    ],
    output: { itemType: 'GOLDEN_APPLE', count: 1 },
  }),
  // Fishing rod: 3 sticks + 2 string
  new Recipe({
    id: RecipeId.make('sticks-and-string-to-fishing-rod'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'STICKS', count: 3 }),
      new RecipeIngredient({ itemType: 'STRING', count: 2 }),
    ],
    output: { itemType: 'FISHING_ROD', count: 1 },
  }),
  // Bone meal: 1 bone = 3 bone meal
  new Recipe({
    id: RecipeId.make('bone-to-bone-meal'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'BONE', count: 1 })],
    output: { itemType: 'BONE_MEAL', count: 3 },
  }),
  // Wheat seeds: not craftable (obtained from breaking grass/wheat)
  // Bread: already in recipes (3 WHEAT)
  new Recipe({
    id: RecipeId.make('wheat-to-bread'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'WHEAT', count: 3 })],
    output: { itemType: 'BREAD', count: 1 },
  }),
  // ── Hoe tools ───────────────────────────────────────────────────────────────
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
  // ── Axe tools ───────────────────────────────────────────────────────────────
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
