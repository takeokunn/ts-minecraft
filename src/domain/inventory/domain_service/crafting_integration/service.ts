/**
 * Crafting Integration Domain Service
 *
 * クラフティングシステム統合サービス。
 * インベントリとクラフティングシステム間の複雑な相互作用を管理し、
 * レシピの実行可能性、材料の可用性、結果の配置などを処理します。
 */

import { Context, Data, Effect } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'

// =============================================================================
// Crafting Integration Service Types
// =============================================================================

/**
 * レシピ定義
 */
export interface Recipe {
  readonly recipeId: string
  readonly type: RecipeType
  readonly ingredients: ReadonlyArray<RecipeIngredient>
  readonly result: RecipeResult
  readonly requirements: RecipeRequirements
}

/**
 * レシピタイプ
 */
export type RecipeType = 'CRAFTING' | 'SMELTING' | 'BREWING' | 'SMITHING' | 'COOKING'

/**
 * レシピ材料
 */
export interface RecipeIngredient {
  readonly itemId: ItemId
  readonly count: number
  readonly slot?: number // グリッド内の位置（任意）
  readonly alternatives?: ReadonlyArray<ItemId> // 代替材料
}

/**
 * レシピ結果
 */
export interface RecipeResult {
  readonly itemId: ItemId
  readonly count: number
  readonly metadata?: unknown
}

/**
 * レシピ要件
 */
export interface RecipeRequirements {
  readonly craftingTableRequired: boolean
  readonly furnaceRequired: boolean
  readonly brewingStandRequired: boolean
  readonly smithingTableRequired: boolean
  readonly experience?: number
  readonly fuel?: FuelRequirement
}

/**
 * 燃料要件
 */
export interface FuelRequirement {
  readonly fuelType: ItemId
  readonly amount: number
  readonly burnTime: number
}

/**
 * クラフト可能性チェック結果
 */
export interface CraftabilityResult {
  readonly canCraft: boolean
  readonly reason?: string
  readonly missingIngredients: ReadonlyArray<{
    readonly itemId: ItemId
    readonly required: number
    readonly available: number
  }>
  readonly suggestedSlots: ReadonlyArray<number>
  readonly resultPlacement: {
    readonly canPlace: boolean
    readonly targetSlot?: number
    readonly overflow: ReadonlyArray<ItemStack>
  }
}

/**
 * クラフト実行結果
 */
export interface CraftingResult {
  readonly success: boolean
  readonly updatedInventory: Inventory
  readonly craftedItems: ReadonlyArray<ItemStack>
  readonly consumedIngredients: ReadonlyArray<{
    readonly itemId: ItemId
    readonly count: number
    readonly fromSlots: ReadonlyArray<number>
  }>
  readonly experienceGained: number
  readonly byproducts: ReadonlyArray<ItemStack>
}

/**
 * 材料収集結果
 */
export interface IngredientCollectionResult {
  readonly collected: ReadonlyArray<{
    readonly itemId: ItemId
    readonly count: number
    readonly fromSlots: ReadonlyArray<number>
  }>
  readonly missing: ReadonlyArray<{
    readonly itemId: ItemId
    readonly required: number
    readonly shortfall: number
  }>
  readonly alternatives: ReadonlyArray<{
    readonly originalItemId: ItemId
    readonly alternativeItemId: ItemId
    readonly availableCount: number
  }>
}

// =============================================================================
// Domain Errors
// =============================================================================

export class CraftingIntegrationError extends Data.TaggedError('CraftingIntegrationError')<{
  readonly reason: string
  readonly details?: string
}> {}

// =============================================================================
// Crafting Integration Service Interface
// =============================================================================

/**
 * クラフティング統合ドメインサービス
 *
 * インベントリシステムとクラフティングシステムの境界を管理し、
 * 両システム間の複雑な相互作用を統合的に処理するサービス。
 *
 * 責務:
 * - レシピ実行可能性の評価
 * - 材料の収集と配置
 * - クラフト結果の配置最適化
 * - 経験値とバイプロダクトの管理
 * - 代替材料の提案と使用
 */
export interface CraftingIntegrationService {
  /**
   * レシピのクラフト可能性チェック
   *
   * 指定されたレシピがインベントリの材料で実行可能かを詳細に評価する。
   * 不足材料、代替材料、結果の配置可能性を含む包括的な分析を提供。
   *
   * @param inventory - 対象のインベントリ
   * @param recipe - チェックするレシピ
   * @returns 詳細なクラフト可能性情報
   *
   * @example
   * ```typescript
   * const result = yield* craftingService.checkCraftability(inventory, swordRecipe)
   *
   * if (!result.canCraft) {
   *   yield* Effect.log(`クラフト不可: ${result.reason}`)
   *   for (const missing of result.missingIngredients) {
   *     yield* Effect.log(`不足: ${missing.itemId} (${missing.required - missing.available}個)`)
   *   }
   * }
   * ```
   */
  readonly checkCraftability: (
    inventory: Inventory,
    recipe: Recipe
  ) => Effect.Effect<CraftabilityResult, CraftingIntegrationError>

