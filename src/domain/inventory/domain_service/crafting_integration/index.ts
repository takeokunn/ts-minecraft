/**
 * Crafting Integration Service Module
 *
 * クラフティング統合ドメインサービスのバレルエクスポート。
 */

// Service Interface and Implementation
export { CraftingIntegrationError, CraftingIntegrationService } from './service'
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
} from './service'

// Live Implementation
export { CraftingIntegrationServiceLive } from './live'
