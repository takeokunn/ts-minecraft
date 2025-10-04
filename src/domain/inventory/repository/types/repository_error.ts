import { Data } from 'effect'
import type { ContainerId, ItemId, PlayerId, SlotPosition } from '../../types'

// =============================================================================
// Repository Error Types
// =============================================================================

/**
 * Repository操作の汎用エラー
 */
export const RepositoryError = Data.tagged<{
  readonly _tag: 'RepositoryError'
  readonly operation: string
  readonly reason: string
  readonly details?: unknown
  readonly timestamp: number
}>('RepositoryError')

export type RepositoryError = ReturnType<typeof RepositoryError>

/**
 * インベントリが見つからないエラー
 */
export const InventoryNotFoundError = Data.tagged<{
  readonly _tag: 'InventoryNotFoundError'
  readonly playerId: PlayerId
  readonly timestamp: number
}>('InventoryNotFoundError')

export type InventoryNotFoundError = ReturnType<typeof InventoryNotFoundError>

/**
 * アイテムが見つからないエラー
 */
export const ItemNotFoundError = Data.tagged<{
  readonly _tag: 'ItemNotFoundError'
  readonly itemId: ItemId
  readonly timestamp: number
}>('ItemNotFoundError')

export type ItemNotFoundError = ReturnType<typeof ItemNotFoundError>

/**
 * コンテナが見つからないエラー
 */
export const ContainerNotFoundError = Data.tagged<{
  readonly _tag: 'ContainerNotFoundError'
  readonly containerId: ContainerId
  readonly timestamp: number
}>('ContainerNotFoundError')

export type ContainerNotFoundError = ReturnType<typeof ContainerNotFoundError>

/**
 * スロットが見つからないエラー
 */
export const SlotNotFoundError = Data.tagged<{
  readonly _tag: 'SlotNotFoundError'
  readonly playerId: PlayerId
  readonly position: SlotPosition
  readonly timestamp: number
}>('SlotNotFoundError')

export type SlotNotFoundError = ReturnType<typeof SlotNotFoundError>

/**
 * 重複インベントリエラー
 */
export const DuplicateInventoryError = Data.tagged<{
  readonly _tag: 'DuplicateInventoryError'
  readonly playerId: PlayerId
  readonly timestamp: number
}>('DuplicateInventoryError')

export type DuplicateInventoryError = ReturnType<typeof DuplicateInventoryError>

/**
 * 重複アイテム定義エラー
 */
export const DuplicateItemDefinitionError = Data.tagged<{
  readonly _tag: 'DuplicateItemDefinitionError'
  readonly itemId: ItemId
  readonly timestamp: number
}>('DuplicateItemDefinitionError')

export type DuplicateItemDefinitionError = ReturnType<typeof DuplicateItemDefinitionError>

/**
 * データ整合性エラー
 */
export const DataIntegrityError = Data.tagged<{
  readonly _tag: 'DataIntegrityError'
  readonly message: string
  readonly affectedEntities: readonly string[]
  readonly timestamp: number
}>('DataIntegrityError')

export type DataIntegrityError = ReturnType<typeof DataIntegrityError>

/**
 * ストレージエラー
 */
export const StorageError = Data.tagged<{
  readonly _tag: 'StorageError'
  readonly storageType: string
  readonly operation: string
  readonly reason: string
  readonly timestamp: number
}>('StorageError')

export type StorageError = ReturnType<typeof StorageError>

/**
 * 検証エラー
 */
export const ValidationError = Data.tagged<{
  readonly _tag: 'ValidationError'
  readonly entityType: string
  readonly validationFailures: readonly string[]
  readonly timestamp: number
}>('ValidationError')

export type ValidationError = ReturnType<typeof ValidationError>

/**
 * 容量不足エラー
 */
export const InsufficientCapacityError = Data.tagged<{
  readonly _tag: 'InsufficientCapacityError'
  readonly playerId: PlayerId
  readonly requiredCapacity: number
  readonly availableCapacity: number
  readonly timestamp: number
}>('InsufficientCapacityError')

export type InsufficientCapacityError = ReturnType<typeof InsufficientCapacityError>

/**
 * アイテム数不足エラー
 */
export const InsufficientItemsError = Data.tagged<{
  readonly _tag: 'InsufficientItemsError'
  readonly playerId: PlayerId
  readonly itemId: ItemId
  readonly requestedQuantity: number
  readonly availableQuantity: number
  readonly timestamp: number
}>('InsufficientItemsError')

export type InsufficientItemsError = ReturnType<typeof InsufficientItemsError>

// =============================================================================
// Repository Error Union
// =============================================================================

/**
 * 全てのRepository操作エラーのUnion型
 */
export type AllRepositoryErrors =
  | RepositoryError
  | InventoryNotFoundError
  | ItemNotFoundError
  | ContainerNotFoundError
  | SlotNotFoundError
  | DuplicateInventoryError
  | DuplicateItemDefinitionError
  | DataIntegrityError
  | StorageError
  | ValidationError
  | InsufficientCapacityError
  | InsufficientItemsError

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Repository操作エラーを生成
 */
