/**
 * @fileoverview World Domain Errors
 * 世界ドメインの構造化エラー定義
 */

import { Data, Schema } from 'effect'
import { WorldId, ChunkPosition, DimensionId, Vector3D } from '../core/world-types'

// === 基本エラー情報型 ===

/** エラーコンテキスト - エラーの発生状況を表す */
export interface ErrorContext {
  readonly timestamp: Date
  readonly worldId?: WorldId
  readonly position?: Vector3D
  readonly chunkPosition?: ChunkPosition
  readonly dimensionId?: DimensionId
  readonly operationId?: string
  readonly userId?: string
  readonly additionalData?: Record<string, unknown>
}

export const ErrorContextSchema = Schema.Struct({
  timestamp: Schema.DateFromSelf,
  worldId: Schema.optional(Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema))),
  position: Schema.optional(Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema))),
  chunkPosition: Schema.optional(Schema.suspend(() => import('../core/world-types').then(m => m.ChunkPositionSchema))),
  dimensionId: Schema.optional(Schema.suspend(() => import('../core/world-types').then(m => m.DimensionIdSchema))),
  operationId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  additionalData: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}).pipe(
  Schema.annotations({
    title: 'Error Context',
    description: 'Contextual information about error occurrence',
  })
)

// === 世界管理エラー ===

/** 世界が存在しないエラー */
export class WorldNotFoundError extends Data.TaggedError('WorldNotFoundError')<{
  readonly worldId: WorldId
  readonly context: ErrorContext
  readonly suggestedAction?: string
}> {
  get message() {
    return `World not found: ${this.worldId}${this.suggestedAction ? ` - ${this.suggestedAction}` : ''}`
  }
}

export const WorldNotFoundErrorSchema = Schema.TaggedStruct('WorldNotFoundError', {
  worldId: Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema)),
  context: ErrorContextSchema,
  suggestedAction: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'World Not Found Error',
    description: 'Error when attempting to access a non-existent world',
  })
)

/** 世界作成失敗エラー */
export class WorldCreationError extends Data.TaggedError('WorldCreationError')<{
  readonly worldId: WorldId
  readonly reason: string
  readonly context: ErrorContext
  readonly cause?: unknown
}> {
  get message() {
    return `Failed to create world ${this.worldId}: ${this.reason}`
  }
}

export const WorldCreationErrorSchema = Schema.TaggedStruct('WorldCreationError', {
  worldId: Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema)),
  reason: Schema.String,
  context: ErrorContextSchema,
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'World Creation Error',
    description: 'Error when world creation fails',
  })
)

/** 世界読み込み失敗エラー */
export class WorldLoadError extends Data.TaggedError('WorldLoadError')<{
  readonly worldId: WorldId
  readonly stage: 'initialization' | 'chunk_loading' | 'player_spawn' | 'world_generation'
  readonly reason: string
  readonly context: ErrorContext
  readonly recoverable: boolean
}> {
  get message() {
    return `Failed to load world ${this.worldId} at stage '${this.stage}': ${this.reason}`
  }
}

export const WorldLoadErrorSchema = Schema.TaggedStruct('WorldLoadError', {
  worldId: Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema)),
  stage: Schema.Literal('initialization', 'chunk_loading', 'player_spawn', 'world_generation'),
  reason: Schema.String,
  context: ErrorContextSchema,
  recoverable: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'World Load Error',
    description: 'Error during world loading process',
  })
)

/** 世界保存失敗エラー */
export class WorldSaveError extends Data.TaggedError('WorldSaveError')<{
  readonly worldId: WorldId
  readonly affectedChunks: readonly ChunkPosition[]
  readonly reason: string
  readonly context: ErrorContext
  readonly dataLoss: boolean
}> {
  get message() {
    return `Failed to save world ${this.worldId}: ${this.reason} (${this.affectedChunks.length} chunks affected)`
  }
}

export const WorldSaveErrorSchema = Schema.TaggedStruct('WorldSaveError', {
  worldId: Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema)),
  affectedChunks: Schema.Array(Schema.suspend(() => import('../core/world-types').then(m => m.ChunkPositionSchema))),
  reason: Schema.String,
  context: ErrorContextSchema,
  dataLoss: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'World Save Error',
    description: 'Error when saving world data fails',
  })
)

// === 座標・境界エラー ===

/** 座標が無効エラー */
export class InvalidCoordinateError extends Data.TaggedError('InvalidCoordinateError')<{
  readonly coordinate: Vector3D
  readonly reason: string
  readonly validRange?: { min: Vector3D; max: Vector3D }
  readonly context: ErrorContext
}> {
  get message() {
    return `Invalid coordinate (${this.coordinate.x}, ${this.coordinate.y}, ${this.coordinate.z}): ${this.reason}`
  }
}

