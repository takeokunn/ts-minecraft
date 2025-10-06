/**
 * Crafting Domain Aggregates
 *
 * DDD集約ルートとドメインメソッドのエクスポート
 */

export * from './index'

// Recipe集約に関連するすべての型とファクトリメソッド
export type { CraftingDifficulty, CraftingTime, RecipeAggregate, RecipeMetadata, SuccessRate } from './index'

// Recipe集約のファクトリメソッドとドメインメソッド
export {
  CraftingDifficulty,
  CraftingTime,
  RecipeAggregate,
  RecipeMetadata,
  SuccessRate,
  addTag,
  canCraftWithGrid,
  cloneRecipeAggregate,
  createRecipeAggregate,
  removeTag,
  updateCraftingTime,
  updateDescription,
  updateDifficulty,
  updateSuccessRate,
  validateRecipe,
  validateRecipeStructure,
} from './index'
export * from './index';
