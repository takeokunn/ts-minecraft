/**
 * Transaction Manager Application Service
 *
 * DDD Application層 - トランザクション管理の専門サービス
 * 複数集約にまたがる複雑な操作と分散トランザクション管理
 */

import type { ItemStack } from '@/domain/inventory/aggregate/item_stack'
import type { InventoryId, ItemId, PlayerId } from '@/domain/inventory/types'
import { Context, Effect } from 'effect'
import type { InventoryApplicationError } from '../types'

/**
 * トランザクション管理アプリケーションサービス
 *
 * @description
 * 複数のインベントリやコンテナにまたがる複雑な操作を管理。
 * ACIDプロパティを保証し、失敗時のロールバック機能を提供。
 */
export interface TransactionManagerApplicationService {
  /**
   * 複数インベントリ間でのアトミックな転送を実行します
   *
   * @param transfers - 転送操作の配列
   * @param transactionId - トランザクションID（オプション）
   * @returns トランザクション実行結果
   */
  readonly executeAtomicTransfers: (
    transfers: ReadonlyArray<{
      readonly sourceInventoryId: InventoryId
      readonly targetInventoryId: InventoryId
      readonly sourceSlot: number
      readonly targetSlot?: number
      readonly itemId: ItemId
      readonly quantity: number
    }>,
    transactionId?: string
  ) => Effect.Effect<
    {
      readonly transactionId: string
      readonly completedTransfers: number
      readonly totalTransfers: number
    },
    InventoryApplicationError
  >

