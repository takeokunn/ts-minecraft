import { Schema } from 'effect'

/**
 * Application Layer Errors - ゲームアプリケーション統合のエラー定義
 *
 * Issue #176: Application Layer Integration
 * Effect-TS TaggedErrorによる構造化エラーハンドリング
 */

// ===== 基本エラー情報 =====

/**
 * エラーコンテキスト - エラー発生時の詳細情報
 */
export const ErrorContext = Schema.Struct({
  timestamp: Schema.Number,
  system: Schema.String,
  operation: Schema.String,
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type ErrorContext = Schema.Schema.Type<typeof ErrorContext>

// ===== アプリケーション初期化エラー =====

/**
 * GameLoopサービス初期化失敗
 */
export const GameLoopInitializationFailedError = Schema.TaggedError('GameLoopInitializationFailedError')({
  context: ErrorContext,
  cause: Schema.String,
  retryable: Schema.Boolean,
})
export type GameLoopInitializationFailedError = Schema.Schema.Type<typeof GameLoopInitializationFailedError>

/**
 * Rendererサービス初期化失敗
 */
export const RendererInitializationFailedError = Schema.TaggedError('RendererInitializationFailedError')({
  context: ErrorContext,
  cause: Schema.String,
  webglVersion: Schema.optional(Schema.Literal('webgl', 'webgl2')),
  capabilities: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Boolean })),
})
export type RendererInitializationFailedError = Schema.Schema.Type<typeof RendererInitializationFailedError>

/**
 * Sceneサービス初期化失敗
 */
