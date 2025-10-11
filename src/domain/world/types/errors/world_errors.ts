/**
 * @fileoverview World Domain Errors
 * 世界ドメインの構造化エラー定義
 */

import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import type { JsonValue } from '@shared/schema/json'
import { JsonValueSchema } from '@shared/schema/json'
import { DateTime, Effect, Schema } from 'effect'
import {
  ChunkPosition,
  ChunkPositionSchema,
  DimensionId,
  DimensionIdSchema,
  Vector3D,
  Vector3DSchema,
  WorldId,
  WorldIdSchema,
} from '../core'

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
  readonly additionalData?: Record<string, JsonValue>
}

export const ErrorContextSchema = Schema.Struct({
  timestamp: Schema.DateFromSelf,
  worldId: Schema.optional(Schema.suspend(() => WorldIdSchema)),
  position: Schema.optional(Schema.suspend(() => Vector3DSchema)),
  chunkPosition: Schema.optional(Schema.suspend(() => ChunkPositionSchema)),
  dimensionId: Schema.optional(Schema.suspend(() => DimensionIdSchema)),
  operationId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  additionalData: Schema.optional(Schema.Record({ key: Schema.String, value: JsonValueSchema })),
}).pipe(
  Schema.annotations({
    title: 'Error Context',
    description: 'Contextual information about error occurrence',
  })
)

// === 世界管理エラー ===

/** 世界が存在しないエラー */
export const WorldNotFoundErrorSchema = Schema.TaggedStruct('WorldNotFoundError', {
  worldId: Schema.suspend(() => WorldIdSchema),
  context: ErrorContextSchema,
  suggestedAction: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'World Not Found Error',
    description: 'Error when attempting to access a non-existent world',
  })
)
export type WorldNotFoundError = Schema.Schema.Type<typeof WorldNotFoundErrorSchema>

export const getWorldNotFoundErrorMessage = (error: WorldNotFoundError): string =>
  `World not found: ${error.worldId}${error.suggestedAction ? ` - ${error.suggestedAction}` : ''}`

/** 世界作成失敗エラー */
export const WorldCreationErrorSchema = Schema.TaggedStruct('WorldCreationError', {
  worldId: Schema.suspend(() => WorldIdSchema),
  reason: Schema.String,
  context: ErrorContextSchema,
  cause: Schema.optional(ErrorCauseSchema),
}).pipe(
  Schema.annotations({
    title: 'World Creation Error',
    description: 'Error when world creation fails',
  })
)
export type WorldCreationError = Schema.Schema.Type<typeof WorldCreationErrorSchema>

export const getWorldCreationErrorMessage = (error: WorldCreationError): string =>
  `Failed to create world ${error.worldId}: ${error.reason}`

/** 世界読み込み失敗エラー */
export const WorldLoadErrorSchema = Schema.TaggedStruct('WorldLoadError', {
  worldId: Schema.suspend(() => WorldIdSchema),
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
export type WorldLoadError = Schema.Schema.Type<typeof WorldLoadErrorSchema>

export const getWorldLoadErrorMessage = (error: WorldLoadError): string =>
  `Failed to load world ${error.worldId} at stage '${error.stage}': ${error.reason}`

/** 世界保存失敗エラー */
export const WorldSaveErrorSchema = Schema.TaggedStruct('WorldSaveError', {
  worldId: Schema.suspend(() => WorldIdSchema),
  affectedChunks: Schema.Array(Schema.suspend(() => ChunkPositionSchema)),
  reason: Schema.String,
  context: ErrorContextSchema,
  dataLoss: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'World Save Error',
    description: 'Error when saving world data fails',
  })
)
export type WorldSaveError = Schema.Schema.Type<typeof WorldSaveErrorSchema>

export const getWorldSaveErrorMessage = (error: WorldSaveError): string =>
  `Failed to save world ${error.worldId}: ${error.reason} (${error.affectedChunks.length} chunks affected)`

// === 座標・境界エラー ===

/** 座標が無効エラー */
export const InvalidCoordinateErrorSchema = Schema.TaggedStruct('InvalidCoordinateError', {
  coordinate: Schema.suspend(() => Vector3DSchema),
  reason: Schema.String,
  validRange: Schema.optional(
    Schema.Struct({
      min: Schema.suspend(() => Vector3DSchema),
      max: Schema.suspend(() => Vector3DSchema),
    })
  ),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Invalid Coordinate Error',
    description: 'Error when coordinates are outside valid range',
  })
)
export type InvalidCoordinateError = Schema.Schema.Type<typeof InvalidCoordinateErrorSchema>

