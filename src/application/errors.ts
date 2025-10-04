import { Schema } from '@effect/schema'
import { Clock, Effect, Match, pipe } from 'effect'
import { CpuPercentage, MemoryBytes, Milliseconds, Timestamp } from './types'

// ===== JSON表現 =====

export const JsonValue = Schema.Json
export type JsonValue = Schema.Schema.Type<typeof JsonValue>

const ErrorDetail = Schema.Struct({
  key: Schema.String,
  value: JsonValue,
})

// ===== 基本エラー情報 =====

export const ErrorContext = Schema.Struct({
  timestamp: Timestamp,
  system: Schema.String,
  operation: Schema.String,
  details: Schema.optional(Schema.Array(ErrorDetail)),
})
export type ErrorContext = Schema.Schema.Type<typeof ErrorContext>

// ===== アプリケーション初期化エラー =====

export const GameLoopInitializationFailedError = Schema.TaggedStruct('GameLoopInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  retryable: Schema.Boolean,
})
export type GameLoopInitializationFailedError = Schema.Schema.Type<typeof GameLoopInitializationFailedError>

export const RendererInitializationFailedError = Schema.TaggedStruct('RendererInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  webglVersion: Schema.optional(Schema.Union(Schema.Literal('webgl'), Schema.Literal('webgl2'))),
  capabilities: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Boolean })),
})
export type RendererInitializationFailedError = Schema.Schema.Type<typeof RendererInitializationFailedError>

