/**
 * Inventory Application Service Error Types
 *
 * アプリケーションサービス層固有のエラー型定義
 * DDD + Effect-TSエラーハンドリングパターン
 */

import { Clock, DateTime, Effect, Match, pipe, Schema } from 'effect'

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
  readonly details?: unknown
  readonly cause?: Error
  readonly timestamp?: DateTime.Utc

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

const currentTimestamp = Effect.map(Clock.currentTimeMillis, DateTime.unsafeMake)

/**
 * インベントリが見つからないエラー
 */
export const InventoryNotFoundError = (
  inventoryId: string,
  playerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'INVENTORY_NOT_FOUND' as const,
      message: `Inventory not found: ${inventoryId}`,
      inventoryId,
      playerId,
      timestamp,
    }
  })

/**
 * コンテナが見つからないエラー
 */
export const ContainerNotFoundError = (
  containerId: string,
  playerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONTAINER_NOT_FOUND' as const,
      message: `Container not found: ${containerId}`,
      containerId,
      playerId,
      timestamp,
    }
  })

/**
 * コンテナ配置位置が占有されているエラー
 */
export const ContainerPositionOccupiedError = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  existingContainerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONTAINER_POSITION_OCCUPIED' as const,
      message: `Position already occupied by container at (${position.x}, ${position.y}, ${position.z})`,
      position,
      containerId: existingContainerId,
      timestamp,
    }
  })

/**
 * コンテナへのアクセスが拒否されたエラー
 */
export const ContainerAccessDeniedError = (
  containerId: string,
  playerId: string,
  requiredPermission: 'read' | 'write' | 'admin'
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONTAINER_ACCESS_DENIED' as const,
      message: `Access denied to container ${containerId} for player ${playerId}. Required permission: ${requiredPermission}`,
      containerId,
      playerId,
      details: { requiredPermission },
      timestamp,
    }
  })

/**
 * コンテナがロックされているエラー
 */
export const ContainerLockedError = (
  containerId: string,
  lockType: string,
  playerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONTAINER_LOCKED' as const,
      message: `Container ${containerId} is locked with ${lockType} lock`,
      containerId,
      lockType,
      playerId,
      timestamp,
    }
  })

/**
 * コンテナのロック解除に失敗したエラー
 */
export const ContainerUnlockFailedError = (
  containerId: string,
  playerId: string,
  reason: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONTAINER_UNLOCK_FAILED' as const,
      message: `Failed to unlock container ${containerId}: ${reason}`,
      containerId,
      playerId,
      details: { reason },
      timestamp,
    }
  })

/**
 * トランザクションが見つからないエラー
 */
export const TransactionNotFoundError = (transactionId: string): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'TRANSACTION_NOT_FOUND' as const,
      message: `Transaction not found: ${transactionId}`,
      transactionId,
      timestamp,
    }
  })

/**
 * トランザクション実行失敗エラー
 */
export const TransactionFailedError = (
  transactionId: string,
  reason: string,
  cause?: Error
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'TRANSACTION_FAILED' as const,
      message: `Transaction ${transactionId} failed: ${reason}`,
      transactionId,
      details: { reason },
      cause,
      timestamp,
    }
  })

/**
 * トランザクションタイムアウトエラー
 */
export const TransactionTimeoutError = (
  transactionId: string,
  timeoutMs: number
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'TRANSACTION_TIMEOUT' as const,
      message: `Transaction ${transactionId} timed out after ${timeoutMs}ms`,
      transactionId,
      details: { timeoutMs },
      timestamp,
    }
  })

/**
 * デッドロック検出エラー
 */
export const TransactionDeadlockError = (
  transactionIds: ReadonlyArray<string>,
  resourceIds: ReadonlyArray<string>
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'TRANSACTION_DEADLOCK' as const,
      message: `Deadlock detected involving transactions: ${transactionIds.join(', ')}`,
      details: { transactionIds, resourceIds },
      timestamp,
    }
  })

/**
 * 無効な操作エラー
 */
export const InvalidOperationError = (
  operation: string,
  reason: string,
  context?: unknown
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'INVALID_OPERATION' as const,
      message: `Invalid operation '${operation}': ${reason}`,
      details: { operation, reason, context },
      timestamp,
    }
  })

/**
 * 権限不足エラー
 */
export const PermissionDeniedError = (
  playerId: string,
  action: string,
  resource: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'PERMISSION_DENIED' as const,
      message: `Player ${playerId} does not have permission to ${action} on ${resource}`,
      playerId,
      details: { action, resource },
      timestamp,
    }
  })

/**
 * リソースビジーエラー
 */
export const ResourceBusyError = (
  resourceId: string,
  resourceType: string,
  busyUntil?: DateTime.Utc
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'RESOURCE_BUSY' as const,
      message: `Resource ${resourceType}:${resourceId} is currently busy`,
      details: { resourceId, resourceType, busyUntil },
      timestamp,
    }
  })

/**
 * バリデーション失敗エラー
 */
export const ValidationFailedError = (
  validationRules: ReadonlyArray<string>,
  violatedRules: ReadonlyArray<string>,
  context?: unknown
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'VALIDATION_FAILED' as const,
      message: `Validation failed. Violated rules: ${violatedRules.join(', ')}`,
      details: { validationRules, violatedRules, context },
      timestamp,
    }
  })

/**
 * 並行性競合エラー
 */
export const ConcurrencyConflictError = (
  resource: string,
  conflictingOperations: ReadonlyArray<string>
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CONCURRENCY_CONFLICT' as const,
      message: `Concurrency conflict on resource ${resource}`,
      details: { resource, conflictingOperations },
      timestamp,
    }
  })

/**
 * 分散トランザクション失敗エラー
 */