  /**
   * クラフティング操作を実行します（材料消費 + 結果生成）
   *
   * @param craftingOperation - クラフティング操作
   * @returns クラフティング結果
   */
  readonly executeCraftingTransaction: (craftingOperation: {
    readonly playerId: PlayerId
    readonly inventoryId: InventoryId
    readonly recipeId: string
    readonly materials: ReadonlyArray<{
      readonly itemId: ItemId
      readonly quantity: number
      readonly slotIndex?: number
    }>
    readonly resultItem: ItemStack
    readonly resultSlot?: number
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly consumedMaterials: ReadonlyArray<{
        readonly itemId: ItemId
        readonly quantity: number
        readonly slotIndex: number
      }>
      readonly producedItem: ItemStack
      readonly resultSlot: number
    },
    InventoryApplicationError
  >

  /**
   * 取引（プレイヤー間交換）を実行します
   *
   * @param tradeOperation - 取引操作
   * @returns 取引結果
   */
  readonly executeTradeTransaction: (tradeOperation: {
    readonly tradeId: string
    readonly player1Id: PlayerId
    readonly player2Id: PlayerId
    readonly player1Offers: ReadonlyArray<{
      readonly inventoryId: InventoryId
      readonly slotIndex: number
      readonly itemStack: ItemStack
    }>
    readonly player2Offers: ReadonlyArray<{
      readonly inventoryId: InventoryId
      readonly slotIndex: number
      readonly itemStack: ItemStack
    }>
    readonly acceptedByPlayer1: boolean
    readonly acceptedByPlayer2: boolean
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly tradeCompleted: boolean
      readonly player1Received: ReadonlyArray<ItemStack>
      readonly player2Received: ReadonlyArray<ItemStack>
    },
    InventoryApplicationError
  >

  /**
   * 一括アイテム分散を実行します
   *
   * @param distributionOperation - 分散操作
   * @returns 分散結果
   */
  readonly executeBulkDistribution: (distributionOperation: {
    readonly sourceInventoryId: InventoryId
    readonly targetInventories: ReadonlyArray<InventoryId>
    readonly itemsToDistribute: ReadonlyArray<{
      readonly itemId: ItemId
      readonly totalQuantity: number
      readonly distributionStrategy: 'equal' | 'priority' | 'capacity'
    }>
    readonly distributionRules?: {
      readonly maxItemsPerInventory?: number
      readonly priorityOrder?: ReadonlyArray<InventoryId>
      readonly reserveCapacity?: number
    }
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly distributionResults: ReadonlyArray<{
        readonly inventoryId: InventoryId
        readonly receivedItems: ReadonlyArray<{
          readonly itemId: ItemId
          readonly quantity: number
          readonly slotIndex: number
        }>
      }>
      readonly remainingItems: ReadonlyArray<{
        readonly itemId: ItemId
        readonly quantity: number
      }>
    },
    InventoryApplicationError
  >

  /**
   * インベントリ統合を実行します
   *
   * @param mergeOperation - 統合操作
   * @returns 統合結果
   */
  readonly executeInventoryMerge: (mergeOperation: {
    readonly sourceInventories: ReadonlyArray<InventoryId>
    readonly targetInventoryId: InventoryId
    readonly mergeStrategy: 'stack_similar' | 'preserve_order' | 'sort_by_type'
    readonly conflictResolution: 'overwrite' | 'skip' | 'create_overflow'
    readonly playerId: PlayerId
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly mergedItems: ReadonlyArray<{
        readonly sourceInventoryId: InventoryId
        readonly sourceSlot: number
        readonly targetSlot: number
        readonly itemStack: ItemStack
      }>
      readonly overflowItems: ReadonlyArray<ItemStack>
      readonly conflictItems: ReadonlyArray<ItemStack>
    },
    InventoryApplicationError
  >

  /**
   * 自動補充トランザクションを実行します
   *
   * @param refillOperation - 補充操作
   * @returns 補充結果
   */
  readonly executeAutoRefill: (refillOperation: {
    readonly targetInventoryId: InventoryId
    readonly sourceInventories: ReadonlyArray<InventoryId>
    readonly refillRules: ReadonlyArray<{
      readonly itemId: ItemId
      readonly minQuantity: number
      readonly maxQuantity: number
      readonly priority: number
    }>
    readonly playerId: PlayerId
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly refillResults: ReadonlyArray<{
        readonly itemId: ItemId
        readonly requestedQuantity: number
        readonly actualQuantity: number
        readonly sourceInventoryId: InventoryId
        readonly targetSlot: number
      }>
      readonly unfulfilledRequests: ReadonlyArray<{
        readonly itemId: ItemId
        readonly missingQuantity: number
      }>
    },
    InventoryApplicationError
  >

  /**
   * トランザクションの状態を取得します
   *
   * @param transactionId - トランザクションID
   * @returns トランザクション状態
   */
  readonly getTransactionStatus: (transactionId: string) => Effect.Effect<
    {
      readonly transactionId: string
      readonly status: 'pending' | 'committed' | 'failed' | 'rolled_back'
      readonly startTime: Date
      readonly endTime?: Date
      readonly operations: ReadonlyArray<{
        readonly operationType: string
        readonly operationId: string
        readonly status: 'pending' | 'completed' | 'failed'
        readonly details: unknown
      }>
      readonly rollbackReason?: string
    },
    InventoryApplicationError
  >

  /**
   * トランザクションをロールバックします
   *
   * @param transactionId - トランザクションID
   * @param reason - ロールバック理由
   * @returns ロールバック結果
   */
  readonly rollbackTransaction: (
    transactionId: string,
    reason: string
  ) => Effect.Effect<
    {
      readonly transactionId: string
      readonly rollbackCompleted: boolean
      readonly restoredOperations: ReadonlyArray<{
        readonly operationType: string
        readonly operationId: string
        readonly restored: boolean
      }>
      readonly rollbackErrors: ReadonlyArray<string>
    },
    InventoryApplicationError
  >

  /**
   * デッドロック検出と解決を実行します
   *
   * @returns デッドロック解決結果
   */
  readonly detectAndResolveDeadlocks: () => Effect.Effect<
    {
      readonly deadlocksDetected: number
      readonly deadlocksResolved: number
      readonly affectedTransactions: ReadonlyArray<string>
      readonly resolutionStrategy: string
    },
    InventoryApplicationError
  >

  /**
   * トランザクション統計を取得します
   *
   * @param timeRange - 時間範囲（オプション）
   * @returns 統計情報
   */
  readonly getTransactionStatistics: (timeRange?: {
    readonly startTime: Date
    readonly endTime: Date
  }) => Effect.Effect<
    {
      readonly totalTransactions: number
      readonly successfulTransactions: number
      readonly failedTransactions: number
      readonly rolledBackTransactions: number
      readonly averageTransactionTime: number
      readonly deadlockCount: number
      readonly performanceMetrics: {
        readonly throughputPerSecond: number
        readonly averageLatency: number
        readonly p95Latency: number
        readonly p99Latency: number
      }
    },
    InventoryApplicationError
  >

  /**
   * 長時間実行トランザクションの監視とタイムアウト処理
   *
   * @param timeoutThreshold - タイムアウト閾値（ミリ秒）
   * @returns タイムアウト処理結果
   */
  readonly handleTransactionTimeouts: (timeoutThreshold: number) => Effect.Effect<
    {
      readonly timedOutTransactions: ReadonlyArray<string>
      readonly automaticallyRolledBack: ReadonlyArray<string>
      readonly manualInterventionRequired: ReadonlyArray<string>
    },
    InventoryApplicationError
  >

  /**
   * トランザクションログの圧縮とアーカイブ
   *
   * @param archiveThreshold - アーカイブ閾値（日数）
   * @returns アーカイブ結果
   */
  readonly archiveTransactionLogs: (archiveThreshold: number) => Effect.Effect<
    {
      readonly archivedTransactions: number
      readonly compressedLogSize: number
      readonly archiveLocation: string
      readonly compressionRatio: number
    },
    InventoryApplicationError
  >

  /**
   * 分散トランザクション用の2フェーズコミット実行
   *
   * @param distributedOperation - 分散操作
   * @returns 分散トランザクション結果
   */
  readonly executeDistributedTransaction: (distributedOperation: {
    readonly coordinatorNode: string
    readonly participantNodes: ReadonlyArray<string>
    readonly operations: ReadonlyArray<{
      readonly nodeId: string
      readonly operationType: string
      readonly operationData: unknown
    }>
    readonly timeoutMs: number
  }) => Effect.Effect<
    {
      readonly transactionId: string
      readonly phase1Results: ReadonlyArray<{
        readonly nodeId: string
        readonly prepared: boolean
        readonly error?: string
      }>
      readonly phase2Results: ReadonlyArray<{
        readonly nodeId: string
        readonly committed: boolean
        readonly error?: string
      }>
      readonly overallResult: 'committed' | 'aborted'
    },
    InventoryApplicationError
  >

  /**
   * トランザクション優先度管理とリソース競合解決
   *
   * @param priorityConfig - 優先度設定
   * @returns 優先度管理結果
   */
  readonly managePriorities: (priorityConfig: {
    readonly highPriorityPlayers: ReadonlyArray<PlayerId>
    readonly resourceLockTimeout: number
    readonly priorityBoostFactor: number
  }) => Effect.Effect<
    {
      readonly activeTransactions: number
      readonly priorityAdjustments: number
      readonly resourceContentions: number
      readonly averageWaitTime: number
    },
    InventoryApplicationError
  >

  /**
   * デバッグ用のトランザクション詳細情報取得
   *
   * @param transactionId - トランザクションID
   * @returns デバッグ情報
   */
  readonly getTransactionDebugInfo: (transactionId: string) => Effect.Effect<
    {
      readonly transactionState: unknown
      readonly lockHierarchy: ReadonlyArray<{
        readonly resourceId: string
        readonly lockType: 'read' | 'write'
        readonly acquiredAt: Date
        readonly holdingTransaction: string
      }>
      readonly dependencyGraph: ReadonlyArray<{
        readonly fromTransaction: string
        readonly toTransaction: string
        readonly waitingFor: string
      }>
      readonly performanceProfile: {
        readonly cpuTime: number
        readonly memoryUsage: number
        readonly networkCalls: number
        readonly diskOperations: number
      }
    },
    InventoryApplicationError
  >
}

/**
 * TransactionManagerApplicationService Context Tag
 */
export const TransactionManagerApplicationService = Context.GenericTag<TransactionManagerApplicationService>(
  '@minecraft/domain/inventory/TransactionManagerApplicationService'
)
