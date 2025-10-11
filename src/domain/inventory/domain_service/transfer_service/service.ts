/**
 * Inventory Transfer Domain Service
 *
 * アイテム移動の複雑なドメインロジックを担当するサービス。
 * 複数のインベントリ間でのアイテム転送、移動制約の適用、
 * 転送最適化などの高度なビジネスロジックを提供します。
 */

import { Context, Effect, Schema } from 'effect'
import { InventorySchema } from '../../inventory-types'
import type { Inventory, InventoryErrorReason, ItemId } from '../../types'

// =============================================================================
// Transfer Service Types
// =============================================================================

/**
 * アイテム転送リクエスト
 */
export interface TransferRequest {
  readonly sourceInventory: Inventory
  readonly targetInventory: Inventory
  readonly sourceSlot: number
  readonly targetSlot: number | 'auto' // 'auto'は空いているスロットを自動選択
  readonly itemCount?: number // 指定がなければスタック全体を移動
}

/**
 * アイテム転送結果
 */
export interface TransferResult {
  readonly success: boolean
  readonly sourceInventory: Inventory
  readonly targetInventory: Inventory
  readonly transferredCount: number
  readonly remainingCount: number
  readonly targetSlot: number
  readonly message?: string
}

/**
 * バッチ転送リクエスト
 */
export interface BatchTransferRequest {
  readonly transfers: ReadonlyArray<Omit<TransferRequest, 'sourceInventory' | 'targetInventory'>>
  readonly sourceInventory: Inventory
  readonly targetInventory: Inventory
}

/**
 * 転送可能性の詳細情報
 */
export interface TransferabilityDetails {
  readonly canTransfer: boolean
  readonly reason?: InventoryErrorReason
  readonly maxTransferableCount: number
  readonly recommendedTargetSlot?: number
  readonly constraints: ReadonlyArray<TransferConstraint>
}

/**
 * 転送制約の種類
 */
export interface TransferConstraint {
  readonly type: 'slot_occupied' | 'incompatible_items' | 'stack_limit' | 'item_specific'
  readonly message: string
  readonly affectedSlots: ReadonlyArray<number>
}

/**
 * 最適化転送オプション
 */
export interface OptimizedTransferOptions {
  readonly consolidateStacks: boolean // 同じアイテムのスタックを統合
  readonly fillPartialStacks: boolean // 部分的なスタックを優先的に満たす
  readonly preserveOrder: boolean // アイテムの順序を保持
  readonly respectItemCategories: boolean // アイテムカテゴリを考慮
}

// =============================================================================
// Domain Errors
// =============================================================================

export const TransferErrorSchema = Schema.TaggedStruct('TransferError', {
  reason: Schema.String,
  details: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Transfer Error',
    description: 'Error when item transfer operation fails',
  })
)
export type TransferError = Schema.Schema.Type<typeof TransferErrorSchema>

/**
 * TransferErrorのメッセージを取得する操作関数
 */
export const getTransferErrorMessage = (error: TransferError): string =>
  error.details ? `${error.reason}: ${error.details}` : error.reason

/**
 * TransferErrorを作成するFactory関数
 */
export const createTransferError = (
  reason: InventoryErrorReason,
  details?: string
): Effect.Effect<TransferError, Schema.ParseError> =>
  Schema.decode(TransferErrorSchema)({
    _tag: 'TransferError' as const,
    reason,
    details,
  })

/**
 * 型ガード関数
 */
export const isTransferError = (error: unknown): error is TransferError => Schema.is(TransferErrorSchema)(error)

export const BatchTransferErrorSchema = Schema.TaggedStruct('BatchTransferError', {
  failedTransfers: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      error: Schema.suspend(() => TransferErrorSchema),
    })
  ),
  partialResults: Schema.Array(
    Schema.Struct({
      success: Schema.Boolean,
      sourceInventory: InventorySchema,
      targetInventory: InventorySchema,
      transferredCount: Schema.Number,
      remainingCount: Schema.Number,
      targetSlot: Schema.Number,
      message: Schema.optional(Schema.String),
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Batch Transfer Error',
    description: 'Error when batch transfer fails with partial results',
  })
)
export type BatchTransferError = Schema.Schema.Type<typeof BatchTransferErrorSchema>

/**
 * BatchTransferErrorのメッセージを取得する操作関数
 */
export const getBatchTransferErrorMessage = (error: BatchTransferError): string =>
  `Batch transfer failed with ${error.failedTransfers.length} failed transfers`

/**
 * BatchTransferErrorを作成するFactory関数
 */
