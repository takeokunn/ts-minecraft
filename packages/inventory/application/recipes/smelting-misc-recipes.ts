import { Recipe, RecipeIngredient } from '../../domain/crafting'
import { RecipeId } from '@ts-minecraft/core'

export const SMELTING_MISC_RECIPES: ReadonlyArray<Recipe> = [
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
    id: RecipeId.make('stone-to-pressure-plate'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'STONE', count: 2 })],
    output: { itemType: 'PRESSURE_PLATE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('stone-to-stone-slab'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'STONE', count: 3 })],
    output: { itemType: 'STONE_SLAB', count: 6 },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-oak-stairs'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 6 })],
    output: { itemType: 'OAK_STAIRS', count: 4 },
  }),
  new Recipe({
    id: RecipeId.make('coal-to-coal-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'COAL', count: 9 })],
    output: { itemType: 'COAL_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('coal-block-to-coal'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'COAL_BLOCK', count: 1 })],
    output: { itemType: 'COAL', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-to-iron-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_INGOT', count: 9 })],
    output: { itemType: 'IRON_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('iron-block-to-iron-ingots'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'IRON_BLOCK', count: 1 })],
    output: { itemType: 'IRON_INGOT', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('gold-ingots-to-gold-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 9 })],
    output: { itemType: 'GOLD_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-block-to-gold-ingots'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'GOLD_BLOCK', count: 1 })],
    output: { itemType: 'GOLD_INGOT', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('diamonds-to-diamond-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND', count: 9 })],
    output: { itemType: 'DIAMOND_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('diamond-block-to-diamonds'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'DIAMOND_BLOCK', count: 1 })],
    output: { itemType: 'DIAMOND', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('redstone-dust-to-redstone-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 9 })],
    output: { itemType: 'REDSTONE_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('redstone-block-to-redstone-dust'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'REDSTONE_BLOCK', count: 1 })],
    output: { itemType: 'REDSTONE_DUST', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('lapis-lazuli-to-lapis-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'LAPIS_LAZULI', count: 9 })],
    output: { itemType: 'LAPIS_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('lapis-block-to-lapis-lazuli'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'LAPIS_BLOCK', count: 1 })],
    output: { itemType: 'LAPIS_LAZULI', count: 9 },
  }),
  new Recipe({
    id: RecipeId.make('emeralds-to-emerald-block'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'EMERALD', count: 9 })],
    output: { itemType: 'EMERALD_BLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('emerald-block-to-emeralds'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'EMERALD_BLOCK', count: 1 })],
    output: { itemType: 'EMERALD', count: 9 },
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
    id: RecipeId.make('raw-pork-to-cooked-porkchop'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_PORKCHOP', count: 1 })],
    output: { itemType: 'COOKED_PORKCHOP', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-mutton-to-cooked-mutton'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_MUTTON', count: 1 })],
    output: { itemType: 'COOKED_MUTTON', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('raw-chicken-to-cooked-chicken'),
    station: 'furnace',
    ingredients: [new RecipeIngredient({ itemType: 'RAW_CHICKEN', count: 1 })],
    output: { itemType: 'COOKED_CHICKEN', count: 1 },
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
]
