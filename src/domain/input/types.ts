import { Schema } from 'effect'

// マウスデルタ情報
export const MouseDelta = Schema.Struct({
  deltaX: Schema.Number,
  deltaY: Schema.Number,
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type MouseDelta = Schema.Schema.Type<typeof MouseDelta>

// キー押下状態
export const KeyState = Schema.Struct({
  key: Schema.String.pipe(Schema.minLength(1)),
  isPressed: Schema.Boolean,
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type KeyState = Schema.Schema.Type<typeof KeyState>

// マウスボタン状態
export const MouseButtonState = Schema.Struct({
  button: Schema.Number.pipe(Schema.int(), Schema.between(0, 2)), // 0: left, 1: middle, 2: right
  isPressed: Schema.Boolean,
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type MouseButtonState = Schema.Schema.Type<typeof MouseButtonState>

// 入力イベントタイプ
export const InputEventType = Schema.Literal('keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove')
export type InputEventType = Schema.Schema.Type<typeof InputEventType>

// 入力イベント
export const InputEvent = Schema.Struct({
  type: InputEventType,
  key: Schema.optional(Schema.String),
  button: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 2))),
  delta: Schema.optional(MouseDelta),
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type InputEvent = Schema.Schema.Type<typeof InputEvent>

// 入力ハンドラー
export interface InputHandler {
  readonly onKeyDown?: (key: string) => void
  readonly onKeyUp?: (key: string) => void
  readonly onMouseDown?: (button: number) => void
  readonly onMouseUp?: (button: number) => void
  readonly onMouseMove?: (delta: MouseDelta) => void
}

// 入力システムエラー
export const InputSystemErrorSchema = Schema.Struct({
  _tag: Schema.Literal('InputSystemError'),
  message: Schema.String,
  key: Schema.optional(Schema.String),
  button: Schema.optional(Schema.Number),
})

export type InputSystemError = Schema.Schema.Type<typeof InputSystemErrorSchema>

export const InputSystemError = (params: Omit<InputSystemError, '_tag'>): InputSystemError => ({
  _tag: 'InputSystemError' as const,
  ...params,
})

export const InputHandlerRegistrationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('InputHandlerRegistrationError'),
  message: Schema.String,
  handlerId: Schema.optional(Schema.String),
})

export type InputHandlerRegistrationError = Schema.Schema.Type<typeof InputHandlerRegistrationErrorSchema>

export const InputHandlerRegistrationError = (
  params: Omit<InputHandlerRegistrationError, '_tag'>
): InputHandlerRegistrationError => ({
  _tag: 'InputHandlerRegistrationError' as const,
  ...params,
})