  /**
   * レシピのクラフト実行
   *
   * レシピを実際に実行し、材料の消費、結果の配置、
   * 副産物の処理を包括的に行う。
   *
   * @param inventory - 対象のインベントリ
   * @param recipe - 実行するレシピ
   * @param craftCount - クラフト回数（デフォルト: 1）
   * @returns クラフト実行結果
   *
   * @example
   * ```typescript
   * const result = yield* craftingService.executeCrafting(
   *   inventory,
   *   breadRecipe,
   *   5 // 5回クラフト
   * )
   *
   * if (result.success) {
   *   yield* Effect.log(`${result.craftedItems.length}個のアイテムをクラフト`)
   *   yield* Effect.log(`経験値 ${result.experienceGained} を獲得`)
   * }
   * ```
   */
  readonly executeCrafting: (
    inventory: Inventory,
    recipe: Recipe,
    craftCount?: number
  ) => Effect.Effect<CraftingResult, CraftingIntegrationError>

  /**
   * 材料の自動収集
   *
   * レシピに必要な材料をインベントリから自動収集し、
   * 最適な配置を決定する。代替材料の使用も考慮。
   *
   * @param inventory - 対象のインベントリ
   * @param ingredients - 必要な材料リスト
   * @param allowAlternatives - 代替材料の使用を許可するか
   * @returns 材料収集結果
   *
   * @example
   * ```typescript
   * const collection = yield* craftingService.collectIngredients(
   *   inventory,
   *   swordRecipe.ingredients,
   *   true // 代替材料使用許可
   * )
   *
   * if (collection.missing.length > 0) {
   *   yield* Effect.log('材料不足です')
   * }
   * ```
   */
  readonly collectIngredients: (
    inventory: Inventory,
    ingredients: ReadonlyArray<RecipeIngredient>,
    allowAlternatives?: boolean
  ) => Effect.Effect<IngredientCollectionResult, CraftingIntegrationError>

  /**
   * 代替材料の提案
   *
   * 不足している材料に対して、インベントリ内の代替可能な材料を提案する。
   * アイテムレジストリとの連携により適切な代替を選択。
   *
   * @param inventory - 対象のインベントリ
   * @param requiredItemId - 必要なアイテムID
   * @param requiredCount - 必要な数量
   * @returns 代替材料の提案リスト
   *
   * @example
   * ```typescript
   * const alternatives = yield* craftingService.suggestAlternativeIngredients(
   *   inventory,
   *   'minecraft:oak_planks',
   *   4
   * )
   *
   * for (const alt of alternatives) {
   *   yield* Effect.log(`代替案: ${alt.itemId} (${alt.availableCount}個利用可能)`)
   * }
   * ```
   */
  readonly suggestAlternativeIngredients: (
    inventory: Inventory,
    requiredItemId: ItemId,
    requiredCount: number
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly itemId: ItemId
      readonly availableCount: number
      readonly compatibilityScore: number
      readonly reason: string
    }>,
    never
  >

  /**
   * バッチクラフティング
   *
   * 複数のレシピを効率的にバッチ実行する。
   * 材料の最適配分と実行順序の最適化を行う。
   *
   * @param inventory - 対象のインベントリ
   * @param recipes - 実行するレシピと回数のリスト
   * @returns バッチクラフト結果
   *
   * @example
   * ```typescript
   * const batchResult = yield* craftingService.batchCrafting(inventory, [
   *   { recipe: breadRecipe, count: 10 },
   *   { recipe: cakeRecipe, count: 2 }
   * ])
   *
   * yield* Effect.log(`${batchResult.totalCrafted}個のアイテムをクラフト`)
   * ```
   */
  readonly batchCrafting: (
    inventory: Inventory,
    recipes: ReadonlyArray<{
      readonly recipe: Recipe
      readonly count: number
    }>
  ) => Effect.Effect<
    {
      readonly updatedInventory: Inventory
      readonly totalCrafted: number
      readonly totalExperienceGained: number
      readonly failedRecipes: ReadonlyArray<{
        readonly recipe: Recipe
        readonly reason: string
      }>
      readonly executionOrder: ReadonlyArray<string>
    },
    CraftingIntegrationError
  >

  /**
   * 逆レシピ検索
   *
   * 指定されたアイテムを作成可能なレシピを検索し、
   * 現在のインベントリで実行可能なものを優先的に返す。
   *
   * @param targetItemId - 作成したいアイテムID
   * @param inventory - 対象のインベントリ
   * @returns 該当レシピと実行可能性のリスト
   *
   * @example
   * ```typescript
   * const recipes = yield* craftingService.findRecipesForItem(
   *   'minecraft:diamond_sword',
   *   inventory
   * )
   *
   * for (const result of recipes) {
   *   if (result.canCraft) {
   *     yield* Effect.log(`実行可能: ${result.recipe.recipeId}`)
   *   }
   * }
   * ```
   */
  readonly findRecipesForItem: (
    targetItemId: ItemId,
    inventory: Inventory
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly recipe: Recipe
      readonly canCraft: boolean
      readonly missingIngredients: ReadonlyArray<ItemId>
      readonly craftingComplexity: number
    }>,
    never
  >

  /**
   * クラフティング統計
   *
   * クラフティング操作の統計情報を取得する。
   * パフォーマンス監視と最適化目的で使用。
   *
   * @returns クラフティング統計情報
   */
  readonly getCraftingStats: () => Effect.Effect<
    {
      readonly totalCrafts: number
      readonly successfulCrafts: number
      readonly failedCrafts: number
      readonly averageCraftTime: number
      readonly mostCraftedItem: ItemId | null
      readonly totalExperienceGenerated: number
    },
    never
  >
}

// =============================================================================
// Service Tag Definition
// =============================================================================

/**
 * CraftingIntegrationService用のContextタグ
 */
export const CraftingIntegrationService = Context.GenericTag<CraftingIntegrationService>(
  '@minecraft/domain/inventory/CraftingIntegrationService'
)

// =============================================================================
// Type Exports
// =============================================================================

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
}
