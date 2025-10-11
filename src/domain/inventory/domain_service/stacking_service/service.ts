/**
 * Inventory Stacking Domain Service
 *
 * アイテムスタック処理の高度なドメインロジックを担当するサービス。
 * スタックルール、互換性チェック、制約適用、最適化などの
 * 複雑なビジネスロジックを提供します。
 */

import { Context, Effect, Schema } from 'effect'
import type { Inventory, InventoryErrorReason, ItemId, ItemMetadata, ItemStack } from '../../types'
import { InventorySchema, ItemMetadataSchema } from '../../inventory-types'

// =============================================================================
// Stacking Service Types
// =============================================================================

/**
 * スタック互換性情報
 */
export interface StackCompatibility {
  readonly isCompatible: boolean
  readonly reason?: StackIncompatibilityReason
  readonly maxCombinedCount: number
  readonly requiresMetadataConsolidation: boolean
  readonly metadataConflicts: ReadonlyArray<MetadataConflict>
}

/**
 * スタック互換性チェック結果の詳細
 */
export type StackIncompatibilityReason =
  | 'DIFFERENT_ITEM_IDS'
  | 'METADATA_MISMATCH'
  | 'DURABILITY_CONFLICT'
  | 'ENCHANTMENT_CONFLICT'
  | 'CUSTOM_NAME_CONFLICT'
  | 'NBT_DATA_CONFLICT'
  | 'STACK_LIMIT_EXCEEDED'

/**
 * メタデータ競合情報
 */
export type MetadataValue = ItemMetadata[keyof ItemMetadata] | null | undefined

export interface MetadataConflict {
  readonly field: keyof ItemMetadata
  readonly sourceValue: MetadataValue
  readonly targetValue: MetadataValue
  readonly resolutionStrategy: MetadataResolutionStrategy
}

/**
 * メタデータ解決戦略
 */
export type MetadataResolutionStrategy =
  | 'USE_SOURCE'
  | 'USE_TARGET'
  | 'MERGE'
  | 'AVERAGE'
  | 'MAX'
  | 'MIN'
  | 'PREVENT_STACK'

/**
 * スタック最適化オプション
 */
export interface StackOptimizationOptions {
  readonly consolidatePartialStacks: boolean
  readonly respectItemOrder: boolean
  readonly preserveMetadata: boolean
  readonly allowDurabilityAveraging: boolean
  readonly groupByCategory: boolean
  readonly fillFromLeft: boolean
}

/**
 * スタック最適化結果
 */
export interface StackOptimizationResult {
  readonly optimizedInventory: Inventory
  readonly stacksConsolidated: number
  readonly spaceSaved: number
  readonly operationsPerformed: ReadonlyArray<StackOperation>
  readonly warnings: ReadonlyArray<string>
}

/**
 * スタック操作記録
 */
export interface StackOperation {
  readonly type: 'MERGE' | 'SPLIT' | 'MOVE' | 'CONSOLIDATE'
  readonly sourceSlot: number
  readonly targetSlot?: number
  readonly itemsBefore: number
  readonly itemsAfter: number
  readonly metadata?: ItemMetadata
}

/**
 * スタック分割要求
 */
export interface StackSplitRequest {
  readonly sourceSlot: number
  readonly splitCount: number
  readonly targetSlot?: number | 'auto'
  readonly preserveMetadata: boolean
}

/**
 * スタック分割結果
 */
export interface StackSplitResult {
  readonly success: boolean
  readonly updatedInventory: Inventory
  readonly sourceSlot: number
  readonly targetSlot: number
  readonly originalStack: ItemStack
  readonly resultingStacks: ReadonlyArray<ItemStack>
}

// =============================================================================
// Domain Errors
// =============================================================================

export const StackingErrorSchema = Schema.TaggedStruct('StackingError', {
  reason: Schema.String,
  details: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Stacking Error',
    description: 'Error when item stacking operation fails',
  })
)
export type StackingError = Schema.Schema.Type<typeof StackingErrorSchema>

/**
 * StackingErrorのメッセージを取得する操作関数
 */
export const getStackingErrorMessage = (error: StackingError): string =>
  error.details ? `${error.reason}: ${error.details}` : error.reason

/**
 * StackingErrorを作成するFactory関数
 */