export const SceneInitializationFailedError = Schema.TaggedStruct('SceneInitializationFailedError', {
  context: ErrorContext,
  sceneType: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type SceneInitializationFailedError = Schema.Schema.Type<typeof SceneInitializationFailedError>

export const InputInitializationFailedError = Schema.TaggedStruct('InputInitializationFailedError', {
  context: ErrorContext,
  deviceType: Schema.optional(Schema.Union(Schema.Literal('keyboard'), Schema.Literal('mouse'), Schema.Literal('gamepad'))),
  cause: Schema.String,
})
export type InputInitializationFailedError = Schema.Schema.Type<typeof InputInitializationFailedError>

export const ECSInitializationFailedError = Schema.TaggedStruct('ECSInitializationFailedError', {
  context: ErrorContext,
  component: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type ECSInitializationFailedError = Schema.Schema.Type<typeof ECSInitializationFailedError>

export const CanvasNotFoundError = Schema.TaggedStruct('CanvasNotFoundError', {
  context: ErrorContext,
  canvasId: Schema.optional(Schema.String),
  selector: Schema.optional(Schema.String),
})
export type CanvasNotFoundError = Schema.Schema.Type<typeof CanvasNotFoundError>

// ===== ランタイムエラー =====

export const SystemCommunicationError = Schema.TaggedStruct('SystemCommunicationError', {
  context: ErrorContext,
  sourceSystem: Schema.String,
  targetSystem: Schema.String,
  messageType: Schema.String,
  cause: Schema.String,
})
export type SystemCommunicationError = Schema.Schema.Type<typeof SystemCommunicationError>

export const FrameProcessingError = Schema.TaggedStruct('FrameProcessingError', {
  context: ErrorContext,
  frameNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  deltaTime: Milliseconds,
  stage: Schema.Union(
    Schema.Literal('update'),
    Schema.Literal('render'),
    Schema.Literal('input'),
    Schema.Literal('ecs')
  ),
  cause: Schema.String,
})
export type FrameProcessingError = Schema.Schema.Type<typeof FrameProcessingError>

export const PerformanceDegradationError = Schema.TaggedStruct('PerformanceDegradationError', {
  context: ErrorContext,
  metric: Schema.Union(Schema.Literal('fps'), Schema.Literal('memory'), Schema.Literal('cpu'), Schema.Literal('gpu')),
  currentValue: Schema.Number,
  thresholdValue: Schema.Number,
  severity: Schema.Union(Schema.Literal('warning'), Schema.Literal('critical')),
})
export type PerformanceDegradationError = Schema.Schema.Type<typeof PerformanceDegradationError>

export const MemoryLeakError = Schema.TaggedStruct('MemoryLeakError', {
  context: ErrorContext,
  memoryUsage: MemoryBytes,
  memoryLimit: MemoryBytes,
  leakSource: Schema.optional(Schema.String),
})
export type MemoryLeakError = Schema.Schema.Type<typeof MemoryLeakError>

export const WebGLContextLostError = Schema.TaggedStruct('WebGLContextLostError', {
  context: ErrorContext,
  recoverable: Schema.Boolean,
  lastDrawCall: Schema.optional(Schema.String),
})
export type WebGLContextLostError = Schema.Schema.Type<typeof WebGLContextLostError>

export type GameApplicationRuntimeError =
  | SystemCommunicationError
  | FrameProcessingError
  | PerformanceDegradationError
  | MemoryLeakError
  | WebGLContextLostError

// ===== 状態管理エラー =====

export const InvalidStateTransitionError = Schema.TaggedStruct('InvalidStateTransitionError', {
  context: ErrorContext,
  currentState: Schema.String,
  attemptedState: Schema.String,
  validTransitions: Schema.Array(Schema.String),
})
export type InvalidStateTransitionError = Schema.Schema.Type<typeof InvalidStateTransitionError>

export const ConfigurationValidationError = Schema.TaggedStruct('ConfigurationValidationError', {
  context: ErrorContext,
  field: Schema.String,
  value: JsonValue,
  constraint: Schema.String,
})
export type ConfigurationValidationError = Schema.Schema.Type<typeof ConfigurationValidationError>

export const SystemSynchronizationError = Schema.TaggedStruct('SystemSynchronizationError', {
  context: ErrorContext,
  outOfSyncSystems: Schema.Array(Schema.String),
  timeDrift: Milliseconds,
})
export type SystemSynchronizationError = Schema.Schema.Type<typeof SystemSynchronizationError>

export type GameApplicationStateError =
  | InvalidStateTransitionError
  | ConfigurationValidationError
  | SystemSynchronizationError

export type GameApplicationInitError =
  | GameLoopInitializationFailedError
  | RendererInitializationFailedError
  | SceneInitializationFailedError
  | InputInitializationFailedError
  | ECSInitializationFailedError
  | CanvasNotFoundError
  | ConfigurationValidationError

export type GameApplicationError =
  | GameApplicationInitError
  | GameApplicationRuntimeError
  | GameApplicationStateError

// ===== エラーヘルパー関数 =====

const ensureTimestamp = Schema.decodeSync(Timestamp)

export const createErrorContext = ({
  system,
  operation,
  details,
}: {
  readonly system: string
  readonly operation: string
  readonly details?: ReadonlyArray<{ readonly key: string; readonly value: JsonValue }>
}): Effect.Effect<ErrorContext> =>
  pipe(
    Clock.currentTimeMillis,
    Effect.map(ensureTimestamp),
    Effect.map((timestamp) => ({
      timestamp,
      system,
      operation,
      details: details?.map(({ key, value }) => ({ key, value })),
    }))
  )

const decodeSeverity = Schema.decodeSync(Schema.Literal('low', 'medium', 'high', 'critical'))

const Severity = {
  critical: decodeSeverity('critical'),
  high: decodeSeverity('high'),
  medium: decodeSeverity('medium'),
  low: decodeSeverity('low'),
}

const decodeString = Schema.decodeSync(Schema.String)
const decodeBoolean = Schema.decodeSync(Schema.Boolean)

export const getErrorSeverity = (
  error: GameApplicationError
): 'low' | 'medium' | 'high' | 'critical' =>
  Match.value(decodeTag(error)).pipe(
    Match.when('CanvasNotFoundError', () => Severity.critical),
    Match.when('RendererInitializationFailedError', () => Severity.critical),
    Match.when('WebGLContextLostError', () => Severity.critical),
    Match.when('MemoryLeakError', () => Severity.critical),
    Match.when('GameLoopInitializationFailedError', () => Severity.high),
    Match.when('SystemCommunicationError', () => Severity.high),
    Match.when('FrameProcessingError', () => Severity.high),
    Match.when('InvalidStateTransitionError', () => Severity.high),
    Match.when('SceneInitializationFailedError', () => Severity.medium),
    Match.when('InputInitializationFailedError', () => Severity.medium),
    Match.when('ECSInitializationFailedError', () => Severity.medium),
    Match.when('SystemSynchronizationError', () => Severity.medium),
    Match.when('PerformanceDegradationError', () => Severity.low),
    Match.when('ConfigurationValidationError', () => Severity.low),
    Match.orElse(() => Severity.medium)
  )

export const isRecoverable = (error: GameApplicationError): boolean =>
  Match.value(decodeTag(error)).pipe(
    Match.when('CanvasNotFoundError', () => false),
    Match.when('MemoryLeakError', () => false),
    Match.when('PerformanceDegradationError', () => true),
    Match.when('ConfigurationValidationError', () => true),
    Match.when('SystemSynchronizationError', () => true),
    Match.when('WebGLContextLostError', () => decodeBoolean(Reflect.get(error, 'recoverable'))),
    Match.when('GameLoopInitializationFailedError', () => decodeBoolean(Reflect.get(error, 'retryable'))),
    Match.orElse(() => true)
  )

const decodeTag = (error: GameApplicationError): string =>
  decodeString(Reflect.get(error, '_tag'))
