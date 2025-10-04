/**
 * Inventory Application Service Error Types
 *
 * アプリケーションサービス層固有のエラー型定義
 * DDD + Effect-TSエラーハンドリングパターン
 */

import { Schema } from 'effect'

/**
 * アプリケーションサービスエラーの基底型
 */
export interface InventoryApplicationError {
  readonly _tag:
    | 'INVENTORY_NOT_FOUND'
    | 'CONTAINER_NOT_FOUND'
    | 'CONTAINER_POSITION_OCCUPIED'
    | 'CONTAINER_ACCESS_DENIED'
    | 'CONTAINER_LOCKED'
    | 'CONTAINER_UNLOCK_FAILED'
    | 'TRANSACTION_NOT_FOUND'
    | 'TRANSACTION_FAILED'
    | 'TRANSACTION_TIMEOUT'
    | 'TRANSACTION_DEADLOCK'
    | 'INVALID_OPERATION'
    | 'PERMISSION_DENIED'
    | 'RESOURCE_BUSY'
    | 'VALIDATION_FAILED'
    | 'CONCURRENCY_CONFLICT'
    | 'DISTRIBUTED_TRANSACTION_FAILED'
    | 'AUTO_REFILL_FAILED'
    | 'BULK_OPERATION_FAILED'
    | 'MERGE_OPERATION_FAILED'
    | 'CRAFTING_FAILED'
    | 'TRADE_FAILED'
  readonly message: string
  readonly details?: any
  readonly cause?: Error
  readonly timestamp?: Date

  // コンテキスト別の詳細情報
  readonly inventoryId?: string
  readonly containerId?: string
  readonly playerId?: string
  readonly transactionId?: string
  readonly itemId?: string
  readonly slotIndex?: number
  readonly position?: { readonly x: number; readonly y: number; readonly z: number }
  readonly lockType?: string
  readonly tradeId?: string
  readonly recipeId?: string
}

/**
 * インベントリが見つからないエラー
 */
export const InventoryNotFoundError = (
  inventoryId: string,
  playerId?: string
): InventoryApplicationError => ({
  _tag: 'INVENTORY_NOT_FOUND',
  message: `Inventory not found: ${inventoryId}`,
  inventoryId,
  playerId,
  timestamp: new Date()
})

/**
 * コンテナが見つからないエラー
 */
export const ContainerNotFoundError = (
  containerId: string,
  playerId?: string
): InventoryApplicationError => ({
  _tag: 'CONTAINER_NOT_FOUND',
  message: `Container not found: ${containerId}`,
  containerId,
  playerId,
  timestamp: new Date()
})

/**
 * コンテナ配置位置が占有されているエラー
 */
export const ContainerPositionOccupiedError = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  existingContainerId?: string
): InventoryApplicationError => ({
  _tag: 'CONTAINER_POSITION_OCCUPIED',
  message: `Position already occupied by container at (${position.x}, ${position.y}, ${position.z})`,
  position,
  containerId: existingContainerId,
  timestamp: new Date()
})

/**
 * コンテナへのアクセスが拒否されたエラー
 */
export const ContainerAccessDeniedError = (
  containerId: string,
  playerId: string,
  requiredPermission: 'read' | 'write' | 'admin'
): InventoryApplicationError => ({
  _tag: 'CONTAINER_ACCESS_DENIED',
  message: `Access denied to container ${containerId} for player ${playerId}. Required permission: ${requiredPermission}`,
  containerId,
  playerId,
  details: { requiredPermission },
  timestamp: new Date()
})

/**
 * コンテナがロックされているエラー
 */
export const ContainerLockedError = (
  containerId: string,
  lockType: string,
  playerId?: string
): InventoryApplicationError => ({
  _tag: 'CONTAINER_LOCKED',
  message: `Container ${containerId} is locked with ${lockType} lock`,
  containerId,
  lockType,
  playerId,
  timestamp: new Date()
})

/**
 * コンテナのロック解除に失敗したエラー
 */
export const ContainerUnlockFailedError = (
  containerId: string,
  playerId: string,
  reason: string
): InventoryApplicationError => ({
  _tag: 'CONTAINER_UNLOCK_FAILED',
  message: `Failed to unlock container ${containerId}: ${reason}`,
  containerId,
  playerId,
  details: { reason },
  timestamp: new Date()
})

/**
 * トランザクションが見つからないエラー
 */
export const TransactionNotFoundError = (
  transactionId: string
): InventoryApplicationError => ({
  _tag: 'TRANSACTION_NOT_FOUND',
  message: `Transaction not found: ${transactionId}`,
  transactionId,
  timestamp: new Date()
})