export const createRepositoryError = (operation: string, reason: string, details?: unknown): RepositoryError =>
  RepositoryError({
    operation,
    reason,
    details,
    timestamp: Date.now(),
  })

/**
 * インベントリ未発見エラーを生成
 */
export const createInventoryNotFoundError = (playerId: PlayerId): InventoryNotFoundError =>
  InventoryNotFoundError({
    playerId,
    timestamp: Date.now(),
  })

/**
 * アイテム未発見エラーを生成
 */
export const createItemNotFoundError = (itemId: ItemId): ItemNotFoundError =>
  ItemNotFoundError({
    itemId,
    timestamp: Date.now(),
  })

/**
 * コンテナ未発見エラーを生成
 */
export const createContainerNotFoundError = (containerId: ContainerId): ContainerNotFoundError =>
  ContainerNotFoundError({
    containerId,
    timestamp: Date.now(),
  })

/**
 * スロット未発見エラーを生成
 */
export const createSlotNotFoundError = (playerId: PlayerId, position: SlotPosition): SlotNotFoundError =>
  SlotNotFoundError({
    playerId,
    position,
    timestamp: Date.now(),
  })

/**
 * 重複インベントリエラーを生成
 */
export const createDuplicateInventoryError = (playerId: PlayerId): DuplicateInventoryError =>
  DuplicateInventoryError({
    playerId,
    timestamp: Date.now(),
  })

/**
 * 重複アイテム定義エラーを生成
 */
export const createDuplicateItemDefinitionError = (itemId: ItemId): DuplicateItemDefinitionError =>
  DuplicateItemDefinitionError({
    itemId,
    timestamp: Date.now(),
  })

/**
 * データ整合性エラーを生成
 */
export const createDataIntegrityError = (message: string, affectedEntities: readonly string[]): DataIntegrityError =>
  DataIntegrityError({
    message,
    affectedEntities,
    timestamp: Date.now(),
  })

/**
 * ストレージエラーを生成
 */
export const createStorageError = (storageType: string, operation: string, reason: string): StorageError =>
  StorageError({
    storageType,
    operation,
    reason,
    timestamp: Date.now(),
  })

/**
 * 検証エラーを生成
 */
export const createValidationError = (entityType: string, validationFailures: readonly string[]): ValidationError =>
  ValidationError({
    entityType,
    validationFailures,
    timestamp: Date.now(),
  })

/**
 * 容量不足エラーを生成
 */
export const createInsufficientCapacityError = (
  playerId: PlayerId,
  requiredCapacity: number,
  availableCapacity: number
): InsufficientCapacityError =>
  InsufficientCapacityError({
    playerId,
    requiredCapacity,
    availableCapacity,
    timestamp: Date.now(),
  })

/**
 * アイテム数不足エラーを生成
 */
export const createInsufficientItemsError = (
  playerId: PlayerId,
  itemId: ItemId,
  requestedQuantity: number,
  availableQuantity: number
): InsufficientItemsError =>
  InsufficientItemsError({
    playerId,
    itemId,
    requestedQuantity,
    availableQuantity,
    timestamp: Date.now(),
  })

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * RepositoryErrorかどうかを判定
 */
export const isRepositoryError = (error: unknown): error is RepositoryError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'RepositoryError'

/**
 * InventoryNotFoundErrorかどうかを判定
 */
export const isInventoryNotFoundError = (error: unknown): error is InventoryNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InventoryNotFoundError'

/**
 * ItemNotFoundErrorかどうかを判定
 */
export const isItemNotFoundError = (error: unknown): error is ItemNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'ItemNotFoundError'

/**
 * ContainerNotFoundErrorかどうかを判定
 */
export const isContainerNotFoundError = (error: unknown): error is ContainerNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'ContainerNotFoundError'

/**
 * SlotNotFoundErrorかどうかを判定
 */
export const isSlotNotFoundError = (error: unknown): error is SlotNotFoundError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'SlotNotFoundError'

/**
 * DuplicateInventoryErrorかどうかを判定
 */
export const isDuplicateInventoryError = (error: unknown): error is DuplicateInventoryError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'DuplicateInventoryError'

/**
 * DuplicateItemDefinitionErrorかどうかを判定
 */
export const isDuplicateItemDefinitionError = (error: unknown): error is DuplicateItemDefinitionError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'DuplicateItemDefinitionError'

/**
 * DataIntegrityErrorかどうかを判定
 */
export const isDataIntegrityError = (error: unknown): error is DataIntegrityError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'DataIntegrityError'

/**
 * StorageErrorかどうかを判定
 */
export const isStorageError = (error: unknown): error is StorageError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'StorageError'

/**
 * ValidationErrorかどうかを判定
 */
export const isValidationError = (error: unknown): error is ValidationError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'ValidationError'

/**
 * InsufficientCapacityErrorかどうかを判定
 */
export const isInsufficientCapacityError = (error: unknown): error is InsufficientCapacityError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InsufficientCapacityError'

/**
 * InsufficientItemsErrorかどうかを判定
 */
export const isInsufficientItemsError = (error: unknown): error is InsufficientItemsError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InsufficientItemsError'
