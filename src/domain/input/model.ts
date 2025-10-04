import { Schema } from '@effect/schema'
import { Option, Order, ReadonlyArray, pipe } from 'effect'

// ============================================================================
// ブランド型定義
// ============================================================================

export const InputTimestampSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('InputTimestamp'),
  Schema.annotations({ title: 'InputTimestamp' })
)
export type InputTimestamp = Schema.Schema.Type<typeof InputTimestampSchema>
export const InputTimestamp = Schema.decodeSync(InputTimestampSchema)

export const KeyCodeSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^([A-Z]+|Digit\d|Key[A-Z]|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Space)$/),
  Schema.brand('KeyCode'),
  Schema.annotations({ title: 'KeyCode' })
)
export type KeyCode = Schema.Schema.Type<typeof KeyCodeSchema>
export const KeyCode = Schema.decodeSync(KeyCodeSchema)

export const MouseButtonSchema = Schema.Union(
  Schema.Literal('left'),
  Schema.Literal('middle'),
  Schema.Literal('right')
).pipe(Schema.brand('MouseButton'))
export type MouseButton = Schema.Schema.Type<typeof MouseButtonSchema>
export const MouseButton = Schema.decodeSync(MouseButtonSchema)

export const AxisIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(7),
  Schema.brand('AxisId'),
  Schema.annotations({ title: 'AxisId' })
)
export type AxisId = Schema.Schema.Type<typeof AxisIdSchema>
export const AxisId = Schema.decodeSync(AxisIdSchema)

export const AxisValueSchema = Schema.Number.pipe(
  Schema.between(-1, 1),
  Schema.brand('AxisValue'),
  Schema.annotations({ title: 'AxisValue' })
)
export type AxisValue = Schema.Schema.Type<typeof AxisValueSchema>
export const AxisValue = Schema.decodeSync(AxisValueSchema)

export const ActionIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('ActionId'),
  Schema.annotations({ title: 'ActionId' })
)
export type ActionId = Schema.Schema.Type<typeof ActionIdSchema>
export const ActionId = Schema.decodeSync(ActionIdSchema)

// ============================================================================
// ベクトル型
// ============================================================================

export const Vector2Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
}).pipe(Schema.brand('Vector2'))
export type Vector2 = Schema.Schema.Type<typeof Vector2Schema>
export const Vector2 = Schema.decodeSync(Vector2Schema)

export const MouseDeltaSchema = Schema.Struct({
  deltaX: Schema.Number,
  deltaY: Schema.Number,
  occurredAt: InputTimestampSchema,
}).pipe(Schema.brand('MouseDelta'))
export type MouseDelta = Schema.Schema.Type<typeof MouseDeltaSchema>
export const MouseDelta = Schema.decodeSync(MouseDeltaSchema)

// ============================================================================
// 入力イベント定義
// ============================================================================

const modifiersSchema = Schema.Struct({
  shift: Schema.Boolean,
  ctrl: Schema.Boolean,
  alt: Schema.Boolean,
  meta: Schema.Boolean,
})

export const KeyPressedSchema = Schema.Struct({
  _tag: Schema.Literal('KeyPressed'),
  timestamp: InputTimestampSchema,
  key: KeyCodeSchema,
  modifiers: Schema.optional(modifiersSchema),
})

export const KeyReleasedSchema = Schema.Struct({
  _tag: Schema.Literal('KeyReleased'),
  timestamp: InputTimestampSchema,
  key: KeyCodeSchema,
  modifiers: Schema.optional(modifiersSchema),
})

export const MouseButtonPressedSchema = Schema.Struct({
  _tag: Schema.Literal('MouseButtonPressed'),
  timestamp: InputTimestampSchema,
  button: MouseButtonSchema,
})

export const MouseButtonReleasedSchema = Schema.Struct({
  _tag: Schema.Literal('MouseButtonReleased'),
  timestamp: InputTimestampSchema,
  button: MouseButtonSchema,
})

export const MouseMovedSchema = Schema.Struct({
  _tag: Schema.Literal('MouseMoved'),
  timestamp: InputTimestampSchema,
  position: Vector2Schema,
  delta: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
})

export const GamepadAxisChangedSchema = Schema.Struct({
  _tag: Schema.Literal('GamepadAxisChanged'),
  timestamp: InputTimestampSchema,
  axis: AxisIdSchema,
  value: AxisValueSchema,
})

export const InputEventSchema = Schema.Union(
  KeyPressedSchema,
  KeyReleasedSchema,
  MouseButtonPressedSchema,
  MouseButtonReleasedSchema,
  MouseMovedSchema,
  GamepadAxisChangedSchema
)

export type InputEvent = Schema.Schema.Type<typeof InputEventSchema>
export type InputEventEncoded = Schema.Schema.Encoded<typeof InputEventSchema>

// ============================================================================
// デコーダー
// ============================================================================

export const decodeInputEvent = Schema.decodeUnknownEither(InputEventSchema)
export const decodeKeyCode = Schema.decodeUnknownEither(KeyCodeSchema)
export const decodeMouseButton = Schema.decodeUnknownEither(MouseButtonSchema)
export const decodeActionId = Schema.decodeUnknownEither(ActionIdSchema)

// ============================================================================
// 並び替えユーティリティ
// ============================================================================

export const orderByTimestamp: Order.Order<InputEvent> = Order.mapInput(Order.number, (event) => event.timestamp)

export const sortByTimestamp = (events: ReadonlyArray<InputEvent>): ReadonlyArray<InputEvent> =>
  pipe(events, ReadonlyArray.sort(orderByTimestamp))

export const latestTimestamp = (events: ReadonlyArray<InputEvent>): Option.Option<InputTimestamp> =>
  pipe(events, ReadonlyArray.reduce<Option.Option<InputTimestamp>>(Option.none(), (_acc, event) =>
    Option.some(event.timestamp)
  ))
