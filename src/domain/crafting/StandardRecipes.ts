import { Effect, Array } from 'effect'
import {
  CraftingRecipe,
  RecipeId,
  ItemStackCount,
  CraftingItemStack,
  ItemMatcher,
  RecipeCategory,
} from './RecipeTypes'

/**
 * Standard Minecraft Recipes
 *
 * 標準的なMinecraftクラフティングレシピの定義
 */

// ===== Helper Functions =====

const createRecipeId = (id: string): RecipeId => RecipeId(id)

const createItemStack = (itemId: string, count: number, metadata?: Record<string, unknown>): CraftingItemStack => ({
  itemId,
  count: ItemStackCount(count),
  metadata,
})

const exactMatcher = (itemId: string): ItemMatcher => ({
  _tag: 'exact',
  itemId,
})

const tagMatcher = (tag: string): ItemMatcher => ({
  _tag: 'tag',
  tag,
})

const craftingCategory = (): RecipeCategory => ({
  _tag: 'crafting',
})

// ===== Wood and Basic Tools =====

export const woodenPickaxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:wooden_pickaxe'),
  pattern: [
    ['W', 'W', 'W'],
    [undefined, 'S', undefined],
    [undefined, 'S', undefined],
  ],
  ingredients: {
    W: tagMatcher('minecraft:planks'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:wooden_pickaxe', 1),
  category: craftingCategory(),
}

export const woodenAxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:wooden_axe'),
  pattern: [
    ['W', 'W'],
    ['W', 'S'],
    [undefined, 'S'],
  ],
  ingredients: {
    W: tagMatcher('minecraft:planks'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:wooden_axe', 1),
  category: craftingCategory(),
}

export const woodenShovelRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:wooden_shovel'),
  pattern: [
    ['W'],
    ['S'],
    ['S'],
  ],
  ingredients: {
    W: tagMatcher('minecraft:planks'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:wooden_shovel', 1),
  category: craftingCategory(),
}

export const woodenSwordRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:wooden_sword'),
  pattern: [
    ['W'],
    ['W'],
    ['S'],
  ],
  ingredients: {
    W: tagMatcher('minecraft:planks'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:wooden_sword', 1),
  category: craftingCategory(),
}

export const sticksRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:sticks'),
  pattern: [
    ['P'],
    ['P'],
  ],
  ingredients: {
    P: tagMatcher('minecraft:planks'),
  },
  result: createItemStack('minecraft:stick', 4),
  category: craftingCategory(),
}

// ===== Planks from Logs =====

export const oakPlanksRecipe: CraftingRecipe = {
  _tag: 'shapeless',
  id: createRecipeId('minecraft:oak_planks'),
  ingredients: [exactMatcher('minecraft:oak_log')],
  result: createItemStack('minecraft:oak_planks', 4),
  category: craftingCategory(),
}

export const birchPlanksRecipe: CraftingRecipe = {
  _tag: 'shapeless',
  id: createRecipeId('minecraft:birch_planks'),
  ingredients: [exactMatcher('minecraft:birch_log')],
  result: createItemStack('minecraft:birch_planks', 4),
  category: craftingCategory(),
}

export const sprucePlanksRecipe: CraftingRecipe = {
  _tag: 'shapeless',
  id: createRecipeId('minecraft:spruce_planks'),
  ingredients: [exactMatcher('minecraft:spruce_log')],
  result: createItemStack('minecraft:spruce_planks', 4),
  category: craftingCategory(),
}

// ===== Stone Tools =====

export const stonePickaxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:stone_pickaxe'),
  pattern: [
    ['C', 'C', 'C'],
    [undefined, 'S', undefined],
    [undefined, 'S', undefined],
  ],
  ingredients: {
    C: tagMatcher('minecraft:stone'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:stone_pickaxe', 1),
  category: craftingCategory(),
}

export const stoneAxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:stone_axe'),
  pattern: [
    ['C', 'C'],
    ['C', 'S'],
    [undefined, 'S'],
  ],
  ingredients: {
    C: tagMatcher('minecraft:stone'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:stone_axe', 1),
  category: craftingCategory(),
}

export const stoneShovelRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:stone_shovel'),
  pattern: [
    ['C'],
    ['S'],
    ['S'],
  ],
  ingredients: {
    C: tagMatcher('minecraft:stone'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:stone_shovel', 1),
  category: craftingCategory(),
}

export const stoneSwordRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:stone_sword'),
  pattern: [
    ['C'],
    ['C'],
    ['S'],
  ],
  ingredients: {
    C: tagMatcher('minecraft:stone'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:stone_sword', 1),
  category: craftingCategory(),
}

// ===== Iron Tools =====

export const ironPickaxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:iron_pickaxe'),
  pattern: [
    ['I', 'I', 'I'],
    [undefined, 'S', undefined],
    [undefined, 'S', undefined],
  ],
  ingredients: {
    I: exactMatcher('minecraft:iron_ingot'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:iron_pickaxe', 1),
  category: craftingCategory(),
}

export const ironAxeRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:iron_axe'),
  pattern: [
    ['I', 'I'],
    ['I', 'S'],
    [undefined, 'S'],
  ],
  ingredients: {
    I: exactMatcher('minecraft:iron_ingot'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:iron_axe', 1),
  category: craftingCategory(),
}

export const ironShovelRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:iron_shovel'),
  pattern: [
    ['I'],
    ['S'],
    ['S'],
  ],
  ingredients: {
    I: exactMatcher('minecraft:iron_ingot'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:iron_shovel', 1),
  category: craftingCategory(),
}

export const ironSwordRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:iron_sword'),
  pattern: [
    ['I'],
    ['I'],
    ['S'],
  ],
  ingredients: {
    I: exactMatcher('minecraft:iron_ingot'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:iron_sword', 1),
  category: craftingCategory(),
}

// ===== Workbench =====

export const craftingTableRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:crafting_table'),
  pattern: [
    ['P', 'P'],
    ['P', 'P'],
  ],
  ingredients: {
    P: tagMatcher('minecraft:planks'),
  },
  result: createItemStack('minecraft:crafting_table', 1),
  category: craftingCategory(),
}

// ===== Chests and Storage =====

export const chestRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:chest'),
  pattern: [
    ['P', 'P', 'P'],
    ['P', undefined, 'P'],
    ['P', 'P', 'P'],
  ],
  ingredients: {
    P: tagMatcher('minecraft:planks'),
  },
  result: createItemStack('minecraft:chest', 1),
  category: craftingCategory(),
}

// ===== Torches =====

export const torchRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:torch'),
  pattern: [
    ['C'],
    ['S'],
  ],
  ingredients: {
    C: exactMatcher('minecraft:coal'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:torch', 4),
  category: craftingCategory(),
}

export const charcoalTorchRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:torch_from_charcoal'),
  pattern: [
    ['C'],
    ['S'],
  ],
  ingredients: {
    C: exactMatcher('minecraft:charcoal'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:torch', 4),
  category: craftingCategory(),
}

// ===== Furnace =====

export const furnaceRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:furnace'),
  pattern: [
    ['S', 'S', 'S'],
    ['S', undefined, 'S'],
    ['S', 'S', 'S'],
  ],
  ingredients: {
    S: tagMatcher('minecraft:stone'),
  },
  result: createItemStack('minecraft:furnace', 1),
  category: craftingCategory(),
}

// ===== Ladders =====

export const ladderRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:ladder'),
  pattern: [
    ['S', undefined, 'S'],
    ['S', 'S', 'S'],
    ['S', undefined, 'S'],
  ],
  ingredients: {
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:ladder', 3),
  category: craftingCategory(),
}

// ===== Fences =====

export const oakFenceRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:oak_fence'),
  pattern: [
    ['P', 'S', 'P'],
    ['P', 'S', 'P'],
  ],
  ingredients: {
    P: exactMatcher('minecraft:oak_planks'),
    S: exactMatcher('minecraft:stick'),
  },
  result: createItemStack('minecraft:oak_fence', 3),
  category: craftingCategory(),
}

// ===== Doors =====

export const oakDoorRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:oak_door'),
  pattern: [
    ['P', 'P'],
    ['P', 'P'],
    ['P', 'P'],
  ],
  ingredients: {
    P: exactMatcher('minecraft:oak_planks'),
  },
  result: createItemStack('minecraft:oak_door', 3),
  category: craftingCategory(),
}

// ===== Beds =====

export const redBedRecipe: CraftingRecipe = {
  _tag: 'shaped',
  id: createRecipeId('minecraft:red_bed'),
  pattern: [
    ['W', 'W', 'W'],
    ['P', 'P', 'P'],
  ],
  ingredients: {
    W: exactMatcher('minecraft:red_wool'),
    P: tagMatcher('minecraft:planks'),
  },
  result: createItemStack('minecraft:red_bed', 1),
  category: craftingCategory(),
}

// ===== Recipe Collection =====

export const getAllStandardRecipes = (): Effect.Effect<Array.ReadonlyArray<CraftingRecipe>, never> =>
  Effect.succeed([
    // Wood tools
    woodenPickaxeRecipe,
    woodenAxeRecipe,
    woodenShovelRecipe,
    woodenSwordRecipe,
    sticksRecipe,

    // Planks
    oakPlanksRecipe,
    birchPlanksRecipe,
    sprucePlanksRecipe,

    // Stone tools
    stonePickaxeRecipe,
    stoneAxeRecipe,
    stoneShovelRecipe,
    stoneSwordRecipe,

    // Iron tools
    ironPickaxeRecipe,
    ironAxeRecipe,
    ironShovelRecipe,
    ironSwordRecipe,

    // Utility blocks
    craftingTableRecipe,
    chestRecipe,
    furnaceRecipe,

    // Light sources
    torchRecipe,
    charcoalTorchRecipe,

    // Building components
    ladderRecipe,
    oakFenceRecipe,
    oakDoorRecipe,

    // Furniture
    redBedRecipe,
  ])

export const getRecipeCount = (): number => 22