export const getInvalidCoordinateErrorMessage = (error: InvalidCoordinateError): string =>
  `Invalid coordinate (${error.coordinate.x}, ${error.coordinate.y}, ${error.coordinate.z}): ${error.reason}`

/** 世界境界外エラー */
export const OutOfWorldBoundsErrorSchema = Schema.TaggedStruct('OutOfWorldBoundsError', {
  position: Schema.suspend(() => Vector3DSchema),
  worldBounds: Schema.Struct({
    min: Schema.suspend(() => Vector3DSchema),
    max: Schema.suspend(() => Vector3DSchema),
  }),
  context: ErrorContextSchema,
  autoCorrect: Schema.optional(Schema.suspend(() => Vector3DSchema)),
}).pipe(
  Schema.annotations({
    title: 'Out Of World Bounds Error',
    description: 'Error when position is outside world boundaries',
  })
)
export type OutOfWorldBoundsError = Schema.Schema.Type<typeof OutOfWorldBoundsErrorSchema>

export const getOutOfWorldBoundsErrorMessage = (error: OutOfWorldBoundsError): string =>
  `Position (${error.position.x}, ${error.position.y}, ${error.position.z}) is outside world bounds`

/** チャンク境界外エラー */
export const OutOfChunkBoundsErrorSchema = Schema.TaggedStruct('OutOfChunkBoundsError', {
  position: Schema.suspend(() => Vector3DSchema),
  chunkPosition: Schema.suspend(() => ChunkPositionSchema),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Out Of Chunk Bounds Error',
    description: 'Error when position is outside chunk boundaries',
  })
)
export type OutOfChunkBoundsError = Schema.Schema.Type<typeof OutOfChunkBoundsErrorSchema>

export const getOutOfChunkBoundsErrorMessage = (error: OutOfChunkBoundsError): string =>
  `Position (${error.position.x}, ${error.position.y}, ${error.position.z}) is outside chunk bounds at (${error.chunkPosition.x}, ${error.chunkPosition.z})`

// === 次元エラー ===

/** 次元が存在しないエラー */
export const DimensionNotFoundErrorSchema = Schema.TaggedStruct('DimensionNotFoundError', {
  dimensionId: Schema.suspend(() => DimensionIdSchema),
  worldId: Schema.suspend(() => WorldIdSchema),
  context: ErrorContextSchema,
  availableDimensions: Schema.Array(Schema.suspend(() => DimensionIdSchema)),
}).pipe(
  Schema.annotations({
    title: 'Dimension Not Found Error',
    description: 'Error when attempting to access non-existent dimension',
  })
)
export type DimensionNotFoundError = Schema.Schema.Type<typeof DimensionNotFoundErrorSchema>

export const getDimensionNotFoundErrorMessage = (error: DimensionNotFoundError): string =>
  `Dimension '${error.dimensionId}' not found in world '${error.worldId}'`

/** 次元切り替え失敗エラー */
export const DimensionSwitchErrorSchema = Schema.TaggedStruct('DimensionSwitchError', {
  fromDimension: Schema.suspend(() => DimensionIdSchema),
  toDimension: Schema.suspend(() => DimensionIdSchema),
  playerId: Schema.String,
  reason: Schema.String,
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Dimension Switch Error',
    description: 'Error when player dimension switching fails',
  })
)
export type DimensionSwitchError = Schema.Schema.Type<typeof DimensionSwitchErrorSchema>

export const getDimensionSwitchErrorMessage = (error: DimensionSwitchError): string =>
  `Failed to switch player ${error.playerId} from '${error.fromDimension}' to '${error.toDimension}': ${error.reason}`

// === パフォーマンス関連エラー ===

/** メモリ不足エラー */
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
export type InsufficientMemoryError = Schema.Schema.Type<typeof InsufficientMemoryErrorSchema>

export const getInsufficientMemoryErrorMessage = (error: InsufficientMemoryError): string =>
  `Insufficient memory for ${error.operation}: requested ${error.requestedMemory} bytes, available ${error.availableMemory} bytes`

/** タイムアウトエラー */
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
export type OperationTimeoutError = Schema.Schema.Type<typeof OperationTimeoutErrorSchema>

export const getOperationTimeoutErrorMessage = (error: OperationTimeoutError): string =>
  `Operation '${error.operation}' timed out after ${error.elapsedMs}ms (limit: ${error.timeoutMs}ms)`

// === 設定エラー ===

/** 無効な世界設定エラー */
export const InvalidWorldSettingsErrorSchema = Schema.TaggedStruct('InvalidWorldSettingsError', {
  settingName: Schema.String,
  providedValue: JsonValueSchema,
  expectedType: Schema.String,
  validValues: Schema.optional(Schema.Array(JsonValueSchema)),
  context: ErrorContextSchema,
}).pipe(
  Schema.annotations({
    title: 'Invalid World Settings Error',
    description: 'Error when world settings are invalid',
  })
)
export type InvalidWorldSettingsError = Schema.Schema.Type<typeof InvalidWorldSettingsErrorSchema>

