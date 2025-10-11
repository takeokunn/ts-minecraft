import { Clock, Effect, Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { JsonValueSchema } from '@/shared/schema/json'

// =============================================================================
// Inventory Error Types using Schema.TaggedError
// =============================================================================

/**
 * インベントリエラー - 基底クラス
 * 全てのインベントリ関連エラーの基底型
 */
export const InventoryErrorSchema = Schema.TaggedError('InventoryError', {
  message: Schema.String.pipe(
    Schema.annotations({
      description: 'Human-readable error message',
    })
  ),
  inventoryId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Associated inventory identifier',
      })
    )
  ),
  timestamp: Schema.Number.pipe(
    Schema.annotations({
      description: 'Error occurrence timestamp',
    })
  ),
})
export type InventoryError = Schema.Schema.Type<typeof InventoryErrorSchema>
export const InventoryError = makeErrorFactory(InventoryErrorSchema)

// =============================================================================
// Validation Error Hierarchy
// =============================================================================

/**
 * バリデーションエラー
 * 入力値の検証失敗時のエラー
 */
export const ValidationErrorSchema = Schema.TaggedError('ValidationError', {
  message: Schema.String,
  field: Schema.String.pipe(
    Schema.annotations({
      description: 'Field name that failed validation',
    })
  ),
  value: JsonValueSchema.pipe(
    Schema.annotations({
      description: 'Invalid value that caused the error',
    })
  ),
  expectedType: Schema.String.pipe(
    Schema.annotations({
      description: 'Expected type or format',
    })
  ),
})
export type ValidationError = Schema.Schema.Type<typeof ValidationErrorSchema>
export const ValidationError = makeErrorFactory(ValidationErrorSchema)

/**
 * スロットバリデーションエラー
 * スロット番号やスロット状態の検証失敗
 */
export const SlotValidationErrorSchema = Schema.TaggedError('SlotValidationError', {
  message: Schema.String,
  slotNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({
      description: 'Invalid slot number',
    })
  ),
  inventoryId: Schema.String.pipe(
    Schema.annotations({
      description: 'Inventory containing the invalid slot',
    })
  ),
  reason: Schema.Literal('OUT_OF_BOUNDS', 'INVALID_TYPE', 'LOCKED', 'RESTRICTED').pipe(
    Schema.annotations({
      description: 'Specific reason for slot validation failure',
    })
  ),
})
export type SlotValidationError = Schema.Schema.Type<typeof SlotValidationErrorSchema>
export const SlotValidationError = makeErrorFactory(SlotValidationErrorSchema)

/**
 * アイテムバリデーションエラー
 * アイテムデータの検証失敗
 */
export const ItemValidationErrorSchema = Schema.TaggedError('ItemValidationError', {
  message: Schema.String,
  itemId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Invalid item identifier',
      })
    )
  ),
  property: Schema.String.pipe(
    Schema.annotations({
      description: 'Invalid item property name',
    })
  ),
  value: JsonValueSchema.pipe(
    Schema.annotations({
      description: 'Invalid property value',
    })
  ),
})
export type ItemValidationError = Schema.Schema.Type<typeof ItemValidationErrorSchema>
export const ItemValidationError = makeErrorFactory(ItemValidationErrorSchema)

/**
 * 制約違反エラー
 * ビジネスルールや制約の違反
 */
export const ConstraintViolationErrorSchema = Schema.TaggedError('ConstraintViolationError', {
  message: Schema.String,
  constraint: Schema.String.pipe(
    Schema.annotations({
      description: 'Name of violated constraint',
    })
  ),
  currentValue: JsonValueSchema.pipe(
    Schema.annotations({
      description: 'Current value that violates the constraint',
    })
  ),
  allowedRange: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Description of allowed values or range',
      })
    )
  ),
})
export type ConstraintViolationError = Schema.Schema.Type<typeof ConstraintViolationErrorSchema>
export const ConstraintViolationError = makeErrorFactory(ConstraintViolationErrorSchema)