/**
 * トランザクション実行失敗エラー
 */
export const TransactionFailedError = (
  transactionId: string,
  reason: string,
  cause?: Error
): InventoryApplicationError => ({
  _tag: 'TRANSACTION_FAILED',
  message: `Transaction ${transactionId} failed: ${reason}`,
  transactionId,
  details: { reason },
  cause,
  timestamp: new Date()
})

/**
 * トランザクションタイムアウトエラー
 */
export const TransactionTimeoutError = (
  transactionId: string,
  timeoutMs: number
): InventoryApplicationError => ({
  _tag: 'TRANSACTION_TIMEOUT',
  message: `Transaction ${transactionId} timed out after ${timeoutMs}ms`,
  transactionId,
  details: { timeoutMs },
  timestamp: new Date()
})

/**
 * デッドロック検出エラー
 */
export const TransactionDeadlockError = (
  transactionIds: ReadonlyArray<string>,
  resourceIds: ReadonlyArray<string>
): InventoryApplicationError => ({
  _tag: 'TRANSACTION_DEADLOCK',
  message: `Deadlock detected involving transactions: ${transactionIds.join(', ')}`,
  details: { transactionIds, resourceIds },
  timestamp: new Date()
})

/**
 * 無効な操作エラー
 */
export const InvalidOperationError = (
  operation: string,
  reason: string,
  context?: any
): InventoryApplicationError => ({
  _tag: 'INVALID_OPERATION',
  message: `Invalid operation '${operation}': ${reason}`,
  details: { operation, reason, context },
  timestamp: new Date()
})

/**
 * 権限不足エラー
 */
export const PermissionDeniedError = (
  playerId: string,
  action: string,
  resource: string
): InventoryApplicationError => ({
  _tag: 'PERMISSION_DENIED',
  message: `Player ${playerId} does not have permission to ${action} on ${resource}`,
  playerId,
  details: { action, resource },
  timestamp: new Date()
})

/**
 * リソースビジーエラー
 */
export const ResourceBusyError = (
  resourceId: string,
  resourceType: string,
  busyUntil?: Date
): InventoryApplicationError => ({
  _tag: 'RESOURCE_BUSY',
  message: `Resource ${resourceType}:${resourceId} is currently busy`,
  details: { resourceId, resourceType, busyUntil },
  timestamp: new Date()
})

/**
 * バリデーション失敗エラー
 */
export const ValidationFailedError = (
  validationRules: ReadonlyArray<string>,
  violatedRules: ReadonlyArray<string>,
  context?: any
): InventoryApplicationError => ({
  _tag: 'VALIDATION_FAILED',
  message: `Validation failed. Violated rules: ${violatedRules.join(', ')}`,
  details: { validationRules, violatedRules, context },
  timestamp: new Date()
})

/**
 * 並行性競合エラー
 */
export const ConcurrencyConflictError = (
  resource: string,
  conflictingOperations: ReadonlyArray<string>
): InventoryApplicationError => ({
  _tag: 'CONCURRENCY_CONFLICT',
  message: `Concurrency conflict on resource ${resource}`,
  details: { resource, conflictingOperations },
  timestamp: new Date()
})

/**
 * 分散トランザクション失敗エラー
 */
export const DistributedTransactionFailedError = (
  transactionId: string,
  failedNodes: ReadonlyArray<string>,
  phase: '1' | '2'
): InventoryApplicationError => ({
  _tag: 'DISTRIBUTED_TRANSACTION_FAILED',
  message: `Distributed transaction ${transactionId} failed in phase ${phase}`,
  transactionId,
  details: { failedNodes, phase },
  timestamp: new Date()
})

/**
 * 自動補充失敗エラー
 */
export const AutoRefillFailedError = (
  inventoryId: string,
  failedItems: ReadonlyArray<{ itemId: string; reason: string }>,
  playerId?: string
): InventoryApplicationError => ({
  _tag: 'AUTO_REFILL_FAILED',
  message: `Auto refill failed for inventory ${inventoryId}`,
  inventoryId,
  playerId,
  details: { failedItems },
  timestamp: new Date()
})

/**
 * 一括操作失敗エラー
 */
export const BulkOperationFailedError = (
  operationType: string,
  totalOperations: number,
  failedOperations: number,
  errors: ReadonlyArray<string>
): InventoryApplicationError => ({
  _tag: 'BULK_OPERATION_FAILED',
  message: `Bulk ${operationType} failed: ${failedOperations}/${totalOperations} operations failed`,
  details: { operationType, totalOperations, failedOperations, errors },
  timestamp: new Date()
})

/**
 * マージ操作失敗エラー
 */