export const getInvalidWorldSettingsErrorMessage = (error: InvalidWorldSettingsError): string =>
  `Invalid world setting '${error.settingName}': expected ${error.expectedType}, got ${typeof error.providedValue}`

// === エラー統合型 ===

/** 世界ドメインの全エラー型 */
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

export type WorldDomainError = Schema.Schema.Type<typeof WorldDomainErrorSchema>

// === エラー作成Factory関数 ===

/** ErrorContext作成ヘルパー */
export const createErrorContext = (overrides: Partial<ErrorContext> = {}): Effect.Effect<ErrorContext> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return {
      timestamp,
      ...overrides,
    }
  })

/** WorldNotFoundError作成Factory */
export const createWorldNotFoundError = (
  worldId: WorldId,
  context?: Partial<ErrorContext>,
  suggestedAction?: string
): Effect.Effect<WorldNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(WorldNotFoundErrorSchema)({
      _tag: 'WorldNotFoundError' as const,
      worldId,
      context: { timestamp, ...context },
      suggestedAction,
    })
  })

/** WorldCreationError作成Factory */
export const createWorldCreationError = (
  worldId: WorldId,
  reason: string,
  context?: Partial<ErrorContext>,
  cause?: Schema.Schema.Input<typeof ErrorCauseSchema>
): Effect.Effect<WorldCreationError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(WorldCreationErrorSchema)({
      _tag: 'WorldCreationError' as const,
      worldId,
      reason,
      context: { timestamp, ...context },
      cause: toErrorCause(cause),
    })
  })

/** WorldLoadError作成Factory */
export const createWorldLoadError = (
  worldId: WorldId,
  stage: 'initialization' | 'chunk_loading' | 'player_spawn' | 'world_generation',
  reason: string,
  recoverable: boolean,
  context?: Partial<ErrorContext>
): Effect.Effect<WorldLoadError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(WorldLoadErrorSchema)({
      _tag: 'WorldLoadError' as const,
      worldId,
      stage,
      reason,
      context: { timestamp, ...context },
      recoverable,
    })
  })

/** WorldSaveError作成Factory */
export const createWorldSaveError = (
  worldId: WorldId,
  affectedChunks: readonly ChunkPosition[],
  reason: string,
  dataLoss: boolean,
  context?: Partial<ErrorContext>
): Effect.Effect<WorldSaveError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(WorldSaveErrorSchema)({
      _tag: 'WorldSaveError' as const,
      worldId,
      affectedChunks,
      reason,
      context: { timestamp, ...context },
      dataLoss,
    })
  })

/** InvalidCoordinateError作成Factory */
export const createInvalidCoordinateError = (
  coordinate: Vector3D,
  reason: string,
  context?: Partial<ErrorContext>,
  validRange?: { min: Vector3D; max: Vector3D }
): Effect.Effect<InvalidCoordinateError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(InvalidCoordinateErrorSchema)({
      _tag: 'InvalidCoordinateError' as const,
      coordinate,
      reason,
      context: { timestamp, ...context },
      validRange,
    })
  })

/** OutOfWorldBoundsError作成Factory */
export const createOutOfWorldBoundsError = (
  position: Vector3D,
  worldBounds: { min: Vector3D; max: Vector3D },
  context?: Partial<ErrorContext>,
  autoCorrect?: Vector3D
): Effect.Effect<OutOfWorldBoundsError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(OutOfWorldBoundsErrorSchema)({
      _tag: 'OutOfWorldBoundsError' as const,
      position,
      worldBounds,
      context: { timestamp, ...context },
      autoCorrect,
    })
  })

/** OutOfChunkBoundsError作成Factory */
export const createOutOfChunkBoundsError = (
  position: Vector3D,
  chunkPosition: ChunkPosition,
  context?: Partial<ErrorContext>
): Effect.Effect<OutOfChunkBoundsError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(OutOfChunkBoundsErrorSchema)({
      _tag: 'OutOfChunkBoundsError' as const,
      position,
      chunkPosition,
      context: { timestamp, ...context },
    })
  })

/** DimensionNotFoundError作成Factory */
export const createDimensionNotFoundError = (
  dimensionId: DimensionId,
  worldId: WorldId,
  availableDimensions: readonly DimensionId[],
  context?: Partial<ErrorContext>
): Effect.Effect<DimensionNotFoundError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(DimensionNotFoundErrorSchema)({
      _tag: 'DimensionNotFoundError' as const,
      dimensionId,
      worldId,
      context: { timestamp, ...context },
      availableDimensions,
    })
  })