export const InvalidCoordinateErrorSchema = Schema.TaggedStruct('InvalidCoordinateError', {
  coordinate: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
  reason: Schema.String,
  validRange: Schema.optional(Schema.Struct({
    min: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
    max: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
  })),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Invalid Coordinate Error',
    description: 'Error when coordinates are outside valid range',
  })
)

/** 世界境界外エラー */
export class OutOfWorldBoundsError extends Data.TaggedError('OutOfWorldBoundsError')<{
  readonly position: Vector3D
  readonly worldBounds: { min: Vector3D; max: Vector3D }
  readonly context: ErrorContext
  readonly autoCorrect?: Vector3D
}> {
  get message() {
    return `Position (${this.position.x}, ${this.position.y}, ${this.position.z}) is outside world bounds`
  }
}

export const OutOfWorldBoundsErrorSchema = Schema.TaggedStruct('OutOfWorldBoundsError', {
  position: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
  worldBounds: Schema.Struct({
    min: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
    max: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
  }),
  context: ErrorContextSchema,
  autoCorrect: Schema.optional(Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema))),
}).pipe(
  Schema.annotations({
    title: 'Out Of World Bounds Error',
    description: 'Error when position is outside world boundaries',
  })
)

/** チャンク境界外エラー */
export class OutOfChunkBoundsError extends Data.TaggedError('OutOfChunkBoundsError')<{
  readonly position: Vector3D
  readonly chunkPosition: ChunkPosition
  readonly context: ErrorContext
}> {
  get message() {
    return `Position (${this.position.x}, ${this.position.y}, ${this.position.z}) is outside chunk bounds at (${this.chunkPosition.x}, ${this.chunkPosition.z})`
  }
}

export const OutOfChunkBoundsErrorSchema = Schema.TaggedStruct('OutOfChunkBoundsError', {
  position: Schema.suspend(() => import('../core/world-types').then(m => m.Vector3DSchema)),
  chunkPosition: Schema.suspend(() => import('../core/world-types').then(m => m.ChunkPositionSchema)),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Out Of Chunk Bounds Error',
    description: 'Error when position is outside chunk boundaries',
  })
)

// === 次元エラー ===

/** 次元が存在しないエラー */
export class DimensionNotFoundError extends Data.TaggedError('DimensionNotFoundError')<{
  readonly dimensionId: DimensionId
  readonly worldId: WorldId
  readonly context: ErrorContext
  readonly availableDimensions: readonly DimensionId[]
}> {
  get message() {
    return `Dimension '${this.dimensionId}' not found in world '${this.worldId}'`
  }
}

export const DimensionNotFoundErrorSchema = Schema.TaggedStruct('DimensionNotFoundError', {
  dimensionId: Schema.suspend(() => import('../core/world-types').then(m => m.DimensionIdSchema)),
  worldId: Schema.suspend(() => import('../core/world-types').then(m => m.WorldIdSchema)),
  context: ErrorContextSchema,
  availableDimensions: Schema.Array(Schema.suspend(() => import('../core/world-types').then(m => m.DimensionIdSchema))),
}).pipe(
  Schema.annotations({
    title: 'Dimension Not Found Error',
    description: 'Error when attempting to access non-existent dimension',
  })
)

/** 次元切り替え失敗エラー */
export class DimensionSwitchError extends Data.TaggedError('DimensionSwitchError')<{
  readonly fromDimension: DimensionId
  readonly toDimension: DimensionId
  readonly playerId: string
  readonly reason: string
  readonly context: ErrorContext
}> {
  get message() {
    return `Failed to switch player ${this.playerId} from '${this.fromDimension}' to '${this.toDimension}': ${this.reason}`
  }
}

export const DimensionSwitchErrorSchema = Schema.TaggedStruct('DimensionSwitchError', {
  fromDimension: Schema.suspend(() => import('../core/world-types').then(m => m.DimensionIdSchema)),
  toDimension: Schema.suspend(() => import('../core/world-types').then(m => m.DimensionIdSchema)),
  playerId: Schema.String,
  reason: Schema.String,
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Dimension Switch Error',
    description: 'Error when player dimension switching fails',
  })
)

// === パフォーマンス関連エラー ===

/** メモリ不足エラー */
export class InsufficientMemoryError extends Data.TaggedError('InsufficientMemoryError')<{
  readonly requestedMemory: number // bytes
  readonly availableMemory: number // bytes
  readonly operation: string
  readonly context: ErrorContext
  readonly suggestedActions: readonly string[]
}> {
  get message() {
    return `Insufficient memory for ${this.operation}: requested ${this.requestedMemory} bytes, available ${this.availableMemory} bytes`
  }
}