// =============================================================================
// Operation Error Hierarchy
// =============================================================================

/**
 * 操作エラー
 * インベントリ操作の実行失敗
 */
export const OperationErrorSchema = Schema.TaggedError('OperationError', {
  message: Schema.String,
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Name of the failed operation',
    })
  ),
  inventoryId: Schema.String.pipe(
    Schema.annotations({
      description: 'Target inventory identifier',
    })
  ),
})
export type OperationError = Schema.Schema.Type<typeof OperationErrorSchema>
export const OperationError = makeErrorFactory(OperationErrorSchema)

/**
 * 容量不足エラー
 * インベントリに十分な空きスペースがない
 */
export const InsufficientSpaceErrorSchema = Schema.TaggedError('InsufficientSpaceError', {
  message: Schema.String,
  inventoryId: Schema.String,
  requiredSlots: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Number of slots required for the operation',
    })
  ),
  availableSlots: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Number of available slots',
    })
  ),
  itemId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Item that could not be added',
      })
    )
  ),
})
export type InsufficientSpaceError = Schema.Schema.Type<typeof InsufficientSpaceErrorSchema>
export const InsufficientSpaceError = makeErrorFactory(InsufficientSpaceErrorSchema)

/**
 * アイテム未発見エラー
 * 指定されたアイテムが見つからない
 */
export const ItemNotFoundErrorSchema = Schema.TaggedError('ItemNotFoundError', {
  message: Schema.String,
  inventoryId: Schema.String,
  itemId: Schema.String.pipe(
    Schema.annotations({
      description: 'Item identifier that was not found',
    })
  ),
  slotNumber: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.annotations({
        description: 'Slot number where item was expected',
      })
    )
  ),
  expectedQuantity: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Expected quantity of the item',
      })
    )
  ),
})
export type ItemNotFoundError = Schema.Schema.Type<typeof ItemNotFoundErrorSchema>
export const ItemNotFoundError = makeErrorFactory(ItemNotFoundErrorSchema)

/**
 * 転送失敗エラー
 * アイテム転送操作の失敗
 */
export const TransferFailureErrorSchema = Schema.TaggedError('TransferFailureError', {
  message: Schema.String,
  sourceInventoryId: Schema.String.pipe(
    Schema.annotations({
      description: 'Source inventory identifier',
    })
  ),
  targetInventoryId: Schema.String.pipe(
    Schema.annotations({
      description: 'Target inventory identifier',
    })
  ),
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  reason: Schema.Literal(
    'SOURCE_INSUFFICIENT',
    'TARGET_FULL',
    'ITEM_INCOMPATIBLE',
    'PERMISSION_DENIED',
    'NETWORK_ERROR'
  ).pipe(
    Schema.annotations({
      description: 'Specific reason for transfer failure',
    })
  ),
})
export type TransferFailureError = Schema.Schema.Type<typeof TransferFailureErrorSchema>
export const TransferFailureError = makeErrorFactory(TransferFailureErrorSchema)

// =============================================================================
// System Error Hierarchy
// =============================================================================

/**
 * システムエラー
 * システムレベルの障害
 */
export const SystemErrorSchema = Schema.TaggedError('SystemError', {
  message: Schema.String,
  component: Schema.String.pipe(
    Schema.annotations({
      description: 'System component where error occurred',
    })
  ),
  errorCode: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'System-specific error code',
      })
    )
  ),
})
export type SystemError = Schema.Schema.Type<typeof SystemErrorSchema>
export const SystemError = makeErrorFactory(SystemErrorSchema)

/**
 * データ破損エラー
 * インベントリデータの整合性エラー
 */
export const CorruptionErrorSchema = Schema.TaggedError('CorruptionError', {
  message: Schema.String,
  inventoryId: Schema.String,
  corruptionType: Schema.Literal(
    'CHECKSUM_MISMATCH',
    'INVALID_FORMAT',
    'MISSING_REQUIRED_FIELD',
    'CIRCULAR_REFERENCE',
    'SIZE_MISMATCH'
  ).pipe(
    Schema.annotations({
      description: 'Type of data corruption detected',
    })
  ),
  affectedFields: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description: 'List of corrupted fields',
    })
  ),
  checksum: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Expected checksum for verification',
      })
    )
  ),
})
export type CorruptionError = Schema.Schema.Type<typeof CorruptionErrorSchema>
export const CorruptionError = makeErrorFactory(CorruptionErrorSchema)