export const createBatchTransferError = (
  failedTransfers: ReadonlyArray<{
    index: number
    error: TransferError
  }>,
  partialResults: ReadonlyArray<TransferResult>
): Effect.Effect<BatchTransferError, Schema.ParseError> =>
  Schema.decode(BatchTransferErrorSchema)({
    _tag: 'BatchTransferError' as const,
    failedTransfers,
    partialResults,
  })

/**
 * 型ガード関数
 */
export const isBatchTransferError = (error: unknown): error is BatchTransferError =>
  Schema.is(BatchTransferErrorSchema)(error)

// =============================================================================
// Transfer Service Interface
// =============================================================================

/**
 * アイテム転送ドメインサービス
 *
 * 複数のインベントリ間でのアイテム転送に関する複雑なビジネスロジックを提供。
 * DDD原則に従い、純粋なドメインロジックのみを含み、技術的詳細は排除。
 *
 * 責務:
 * - 単一・バッチアイテム転送の実行
 * - 転送可能性の事前チェック
 * - 転送制約の適用と検証
 * - 最適化された転送戦略の提供
 * - スタック統合と分割の管理
 *
 * 設計原則:
 * - 不変性の保持（元のインベントリを変更せず新しいインスタンスを返す）
 * - 副作用の排除（純粋関数として実装）
 * - 責任の明確化（転送ロジックのみに集中）
 * - 拡張性の確保（新しい転送パターンに対応可能）
 */
export interface TransferService {
  /**
   * 単一アイテムの転送実行
   *
   * 指定されたスロット間でアイテムを移動する。
   * 移動制約を適用し、最適な転送方法を選択する。
   *
   * @param request - 転送リクエスト
   * @returns 転送結果（成功時は更新されたインベントリを含む）
   *
   * @example
   * ```typescript
   * const result = yield* transferService.transferItem({
   *   sourceInventory: playerInventory,
   *   targetInventory: chestInventory,
   *   sourceSlot: 0,
   *   targetSlot: 'auto',
   *   itemCount: 32
   * })
   *
   * yield* pipe(
   *   Match.value(result.success),
   *   Match.when(true, () => Effect.sync(() =>
   *     console.log(`${result.transferredCount}個のアイテムを転送完了`)
   *   )),
   *   Match.when(false, () => Effect.fail(
   *     new TransferError('TRANSFER_FAILED', result.message)
   *   )),
   *   Match.exhaustive
   * )
   * ```
   */
  readonly transferItem: (request: TransferRequest) => Effect.Effect<TransferResult, TransferError>

  /**
   * バッチアイテム転送の実行
   *
   * 複数のアイテム転送を一度に実行する。
   * 依存関係を考慮し、最適な順序で転送を行う。
   *
   * @param request - バッチ転送リクエスト
   * @returns 全転送結果の配列
   *
   * @example
   * ```typescript
   * const results = yield* transferService.batchTransferItems({
   *   sourceInventory: playerInventory,
   *   targetInventory: chestInventory,
   *   transfers: [
   *     { sourceSlot: 0, targetSlot: 'auto' },
   *     { sourceSlot: 1, targetSlot: 'auto', itemCount: 16 }
   *   ]
   * })
   * ```
   */
  readonly batchTransferItems: (
    request: BatchTransferRequest
  ) => Effect.Effect<ReadonlyArray<TransferResult>, BatchTransferError>

  /**
   * 転送可能性の事前チェック
   *
   * アイテム転送が可能かどうかを事前に検証し、
   * 制約や推奨事項を含む詳細情報を返す。
   *
   * @param request - 転送リクエスト
   * @returns 転送可能性の詳細情報
   *
   * @example
   * ```typescript
   * const details = yield* transferService.checkTransferability({
   *   sourceInventory: inventory1,
   *   targetInventory: inventory2,
   *   sourceSlot: 5,
   *   targetSlot: 'auto'
   * })
   *
   * if (!details.canTransfer) {
   *   yield* Effect.log(`転送不可: ${details.reason}`)
   * }
   * ```
   */
  readonly checkTransferability: (request: TransferRequest) => Effect.Effect<TransferabilityDetails, never>

