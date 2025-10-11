/**
 * Container Manager Application Service
 *
 * DDD Application層 - コンテナ管理の専門サービス
 * チェスト、樽、エンダーチェスト等の管理に特化
 */

import type { ContainerAggregate, ContainerId } from '@/domain/inventory/aggregate/container'
import type { ItemId, ItemStack, PlayerId } from '@/domain/inventory/types'
import type { JsonValue } from '@shared/schema/json'
import { Context, Effect } from 'effect'
import type { InventoryApplicationError } from '../types'

export type ContainerAccessLevel = 'read' | 'write' | 'admin'

export interface ContainerPermissions {
  readonly publicAccess: boolean
  readonly allowedPlayers: ReadonlyArray<PlayerId>
  readonly accessLevel: ContainerAccessLevel
}

export interface ContainerOperationLog {
  readonly timestamp: Date
  readonly playerId: PlayerId
  readonly action: 'open' | 'close' | 'store' | 'retrieve' | 'transfer'
  readonly itemId?: ItemId
  readonly quantity?: number
  readonly details: string
}

export type ContainerBatchOperation = {
  readonly type: 'store' | 'retrieve' | 'transfer'
  readonly containerId: ContainerId
  readonly itemStack?: ItemStack
  readonly slotIndex?: number
  readonly targetContainerId?: ContainerId
  readonly quantity?: number
}

export type BatchOperationResult = {
  readonly success: boolean
  readonly operation: ContainerBatchOperation
  readonly error?: string
}

export type ContainerLockStatus =
  | { readonly type: 'unlocked'; readonly isLocked: false }
  | {
      readonly type: 'password' | 'key' | 'biometric'
      readonly isLocked: true
      readonly metadata?: JsonValue
    }

export interface ContainerDebugInfo {
  readonly containerState: ContainerAggregate
  readonly permissions: ContainerPermissions
  readonly lockStatus: ContainerLockStatus
  readonly recentOperations: ReadonlyArray<ContainerOperationLog>
  readonly performanceMetrics: {
    readonly averageOperationTime: number
    readonly totalOperations: number
    readonly errorRate: number
  }
}

/**
 * コンテナ管理アプリケーションサービス
 *
 * @description
 * コンテナ（チェスト、樽、エンダーチェスト等）の管理に特化したサービス。
 * アクセス制御、共有機能、分類機能を提供。
 */
export interface ContainerManagerApplicationService {
  /**
   * コンテナを作成します
   *
   * @param containerType - コンテナタイプ（chest, barrel, ender_chest等）
   * @param ownerId - 所有者プレイヤーID
   * @param position - 配置座標
   * @param size - コンテナサイズ
   * @returns 作成されたコンテナID
   */
  readonly createContainer: (
    containerType: string,
    ownerId: PlayerId,
    position: { readonly x: number; readonly y: number; readonly z: number },
    size: number
  ) => Effect.Effect<ContainerId, InventoryApplicationError>