/**
 * 並行性エラー
 * 並行アクセスによる競合状態
 */
export const ConcurrencyErrorSchema = Schema.TaggedError('ConcurrencyError', {
  message: Schema.String,
  inventoryId: Schema.String,
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Operation that caused the concurrency conflict',
    })
  ),
  conflictType: Schema.Literal('OPTIMISTIC_LOCK_FAILURE', 'DEADLOCK', 'RESOURCE_BUSY', 'VERSION_MISMATCH').pipe(
    Schema.annotations({
      description: 'Type of concurrency conflict',
    })
  ),
  currentVersion: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Current data version',
      })
    )
  ),
  expectedVersion: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Expected data version',
      })
    )
  ),
})
export type ConcurrencyError = Schema.Schema.Type<typeof ConcurrencyErrorSchema>
export const ConcurrencyError = makeErrorFactory(ConcurrencyErrorSchema)

// =============================================================================
// Permission Error Hierarchy
// =============================================================================

/**
 * 権限エラー
 * アクセス権限の不足
 */
export const PermissionErrorSchema = Schema.TaggedError('PermissionError', {
  message: Schema.String,
  playerId: Schema.String.pipe(
    Schema.annotations({
      description: 'Player attempting the operation',
    })
  ),
  inventoryId: Schema.String,
  requiredPermission: Schema.String.pipe(
    Schema.annotations({
      description: 'Required permission for the operation',
    })
  ),
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Attempted operation',
    })
  ),
})
export type PermissionError = Schema.Schema.Type<typeof PermissionErrorSchema>
export const PermissionError = makeErrorFactory(PermissionErrorSchema)

/**
 * 所有権エラー
 * リソースの所有権に関するエラー
 */
export const OwnershipErrorSchema = Schema.TaggedError('OwnershipError', {
  message: Schema.String,
  playerId: Schema.String,
  inventoryId: Schema.String,
  ownerId: Schema.String.pipe(
    Schema.annotations({
      description: 'Actual owner of the inventory',
    })
  ),
  operation: Schema.String,
})
export type OwnershipError = Schema.Schema.Type<typeof OwnershipErrorSchema>
export const OwnershipError = makeErrorFactory(OwnershipErrorSchema)

// =============================================================================
// Union Type for All Inventory Errors
// =============================================================================

/**
 * 全てのインベントリエラーのUnion型
 */
export type InventoryDomainError =
  | InventoryError
  | ValidationError
  | SlotValidationError
  | ItemValidationError
  | ConstraintViolationError
  | OperationError
  | InsufficientSpaceError
  | ItemNotFoundError
  | TransferFailureError
  | SystemError
  | CorruptionError
  | ConcurrencyError
  | PermissionError
  | OwnershipError

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * 基本インベントリエラーを生成
 */
export const createInventoryError = (params: {
  message: string
  inventoryId?: string
}): Effect.Effect<InventoryError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return InventoryError.make({
      ...params,
      timestamp,
    })
  })

/**
 * バリデーションエラーを生成
 */
export const createValidationError = (params: {
  message: string
  field: string
  value: unknown
  expectedType: string
}): ValidationError => ValidationError.make(params)

/**
 * スロットバリデーションエラーを生成
 */
export const createSlotValidationError = (params: {
  message: string
  slotNumber: number
  inventoryId: string
  reason: 'OUT_OF_BOUNDS' | 'INVALID_TYPE' | 'LOCKED' | 'RESTRICTED'
}): SlotValidationError => SlotValidationError.make(params)

/**
 * アイテムバリデーションエラーを生成
 */
