/**
 * InventoryStorageService - インフラ層の永続化サービス
 *
 * Effect-TS を基盤に LocalStorage / IndexedDB / ハイブリッド構成を抽象化し、
 * 型安全かつ宣言的な API として提供する。
 *
 * ポリシー:
 * - 制御構文は Effect combinator / Match による表現のみを使用
 * - Brand 型・ADT を駆使して型アサーション / `unknown` / 非 null 断言を排除
 * - class は一切使用せず Data.tagged の ADT でエラー体系を定義
 */

import type { ParseError } from '@effect/schema/ParseResult'
import { isParseError } from '@effect/schema/ParseResult'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Context, Data, Effect, Option, pipe, Schema } from 'effect'
import { isJsonSerializable, toJsonValue, type JsonValue } from '@/shared/schema/json'
import type { Inventory, InventoryState, PlayerId } from '../../domain/inventory'
import { PlayerIdSchema } from '../../domain/inventory'

// =============================================================================
// ストレージ種別とキー定義
// =============================================================================

export const StorageBackendSchema = Schema.Literal('localStorage', 'indexedDB', 'hybrid').pipe(
  Schema.brand('InventoryStorageBackend'),
  Schema.annotations({
    title: 'InventoryStorageBackend',
    description: 'インベントリ永続化に利用するバックエンド種別',
  })
)

export type StorageBackend = Schema.Schema.Type<typeof StorageBackendSchema>

const storageKeyPattern = /^minecraft:inventory:[a-fA-F0-9-]{36}$/
const backupKeyPattern = /^minecraft:inventory:backup:[a-fA-F0-9-]{36}:[0-9]{13}:[a-z0-9]{9}$/

export const StorageKeySchema = Schema.String.pipe(
  Schema.pattern(storageKeyPattern),
  Schema.brand('InventoryStorageKey'),
  Schema.annotations({ title: 'InventoryStorageKey' })
)
export type StorageKey = Schema.Schema.Type<typeof StorageKeySchema>

export const BackupKeySchema = Schema.String.pipe(
  Schema.pattern(backupKeyPattern),
  Schema.brand('InventoryBackupKey'),
  Schema.annotations({ title: 'InventoryBackupKey' })
)
export type BackupKey = Schema.Schema.Type<typeof BackupKeySchema>

// Re-export from units
export { MillisecondsSchema, type Milliseconds } from '../../domain/shared/value_object/units'

const BackupSlotSchema = Schema.Number.pipe(Schema.int(), Schema.between(1, 10), Schema.brand('BackupSlotCount'))
export type BackupSlotCount = Schema.Schema.Type<typeof BackupSlotSchema>

export const StorageConfigSchema = Schema.Struct({
  backend: StorageBackendSchema,
  autoSave: Schema.Boolean,
  saveInterval: MillisecondsSchema,
  backupSlots: BackupSlotSchema,
  compression: Schema.Boolean,
}).pipe(Schema.brand('InventoryStorageConfig'), Schema.annotations({ title: 'InventoryStorageConfig' }))

export type StorageConfig = Schema.Schema.Type<typeof StorageConfigSchema>

export const defaultStorageConfig: StorageConfig = Schema.decodeUnknownSync(StorageConfigSchema)({
  backend: 'hybrid',
  autoSave: true,
  saveInterval: 5_000,
  backupSlots: 3,
  compression: false,
})

// =============================================================================
// エラー体系 (ADT)
// =============================================================================

interface FailureFields {
  readonly backend: StorageBackend
  readonly message: string
  readonly cause: Option.Option<StorageFailureCause>
}

interface FailureWithContext extends FailureFields {
  readonly context: string
}

interface FailureWithQuota extends FailureFields {
  readonly quotaBytes: number
}

export interface StorageNotAvailableError extends FailureFields {
  readonly _tag: 'NotAvailable'
}

export interface StorageSaveFailedError extends FailureWithContext {
  readonly _tag: 'SaveFailed'
}

export interface StorageLoadFailedError extends FailureWithContext {
  readonly _tag: 'LoadFailed'
}

export interface StorageCorruptedError extends FailureFields {
  readonly _tag: 'Corrupted'
}

export interface StorageQuotaExceededError extends FailureWithQuota {
  readonly _tag: 'QuotaExceeded'
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

export type StorageFailureCause = ParseError | Error | JsonValue

export const toStorageFailureCause = (value: unknown): StorageFailureCause | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (isParseError(value)) {
    return value
  }

  if (value instanceof Error) {
    return value
  }

  if (isJsonSerializable(value)) {
    return toJsonValue(value)
  }

  return String(value)
}

const withCause = (value: StorageFailureCause | null | undefined) => Option.fromNullable(value ?? null)

const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

export const toNotAvailable = (
  backend: StorageBackend,
  message: string,
  cause?: StorageFailureCause | null
): StorageError => StorageErrors.NotAvailable({ backend, message, cause: withCause(cause) })

export const toSaveFailed = (
  backend: StorageBackend,
  context: string,
  message: string,
  cause?: StorageFailureCause | null
): StorageError => StorageErrors.SaveFailed({ backend, context, message, cause: withCause(cause) })

export const toLoadFailed = (
  backend: StorageBackend,
  context: string,
  message: string,
  cause?: StorageFailureCause | null
): StorageError => StorageErrors.LoadFailed({ backend, context, message, cause: withCause(cause) })

export const toCorrupted = (
  backend: StorageBackend,
  message: string,
  cause?: StorageFailureCause | null
): StorageError => StorageErrors.Corrupted({ backend, message, cause: withCause(cause) })

export const toQuotaExceeded = (
  backend: StorageBackend,
  message: string,
  quotaBytes: number,
  cause?: StorageFailureCause | null
): StorageError => StorageErrors.QuotaExceeded({ backend, message, quotaBytes, cause: withCause(cause) })

// =============================================================================
// 公開 API
// =============================================================================

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
  readonly restoreBackup: (playerId: PlayerId, snapshot: BackupSnapshot) => Effect.Effect<Inventory, StorageError>
  readonly clearAllData: () => Effect.Effect<void, StorageError>
  readonly getStorageInfo: () => Effect.Effect<StorageInfo, StorageError>
}

export const InventoryStorageService = Context.GenericTag<InventoryStorageService>(
  '@minecraft/infrastructure/inventory/StorageService'
)

// =============================================================================
// 共通ユーティリティ
// =============================================================================

const decode = <A>(
  schema: Schema.Schema<A>,
  value: unknown,
  backend: StorageBackend,
  context: string
): Effect.Effect<A, StorageError> =>
  pipe(
    Schema.decodeUnknown(schema)(value),
    Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
  )

export const makeStorageKey = (playerId: PlayerId): Effect.Effect<StorageKey, StorageError> =>
  pipe(
    Schema.encode(PlayerIdSchema)(playerId),
    Effect.map((encoded) => `minecraft:inventory:${encoded}`),
    Effect.flatMap((raw) => decode(StorageKeySchema, raw, 'localStorage', 'storage-key'))
  )

export const makeBackupKey = (
  playerId: PlayerId,
  timestamp: Milliseconds,
  nonce: string
): Effect.Effect<BackupKey, StorageError> =>
  Effect.gen(function* () {
    const encodedPlayerId = yield* Schema.encode(PlayerIdSchema)(playerId)
    const encodedMillis = yield* Schema.encode(MillisecondsSchema)(timestamp)
    const raw = `minecraft:inventory:backup:${encodedPlayerId}:${encodedMillis}:${nonce}`
    return yield* decode(BackupKeySchema, raw, 'localStorage', 'backup-key')
  })
