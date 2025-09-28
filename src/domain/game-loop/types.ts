import { Schema } from '@effect/schema'

// ゲームループの状態
export const GameLoopStateSchema = Schema.Union(
  Schema.Literal('idle'),
  Schema.Literal('running'),
  Schema.Literal('paused'),
  Schema.Literal('stopped')
)

export type GameLoopState = Schema.Schema.Type<typeof GameLoopStateSchema>

// フレーム情報
export const FrameInfoSchema = Schema.Struct({
  currentTime: Schema.Number,
  deltaTime: Schema.Number,
  frameCount: Schema.Number,
  fps: Schema.Number,
  frameSkipped: Schema.Boolean,
})

export type FrameInfo = Schema.Schema.Type<typeof FrameInfoSchema>

// パフォーマンスメトリクス
export const PerformanceMetricsSchema = Schema.Struct({
  averageFps: Schema.Number,
  minFps: Schema.Number,
  maxFps: Schema.Number,
  frameTimeMs: Schema.Number,
  cpuUsage: Schema.optional(Schema.Number),
  memoryUsage: Schema.optional(Schema.Number),
  droppedFrames: Schema.Number,
})

export type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetricsSchema>

// ゲームループ設定
export const GameLoopConfigSchema = Schema.Struct({
  targetFps: Schema.Number.pipe(Schema.positive()),
  maxFrameSkip: Schema.Number.pipe(Schema.nonNegative()),
  enablePerformanceMonitoring: Schema.Boolean,
  adaptiveQuality: Schema.Boolean,
})

export type GameLoopConfig = Schema.Schema.Type<typeof GameLoopConfigSchema>

// デフォルト設定
export const DEFAULT_GAME_LOOP_CONFIG: GameLoopConfig = {
  targetFps: 60,
  maxFrameSkip: 5,
  enablePerformanceMonitoring: true,
  adaptiveQuality: false,
}

// ゲームループエラーのベース
export const GameLoopError = Schema.TaggedStruct('GameLoopError', {
  message: Schema.String,
  timestamp: Schema.Number,
})
export type GameLoopError = Schema.Schema.Type<typeof GameLoopError>

// ゲームループ初期化エラー
export const GameLoopInitError = Schema.TaggedStruct('GameLoopInitError', {
  message: Schema.String,
  reason: Schema.String,
})
export type GameLoopInitError = Schema.Schema.Type<typeof GameLoopInitError>

// ゲームループ実行エラー
export const GameLoopRuntimeError = Schema.TaggedStruct('GameLoopRuntimeError', {
  message: Schema.String,
  frameNumber: Schema.Number,
  error: Schema.optional(Schema.Unknown),
})
export type GameLoopRuntimeError = Schema.Schema.Type<typeof GameLoopRuntimeError>

// パフォーマンスエラー
export const GameLoopPerformanceError = Schema.TaggedStruct('GameLoopPerformanceError', {
  message: Schema.String,
  currentFps: Schema.Number,
  targetFps: Schema.Number,
  droppedFrames: Schema.Number,
})
export type GameLoopPerformanceError = Schema.Schema.Type<typeof GameLoopPerformanceError>

// 状態遷移エラー
export const GameLoopStateError = Schema.TaggedStruct('GameLoopStateError', {
  message: Schema.String,
  currentState: Schema.String,
  attemptedTransition: Schema.String,
})
export type GameLoopStateError = Schema.Schema.Type<typeof GameLoopStateError>
