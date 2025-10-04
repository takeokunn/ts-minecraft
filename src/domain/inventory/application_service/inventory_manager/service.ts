/**
 * Inventory Manager Application Service
 *
 * DDD Application層 - インベントリ管理の統合サービス
 * CQRSパターンによるコマンド・クエリ完全分離
 * Effect-TSによる関数型プログラミング実装
 */

import { Context, Effect, pipe } from 'effect'
import type { InventoryCommand, InventoryQuery } from '../../types/commands'
import type { QueryResult } from '../../types/queries'
import type { InventoryId, PlayerId } from '../../types/core'
import type { Inventory } from '../../aggregate/inventory/types'
import type { ItemStack } from '../../aggregate/item_stack/types'
import type { InventoryApplicationError } from '../types/errors'

/**
 * インベントリ管理アプリケーションサービス
 *
 * @description
 * インベントリの統合管理を担うアプリケーションサービス。
 * CQRSパターンに基づき、コマンド処理とクエリ処理を分離。
 * 複数のドメインサービスを協調させてユースケースを実現。
 */
export interface InventoryManagerApplicationService {
  /**
   * インベントリコマンドを実行します
   *
   * @param command - 実行するコマンド
   * @returns コマンド実行結果
   */
  readonly executeCommand: (
    command: InventoryCommand
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリクエリを実行します
   *
   * @param query - 実行するクエリ
   * @returns クエリ実行結果
   */
  readonly executeQuery: <TResult>(
    query: InventoryQuery
  ) => Effect.Effect<QueryResult<TResult>, InventoryApplicationError>

  /**
   * プレイヤーのインベントリを初期化します
   *
   * @param playerId - プレイヤーID
   * @param inventoryType - インベントリタイプ
   * @returns 作成されたインベントリID
   */
  readonly initializePlayerInventory: (
    playerId: PlayerId,
    inventoryType: string
  ) => Effect.Effect<InventoryId, InventoryApplicationError>

  /**
   * アイテムをインベントリに追加します
   *
   * @param inventoryId - インベントリID
   * @param itemStack - 追加するアイテムスタック
   * @param slotIndex - 配置先スロットインデックス（オプション）
   * @returns 追加処理の結果
   */
  readonly addItem: (
    inventoryId: InventoryId,
    itemStack: ItemStack,
    slotIndex?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリからアイテムを削除します
   *
   * @param inventoryId - インベントリID
   * @param slotIndex - 削除元スロットインデックス
   * @param quantity - 削除数量（オプション、省略時は全削除）
   * @returns 削除処理の結果
   */
  readonly removeItem: (
    inventoryId: InventoryId,
    slotIndex: number,
    quantity?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリ内でアイテムを移動します
   *
   * @param inventoryId - インベントリID
   * @param fromSlot - 移動元スロットインデックス
   * @param toSlot - 移動先スロットインデックス
   * @param quantity - 移動数量（オプション）
   * @returns 移動処理の結果
   */
  readonly moveItem: (
    inventoryId: InventoryId,
    fromSlot: number,
    toSlot: number,
    quantity?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリ間でアイテムを転送します
   *
   * @param sourceInventoryId - 転送元インベントリID
   * @param targetInventoryId - 転送先インベントリID
   * @param sourceSlot - 転送元スロットインデックス
   * @param targetSlot - 転送先スロットインデックス（オプション）
   * @param quantity - 転送数量（オプション）
   * @returns 転送処理の結果
   */
  readonly transferItem: (
    sourceInventoryId: InventoryId,
    targetInventoryId: InventoryId,
    sourceSlot: number,
    targetSlot?: number,
    quantity?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリを取得します
   *
   * @param inventoryId - インベントリID
   * @returns インベントリ
   */
  readonly getInventory: (
    inventoryId: InventoryId
  ) => Effect.Effect<Inventory, InventoryApplicationError>

  /**
   * プレイヤーのインベントリを取得します
   *
   * @param playerId - プレイヤーID
   * @returns プレイヤーのインベントリ
   */
  readonly getPlayerInventory: (
    playerId: PlayerId
  ) => Effect.Effect<Inventory, InventoryApplicationError>

  /**
   * インベントリ内のアイテム数をカウントします
   *
   * @param inventoryId - インベントリID
   * @param itemId - アイテムID（オプション、省略時は全アイテム）
   * @returns アイテム数
   */
  readonly countItems: (
    inventoryId: InventoryId,
    itemId?: string
  ) => Effect.Effect<number, InventoryApplicationError>

  /**
   * インベントリ内のアイテムを検索します
   *
   * @param inventoryId - インベントリID
   * @param filter - 検索フィルター
   * @returns 検索結果のアイテムスタック配列
   */
  readonly findItems: (
    inventoryId: InventoryId,
    filter: {
      readonly itemId?: string
      readonly minQuantity?: number
      readonly maxQuantity?: number
      readonly hasMetadata?: boolean
    }
  ) => Effect.Effect<ReadonlyArray<{
    readonly slotIndex: number
    readonly itemStack: ItemStack
  }>, InventoryApplicationError>

  /**
   * インベントリ内の空きスロットを検索します
   *
   * @param inventoryId - インベントリID
   * @param requiredCount - 必要な空きスロット数（オプション）
   * @returns 空きスロットインデックス配列
   */
  readonly findEmptySlots: (
    inventoryId: InventoryId,
    requiredCount?: number
  ) => Effect.Effect<ReadonlyArray<number>, InventoryApplicationError>

  /**
   * インベントリの統計情報を取得します
   *
   * @param inventoryId - インベントリID
   * @returns インベントリ統計
   */
  readonly getInventoryStats: (
    inventoryId: InventoryId
  ) => Effect.Effect<{
    readonly totalSlots: number
    readonly usedSlots: number
    readonly emptySlots: number
    readonly totalItems: number
    readonly uniqueItemTypes: number
    readonly utilizationPercentage: number
  }, InventoryApplicationError>

  /**
   * 複数のインベントリ操作をバッチ処理します
   *
   * @param commands - 実行するコマンド配列
   * @returns バッチ処理結果
   */
  readonly batchExecuteCommands: (
    commands: ReadonlyArray<InventoryCommand>
  ) => Effect.Effect<ReadonlyArray<void>, InventoryApplicationError>

  /**
   * インベントリの整合性を検証します
   *
   * @param inventoryId - インベントリID
   * @returns 検証結果
   */
  readonly verifyIntegrity: (
    inventoryId: InventoryId
  ) => Effect.Effect<{
    readonly isValid: boolean
    readonly errors: ReadonlyArray<string>
    readonly warnings: ReadonlyArray<string>
  }, InventoryApplicationError>

  /**
   * インベントリをロックします
   *
   * @param inventoryId - インベントリID
   * @param reason - ロック理由
   * @returns ロック処理の結果
   */
  readonly lockInventory: (
    inventoryId: InventoryId,
    reason: string
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリのロックを解除します
   *
   * @param inventoryId - インベントリID
   * @returns アンロック処理の結果
   */
  readonly unlockInventory: (
    inventoryId: InventoryId
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * インベントリを同期します
   *
   * @param inventoryId - インベントリID
   * @returns 同期処理の結果
   */
  readonly syncInventory: (
    inventoryId: InventoryId
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * パフォーマンス最適化を実行します
   *
   * @param targetMetrics - 目標パフォーマンス指標
   * @returns 最適化結果
   */
  readonly optimizePerformance: (
    targetMetrics: {
      readonly maxCommandExecutionTime: number
      readonly maxQueryExecutionTime: number
      readonly maxMemoryUsage: number
    }
  ) => Effect.Effect<{
    readonly optimizationsApplied: ReadonlyArray<string>
    readonly performanceImprovement: number
  }, InventoryApplicationError>

  /**
   * デバッグ情報を取得します
   *
   * @param inventoryId - インベントリID
   * @returns デバッグ情報
   */
  readonly getDebugInfo: (
    inventoryId: InventoryId
  ) => Effect.Effect<{
    readonly inventoryState: Inventory
    readonly recentCommands: ReadonlyArray<InventoryCommand>
    readonly recentQueries: ReadonlyArray<InventoryQuery>
    readonly performanceMetrics: {
      readonly averageCommandTime: number
      readonly averageQueryTime: number
      readonly memoryUsage: number
    }
  }, InventoryApplicationError>
}

/**
 * InventoryManagerApplicationService Context Tag
 *
 * Effect-TSの依存性注入システムで使用するタグ
 */
export const InventoryManagerApplicationService = Context.GenericTag<InventoryManagerApplicationService>(
  '@minecraft/domain/inventory/InventoryManagerApplicationService'
)

// Legacy alias for compatibility with application layer imports
export type InventoryManagerService = InventoryManagerApplicationService
export const InventoryManagerService = InventoryManagerApplicationService
