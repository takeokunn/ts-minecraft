/**
 * Crafting System - Main Export
 *
 * 完全なクラフティングシステムのエクスポート
 */

// ===== Types =====
export * from './types/RecipeTypes'

// ===== Services =====
export * from './services/CraftingEngineService'
export * from './services/RecipeRegistryService'

// ===== Data =====
export * from './StandardRecipes'

// ===== Re-exports for convenience =====
export type {
  CraftingGrid,
  CraftingItemStack,
  CraftingRecipe,
  CraftingResult,
  ItemMatcher,
  ItemStackCount,
  RecipeCategory,
  RecipeId,
  RecipePattern,
} from './types/RecipeTypes'

export type { CraftingEngineService } from './services/CraftingEngineService'

export type { RecipeRegistryService } from './services/RecipeRegistryService'
