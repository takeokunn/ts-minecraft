import { Schema } from '@effect/schema'

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