/** DimensionSwitchError作成Factory */
export const createDimensionSwitchError = (
  fromDimension: DimensionId,
  toDimension: DimensionId,
  playerId: string,
  reason: string,
  context?: Partial<ErrorContext>
): Effect.Effect<DimensionSwitchError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(DimensionSwitchErrorSchema)({
      _tag: 'DimensionSwitchError' as const,
      fromDimension,
      toDimension,
      playerId,
      reason,
      context: { timestamp, ...context },
    })
  })

/** InsufficientMemoryError作成Factory */
export const createInsufficientMemoryError = (
  requestedMemory: number,
  availableMemory: number,
  operation: string,
  suggestedActions: readonly string[],
  context?: Partial<ErrorContext>
): Effect.Effect<InsufficientMemoryError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(InsufficientMemoryErrorSchema)({
      _tag: 'InsufficientMemoryError' as const,
      requestedMemory,
      availableMemory,
      operation,
      context: { timestamp, ...context },
      suggestedActions,
    })
  })

/** OperationTimeoutError作成Factory */
export const createOperationTimeoutError = (
  operation: string,
  timeoutMs: number,
  elapsedMs: number,
  retryable: boolean,
  context?: Partial<ErrorContext>
): Effect.Effect<OperationTimeoutError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(OperationTimeoutErrorSchema)({
      _tag: 'OperationTimeoutError' as const,
      operation,
      timeoutMs,
      elapsedMs,
      context: { timestamp, ...context },
      retryable,
    })
  })

/** InvalidWorldSettingsError作成Factory */
export const createInvalidWorldSettingsError = (
  settingName: string,
  providedValue: JsonValue,
  expectedType: string,
  context?: Partial<ErrorContext>,
  validValues?: readonly JsonValue[]
): Effect.Effect<InvalidWorldSettingsError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(InvalidWorldSettingsErrorSchema)({
      _tag: 'InvalidWorldSettingsError' as const,
      settingName,
      providedValue,
      expectedType,
      context: { timestamp, ...context },
      validValues,
    })
  })

// === 型ガード関数 ===

/** WorldNotFoundError型ガード */
export const isWorldNotFoundError = (error: unknown): error is WorldNotFoundError =>
  Schema.is(WorldNotFoundErrorSchema)(error)

/** WorldCreationError型ガード */
export const isWorldCreationError = (error: unknown): error is WorldCreationError =>
  Schema.is(WorldCreationErrorSchema)(error)

/** WorldLoadError型ガード */
export const isWorldLoadError = (error: unknown): error is WorldLoadError => Schema.is(WorldLoadErrorSchema)(error)

/** WorldSaveError型ガード */
export const isWorldSaveError = (error: unknown): error is WorldSaveError => Schema.is(WorldSaveErrorSchema)(error)

/** InvalidCoordinateError型ガード */
export const isInvalidCoordinateError = (error: unknown): error is InvalidCoordinateError =>
  Schema.is(InvalidCoordinateErrorSchema)(error)

/** OutOfWorldBoundsError型ガード */
export const isOutOfWorldBoundsError = (error: unknown): error is OutOfWorldBoundsError =>
  Schema.is(OutOfWorldBoundsErrorSchema)(error)

/** OutOfChunkBoundsError型ガード */
export const isOutOfChunkBoundsError = (error: unknown): error is OutOfChunkBoundsError =>
  Schema.is(OutOfChunkBoundsErrorSchema)(error)

/** DimensionNotFoundError型ガード */
export const isDimensionNotFoundError = (error: unknown): error is DimensionNotFoundError =>
  Schema.is(DimensionNotFoundErrorSchema)(error)

/** DimensionSwitchError型ガード */
export const isDimensionSwitchError = (error: unknown): error is DimensionSwitchError =>
  Schema.is(DimensionSwitchErrorSchema)(error)

/** InsufficientMemoryError型ガード */
export const isInsufficientMemoryError = (error: unknown): error is InsufficientMemoryError =>
  Schema.is(InsufficientMemoryErrorSchema)(error)

/** OperationTimeoutError型ガード */
export const isOperationTimeoutError = (error: unknown): error is OperationTimeoutError =>
  Schema.is(OperationTimeoutErrorSchema)(error)

/** InvalidWorldSettingsError型ガード */
export const isInvalidWorldSettingsError = (error: unknown): error is InvalidWorldSettingsError =>
  Schema.is(InvalidWorldSettingsErrorSchema)(error)

/** WorldDomainError型ガード */
export const isWorldDomainError = (error: unknown): error is WorldDomainError =>
  Schema.is(WorldDomainErrorSchema)(error)
