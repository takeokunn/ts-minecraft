/**
 * Crafting Integration Service Module
 *
 * クラフティング統合ドメインサービスのバレルエクスポート。
 */

// Service Interface and Implementation
export { CraftingIntegrationError, CraftingIntegrationService, CraftingIntegrationServiceLive } from './index'
export type {
  CraftabilityResult,
  CraftingResult,
  FuelRequirement,
  IngredientCollectionResult,
  Recipe,
  RecipeIngredient,
  RecipeRequirements,
  RecipeResult,
  RecipeType,
} from './index'

// Live Implementation
export { CraftingIntegrationServiceLive } from './index'
export * from './index';
