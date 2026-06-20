import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const BASIC_MISC_RECIPES: ReadonlyArray<Recipe> = [
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
    id: RecipeId.make('planks-to-chest'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 8 })],
    output: { itemType: 'CHEST', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('book-diamonds-obsidian-to-enchanting-table'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'BOOK', count: 1 }),
      new RecipeIngredient({ itemType: 'DIAMOND', count: 2 }),
      new RecipeIngredient({ itemType: 'OBSIDIAN', count: 4 }),
    ],
    output: { itemType: 'ENCHANTING_TABLE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-blocks-iron-ingots-to-anvil'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_BLOCK', count: 3 }),
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 4 }),
    ],
    output: { itemType: 'ANVIL', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-to-cauldron'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 7 })],
    output: { itemType: 'CAULDRON', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-door'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 6 })],
    output: { itemType: 'DOOR', count: 3 },
  }),
  new Recipe({
    id: RecipeId.make('sticks-to-ladder'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'STICKS', count: 7 })],
    output: { itemType: 'LADDER', count: 3 },
  }),
  new Recipe({
    id: RecipeId.make('glowstone-dust-to-glowstone'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'GLOWSTONE_DUST', count: 4 })],
    output: { itemType: 'GLOWSTONE', count: 1 },
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
  // R68: charcoal also makes torches (vanilla parity — recipe matching is exact-itemType,
  // so charcoal needs its own recipe alongside the coal variant).
  new Recipe({
    id: RecipeId.make('charcoal-and-stick-to-torches'),
    station: 'inventory',
    ingredients: [
      new RecipeIngredient({ itemType: 'CHARCOAL', count: 1 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'TORCH', count: 4 },
  }),
]