export const createItemValidationError = (params: {
  message: string
  itemId?: string
  property: string
  value: unknown
}): ItemValidationError => ItemValidationError.make(params)

/**
 * 制約違反エラーを生成
 */
export const createConstraintViolationError = (params: {
  message: string
  constraint: string
  currentValue: unknown
  allowedRange?: string
}): ConstraintViolationError => ConstraintViolationError.make(params)

/**
 * 容量不足エラーを生成
 */
export const createInsufficientSpaceError = (params: {
  message: string
  inventoryId: string
  requiredSlots: number
  availableSlots: number
  itemId?: string
}): InsufficientSpaceError => InsufficientSpaceError.make(params)

/**
 * アイテム未発見エラーを生成
 */
export const createItemNotFoundError = (params: {
  message: string
  inventoryId: string
  itemId: string
  slotNumber?: number
  expectedQuantity?: number
}): ItemNotFoundError => ItemNotFoundError.make(params)

/**
 * 転送失敗エラーを生成
 */
export const createTransferFailureError = (params: {
  message: string
  sourceInventoryId: string
  targetInventoryId: string
  itemId: string
  quantity: number
  reason: 'SOURCE_INSUFFICIENT' | 'TARGET_FULL' | 'ITEM_INCOMPATIBLE' | 'PERMISSION_DENIED' | 'NETWORK_ERROR'
}): TransferFailureError => TransferFailureError.make(params)

/**
 * データ破損エラーを生成
 */
export const createCorruptionError = (params: {
  message: string
  inventoryId: string
  corruptionType:
    | 'CHECKSUM_MISMATCH'
    | 'INVALID_FORMAT'
    | 'MISSING_REQUIRED_FIELD'
    | 'CIRCULAR_REFERENCE'
    | 'SIZE_MISMATCH'
  affectedFields: string[]
  checksum?: string
}): CorruptionError => CorruptionError.make(params)

/**
 * 並行性エラーを生成
 */
export const createConcurrencyError = (params: {
  message: string
  inventoryId: string
  operation: string
  conflictType: 'OPTIMISTIC_LOCK_FAILURE' | 'DEADLOCK' | 'RESOURCE_BUSY' | 'VERSION_MISMATCH'
  currentVersion?: string
  expectedVersion?: string
}): ConcurrencyError => ConcurrencyError.make(params)

/**
 * 権限エラーを生成
 */
export const createPermissionError = (params: {
  message: string
  playerId: string
  inventoryId: string
  requiredPermission: string
  operation: string
}): PermissionError => PermissionError.make(params)

/**
 * 所有権エラーを生成
 */
export const createOwnershipError = (params: {
  message: string
  playerId: string
  inventoryId: string
  ownerId: string
  operation: string
}): OwnershipError => OwnershipError.make(params)

// =============================================================================
// Error Guard Functions (Type Predicates)
// =============================================================================

/**
 * InventoryErrorかどうかを判定
 */
export const isInventoryError = (error: unknown): error is InventoryError => error instanceof InventoryError

/**
 * ValidationErrorかどうかを判定
 */
export const isValidationError = (error: unknown): error is ValidationError => error instanceof ValidationError

/**
 * SlotValidationErrorかどうかを判定
 */
export const isSlotValidationError = (error: unknown): error is SlotValidationError =>
  error instanceof SlotValidationError

/**
 * ItemValidationErrorかどうかを判定
 */
export const isItemValidationError = (error: unknown): error is ItemValidationError =>
  error instanceof ItemValidationError

/**
 * ConstraintViolationErrorかどうかを判定
 */
export const isConstraintViolationError = (error: unknown): error is ConstraintViolationError =>
  error instanceof ConstraintViolationError

/**
 * OperationErrorかどうかを判定
 */
export const isOperationError = (error: unknown): error is OperationError => error instanceof OperationError

/**
 * InsufficientSpaceErrorかどうかを判定
 */
export const isInsufficientSpaceError = (error: unknown): error is InsufficientSpaceError =>
  error instanceof InsufficientSpaceError

/**
 * ItemNotFoundErrorかどうかを判定
 */