export const createStackingError = (
  reason: InventoryErrorReason,
  details?: string
): Effect.Effect<StackingError, Schema.ParseError> =>
  Schema.decode(StackingErrorSchema)({
    _tag: 'StackingError' as const,
    reason,
    details,
  })

/**
 * 型ガード関数
 */
export const isStackingError = (error: unknown): error is StackingError => Schema.is(StackingErrorSchema)(error)

export const StackOptimizationErrorSchema = Schema.TaggedStruct('StackOptimizationError', {
  failedOperations: Schema.Array(
    Schema.Struct({
      operation: Schema.Struct({
        type: Schema.Literal('MERGE', 'SPLIT', 'MOVE', 'CONSOLIDATE'),
        sourceSlot: Schema.Number,
        targetSlot: Schema.optional(Schema.Number),
        itemsBefore: Schema.Number,
        itemsAfter: Schema.Number,
        metadata: Schema.optional(ItemMetadataSchema),
      }),
      error: Schema.suspend(() => StackingErrorSchema),
    })
  ),
  partialResult: Schema.optional(
    Schema.Struct({
      optimizedInventory: InventorySchema,
      stacksConsolidated: Schema.Number,
      spaceSaved: Schema.Number,
      operationsPerformed: Schema.Array(
        Schema.Struct({
          type: Schema.Literal('MERGE', 'SPLIT', 'MOVE', 'CONSOLIDATE'),
          sourceSlot: Schema.Number,
          targetSlot: Schema.optional(Schema.Number),
          itemsBefore: Schema.Number,
          itemsAfter: Schema.Number,
          metadata: Schema.optional(ItemMetadataSchema),
        })
      ),
      warnings: Schema.Array(Schema.String),
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Stack Optimization Error',
    description: 'Error when stack optimization fails with partial results',
  })
)
export type StackOptimizationError = Schema.Schema.Type<typeof StackOptimizationErrorSchema>

/**
 * StackOptimizationErrorのメッセージを取得する操作関数
 */
export const getStackOptimizationErrorMessage = (error: StackOptimizationError): string =>
  `Stack optimization failed with ${error.failedOperations.length} failed operations`

/**
 * StackOptimizationErrorを作成するFactory関数
 */
export const createStackOptimizationError = (
  failedOperations: ReadonlyArray<{
    operation: StackOperation
    error: StackingError
  }>,
  partialResult?: StackOptimizationResult
): Effect.Effect<StackOptimizationError, Schema.ParseError> =>
  Schema.decode(StackOptimizationErrorSchema)({
    _tag: 'StackOptimizationError' as const,
    failedOperations,
    partialResult,
  })

/**
 * 型ガード関数
 */
export const isStackOptimizationError = (error: unknown): error is StackOptimizationError =>
  Schema.is(StackOptimizationErrorSchema)(error)

// =============================================================================
// Stacking Service Interface
// =============================================================================

/**
 * アイテムスタッキングドメインサービス
 *
 * アイテムスタックの結合、分割、最適化に関する複雑なビジネスロジックを提供。
 * DDD原則に従い、純粋なドメインロジックのみを含み、技術的詳細は排除。
 *
 * 責務:
 * - アイテムスタック互換性の判定
 * - スタック結合・分割の実行
 * - インベントリ全体のスタック最適化
 * - メタデータ競合の解決
 * - スタックルールの適用と検証
 *
 * 設計原則:
 * - 不変性の保持（元のインベントリを変更せず新しいインスタンスを返す）
 * - 副作用の排除（純粋関数として実装）
 * - 責任の明確化（スタッキングロジックのみに集中）
 * - 拡張性の確保（新しいスタックルールに対応可能）
 */
export interface StackingService {
  /**
   * 二つのアイテムスタックの互換性チェック
   *
   * アイテムID、メタデータ、耐久値などを比較し、
   * スタック可能かどうかを詳細に判定する。
   *
   * @param sourceStack - 結合元のアイテムスタック
   * @param targetStack - 結合先のアイテムスタック
   * @returns 互換性の詳細情報
   *
   * @example
   * ```typescript
   * const compatibility = yield* stackingService.checkStackCompatibility(
   *   sourceStack,
   *   targetStack
   * )
   *
   * yield* pipe(
   *   Match.value(compatibility.isCompatible),
   *   Match.when(true, () => Effect.sync(() =>
   *     console.log(`最大結合数: ${compatibility.maxCombinedCount}`)
   *   )),
   *   Match.when(false, () => Effect.log(
   *     `互換性なし: ${compatibility.reason}`
   *   )),
   *   Match.exhaustive
   * )
   * ```
   */
  readonly checkStackCompatibility: (
    sourceStack: ItemStack,
    targetStack: ItemStack
  ) => Effect.Effect<StackCompatibility, never>

  /**
   * アイテムスタックの結合実行
   *
   * 二つのスタックを結合し、可能な限り統合する。
   * メタデータ競合がある場合は指定された戦略で解決する。
   *
   * @param sourceStack - 結合元のアイテムスタック
   * @param targetStack - 結合先のアイテムスタック
   * @param resolutionStrategy - メタデータ競合時の解決戦略
   * @returns 結合結果（残余アイテムと結合後スタック）
   *
   * @example
   * ```typescript
   * const result = yield* stackingService.combineStacks(
   *   sourceStack,
   *   targetStack,
   *   'USE_TARGET'
   * )
   *
   * if (result.remainingSource) {
   *   yield* Effect.log(`結合後の残余: ${result.remainingSource.count}個`)
   * }
   * ```
   */
  readonly combineStacks: (
    sourceStack: ItemStack,
    targetStack: ItemStack,
    resolutionStrategy?: MetadataResolutionStrategy
  ) => Effect.Effect<
    {
      readonly combinedStack: ItemStack
      readonly remainingSource: ItemStack | null
      readonly metadataResolutions: ReadonlyArray<MetadataConflict>
    },
    StackingError
  >

  /**
   * アイテムスタックの分割実行
   *
   * 一つのスタックを指定された数量で分割する。
   * メタデータは指定された戦略に従って継承される。
   *
   * @param inventory - 対象のインベントリ
   * @param request - 分割要求の詳細
   * @returns 分割結果
   *
   * @example
   * ```typescript
   * const result = yield* stackingService.splitStack(inventory, {
   *   sourceSlot: 5,
   *   splitCount: 32,
   *   targetSlot: 'auto',
   *   preserveMetadata: true
   * })
   *
   * if (result.success) {
   *   yield* Effect.log(
   *     `分割完了: ${result.resultingStacks.length}個のスタックに分割`
   *   )
   * }
   * ```
   */
  readonly splitStack: (
    inventory: Inventory,
    request: StackSplitRequest
  ) => Effect.Effect<StackSplitResult, StackingError>

  /**
   * インベントリ全体のスタック最適化
   *
   * 同じアイテムのスタックを統合し、空きスペースを最大化する。
   * 指定されたオプションに従って最適な配置を計算する。
   *
   * @param inventory - 最適化対象のインベントリ
   * @param options - 最適化オプション
   * @returns 最適化結果
   *
   * @example
   * ```typescript
   * const result = yield* stackingService.optimizeInventoryStacks(
   *   inventory,
   *   {
   *     consolidatePartialStacks: true,
   *     respectItemOrder: false,
   *     preserveMetadata: true,
   *     allowDurabilityAveraging: false,
   *     groupByCategory: true,
   *     fillFromLeft: true
   *   }
   * )
   *
   * yield* Effect.log(
   *   `最適化完了: ${result.stacksConsolidated}個のスタックを統合、` +
   *   `${result.spaceSaved}スロットの空きを確保`
   * )
   * ```
   */
  readonly optimizeInventoryStacks: (
    inventory: Inventory,
    options: StackOptimizationOptions
  ) => Effect.Effect<StackOptimizationResult, StackOptimizationError>

  /**
   * 智的スタック配置
   *
   * アイテムの使用頻度、カテゴリ、プレイヤーの行動パターンを考慮して
   * 最適なスタック配置を提案する。
   *
   * @param inventory - 対象のインベントリ
   * @param usageStatistics - アイテム使用統計（オプション）
   * @returns 推奨配置
   *
   * @example
   * ```typescript
   * const arrangement = yield* stackingService.suggestIntelligentStackArrangement(
   *   inventory,
   *   {
   *     frequentlyUsedItems: ['minecraft:pickaxe', 'minecraft:sword'],
   *     recentlyUsedItems: ['minecraft:bread', 'minecraft:torch'],
   *     preferredCategories: ['tools', 'food', 'building']
   *   }
   * )
   * ```
   */
  readonly suggestIntelligentStackArrangement: (
    inventory: Inventory,
    usageStatistics?: {
      readonly frequentlyUsedItems: ReadonlyArray<ItemId>
      readonly recentlyUsedItems: ReadonlyArray<ItemId>
      readonly preferredCategories: ReadonlyArray<string>
    }
  ) => Effect.Effect<
    {
      readonly recommendedInventory: Inventory
      readonly improvements: ReadonlyArray<{
        readonly description: string
        readonly impact: 'HIGH' | 'MEDIUM' | 'LOW'
        readonly category: 'EFFICIENCY' | 'ORGANIZATION' | 'SPACE'
      }>
      readonly alternativeArrangements: ReadonlyArray<Inventory>
    },
    never
  >

  /**
   * スタック制約の検証
   *
   * アイテム固有のスタック制約をチェックし、
   * 違反がある場合は詳細な情報を返す。
   *
   * @param stack - 検証対象のスタック
   * @returns 制約違反の詳細
   *
   * @example
   * ```typescript
   * const violations = yield* stackingService.validateStackConstraints(stack)
   *
   * if (violations.length > 0) {
   *   for (const violation of violations) {
   *     yield* Effect.log(`制約違反: ${violation.description}`)
   *   }
   * }
   * ```
   */
  readonly validateStackConstraints: (stack: ItemStack) => Effect.Effect<
    ReadonlyArray<{
      readonly constraint: string
      readonly description: string
      readonly severity: 'ERROR' | 'WARNING' | 'INFO'
      readonly suggestedFix?: string
    }>,
    never
  >

  /**
   * 高速スタック検索
   *
   * 指定された条件に一致するスタックを効率的に検索する。
   * インデックス化されたデータ構造を使用してパフォーマンスを最適化。
   *
   * @param inventory - 検索対象のインベントリ
   * @param criteria - 検索条件
   * @returns 一致するスタックの配列
   *
   * @example
   * ```typescript
   * const matchingStacks = yield* stackingService.findStacksWithCriteria(
   *   inventory,
   *   {
   *     itemId: 'minecraft:diamond',
   *     minCount: 10,
   *     hasEnchantments: true,
   *     durabilityRange: { min: 0.5, max: 1.0 }
   *   }
   * )
   * ```
   */
  readonly findStacksWithCriteria: (
    inventory: Inventory,
    criteria: {
      readonly itemId?: ItemId
      readonly minCount?: number
      readonly maxCount?: number
      readonly hasEnchantments?: boolean
      readonly customName?: string
      readonly durabilityRange?: { min: number; max: number }
      readonly metadata?: Partial<ItemMetadata>
    }
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly slot: number
      readonly stack: ItemStack
      readonly matchScore: number
    }>,
    never
  >

  /**
   * スタック操作パフォーマンス統計
   *
   * スタッキング操作のパフォーマンス統計を取得する。
   * デバッグ、最適化、監視目的で使用。
   *
   * @returns パフォーマンス統計情報
   */
  readonly getStackingPerformanceStats: () => Effect.Effect<
    {
      readonly totalStackOperations: number
      readonly averageStackTime: number
      readonly stacksConsolidatedPerSecond: number
      readonly memoryUsageBytes: number
      readonly cacheHitRate: number
      readonly mostFrequentErrorType: StackIncompatibilityReason | null
    },
    never
  >
}

// =============================================================================
// Service Tag Definition
// =============================================================================

/**
 * StackingService用のContextタグ
 *
 * Effect-TSの依存注入システムで使用される。
 * Layer.provideで実装を注入し、Effect.genで取得する。
 *
 * @example
 * ```typescript
 * // サービスの使用
 * const compatibility = yield* StackingService.checkStackCompatibility(stack1, stack2)
 *
 * // レイヤーでの提供
 * const StackingServiceLive = Layer.effect(
 *   StackingService,
 *   Effect.gen(function* () {
 *     // 実装を返す
 *     return new StackingServiceImpl()
 *   })
 * )
 * ```
 */
export const StackingService = Context.GenericTag<StackingService>('@minecraft/domain/inventory/StackingService')

// =============================================================================
// Type Exports
// =============================================================================

export type {
  MetadataConflict,
  MetadataResolutionStrategy,
  StackCompatibility,
  StackIncompatibilityReason,
  StackOperation,
  StackOptimizationOptions,
  StackOptimizationResult,
  StackSplitRequest,
  StackSplitResult,
}
