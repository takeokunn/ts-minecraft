import { Schema } from '@effect/schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Context, Data, Effect, Option, pipe } from 'effect'
import type { Inventory, InventoryState, PlayerId } from '../inventory-types'

export const StorageBackendSchema = Schema.Literal('localStorage', 'indexedDB', 'hybrid').pipe(
  Schema.brand('InventoryStorageBackend'),
  Schema.annotations({
    title: 'InventoryStorageBackend',
    description: 'インベントリ永続化に利用するバックエンド種別',
  })
)
export type StorageBackend = Schema.Schema.Type<typeof StorageBackendSchema>

export const StorageKeySchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:inventory:[a-fA-F0-9-]{36}$/),
  Schema.brand('InventoryStorageKey'),
  Schema.annotations({ title: 'InventoryStorageKey' })
)
export type StorageKey = Schema.Schema.Type<typeof StorageKeySchema>

export const BackupKeySchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:inventory:backup:[a-fA-F0-9-]{36}:[0-9]{13}:[a-z0-9]{9}$/),
  Schema.brand('InventoryBackupKey'),
  Schema.annotations({ title: 'InventoryBackupKey' })
)
export type BackupKey = Schema.Schema.Type<typeof BackupKeySchema>

export const MillisecondsSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('Milliseconds')
)
export type Milliseconds = Schema.Schema.Type<typeof MillisecondsSchema>

const BackupSlotSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 10),
  Schema.brand('BackupSlotCount')
)
export type BackupSlotCount = Schema.Schema.Type<typeof BackupSlotSchema>

export const StorageConfigSchema = Schema.Struct({
  backend: StorageBackendSchema,
  autoSave: Schema.Boolean,
  saveInterval: MillisecondsSchema,
  backupSlots: BackupSlotSchema,
  compression: Schema.Boolean,
}).pipe(
  Schema.brand('InventoryStorageConfig'),
  Schema.annotations({ title: 'InventoryStorageConfig' })
)
export type StorageConfig = Schema.Schema.Type<typeof StorageConfigSchema>

export const defaultStorageConfig: StorageConfig = Schema.decodeUnknownSync(StorageConfigSchema)({
  backend: 'hybrid',
  autoSave: true,
  saveInterval: 5_000,
  backupSlots: 3,
  compression: false,
})

export interface StorageNotAvailableError {
  readonly _tag: 'NotAvailable'
  readonly backend: StorageBackend
  readonly message: string
  readonly cause: Option.Option<unknown>
}

export interface StorageSaveFailedError {
  readonly _tag: 'SaveFailed'
  readonly backend: StorageBackend
  readonly context: string
  readonly message: string
  readonly cause: Option.Option<unknown>
}

export interface StorageLoadFailedError {
  readonly _tag: 'LoadFailed'
  readonly backend: StorageBackend
  readonly context: string
  readonly message: string
  readonly cause: Option.Option<unknown>
}

export interface StorageCorruptedError {
  readonly _tag: 'Corrupted'
  readonly backend: StorageBackend
  readonly message: string
  readonly cause: Option.Option<unknown>
}

export interface StorageQuotaExceededError {
  readonly _tag: 'QuotaExceeded'
  readonly backend: StorageBackend
  readonly message: string
  readonly quotaBytes: number
  readonly cause: Option.Option<unknown>
}

export type StorageError =
  | StorageNotAvailableError
  | StorageSaveFailedError
  | StorageLoadFailedError
  | StorageCorruptedError
  | StorageQuotaExceededError

export const StorageErrors = {
  NotAvailable: Data.tagged<StorageNotAvailableError>('NotAvailable'),
  SaveFailed: Data.tagged<StorageSaveFailedError>('SaveFailed'),
  LoadFailed: Data.tagged<StorageLoadFailedError>('LoadFailed'),
  Corrupted: Data.tagged<StorageCorruptedError>('Corrupted'),
  QuotaExceeded: Data.tagged<StorageQuotaExceededError>('QuotaExceeded'),
}

const withCause = (value: unknown) => Option.fromNullable(value)

export const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

export const toNotAvailable = (backend: StorageBackend, message: string, cause?: unknown): StorageError =>
  StorageErrors.NotAvailable({ backend, message, cause: withCause(cause) })

export const toSaveFailed = (
  backend: StorageBackend,
  context: string,
  message: string,
  cause?: unknown
): StorageError => StorageErrors.SaveFailed({ backend, context, message, cause: withCause(cause) })

export const toLoadFailed = (
  backend: StorageBackend,
  context: string,
  message: string,
  cause?: unknown
): StorageError => StorageErrors.LoadFailed({ backend, context, message, cause: withCause(cause) })

export const toCorrupted = (backend: StorageBackend, message: string, cause?: unknown): StorageError =>
  StorageErrors.Corrupted({ backend, message, cause: withCause(cause) })

export const toQuotaExceeded = (
  backend: StorageBackend,
  message: string,
  quotaBytes: number,
  cause?: unknown
): StorageError => StorageErrors.QuotaExceeded({ backend, message, quotaBytes, cause: withCause(cause) })

export interface StorageInfo {
  readonly totalSize: number
  readonly availableSpace: number
  readonly itemCount: number
}

export interface BackupSnapshot {
  readonly key: BackupKey
  readonly createdAt: Milliseconds
}

export interface InventoryStorageService {
  readonly backend: StorageBackend
  readonly config: StorageConfig
  readonly saveInventory: (playerId: PlayerId, inventory: Inventory) => Effect.Effect<void, StorageError>
  readonly loadInventory: (playerId: PlayerId) => Effect.Effect<Option.Option<Inventory>, StorageError>
  readonly saveInventoryState: (state: InventoryState) => Effect.Effect<void, StorageError>
  readonly loadInventoryState: (playerId: PlayerId) => Effect.Effect<Option.Option<InventoryState>, StorageError>
  readonly deleteInventory: (playerId: PlayerId) => Effect.Effect<void, StorageError>
  readonly listStoredInventories: () => Effect.Effect<ReadonlyArray<PlayerId>, StorageError>
  readonly createBackup: (
    playerId: PlayerId
  ) => Effect.Effect<BackupSnapshot & { readonly payload: Inventory }, StorageError>
  readonly restoreBackup: (
    playerId: PlayerId,
    snapshot: BackupSnapshot
  ) => Effect.Effect<Inventory, StorageError>
  readonly clearAllData: () => Effect.Effect<void, StorageError>
  readonly getStorageInfo: () => Effect.Effect<StorageInfo, StorageError>
}

export type InventoryStoragePort = InventoryStorageService

export const InventoryStorageService = Context.GenericTag<InventoryStorageService>(
  '@mc/domain/inventory/StoragePort'
)

export const decodeWith = <A>(
  schema: Schema.Schema<A>,
  value: unknown,
  backend: StorageBackend,
  context: string
): Effect.Effect<A, StorageError> =>
  pipe(
    Schema.decodeUnknown(schema)(value),
    Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
  )