export const MergeOperationFailedError = (
  sourceInventories: ReadonlyArray<string>,
  targetInventoryId: string,
  reason: string,
  playerId?: string
): InventoryApplicationError => ({
  _tag: 'MERGE_OPERATION_FAILED',
  message: `Merge operation failed: ${reason}`,
  inventoryId: targetInventoryId,
  playerId,
  details: { sourceInventories, reason },
  timestamp: new Date()
})

/**
 * クラフティング失敗エラー
 */
export const CraftingFailedError = (
  recipeId: string,
  playerId: string,
  inventoryId: string,
  reason: string
): InventoryApplicationError => ({
  _tag: 'CRAFTING_FAILED',
  message: `Crafting failed for recipe ${recipeId}: ${reason}`,
  recipeId,
  playerId,
  inventoryId,
  details: { reason },
  timestamp: new Date()
})

/**
 * 取引失敗エラー
 */
export const TradeFailedError = (
  tradeId: string,
  player1Id: string,
  player2Id: string,
  reason: string
): InventoryApplicationError => ({
  _tag: 'TRADE_FAILED',
  message: `Trade ${tradeId} failed: ${reason}`,
  tradeId,
  details: { player1Id, player2Id, reason },
  timestamp: new Date()
})

/**
 * アプリケーションエラーのSchema定義
 */
export const InventoryApplicationErrorSchema = Schema.Struct({
  _tag: Schema.Literal(
    'INVENTORY_NOT_FOUND',
    'CONTAINER_NOT_FOUND',
    'CONTAINER_POSITION_OCCUPIED',
    'CONTAINER_ACCESS_DENIED',
    'CONTAINER_LOCKED',
    'CONTAINER_UNLOCK_FAILED',
    'TRANSACTION_NOT_FOUND',
    'TRANSACTION_FAILED',
    'TRANSACTION_TIMEOUT',
    'TRANSACTION_DEADLOCK',
    'INVALID_OPERATION',
    'PERMISSION_DENIED',
    'RESOURCE_BUSY',
    'VALIDATION_FAILED',
    'CONCURRENCY_CONFLICT',
    'DISTRIBUTED_TRANSACTION_FAILED',
    'AUTO_REFILL_FAILED',
    'BULK_OPERATION_FAILED',
    'MERGE_OPERATION_FAILED',
    'CRAFTING_FAILED',
    'TRADE_FAILED'
  ),
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.DateTimeUtc),
  inventoryId: Schema.optional(Schema.String),
  containerId: Schema.optional(Schema.String),
  playerId: Schema.optional(Schema.String),
  transactionId: Schema.optional(Schema.String),
  itemId: Schema.optional(Schema.String),
  slotIndex: Schema.optional(Schema.Number),
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })),
  lockType: Schema.optional(Schema.String),
  tradeId: Schema.optional(Schema.String),
  recipeId: Schema.optional(Schema.String)
})

/**
 * エラーのシリアライゼーション/デシリアライゼーション
 */
export const serializeError = (error: InventoryApplicationError): string =>
  JSON.stringify(error)

export const deserializeError = (serialized: string): InventoryApplicationError =>
  JSON.parse(serialized) as InventoryApplicationError

/**
 * エラーレベルの判定
 */
export const getErrorSeverity = (
  error: InventoryApplicationError
): 'low' | 'medium' | 'high' | 'critical' => {
  switch (error._tag) {
    case 'TRANSACTION_DEADLOCK':
    case 'DISTRIBUTED_TRANSACTION_FAILED':
    case 'CONCURRENCY_CONFLICT':
      return 'critical'

    case 'TRANSACTION_FAILED':
    case 'TRANSACTION_TIMEOUT':
    case 'BULK_OPERATION_FAILED':
      return 'high'

    case 'CONTAINER_ACCESS_DENIED':
    case 'PERMISSION_DENIED':
    case 'VALIDATION_FAILED':
    case 'CRAFTING_FAILED':
    case 'TRADE_FAILED':
      return 'medium'

    default:
      return 'low'
  }
}

/**
 * エラーの回復可能性判定
 */
export const isRecoverableError = (
  error: InventoryApplicationError
): boolean => {
  const nonRecoverableErrors = [
    'INVENTORY_NOT_FOUND',
    'CONTAINER_NOT_FOUND',
    'CONTAINER_POSITION_OCCUPIED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED'
  ]

  return !nonRecoverableErrors.includes(error._tag)
}

/**
 * エラーメッセージの国際化対応
 */
export const getLocalizedErrorMessage = (
  error: InventoryApplicationError,
  locale: string = 'en'
): string => {
  // 実装では実際の国際化ライブラリを使用
  return error.message // 簡略実装
}