export const SceneInitializationFailedError = Schema.TaggedError('SceneInitializationFailedError')({
  context: ErrorContext,
  sceneType: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type SceneInitializationFailedError = Schema.Schema.Type<typeof SceneInitializationFailedError>

/**
 * Inputサービス初期化失敗
 */
export const InputInitializationFailedError = Schema.TaggedError('InputInitializationFailedError')({
  context: ErrorContext,
  deviceType: Schema.optional(Schema.Literal('keyboard', 'mouse', 'gamepad')),
  cause: Schema.String,
})
export type InputInitializationFailedError = Schema.Schema.Type<typeof InputInitializationFailedError>

/**
 * ECSサービス初期化失敗
 */
export const ECSInitializationFailedError = Schema.TaggedError('ECSInitializationFailedError')({
  context: ErrorContext,
  component: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type ECSInitializationFailedError = Schema.Schema.Type<typeof ECSInitializationFailedError>

/**
 * Canvas要素が見つからない
 */
export const CanvasNotFoundError = Schema.TaggedError('CanvasNotFoundError')({
  context: ErrorContext,
  canvasId: Schema.optional(Schema.String),
  selector: Schema.optional(Schema.String),
})
export type CanvasNotFoundError = Schema.Schema.Type<typeof CanvasNotFoundError>

/**
 * 統合初期化エラー（複合エラー）
 */
export type GameApplicationInitError =
  | GameLoopInitializationFailedError
  | RendererInitializationFailedError
  | SceneInitializationFailedError
  | InputInitializationFailedError
  | ECSInitializationFailedError
  | CanvasNotFoundError

// ===== ランタイムエラー =====

/**
 * システム間通信エラー
 */
export const SystemCommunicationError = Schema.TaggedError('SystemCommunicationError')({
  context: ErrorContext,
  sourceSystem: Schema.String,
  targetSystem: Schema.String,
  messageType: Schema.String,
  cause: Schema.String,
})
export type SystemCommunicationError = Schema.Schema.Type<typeof SystemCommunicationError>

/**
 * フレーム処理エラー
 */
export const FrameProcessingError = Schema.TaggedError('FrameProcessingError')({
  context: ErrorContext,
  frameNumber: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
  deltaTime: Schema.Number,
  stage: Schema.Literal('update', 'render', 'input', 'ecs'),
  cause: Schema.String,
})
export type FrameProcessingError = Schema.Schema.Type<typeof FrameProcessingError>

/**
 * パフォーマンス劣化エラー
 */
export const PerformanceDegradationError = Schema.TaggedError('PerformanceDegradationError')({
  context: ErrorContext,
  metric: Schema.Literal('fps', 'memory', 'cpu', 'gpu'),
  currentValue: Schema.Number,
  thresholdValue: Schema.Number,
  severity: Schema.Literal('warning', 'critical'),
})
export type PerformanceDegradationError = Schema.Schema.Type<typeof PerformanceDegradationError>

/**
 * メモリリークエラー
 */
export const MemoryLeakError = Schema.TaggedError('MemoryLeakError')({
  context: ErrorContext,
  memoryUsage: Schema.Number,
  memoryLimit: Schema.Number,
  leakSource: Schema.optional(Schema.String),
})
export type MemoryLeakError = Schema.Schema.Type<typeof MemoryLeakError>

/**
 * WebGLコンテキスト喪失エラー
 */
export const WebGLContextLostError = Schema.TaggedError('WebGLContextLostError')({
  context: ErrorContext,
  recoverable: Schema.Boolean,
  lastDrawCall: Schema.optional(Schema.String),
})
export type WebGLContextLostError = Schema.Schema.Type<typeof WebGLContextLostError>

/**
 * ランタイムエラー（複合エラー）
 */
export type GameApplicationRuntimeError =
  | SystemCommunicationError
  | FrameProcessingError
  | PerformanceDegradationError
  | MemoryLeakError
  | WebGLContextLostError

// ===== 状態管理エラー =====

/**
 * 不正な状態遷移エラー
 */
export const InvalidStateTransitionError = Schema.TaggedError('InvalidStateTransitionError')({
  context: ErrorContext,
  currentState: Schema.String,
  attemptedState: Schema.String,
  validTransitions: Schema.Array(Schema.String),
})
export type InvalidStateTransitionError = Schema.Schema.Type<typeof InvalidStateTransitionError>

/**
 * 設定検証エラー
 */
export const ConfigurationValidationError = Schema.TaggedError('ConfigurationValidationError')({
  context: ErrorContext,
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
})
export type ConfigurationValidationError = Schema.Schema.Type<typeof ConfigurationValidationError>

/**
 * システム同期エラー
 */
export const SystemSynchronizationError = Schema.TaggedError('SystemSynchronizationError')({
  context: ErrorContext,
  outOfSyncSystems: Schema.Array(Schema.String),
  timeDrift: Schema.Number,
})
export type SystemSynchronizationError = Schema.Schema.Type<typeof SystemSynchronizationError>

/**
 * 状態管理エラー（複合エラー）
 */
export type GameApplicationStateError =
  | InvalidStateTransitionError
  | ConfigurationValidationError
  | SystemSynchronizationError

// ===== エラーヘルパー関数 =====

/**
 * エラーコンテキストの作成
 */
export const createErrorContext = (
  system: string,
  operation: string,
  details?: Record<string, unknown>
): ErrorContext => ({
  timestamp: Date.now(),
  system,
  operation,
  details,
})

/**
 * エラーの重要度判定
 */
export const getErrorSeverity = (
  error: GameApplicationInitError | GameApplicationRuntimeError | GameApplicationStateError
): 'low' | 'medium' | 'high' | 'critical' => {
  switch (error._tag) {
    // 致命的エラー
    case 'CanvasNotFoundError':
    case 'RendererInitializationFailedError':
    case 'WebGLContextLostError':
    case 'MemoryLeakError':
      return 'critical'

    // 高重要度エラー
    case 'GameLoopInitializationFailedError':
    case 'SystemCommunicationError':
    case 'FrameProcessingError':
    case 'InvalidStateTransitionError':
      return 'high'

    // 中重要度エラー
    case 'SceneInitializationFailedError':
    case 'InputInitializationFailedError':
    case 'ECSInitializationFailedError':
    case 'SystemSynchronizationError':
      return 'medium'

    // 低重要度エラー
    case 'PerformanceDegradationError':
    case 'ConfigurationValidationError':
      return 'low'

    default:
      return 'medium'
  }
}

/**
 * エラーの回復可能性判定
 */
export const isRecoverable = (
  error: GameApplicationInitError | GameApplicationRuntimeError | GameApplicationStateError
): boolean => {
  switch (error._tag) {
    // 回復不可能
    case 'CanvasNotFoundError':
    case 'MemoryLeakError':
      return false

    // 回復可能
    case 'PerformanceDegradationError':
    case 'ConfigurationValidationError':
    case 'SystemSynchronizationError':
      return true

    // 条件付き回復可能
    case 'WebGLContextLostError':
      return error.recoverable

    case 'GameLoopInitializationFailedError':
      return error.retryable

    // デフォルトは回復可能
    default:
      return true
  }
}