  /**
   * コンテナを削除します
   *
   * @param containerId - コンテナID
   * @param playerId - 実行者プレイヤーID（権限チェック用）
   * @returns 削除処理の結果
   */
  readonly deleteContainer: (
    containerId: ContainerId,
    playerId: PlayerId
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナを開きます（アクセス制御を含む）
   *
   * @param containerId - コンテナID
   * @param playerId - アクセス者プレイヤーID
   * @returns コンテナ情報
   */
  readonly openContainer: (
    containerId: ContainerId,
    playerId: PlayerId
  ) => Effect.Effect<ContainerAggregate, InventoryApplicationError>

  /**
   * コンテナを閉じます
   *
   * @param containerId - コンテナID
   * @param playerId - プレイヤーID
   * @returns 閉じる処理の結果
   */
  readonly closeContainer: (
    containerId: ContainerId,
    playerId: PlayerId
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナにアイテムを格納します
   *
   * @param containerId - コンテナID
   * @param itemStack - 格納するアイテムスタック
   * @param playerId - 実行者プレイヤーID
   * @param slotIndex - 格納先スロット（オプション）
   * @returns 格納処理の結果
   */
  readonly storeItem: (
    containerId: ContainerId,
    itemStack: ItemStack,
    playerId: PlayerId,
    slotIndex?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナからアイテムを取り出します
   *
   * @param containerId - コンテナID
   * @param slotIndex - 取り出し元スロット
   * @param quantity - 取り出し数量（オプション）
   * @param playerId - 実行者プレイヤーID
   * @returns 取り出したアイテムスタック
   */
  readonly retrieveItem: (
    containerId: ContainerId,
    slotIndex: number,
    quantity: number | undefined,
    playerId: PlayerId
  ) => Effect.Effect<ItemStack, InventoryApplicationError>

  /**
   * コンテナ間でアイテムを転送します
   *
   * @param sourceContainerId - 転送元コンテナID
   * @param targetContainerId - 転送先コンテナID
   * @param sourceSlot - 転送元スロット
   * @param targetSlot - 転送先スロット（オプション）
   * @param quantity - 転送数量（オプション）
   * @param playerId - 実行者プレイヤーID
   * @returns 転送処理の結果
   */
  readonly transferBetweenContainers: (
    sourceContainerId: ContainerId,
    targetContainerId: ContainerId,
    sourceSlot: number,
    targetSlot: number | undefined,
    quantity: number | undefined,
    playerId: PlayerId
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナへのアクセス権限を設定します
   *
   * @param containerId - コンテナID
   * @param ownerId - 所有者プレイヤーID
   * @param permissions - 権限設定
   * @returns 権限設定処理の結果
   */
  readonly setPermissions: (
    containerId: ContainerId,
    ownerId: PlayerId,
    permissions: ContainerPermissions
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナのアクセス権限をチェックします
   *
   * @param containerId - コンテナID
   * @param playerId - チェック対象プレイヤーID
   * @param action - 実行したいアクション
   * @returns アクセス可能かどうか
   */
  readonly checkPermission: (
    containerId: ContainerId,
    playerId: PlayerId,
    action: 'read' | 'write' | 'admin'
  ) => Effect.Effect<boolean, InventoryApplicationError>

  /**
   * コンテナ内のアイテムを分類・整理します
   *
   * @param containerId - コンテナID
   * @param playerId - 実行者プレイヤーID
   * @param sortStrategy - ソート戦略
   * @returns 整理処理の結果
   */
  readonly organizeContainer: (
    containerId: ContainerId,
    playerId: PlayerId,
    sortStrategy: 'type' | 'quantity' | 'rarity' | 'alphabetical'
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナ内の特定アイテムを検索します
   *
   * @param containerId - コンテナID
   * @param itemId - 検索するアイテムID
   * @param playerId - 実行者プレイヤーID
   * @returns 検索結果
   */
  readonly searchItems: (
    containerId: ContainerId,
    itemId: ItemId,
    playerId: PlayerId
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly slotIndex: number
      readonly itemStack: ItemStack
    }>,
    InventoryApplicationError
  >

  /**
   * 複数のコンテナを検索します
   *
   * @param itemId - 検索するアイテムID
   * @param playerId - 実行者プレイヤーID
   * @param searchRadius - 検索範囲（オプション）
   * @returns 検索結果
   */
  readonly searchAcrossContainers: (
    itemId: ItemId,
    playerId: PlayerId,
    searchRadius?: number
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly containerId: ContainerId
      readonly containerType: string
      readonly position: { readonly x: number; readonly y: number; readonly z: number }
      readonly slotIndex: number
      readonly itemStack: ItemStack
    }>,
    InventoryApplicationError
  >

  /**
   * コンテナの自動補充を設定します
   *
   * @param containerId - コンテナID
   * @param ownerId - 所有者プレイヤーID
   * @param autoRefillConfig - 自動補充設定
   * @returns 設定処理の結果
   */
  readonly configureAutoRefill: (
    containerId: ContainerId,
    ownerId: PlayerId,
    autoRefillConfig: {
      readonly enabled: boolean
      readonly sourceContainers: ReadonlyArray<ContainerId>
      readonly itemRules: ReadonlyArray<{
        readonly itemId: ItemId
        readonly minQuantity: number
        readonly maxQuantity: number
      }>
    }
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナの統計情報を取得します
   *
   * @param containerId - コンテナID
   * @param playerId - 実行者プレイヤーID
   * @returns 統計情報
   */
  readonly getContainerStats: (
    containerId: ContainerId,
    playerId: PlayerId
  ) => Effect.Effect<
    {
      readonly totalSlots: number
      readonly usedSlots: number
      readonly emptySlots: number
      readonly uniqueItemTypes: number
      readonly totalValue: number
      readonly utilizationPercentage: number
      readonly lastAccessed: Date
      readonly accessCount: number
    },
    InventoryApplicationError
  >

  /**
   * プレイヤーのコンテナ一覧を取得します
   *
   * @param playerId - プレイヤーID
   * @param includeShared - 共有コンテナも含めるか
   * @returns コンテナ一覧
   */
  readonly getPlayerContainers: (
    playerId: PlayerId,
    includeShared: boolean
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly containerId: ContainerId
      readonly containerType: string
      readonly position: { readonly x: number; readonly y: number; readonly z: number }
      readonly accessLevel: 'read' | 'write' | 'admin'
      readonly isOwner: boolean
    }>,
    InventoryApplicationError
  >

  /**
   * コンテナをロックします
   *
   * @param containerId - コンテナID
   * @param ownerId - 所有者プレイヤーID
   * @param lockType - ロックタイプ
   * @param duration - ロック期間（オプション）
   * @returns ロック処理の結果
   */
  readonly lockContainer: (
    containerId: ContainerId,
    ownerId: PlayerId,
    lockType: 'temporary' | 'permanent' | 'password',
    duration?: number
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナのロックを解除します
   *
   * @param containerId - コンテナID
   * @param playerId - 実行者プレイヤーID
   * @param password - パスワード（password lockの場合）
   * @returns アンロック処理の結果
   */
  readonly unlockContainer: (
    containerId: ContainerId,
    playerId: PlayerId,
    password?: string
  ) => Effect.Effect<void, InventoryApplicationError>

  /**
   * コンテナの履歴を取得します
   *
   * @param containerId - コンテナID
   * @param playerId - 実行者プレイヤーID
   * @param limit - 取得件数制限
   * @returns アクセス履歴
   */
  readonly getContainerHistory: (
    containerId: ContainerId,
    playerId: PlayerId,
    limit?: number
  ) => Effect.Effect<ReadonlyArray<ContainerOperationLog>, InventoryApplicationError>

  /**
   * 大容量操作をバッチ処理します
   *
   * @param operations - 操作配列
   * @param playerId - 実行者プレイヤーID
   * @returns バッチ処理結果
   */
  readonly batchOperations: (
    operations: ReadonlyArray<ContainerBatchOperation>,
    playerId: PlayerId
  ) => Effect.Effect<ReadonlyArray<BatchOperationResult>, InventoryApplicationError>

  /**
   * デバッグ情報を取得します
   *
   * @param containerId - コンテナID
   * @returns デバッグ情報
   */
  readonly getDebugInfo: (containerId: ContainerId) => Effect.Effect<ContainerDebugInfo, InventoryApplicationError>
}

/**
 * ContainerManagerApplicationService Context Tag
 */
export const ContainerManagerApplicationService = Context.GenericTag<ContainerManagerApplicationService>(
  '@minecraft/domain/inventory/ContainerManagerApplicationService'
)
