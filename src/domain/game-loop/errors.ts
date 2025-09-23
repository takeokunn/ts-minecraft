import { Schema } from '@effect/schema'

// ゲームループエラーのベース
export class GameLoopError extends Schema.TaggedError<GameLoopError>()(
  'GameLoopError',
  {
    message: Schema.String,
    timestamp: Schema.Number,
  }
) {}

// ゲームループ初期化エラー
export class GameLoopInitError extends Schema.TaggedError<GameLoopInitError>()(
  'GameLoopInitError',
  {
    message: Schema.String,
    reason: Schema.String,
  }
) {}

// ゲームループ実行エラー
export class GameLoopRuntimeError extends Schema.TaggedError<GameLoopRuntimeError>()(
  'GameLoopRuntimeError',
  {
    message: Schema.String,
    frameNumber: Schema.Number,
    error: Schema.optional(Schema.Unknown),
  }
) {}

// パフォーマンスエラー
export class GameLoopPerformanceError extends Schema.TaggedError<GameLoopPerformanceError>()(
  'GameLoopPerformanceError',
  {
    message: Schema.String,
    currentFps: Schema.Number,
    targetFps: Schema.Number,
    droppedFrames: Schema.Number,
  }
) {}

// 状態遷移エラー
export class GameLoopStateError extends Schema.TaggedError<GameLoopStateError>()(
  'GameLoopStateError',
  {
    message: Schema.String,
    currentState: Schema.String,
    attemptedTransition: Schema.String,
  }
) {}