  /**
   * 最適化された転送戦略の提案
   *
   * 指定された条件に基づいて、最も効率的な転送方法を提案する。
   * スタック統合、部分転送、カテゴリ別整理などを考慮。
   *
   * @param sourceInventory - 転送元インベントリ
   * @param targetInventory - 転送先インベントリ
   * @param options - 最適化オプション
   * @returns 推奨転送リクエストの配列
   *
   * @example
   * ```typescript
   * const strategy = yield* transferService.generateOptimizedTransferStrategy(
   *   playerInventory,
   *   chestInventory,
   *   {
   *     consolidateStacks: true,
   *     fillPartialStacks: true,
   *     preserveOrder: false,
   *     respectItemCategories: true
   *   }
   * )
   * ```
   */
  readonly generateOptimizedTransferStrategy: (
    sourceInventory: Inventory,
    targetInventory: Inventory,
    options: OptimizedTransferOptions
  ) => Effect.Effect<ReadonlyArray<TransferRequest>, never>

  /**
   * スタック統合転送
   *
   * 同じアイテムIDを持つアイテムスタックを自動的に統合する。
   * ソート、統合、最適配置を一度に実行。
   *
   * @param sourceInventory - 転送元インベントリ
   * @param targetInventory - 転送先インベントリ
   * @param itemId - 統合対象のアイテムID（未指定時は全アイテム）
   * @returns 統合後の両インベントリ
   *
   * @example
   * ```typescript
   * const result = yield* transferService.consolidateStacks(
   *   playerInventory,
   *   chestInventory,
   *   'minecraft:cobblestone'
   * )
   * ```
   */
  readonly consolidateStacks: (
    sourceInventory: Inventory,
    targetInventory: Inventory,
    itemId?: ItemId
  ) => Effect.Effect<
    {
      readonly sourceInventory: Inventory
      readonly targetInventory: Inventory
      readonly consolidatedStacks: number
    },
    TransferError
  >

  /**
   * 智的アイテム分散
   *
   * アイテムを複数のインベントリに効率的に分散配置する。
   * カテゴリ、使用頻度、アクセス性を考慮した最適配置。
   *
   * @param sourceInventory - 分散元インベントリ
   * @param targetInventories - 分散先インベントリの配列
   * @param distributionRules - 分散ルール設定
   * @returns 分散結果
   *
   * @example
   * ```typescript
   * const result = yield* transferService.distributeItemsIntelligently(
   *   playerInventory,
   *   [chestInventory, shulkerBoxInventory],
   *   { preferEmptySlots: true, groupSimilarItems: true }
   * )
   * ```
   */
  readonly distributeItemsIntelligently: (
    sourceInventory: Inventory,
    targetInventories: ReadonlyArray<Inventory>,
    distributionRules: {
      readonly preferEmptySlots: boolean
      readonly groupSimilarItems: boolean
      readonly respectCapacity: boolean
      readonly priorityOrder?: ReadonlyArray<number> // インベントリの優先順位
    }
  ) => Effect.Effect<
    {
      readonly sourceInventory: Inventory
      readonly targetInventories: ReadonlyArray<Inventory>
      readonly distributionSummary: ReadonlyArray<{
        readonly inventoryIndex: number
        readonly itemsReceived: number
        readonly slotsUsed: number
      }>
    },
    TransferError
  >

  /**
   * 転送パフォーマンス統計
   *
   * 転送操作のパフォーマンス統計を取得する。
   * デバッグ、最適化、監視目的で使用。
   *
   * @returns パフォーマンス統計情報
   */
  readonly getTransferPerformanceStats: () => Effect.Effect<
    {
      readonly totalTransfers: number
      readonly successfulTransfers: number
      readonly failedTransfers: number
      readonly averageTransferTime: number
      readonly itemsTransferredPerSecond: number
      readonly mostFrequentErrorReason: InventoryErrorReason | null
    },
    never
  >
}

// =============================================================================
// Service Tag Definition
// =============================================================================

/**
 * TransferService用のContextタグ
 *
 * Effect-TSの依存注入システムで使用される。
 * Layer.provideで実装を注入し、Effect.genで取得する。
 *
 * @example
 * ```typescript
 * // サービスの使用
 * const result = yield* TransferService.transferItem(request)
 *
 * // レイヤーでの提供
 * const TransferServiceLive = Layer.effect(
 *   TransferService,
 *   Effect.gen(function* () {
 *     // 実装を返す
 *     return new TransferServiceImpl()
 *   })
 * )
 * ```
 */
export const TransferService = Context.GenericTag<TransferService>('@minecraft/domain/inventory/TransferService')

// =============================================================================
// Type Exports
// =============================================================================

export type {
  BatchTransferRequest,
  OptimizedTransferOptions,
  TransferabilityDetails,
  TransferConstraint,
  TransferRequest,
  TransferResult,
}
