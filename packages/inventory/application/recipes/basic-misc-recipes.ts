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
    shaped: { pattern: ['P', 'P'], key: { P: 'PLANKS' } },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-crafting-table'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 4 })],
    output: { itemType: 'CRAFTING_TABLE', count: 1 },
    shaped: { pattern: ['PP', 'PP'], key: { P: 'PLANKS' } },
  }),
  new Recipe({
    id: RecipeId.make('cobblestone-to-furnace'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'COBBLESTONE', count: 8 })],
    output: { itemType: 'FURNACE', count: 1 },
    shaped: { pattern: ['CCC', 'C C', 'CCC'], key: { C: 'COBBLESTONE' } },
  }),
  new Recipe({
    id: RecipeId.make('planks-to-chest'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'PLANKS', count: 8 })],
    output: { itemType: 'CHEST', count: 1 },
    shaped: { pattern: ['PPP', 'P P', 'PPP'], key: { P: 'PLANKS' } },
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
    id: RecipeId.make('iron-ingots-and-sticks-to-rails'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 6 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
    ],
    output: { itemType: 'RAIL', count: 16 },
  }),
  new Recipe({
    id: RecipeId.make('gold-redstone-to-powered-rails'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 6 }),
      new RecipeIngredient({ itemType: 'STICKS', count: 1 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POWERED_RAIL', count: 6 },
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
    id: RecipeId.make('sugar-cane-to-paper'),
    station: 'crafting_table',
    ingredients: [new RecipeIngredient({ itemType: 'SUGAR_CANE', count: 3 })],
    output: { itemType: 'PAPER', count: 3 },
  }),
  new Recipe({
    id: RecipeId.make('iron-ingots-redstone-dust-to-compass'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'IRON_INGOT', count: 4 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'COMPASS', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('gold-ingots-redstone-dust-to-clock'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'GOLD_INGOT', count: 4 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'CLOCK', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('paper-compass-to-map'),
    station: 'crafting_table',
    ingredients: [
      new RecipeIngredient({ itemType: 'PAPER', count: 8 }),
      new RecipeIngredient({ itemType: 'COMPASS', count: 1 }),
    ],
    output: { itemType: 'MAP', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('glowstone-dust-to-glowstone'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'GLOWSTONE_DUST', count: 4 })],
    output: { itemType: 'GLOWSTONE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('blaze-rod-and-cobblestone-to-brewing-stand'),
    station: 'crafting_table',
    // Vanilla recipe — blazes ship now, so the glowstone stand-in is retired.
    ingredients: [
      new RecipeIngredient({ itemType: 'BLAZE_ROD', count: 1 }),
      new RecipeIngredient({ itemType: 'COBBLESTONE', count: 3 }),
    ],
    output: { itemType: 'BREWING_STAND', count: 1 },
    shaped: { pattern: [' R ', 'CCC'], key: { R: 'BLAZE_ROD', C: 'COBBLESTONE' } },
  }),
  new Recipe({
    id: RecipeId.make('blaze-rod-to-blaze-powder'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'BLAZE_ROD', count: 1 })],
    output: { itemType: 'BLAZE_POWDER', count: 2 },
  }),
  new Recipe({
    id: RecipeId.make('ender-pearl-and-blaze-powder-to-ender-eye'),
    station: 'inventory',
    ingredients: [
      new RecipeIngredient({ itemType: 'ENDER_PEARL', count: 1 }),
      new RecipeIngredient({ itemType: 'BLAZE_POWDER', count: 1 }),
    ],
    output: { itemType: 'ENDER_EYE', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('glass-to-bottles'),
    station: 'inventory',
    ingredients: [new RecipeIngredient({ itemType: 'GLASS', count: 3 })],
    output: { itemType: 'GLASS_BOTTLE', count: 3 },
  }),
  // Vanilla brewing chain: nether wart turns a bottle into the AWKWARD base,
  // then a flavor ingredient turns Awkward into the real potion (redstone as
  // the duration stand-in for Swiftness, glowstone dust as the potency
  // stand-in for Healing — same ingredients as before, one wart step deeper).
  new Recipe({
    id: RecipeId.make('bottle-and-nether-wart-to-awkward'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'GLASS_BOTTLE', count: 1 }),
      new RecipeIngredient({ itemType: 'NETHER_WART', count: 1 }),
    ],
    output: { itemType: 'POTION_AWKWARD', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('awkward-and-redstone-to-swiftness'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'POTION_AWKWARD', count: 1 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POTION_SWIFTNESS', count: 1 },
  }),
  // Redstone extends a finished brew's clock (vanilla's duration modifier).
  new Recipe({
    id: RecipeId.make('swiftness-and-redstone-to-swiftness-long'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'POTION_SWIFTNESS', count: 1 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POTION_SWIFTNESS_LONG', count: 1 },
  }),
  // Glowstone amplifies a finished brew to tier 2 (vanilla's potency modifier).
  new Recipe({
    id: RecipeId.make('swiftness-and-glowstone-to-swiftness-ii'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'POTION_SWIFTNESS', count: 1 }),
      new RecipeIngredient({ itemType: 'GLOWSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POTION_SWIFTNESS_II', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('healing-and-glowstone-to-healing-ii'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'POTION_HEALING', count: 1 }),
      new RecipeIngredient({ itemType: 'GLOWSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POTION_HEALING_II', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('awkward-and-glowstone-to-healing'),
    station: 'brewing_stand',
    ingredients: [
      new RecipeIngredient({ itemType: 'POTION_AWKWARD', count: 1 }),
      new RecipeIngredient({ itemType: 'GLOWSTONE_DUST', count: 1 }),
    ],
    output: { itemType: 'POTION_HEALING', count: 1 },
  }),
  new Recipe({
    id: RecipeId.make('glowstone-and-redstone-to-lamp'),
    station: 'inventory',
    ingredients: [
      new RecipeIngredient({ itemType: 'GLOWSTONE', count: 1 }),
      new RecipeIngredient({ itemType: 'REDSTONE_DUST', count: 4 }),
    ],
    output: { itemType: 'REDSTONE_LAMP', count: 1 },
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
