import { Schema } from '@effect/schema'

// マウスボタン定義
export const MouseButton = Schema.Literal(0, 1, 2)
export type MouseButton = Schema.Schema.Type<typeof MouseButton>

// マウスボタンの定数
export const MOUSE_BUTTON = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
} as const

// マウスデルタ（移動量）
export const MouseDelta = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type MouseDelta = Schema.Schema.Type<typeof MouseDelta>

// 入力状態
export const InputState = Schema.Struct({
  keys: Schema.Record({ key: Schema.String, value: Schema.Boolean }),
  mouseButtons: Schema.Record({ key: Schema.String, value: Schema.Boolean }),
  mouseDelta: MouseDelta,
})
export type InputState = Schema.Schema.Type<typeof InputState>

// 入力イベントタイプ
export const InputEventType = Schema.Literal('keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove')
export type InputEventType = Schema.Schema.Type<typeof InputEventType>

// 基本入力イベント
export const InputEvent = Schema.Struct({
  type: InputEventType,
  key: Schema.optional(Schema.String),
  button: Schema.optional(MouseButton),
  delta: Schema.optional(MouseDelta),
  timestamp: Schema.Number,
})
export type InputEvent = Schema.Schema.Type<typeof InputEvent>

// 入力ハンドラー型
export const InputHandler = Schema.Struct({
  id: Schema.String,
  priority: Schema.Number,
  handle: Schema.Any, // Effect関数は直接スキーマ化できないため
})
export type InputHandler = Schema.Schema.Type<typeof InputHandler>

// エラー定義
export class InputError extends Schema.TaggedError<InputError>()('InputError', {
  reason: Schema.String,
}) {}
