import { Schema } from '@effect/schema'
import { Match } from 'effect'

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
export const GameLoopInitializationFailedError = Schema.TaggedStruct('GameLoopInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  retryable: Schema.Boolean,
})
export type GameLoopInitializationFailedError = Schema.Schema.Type<typeof GameLoopInitializationFailedError>

/**
 * Rendererサービス初期化失敗
 */
export const RendererInitializationFailedError = Schema.TaggedStruct('RendererInitializationFailedError', {
  context: ErrorContext,
  cause: Schema.String,
  webglVersion: Schema.optional(Schema.Union(Schema.Literal('webgl'), Schema.Literal('webgl2'))),
  capabilities: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Boolean })),
})
export type RendererInitializationFailedError = Schema.Schema.Type<typeof RendererInitializationFailedError>

/**
 * Sceneサービス初期化失敗
 */
export const SceneInitializationFailedError = Schema.TaggedStruct('SceneInitializationFailedError', {
  context: ErrorContext,
  sceneType: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type SceneInitializationFailedError = Schema.Schema.Type<typeof SceneInitializationFailedError>

/**
 * Inputサービス初期化失敗
 */
export const InputInitializationFailedError = Schema.TaggedStruct('InputInitializationFailedError', {
  context: ErrorContext,
  deviceType: Schema.optional(
    Schema.Union(Schema.Literal('keyboard'), Schema.Literal('mouse'), Schema.Literal('gamepad'))
  ),
  cause: Schema.String,
})
export type InputInitializationFailedError = Schema.Schema.Type<typeof InputInitializationFailedError>

/**
 * ECSサービス初期化失敗
 */
export const ECSInitializationFailedError = Schema.TaggedStruct('ECSInitializationFailedError', {
  context: ErrorContext,
  component: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  cause: Schema.String,
})
export type ECSInitializationFailedError = Schema.Schema.Type<typeof ECSInitializationFailedError>

/**
 * Canvas要素が見つからない
 */
export const CanvasNotFoundError = Schema.TaggedStruct('CanvasNotFoundError', {
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
export const SystemCommunicationError = Schema.TaggedStruct('SystemCommunicationError', {
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
export const FrameProcessingError = Schema.TaggedStruct('FrameProcessingError', {
  context: ErrorContext,
  frameNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  deltaTime: Schema.Number,
  stage: Schema.Union(
    Schema.Literal('update'),
    Schema.Literal('render'),
    Schema.Literal('input'),
    Schema.Literal('ecs')
  ),
  cause: Schema.String,
})
export type FrameProcessingError = Schema.Schema.Type<typeof FrameProcessingError>

/**
 * パフォーマンス劣化エラー
 */
export const PerformanceDegradationError = Schema.TaggedStruct('PerformanceDegradationError', {
  context: ErrorContext,
  metric: Schema.Union(Schema.Literal('fps'), Schema.Literal('memory'), Schema.Literal('cpu'), Schema.Literal('gpu')),
  currentValue: Schema.Number,
  thresholdValue: Schema.Number,
  severity: Schema.Union(Schema.Literal('warning'), Schema.Literal('critical')),
})
export type PerformanceDegradationError = Schema.Schema.Type<typeof PerformanceDegradationError>

/**
 * メモリリークエラー
 */
export const MemoryLeakError = Schema.TaggedStruct('MemoryLeakError', {
  context: ErrorContext,
  memoryUsage: Schema.Number,
  memoryLimit: Schema.Number,
  leakSource: Schema.optional(Schema.String),
})
export type MemoryLeakError = Schema.Schema.Type<typeof MemoryLeakError>

/**
 * WebGLコンテキスト喪失エラー
 */
export const WebGLContextLostError = Schema.TaggedStruct('WebGLContextLostError', {
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
export const InvalidStateTransitionError = Schema.TaggedStruct('InvalidStateTransitionError', {
  context: ErrorContext,
  currentState: Schema.String,
  attemptedState: Schema.String,
  validTransitions: Schema.Array(Schema.String),
})
export type InvalidStateTransitionError = Schema.Schema.Type<typeof InvalidStateTransitionError>

/**
 * 設定検証エラー
 */
export const ConfigurationValidationError = Schema.TaggedStruct('ConfigurationValidationError', {
  context: ErrorContext,
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
})
export type ConfigurationValidationError = Schema.Schema.Type<typeof ConfigurationValidationError>

/**
 * システム同期エラー
 */
export const SystemSynchronizationError = Schema.TaggedStruct('SystemSynchronizationError', {
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
  return Match.value(error._tag).pipe(
    // 致命的エラー
    Match.when('CanvasNotFoundError', () => 'critical' as const),
    Match.when('RendererInitializationFailedError', () => 'critical' as const),
    Match.when('WebGLContextLostError', () => 'critical' as const),
    Match.when('MemoryLeakError', () => 'critical' as const),

    // 高重要度エラー
    Match.when('GameLoopInitializationFailedError', () => 'high' as const),
    Match.when('SystemCommunicationError', () => 'high' as const),
    Match.when('FrameProcessingError', () => 'high' as const),
    Match.when('InvalidStateTransitionError', () => 'high' as const),

    // 中重要度エラー
    Match.when('SceneInitializationFailedError', () => 'medium' as const),
    Match.when('InputInitializationFailedError', () => 'medium' as const),
    Match.when('ECSInitializationFailedError', () => 'medium' as const),
    Match.when('SystemSynchronizationError', () => 'medium' as const),

    // 低重要度エラー
    Match.when('PerformanceDegradationError', () => 'low' as const),
    Match.when('ConfigurationValidationError', () => 'low' as const),

    // デフォルト: 網羅的パターンマッチのためのフォールバック
    Match.orElse(() => 'medium' as const)
  )
}

/**
 * エラーの回復可能性判定
 */
export const isRecoverable = (
  error: GameApplicationInitError | GameApplicationRuntimeError | GameApplicationStateError
): boolean => {
  return Match.value(error._tag).pipe(
    // 回復不可能
    Match.when('CanvasNotFoundError', () => false),
    Match.when('MemoryLeakError', () => false),

    // 回復可能
    Match.when('PerformanceDegradationError', () => true),
    Match.when('ConfigurationValidationError', () => true),
    Match.when('SystemSynchronizationError', () => true),

    // 条件付き回復可能
    Match.when('WebGLContextLostError', () => (error as any).recoverable),
    Match.when('GameLoopInitializationFailedError', () => (error as any).retryable),

    // デフォルトは回復可能（網羅的パターンマッチ）
    Match.orElse(() => true)
  )
}