export const DistributedTransactionFailedError = (
  transactionId: string,
  failedNodes: ReadonlyArray<string>,
  phase: '1' | '2'
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'DISTRIBUTED_TRANSACTION_FAILED' as const,
      message: `Distributed transaction ${transactionId} failed in phase ${phase}`,
      transactionId,
      details: { failedNodes, phase },
      timestamp,
    }
  })

/**
 * 自動補充失敗エラー
 */
export const AutoRefillFailedError = (
  inventoryId: string,
  failedItems: ReadonlyArray<{ itemId: string; reason: string }>,
  playerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'AUTO_REFILL_FAILED' as const,
      message: `Auto refill failed for inventory ${inventoryId}`,
      inventoryId,
      playerId,
      details: { failedItems },
      timestamp,
    }
  })

/**
 * 一括操作失敗エラー
 */
export const BulkOperationFailedError = (
  operationType: string,
  totalOperations: number,
  failedOperations: number,
  errors: ReadonlyArray<string>
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'BULK_OPERATION_FAILED' as const,
      message: `Bulk ${operationType} failed: ${failedOperations}/${totalOperations} operations failed`,
      details: { operationType, totalOperations, failedOperations, errors },
      timestamp,
    }
  })

/**
 * マージ操作失敗エラー
 */
export const MergeOperationFailedError = (
  sourceInventories: ReadonlyArray<string>,
  targetInventoryId: string,
  reason: string,
  playerId?: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'MERGE_OPERATION_FAILED' as const,
      message: `Merge operation failed: ${reason}`,
      inventoryId: targetInventoryId,
      playerId,
      details: { sourceInventories, reason },
      timestamp,
    }
  })

/**
 * クラフティング失敗エラー
 */
export const CraftingFailedError = (
  recipeId: string,
  playerId: string,
  inventoryId: string,
  reason: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'CRAFTING_FAILED' as const,
      message: `Crafting failed for recipe ${recipeId}: ${reason}`,
      recipeId,
      playerId,
      inventoryId,
      details: { reason },
      timestamp,
    }
  })

/**
 * 取引失敗エラー
 */
export const TradeFailedError = (
  tradeId: string,
  player1Id: string,
  player2Id: string,
  reason: string
): Effect.Effect<InventoryApplicationError> =>
  Effect.gen(function* () {
    const timestamp = yield* currentTimestamp
    return {
      _tag: 'TRADE_FAILED' as const,
      message: `Trade ${tradeId} failed: ${reason}`,
      tradeId,
      details: { player1Id, player2Id, reason },
      timestamp,
    }
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
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  lockType: Schema.optional(Schema.String),
  tradeId: Schema.optional(Schema.String),
  recipeId: Schema.optional(Schema.String),
})

/**
 * シリアライゼーションエラー
 */
export class InventorySerializationError extends Schema.TaggedError<InventorySerializationError>()(
  'InventorySerializationError',
  {
    operation: Schema.Literal('serialize', 'deserialize'),
    serialized: Schema.String,
    cause: Schema.Unknown,
  }
) {}

/**
 * エラーのシリアライゼーション/デシリアライゼーション
 */
export const serializeError = (error: InventoryApplicationError): Effect.Effect<string, InventorySerializationError> =>
  Effect.try({
    try: () => JSON.stringify(error),
    catch: (cause) =>
      new InventorySerializationError({
        operation: 'serialize',
        serialized: String(error),
        cause,
      }),
  })

export const deserializeError = (
  serialized: string
): Effect.Effect<InventoryApplicationError, InventorySerializationError> =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => JSON.parse(serialized),
      catch: (cause) =>
        new InventorySerializationError({
          operation: 'deserialize',
          serialized,
          cause,
        }),
    })

    return yield* Schema.decodeUnknown(InventoryApplicationErrorSchema)(parsed).pipe(
      Effect.mapError(
        (cause) =>
          new InventorySerializationError({
            operation: 'deserialize',
            serialized,
            cause,
          })
      )
    )
  })

/**
 * エラーレベルの判定
 */
export const getErrorSeverity = (error: InventoryApplicationError): 'low' | 'medium' | 'high' | 'critical' =>
  pipe(
    Match.value(error),
    Match.tag('TRANSACTION_DEADLOCK', () => 'critical' as const),
    Match.tag('DISTRIBUTED_TRANSACTION_FAILED', () => 'critical' as const),
    Match.tag('CONCURRENCY_CONFLICT', () => 'critical' as const),
    Match.tag('TRANSACTION_FAILED', () => 'high' as const),
    Match.tag('TRANSACTION_TIMEOUT', () => 'high' as const),
    Match.tag('BULK_OPERATION_FAILED', () => 'high' as const),
    Match.tag('CONTAINER_ACCESS_DENIED', () => 'medium' as const),
    Match.tag('PERMISSION_DENIED', () => 'medium' as const),
    Match.tag('VALIDATION_FAILED', () => 'medium' as const),
    Match.tag('CRAFTING_FAILED', () => 'medium' as const),
    Match.tag('TRADE_FAILED', () => 'medium' as const),
    Match.orElse(() => 'low' as const)
  )

/**
 * エラーの回復可能性判定
 */
export const isRecoverableError = (error: InventoryApplicationError): boolean => {
  const nonRecoverableErrors = [
    'INVENTORY_NOT_FOUND',
    'CONTAINER_NOT_FOUND',
    'CONTAINER_POSITION_OCCUPIED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
  ]

  return !nonRecoverableErrors.includes(error._tag)
}

/**
 * エラーメッセージの国際化対応
 */
export const getLocalizedErrorMessage = (error: InventoryApplicationError, locale: string = 'en'): string => {
  // 実装では実際の国際化ライブラリを使用
  return error.message // 簡略実装
}