export const InsufficientMemoryErrorSchema = Schema.TaggedStruct('InsufficientMemoryError', {
  requestedMemory: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  availableMemory: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  operation: Schema.String,
  context: ErrorContextSchema,
  suggestedActions: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Insufficient Memory Error',
    description: 'Error when system runs out of memory',
  })
)

/** タイムアウトエラー */
export class OperationTimeoutError extends Data.TaggedError('OperationTimeoutError')<{
  readonly operation: string
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly context: ErrorContext
  readonly retryable: boolean
}> {
  get message() {
    return `Operation '${this.operation}' timed out after ${this.elapsedMs}ms (limit: ${this.timeoutMs}ms)`
  }
}

export const OperationTimeoutErrorSchema = Schema.TaggedStruct('OperationTimeoutError', {
  operation: Schema.String,
  timeoutMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  elapsedMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  context: ErrorContextSchema,
  retryable: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Operation Timeout Error',
    description: 'Error when operation exceeds time limit',
  })
)

// === 設定エラー ===

/** 無効な世界設定エラー */
export class InvalidWorldSettingsError extends Data.TaggedError('InvalidWorldSettingsError')<{
  readonly settingName: string
  readonly providedValue: unknown
  readonly expectedType: string
  readonly validValues?: readonly unknown[]
  readonly context: ErrorContext
}> {
  get message() {
    return `Invalid world setting '${this.settingName}': expected ${this.expectedType}, got ${typeof this.providedValue}`
  }
}

export const InvalidWorldSettingsErrorSchema = Schema.TaggedStruct('InvalidWorldSettingsError', {
  settingName: Schema.String,
  providedValue: Schema.Unknown,
  expectedType: Schema.String,
  validValues: Schema.optional(Schema.Array(Schema.Unknown)),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Invalid World Settings Error',
    description: 'Error when world settings are invalid',
  })
)

// === エラー統合型 ===

/** 世界ドメインの全エラー型 */
export type WorldDomainError =
  | WorldNotFoundError
  | WorldCreationError
  | WorldLoadError
  | WorldSaveError
  | InvalidCoordinateError
  | OutOfWorldBoundsError
  | OutOfChunkBoundsError
  | DimensionNotFoundError
  | DimensionSwitchError
  | InsufficientMemoryError
  | OperationTimeoutError
  | InvalidWorldSettingsError

export const WorldDomainErrorSchema = Schema.Union(
  WorldNotFoundErrorSchema,
  WorldCreationErrorSchema,
  WorldLoadErrorSchema,
  WorldSaveErrorSchema,
  InvalidCoordinateErrorSchema,
  OutOfWorldBoundsErrorSchema,
  OutOfChunkBoundsErrorSchema,
  DimensionNotFoundErrorSchema,
  DimensionSwitchErrorSchema,
  InsufficientMemoryErrorSchema,
  OperationTimeoutErrorSchema,
  InvalidWorldSettingsErrorSchema
).pipe(
  Schema.annotations({
    title: 'World Domain Error',
    description: 'Union of all world domain errors',
  })
)

// === エラー作成ヘルパー関数 ===

/** ErrorContext作成ヘルパー */
export const createErrorContext = (
  overrides: Partial<ErrorContext> = {}
): ErrorContext => ({
  timestamp: new Date(),
  ...overrides,
})

/** WorldNotFoundError作成ヘルパー */
export const createWorldNotFoundError = (
  worldId: WorldId,
  context?: Partial<ErrorContext>,
  suggestedAction?: string
): WorldNotFoundError =>
  new WorldNotFoundError({
    worldId,
    context: createErrorContext(context),
    suggestedAction,
  })

/** InvalidCoordinateError作成ヘルパー */
export const createInvalidCoordinateError = (
  coordinate: Vector3D,
  reason: string,
  context?: Partial<ErrorContext>,
  validRange?: { min: Vector3D; max: Vector3D }
): InvalidCoordinateError =>
  new InvalidCoordinateError({
    coordinate,
    reason,
    context: createErrorContext(context),
    validRange,
  })

/** OperationTimeoutError作成ヘルパー */
export const createOperationTimeoutError = (
  operation: string,
  timeoutMs: number,
  elapsedMs: number,
  context?: Partial<ErrorContext>,
  retryable: boolean = true
): OperationTimeoutError =>
  new OperationTimeoutError({
    operation,
    timeoutMs,
    elapsedMs,
    context: createErrorContext(context),
    retryable,
  })