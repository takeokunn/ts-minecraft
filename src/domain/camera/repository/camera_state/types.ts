/**
 * Camera State Repository - Types
 *
 * Camera状態永続化のためのRepository専用型定義
 * Effect-TSのBrand型とSchema検証を活用した型安全な永続化抽象化
 */

import { Brand, Data, Option, Schema } from 'effect'
import type { CameraId, CameraRotation, CameraSettings, Position3D } from '../../types/index.js'
import type { ViewMode } from '../../value_object/index.js'

// ========================================
// Repository専用Brand型定義
// ========================================

/**
 * Camera Snapshot - Camera状態のスナップショット
 */
export type CameraSnapshot = Brand<
  {
    readonly cameraId: CameraId
    readonly position: Position3D
    readonly rotation: CameraRotation
    readonly viewMode: ViewMode
    readonly settings: CameraSettings
    readonly timestamp: number
    readonly version: number
  },
  'CameraSnapshot'
>

/**
 * Camera State Query Options - 状態クエリ設定
 */
export type CameraStateQueryOptions = Brand<
  {
    readonly includeHistory: boolean
    readonly maxHistoryItems: number
    readonly filterByViewMode: Option<ViewMode>
  },
  'CameraStateQueryOptions'
>

/**
 * Version Number - Snapshot バージョン番号
 */
export type VersionNumber = Brand<number, 'VersionNumber'>

/**
 * Snapshot Timestamp - タイムスタンプ
 */
export type SnapshotTimestamp = Brand<number, 'SnapshotTimestamp'>

// ========================================
// Repository Error 型定義
// ========================================

/**
 * Repository Error - Repository操作エラー
 */
export type RepositoryError = Data.TaggedEnum<{
  readonly EntityNotFound: {
    readonly entityType: string
    readonly entityId: string
  }
  readonly DuplicateEntity: {
    readonly entityType: string
    readonly entityId: string
  }
  readonly ValidationFailed: {
    readonly message: string
    readonly details: Option<string>
  }
  readonly OperationFailed: {
    readonly operation: string
    readonly reason: string
  }
  readonly StorageError: {
    readonly message: string
    readonly cause: Option<unknown>
  }
  readonly EncodingFailed: {
    readonly entityType: string
    readonly reason: string
  }
  readonly DecodingFailed: {
    readonly entityType: string
    readonly reason: string
  }
}>

// ========================================
// Camera Aggregate Type for Repository
// ========================================

/**
 * Camera - Repository層で扱うCameraエンティティ
 *
 * 注意: これは永続化用の簡略化された表現です
 * 完全なCameraドメインオブジェクトとは異なります
 */
export type Camera = Brand<
  {
    readonly id: CameraId
    readonly position: Position3D
    readonly rotation: CameraRotation
    readonly viewMode: ViewMode
    readonly settings: CameraSettings
    readonly lastUpdateTime: number
    readonly isActive: boolean
  },
  'Camera'
>

/**
 * Player ID - プレイヤー識別子
 */
export type PlayerId = Brand<string, 'PlayerId'>

// ========================================
// Schema定義
// ========================================

/**
 * Camera Snapshot Schema
 */
export const CameraSnapshotSchema = Schema.Struct({
  cameraId: Schema.String.pipe(Schema.brand('CameraId')),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.Number,
  }),
  viewMode: Schema.String,
  settings: Schema.Struct({
    fov: Schema.Number,
    sensitivity: Schema.Number,
    smoothing: Schema.Number,
  }),
  timestamp: Schema.Number.pipe(Schema.positive()),
  version: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('CameraSnapshot'))

/**
 * Camera State Query Options Schema
 */
export const CameraStateQueryOptionsSchema = Schema.Struct({
  includeHistory: Schema.Boolean,
  maxHistoryItems: Schema.Number.pipe(Schema.positive()),
  filterByViewMode: Schema.OptionFromNullable(Schema.String),
}).pipe(Schema.brand('CameraStateQueryOptions'))

/**
 * Repository Error Schema
 */
export const RepositoryErrorSchema = Schema.TaggedEnum<RepositoryError>()({
  EntityNotFound: Schema.Struct({
    entityType: Schema.String,
    entityId: Schema.String,
  }),
  DuplicateEntity: Schema.Struct({
    entityType: Schema.String,
    entityId: Schema.String,
  }),
  ValidationFailed: Schema.Struct({
    message: Schema.String,
    details: Schema.OptionFromNullable(Schema.String),
  }),
  OperationFailed: Schema.Struct({
    operation: Schema.String,
    reason: Schema.String,
  }),
  StorageError: Schema.Struct({
    message: Schema.String,
    cause: Schema.OptionFromNullable(Schema.Unknown),
  }),
  EncodingFailed: Schema.Struct({
    entityType: Schema.String,
    reason: Schema.String,
  }),
  DecodingFailed: Schema.Struct({
    entityType: Schema.String,
    reason: Schema.String,
  }),
})

/**
 * Camera Schema
 */
export const CameraSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('CameraId')),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
    roll: Schema.Number,
  }),
  viewMode: Schema.String,
  settings: Schema.Struct({
    fov: Schema.Number,
    sensitivity: Schema.Number,
    smoothing: Schema.Number,
  }),
  lastUpdateTime: Schema.Number.pipe(Schema.positive()),
  isActive: Schema.Boolean,
}).pipe(Schema.brand('Camera'))

/**
 * Player ID Schema
 */
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))

/**
 * Version Number Schema
 */
export const VersionNumberSchema = Schema.Number.pipe(Schema.positive(), Schema.brand('VersionNumber'))

/**
 * Snapshot Timestamp Schema
 */
export const SnapshotTimestampSchema = Schema.Number.pipe(Schema.positive(), Schema.brand('SnapshotTimestamp'))

// ========================================
// Repository Error Factory Functions
// ========================================

/**
 * Repository Error Factory
 */
export const createRepositoryError = {
  entityNotFound: (entityType: string, entityId: string): RepositoryError =>
    Data.tagged('EntityNotFound', { entityType, entityId }),

  duplicateEntity: (entityType: string, entityId: string): RepositoryError =>
    Data.tagged('DuplicateEntity', { entityType, entityId }),

  validationFailed: (message: string, details?: string): RepositoryError =>
    Data.tagged('ValidationFailed', {
      message,
      details: details ? Option.some(details) : Option.none(),
    }),

  operationFailed: (operation: string, reason: string): RepositoryError =>
    Data.tagged('OperationFailed', { operation, reason }),

  storageError: (message: string, cause?: unknown): RepositoryError =>
    Data.tagged('StorageError', {
      message,
      cause: cause ? Option.some(cause) : Option.none(),
    }),

  encodingFailed: (entityType: string, reason: string): RepositoryError =>
    Data.tagged('EncodingFailed', { entityType, reason }),

  decodingFailed: (entityType: string, reason: string): RepositoryError =>
    Data.tagged('DecodingFailed', { entityType, reason }),
} as const

// ========================================
// Type Guards
// ========================================

/**
 * Repository Error Type Guards
 */
export const isEntityNotFoundError = (error: RepositoryError): boolean => error._tag === 'EntityNotFound'

export const isValidationError = (error: RepositoryError): boolean => error._tag === 'ValidationFailed'

export const isStorageError = (error: RepositoryError): boolean => error._tag === 'StorageError'

export const isEncodingError = (error: RepositoryError): boolean => error._tag === 'EncodingFailed'

export const isDecodingError = (error: RepositoryError): boolean => error._tag === 'DecodingFailed'
