import { Clock, Effect, Match, Schema } from 'effect'
import { ErrorCauseSchema } from '@shared/schema/error'
import { JsonValueSchema } from '@shared/schema/json'
import type { JsonValue } from '@shared/schema/json'
import { ErrorSeverity, MemoryBytes, Milliseconds, Timestamp } from './types'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

// ===== JSON表現 =====

export const JsonValue = JsonValueSchema
export type { JsonValue }

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

export const GameLoopInitializationFailedErrorSchema = Schema.TaggedError('GameLoopInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  retryable: Schema.Boolean,
})
export type GameLoopInitializationFailedError = Schema.Schema.Type<typeof GameLoopInitializationFailedErrorSchema>
export const GameLoopInitializationFailedError = makeErrorFactory(GameLoopInitializationFailedErrorSchema)

export const RendererInitializationFailedErrorSchema = Schema.TaggedError('RendererInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  webglVersion: Schema.optional(Schema.Union(Schema.Literal('webgl'), Schema.Literal('webgl2'))),
  capabilities: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Boolean })),
})
export type RendererInitializationFailedError = Schema.Schema.Type<typeof RendererInitializationFailedErrorSchema>
export const RendererInitializationFailedError = makeErrorFactory(RendererInitializationFailedErrorSchema)

export const SceneInitializationFailedErrorSchema = Schema.TaggedError('SceneInitializationFailedError', {
  context: ErrorContext,
  sceneType: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type SceneInitializationFailedError = Schema.Schema.Type<typeof SceneInitializationFailedErrorSchema>
export const SceneInitializationFailedError = makeErrorFactory(SceneInitializationFailedErrorSchema)

export const InputInitializationFailedErrorSchema = Schema.TaggedError('InputInitializationFailedError', {
  context: ErrorContext,
  deviceType: Schema.optional(
    Schema.Union(Schema.Literal('keyboard'), Schema.Literal('mouse'), Schema.Literal('gamepad'))
  ),
  cause: Schema.String,
})
export type InputInitializationFailedError = Schema.Schema.Type<typeof InputInitializationFailedErrorSchema>
export const InputInitializationFailedError = makeErrorFactory(InputInitializationFailedErrorSchema)

export const ECSInitializationFailedErrorSchema = Schema.TaggedError('ECSInitializationFailedError', {
  context: ErrorContext,
  component: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type ECSInitializationFailedError = Schema.Schema.Type<typeof ECSInitializationFailedErrorSchema>
export const ECSInitializationFailedError = makeErrorFactory(ECSInitializationFailedErrorSchema)

export const CanvasNotFoundErrorSchema = Schema.TaggedError('CanvasNotFoundError', {
  context: ErrorContext,
  canvasId: Schema.optional(Schema.String),
  selector: Schema.optional(Schema.String),
})
export type CanvasNotFoundError = Schema.Schema.Type<typeof CanvasNotFoundErrorSchema>
export const CanvasNotFoundError = makeErrorFactory(CanvasNotFoundErrorSchema)

// ===== ランタイムエラー =====

export const SystemCommunicationErrorSchema = Schema.TaggedError('SystemCommunicationError', {
  context: ErrorContext,
  sourceSystem: Schema.String,
  targetSystem: Schema.String,
  messageType: Schema.String,
  cause: Schema.String,
})
export type SystemCommunicationError = Schema.Schema.Type<typeof SystemCommunicationErrorSchema>
export const SystemCommunicationError = makeErrorFactory(SystemCommunicationErrorSchema)

export const FrameProcessingErrorSchema = Schema.TaggedError('FrameProcessingError', {
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
export type FrameProcessingError = Schema.Schema.Type<typeof FrameProcessingErrorSchema>
export const FrameProcessingError = makeErrorFactory(FrameProcessingErrorSchema)

export const PerformanceDegradationErrorSchema = Schema.TaggedError('PerformanceDegradationError', {
  context: ErrorContext,
  metric: Schema.Union(Schema.Literal('fps'), Schema.Literal('memory'), Schema.Literal('cpu'), Schema.Literal('gpu')),
  currentValue: Schema.Number,
  thresholdValue: Schema.Number,
  severity: Schema.Union(Schema.Literal('warning'), Schema.Literal('critical')),
})
export type PerformanceDegradationError = Schema.Schema.Type<typeof PerformanceDegradationErrorSchema>
export const PerformanceDegradationError = makeErrorFactory(PerformanceDegradationErrorSchema)

export const MemoryLeakErrorSchema = Schema.TaggedError('MemoryLeakError', {
  context: ErrorContext,
  memoryUsage: MemoryBytes,
  memoryLimit: MemoryBytes,
  leakSource: Schema.optional(Schema.String),
})
export type MemoryLeakError = Schema.Schema.Type<typeof MemoryLeakErrorSchema>
export const MemoryLeakError = makeErrorFactory(MemoryLeakErrorSchema)

export const WebGLContextLostErrorSchema = Schema.TaggedError('WebGLContextLostError', {
  context: ErrorContext,
  recoverable: Schema.Boolean,
  lastDrawCall: Schema.optional(Schema.String),
})
export type WebGLContextLostError = Schema.Schema.Type<typeof WebGLContextLostErrorSchema>
export const WebGLContextLostError = makeErrorFactory(WebGLContextLostErrorSchema)

export type GameApplicationRuntimeError =
  | SystemCommunicationError
  | FrameProcessingError
  | PerformanceDegradationError
  | MemoryLeakError
  | WebGLContextLostError

// ===== 状態管理エラー =====

export const InvalidStateTransitionErrorSchema = Schema.TaggedError('InvalidStateTransitionError', {
  context: ErrorContext,
  currentState: Schema.String,
  attemptedState: Schema.String,
  validTransitions: Schema.Array(Schema.String),
})
export type InvalidStateTransitionError = Schema.Schema.Type<typeof InvalidStateTransitionErrorSchema>
export const InvalidStateTransitionError = makeErrorFactory(InvalidStateTransitionErrorSchema)

export const ConfigurationValidationErrorSchema = Schema.TaggedError('ConfigurationValidationError', {
  context: ErrorContext,
  field: Schema.String,
  value: JsonValue,
  constraint: Schema.String,
})
export type ConfigurationValidationError = Schema.Schema.Type<typeof ConfigurationValidationErrorSchema>
export const ConfigurationValidationError = makeErrorFactory(ConfigurationValidationErrorSchema)

export const ConfigurationSerializationErrorSchema = Schema.TaggedError('ConfigurationSerializationError', {
  operation: Schema.Literal('serialize', 'deserialize'),
  input: JsonValue,
  cause: ErrorCauseSchema,
})
export type ConfigurationSerializationError = Schema.Schema.Type<typeof ConfigurationSerializationErrorSchema>
export const ConfigurationSerializationError = makeErrorFactory(ConfigurationSerializationErrorSchema)

export const SystemSynchronizationErrorSchema = Schema.TaggedError('SystemSynchronizationError', {
  context: ErrorContext,
  outOfSyncSystems: Schema.Array(Schema.String),
  timeDrift: Milliseconds,
})
export type SystemSynchronizationError = Schema.Schema.Type<typeof SystemSynchronizationErrorSchema>
export const SystemSynchronizationError = makeErrorFactory(SystemSynchronizationErrorSchema)

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