export const isItemNotFoundError = (error: unknown): error is ItemNotFoundError => error instanceof ItemNotFoundError

/**
 * TransferFailureErrorかどうかを判定
 */
export const isTransferFailureError = (error: unknown): error is TransferFailureError =>
  error instanceof TransferFailureError

/**
 * SystemErrorかどうかを判定
 */
export const isSystemError = (error: unknown): error is SystemError => error instanceof SystemError

/**
 * CorruptionErrorかどうかを判定
 */
export const isCorruptionError = (error: unknown): error is CorruptionError => error instanceof CorruptionError

/**
 * ConcurrencyErrorかどうかを判定
 */
export const isConcurrencyError = (error: unknown): error is ConcurrencyError => error instanceof ConcurrencyError

/**
 * PermissionErrorかどうかを判定
 */
export const isPermissionError = (error: unknown): error is PermissionError => error instanceof PermissionError

/**
 * OwnershipErrorかどうかを判定
 */
export const isOwnershipError = (error: unknown): error is OwnershipError => error instanceof OwnershipError

/**
 * InventoryDomainErrorかどうかを判定
 */
export const isInventoryDomainError = (error: unknown): error is InventoryDomainError =>
  isInventoryError(error) ||
  isValidationError(error) ||
  isSlotValidationError(error) ||
  isItemValidationError(error) ||
  isConstraintViolationError(error) ||
  isOperationError(error) ||
  isInsufficientSpaceError(error) ||
  isItemNotFoundError(error) ||
  isTransferFailureError(error) ||
  isSystemError(error) ||
  isCorruptionError(error) ||
  isConcurrencyError(error) ||
  isPermissionError(error) ||
  isOwnershipError(error)

// =============================================================================
// Error Recovery and Conversion Utilities
// =============================================================================

/**
 * エラーを人間が読める形式に変換
 */
export const formatErrorMessage = (error: InventoryDomainError): string => {
  const baseMessage = `[${error._tag}] ${error.message}`

  if (isSlotValidationError(error)) {
    return `${baseMessage} (Slot: ${error.slotNumber}, Reason: ${error.reason})`
  }

  if (isItemNotFoundError(error)) {
    return `${baseMessage} (Item: ${error.itemId}${error.slotNumber !== undefined ? `, Slot: ${error.slotNumber}` : ''})`
  }

  if (isTransferFailureError(error)) {
    return `${baseMessage} (${error.sourceInventoryId} → ${error.targetInventoryId}, Reason: ${error.reason})`
  }

  if (isCorruptionError(error)) {
    return `${baseMessage} (Type: ${error.corruptionType}, Fields: ${error.affectedFields.join(', ')})`
  }

  return baseMessage
}

/**
 * エラーの重要度を判定
 */
export const getErrorSeverity = (error: InventoryDomainError): 'low' | 'medium' | 'high' | 'critical' => {
  if (isValidationError(error) || isItemValidationError(error)) {
    return 'low'
  }

  if (isInsufficientSpaceError(error) || isItemNotFoundError(error)) {
    return 'medium'
  }

  if (isTransferFailureError(error) || isPermissionError(error)) {
    return 'high'
  }

  if (isCorruptionError(error) || isSystemError(error)) {
    return 'critical'
  }

  return 'medium'
}

/**
 * エラーが回復可能かどうかを判定
 */
export const isRecoverableError = (error: InventoryDomainError): boolean => {
  // バリデーションエラーは入力修正で回復可能
  if (isValidationError(error) || isItemValidationError(error) || isSlotValidationError(error)) {
    return true
  }

  // 容量不足は別の操作で回復可能
  if (isInsufficientSpaceError(error)) {
    return true
  }

  // 並行性エラーは再試行で回復可能
  if (isConcurrencyError(error) && error.conflictType !== 'DEADLOCK') {
    return true
  }

  // システムエラーやデータ破損は通常回復不可能
  if (isSystemError(error) || isCorruptionError(error)) {
    return false
  }

  return true
}
