import { Clock, Effect, Match, Schema } from 'effect'
import { ErrorSeverity, MemoryBytes, Milliseconds, Timestamp } from './types'

// ===== JSON表現 =====

export const JsonValue = Schema.suspend(() =>
  Schema.Union(
    Schema.Null,
    Schema.Boolean,
    Schema.Number,
    Schema.String,
    Schema.Array(JsonValue),
    Schema.Record({ key: Schema.String, value: JsonValue })
  )
)
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

export class GameLoopInitializationFailedError extends Schema.TaggedError<GameLoopInitializationFailedError>()(
  'GameLoopInitializationFailedError',
  {
    context: ErrorContext,
    cause: Schema.String,
    retryable: Schema.Boolean,
  }
) {}

export class RendererInitializationFailedError extends Schema.TaggedError<RendererInitializationFailedError>()(
  'RendererInitializationFailedError',
  {
    context: ErrorContext,
    cause: Schema.String,
    webglVersion: Schema.optional(Schema.Union(Schema.Literal('webgl'), Schema.Literal('webgl2'))),
    capabilities: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Boolean })),
  }
) {}

export class SceneInitializationFailedError extends Schema.TaggedError<SceneInitializationFailedError>()(
  'SceneInitializationFailedError',
  {
    context: ErrorContext,
    sceneType: Schema.optional(Schema.String),
    cause: Schema.String,
  }
) {}

export class InputInitializationFailedError extends Schema.TaggedError<InputInitializationFailedError>()(
  'InputInitializationFailedError',
  {
    context: ErrorContext,
    deviceType: Schema.optional(
      Schema.Union(Schema.Literal('keyboard'), Schema.Literal('mouse'), Schema.Literal('gamepad'))
    ),
    cause: Schema.String,
  }
) {}

export class ECSInitializationFailedError extends Schema.TaggedError<ECSInitializationFailedError>()(
  'ECSInitializationFailedError',
  {
    context: ErrorContext,
    component: Schema.optional(Schema.String),
    system: Schema.optional(Schema.String),
    cause: Schema.String,
  }
) {}

export class CanvasNotFoundError extends Schema.TaggedError<CanvasNotFoundError>()('CanvasNotFoundError', {
  context: ErrorContext,
  canvasId: Schema.optional(Schema.String),
  selector: Schema.optional(Schema.String),
}) {}

// ===== ランタイムエラー =====

export class SystemCommunicationError extends Schema.TaggedError<SystemCommunicationError>()(
  'SystemCommunicationError',
  {
    context: ErrorContext,
    sourceSystem: Schema.String,
    targetSystem: Schema.String,
    messageType: Schema.String,
    cause: Schema.String,
  }
) {}

export class FrameProcessingError extends Schema.TaggedError<FrameProcessingError>()('FrameProcessingError', {
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
}) {}

export class PerformanceDegradationError extends Schema.TaggedError<PerformanceDegradationError>()(
  'PerformanceDegradationError',
  {
    context: ErrorContext,
    metric: Schema.Union(Schema.Literal('fps'), Schema.Literal('memory'), Schema.Literal('cpu'), Schema.Literal('gpu')),
    currentValue: Schema.Number,
    thresholdValue: Schema.Number,
    severity: Schema.Union(Schema.Literal('warning'), Schema.Literal('critical')),
  }
) {}

export class MemoryLeakError extends Schema.TaggedError<MemoryLeakError>()('MemoryLeakError', {
  context: ErrorContext,
  memoryUsage: MemoryBytes,
  memoryLimit: MemoryBytes,
  leakSource: Schema.optional(Schema.String),
}) {}

export class WebGLContextLostError extends Schema.TaggedError<WebGLContextLostError>()('WebGLContextLostError', {
  context: ErrorContext,
  recoverable: Schema.Boolean,
  lastDrawCall: Schema.optional(Schema.String),
}) {}

export type GameApplicationRuntimeError =
  | SystemCommunicationError
  | FrameProcessingError
  | PerformanceDegradationError
  | MemoryLeakError
  | WebGLContextLostError

// ===== 状態管理エラー =====

export class InvalidStateTransitionError extends Schema.TaggedError<InvalidStateTransitionError>()(
  'InvalidStateTransitionError',
  {
    context: ErrorContext,
    currentState: Schema.String,
    attemptedState: Schema.String,
    validTransitions: Schema.Array(Schema.String),
  }
) {}

export class ConfigurationValidationError extends Schema.TaggedError<ConfigurationValidationError>()(
  'ConfigurationValidationError',
  {
    context: ErrorContext,
    field: Schema.String,
    value: JsonValue,
    constraint: Schema.String,
  }
) {}

export class SystemSynchronizationError extends Schema.TaggedError<SystemSynchronizationError>()(
  'SystemSynchronizationError',
  {
    context: ErrorContext,
    outOfSyncSystems: Schema.Array(Schema.String),
    timeDrift: Milliseconds,
  }
) {}

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

export type GameApplicationError = GameApplicationInitError | GameApplicationRuntimeError | GameApplicationStateError

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
  Effect.gen(function* () {
    const timestamp = ensureTimestamp(yield* Clock.currentTimeMillis)
    return {
      timestamp,
      system,
      operation,
      details: details?.map(({ key, value }) => ({ key, value })),
    }
  })

const Severity: Record<'critical' | 'high' | 'medium' | 'low', ErrorSeverity> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export const getErrorSeverity = (error: GameApplicationError): ErrorSeverity =>
  Match.value(error).pipe(
    Match.tag('CanvasNotFoundError', () => Severity.critical),
    Match.tag('RendererInitializationFailedError', () => Severity.critical),
    Match.tag('WebGLContextLostError', () => Severity.critical),
    Match.tag('MemoryLeakError', () => Severity.critical),
    Match.tag('GameLoopInitializationFailedError', () => Severity.high),
    Match.tag('SystemCommunicationError', () => Severity.high),
    Match.tag('FrameProcessingError', () => Severity.high),
    Match.tag('InvalidStateTransitionError', () => Severity.high),
    Match.tag('SceneInitializationFailedError', () => Severity.medium),
    Match.tag('InputInitializationFailedError', () => Severity.medium),
    Match.tag('ECSInitializationFailedError', () => Severity.medium),
    Match.tag('SystemSynchronizationError', () => Severity.medium),
    Match.tag('PerformanceDegradationError', () => Severity.low),
    Match.tag('ConfigurationValidationError', () => Severity.low),
    Match.orElse(() => Severity.medium)
  )

export const isRecoverable = (error: GameApplicationError): boolean =>
  Match.value(error).pipe(
    Match.tag('CanvasNotFoundError', () => false),
    Match.tag('MemoryLeakError', () => false),
    Match.tag('PerformanceDegradationError', () => true),
    Match.tag('ConfigurationValidationError', () => true),
    Match.tag('SystemSynchronizationError', () => true),
    Match.tag('WebGLContextLostError', ({ recoverable }) => recoverable),
    Match.tag('GameLoopInitializationFailedError', ({ retryable }) => retryable),
    Match.orElse(() => true)
  )
