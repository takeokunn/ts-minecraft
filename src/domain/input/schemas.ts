import { Schema, Brand } from 'effect'

// ブランド型定義
export type KeyCode = string & Brand.Brand<'KeyCode'>
export const KeyCode = Brand.nominal<KeyCode>()

export type ButtonId = number & Brand.Brand<'ButtonId'>
export const ButtonId = Brand.nominal<ButtonId>()

export type InputTimestamp = number & Brand.Brand<'InputTimestamp'>
export const InputTimestamp = Brand.nominal<InputTimestamp>()

export type MouseSensitivity = number & Brand.Brand<'MouseSensitivity'>
export const MouseSensitivity = Brand.nominal<MouseSensitivity>()

export type GamepadSensitivity = number & Brand.Brand<'GamepadSensitivity'>
export const GamepadSensitivity = Brand.nominal<GamepadSensitivity>()

export type DeadzoneValue = number & Brand.Brand<'DeadzoneValue'>
export const DeadzoneValue = Brand.nominal<DeadzoneValue>()

// デバイスタイプスキーマ
export const DeviceTypeSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Keyboard'),
    layout: Schema.Union(Schema.Literal('QWERTY'), Schema.Literal('AZERTY'), Schema.Literal('Dvorak')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Mouse'),
    buttonCount: Schema.Number,
    hasWheel: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Gamepad'),
    type: Schema.Union(
      Schema.Literal('Xbox'),
      Schema.Literal('PlayStation'),
      Schema.Literal('Switch'),
      Schema.Literal('Generic')
    ),
    index: Schema.Number,
    buttonCount: Schema.Number,
    axisCount: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('TouchScreen'),
    multiTouch: Schema.Boolean,
    maxTouchPoints: Schema.Number,
  })
)

export type DeviceType = Schema.Schema.Type<typeof DeviceTypeSchema>

// 入力イベントスキーマ
export const InputEventSchema = Schema.Union(
  // キーボードイベント
  Schema.Struct({
    _tag: Schema.Literal('KeyPressed'),
    keyCode: Schema.String.pipe(Schema.brand('KeyCode')),
    modifiers: Schema.optional(
      Schema.Struct({
        shift: Schema.Boolean,
        ctrl: Schema.Boolean,
        alt: Schema.Boolean,
        meta: Schema.Boolean,
      })
    ),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('KeyReleased'),
    keyCode: Schema.String.pipe(Schema.brand('KeyCode')),
    modifiers: Schema.optional(
      Schema.Struct({
        shift: Schema.Boolean,
        ctrl: Schema.Boolean,
        alt: Schema.Boolean,
        meta: Schema.Boolean,
      })
    ),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  // マウスイベント
  Schema.Struct({
    _tag: Schema.Literal('MouseButtonPressed'),
    button: Schema.Union(Schema.Literal('left'), Schema.Literal('right'), Schema.Literal('middle')),
    x: Schema.Number,
    y: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseButtonReleased'),
    button: Schema.Union(Schema.Literal('left'), Schema.Literal('right'), Schema.Literal('middle')),
    x: Schema.Number,
    y: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseMoved'),
    x: Schema.Number,
    y: Schema.Number,
    deltaX: Schema.Number,
    deltaY: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('MouseWheel'),
    deltaX: Schema.Number,
    deltaY: Schema.Number,
    deltaZ: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  // ゲームパッドイベント
  Schema.Struct({
    _tag: Schema.Literal('GamepadButtonPressed'),
    buttonId: Schema.Number.pipe(Schema.brand('ButtonId')),
    value: Schema.Number.pipe(Schema.between(0, 1)),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('GamepadButtonReleased'),
    buttonId: Schema.Number.pipe(Schema.brand('ButtonId')),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('GamepadAxisMove'),
    axisId: Schema.Number,
    value: Schema.Number.pipe(Schema.between(-1, 1)),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  // タッチイベント
  Schema.Struct({
    _tag: Schema.Literal('TouchStart'),
    touches: Schema.Array(
      Schema.Struct({
        identifier: Schema.Number,
        x: Schema.Number,
        y: Schema.Number,
        force: Schema.optional(Schema.Number),
      })
    ),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('TouchMove'),
    touches: Schema.Array(
      Schema.Struct({
        identifier: Schema.Number,
        x: Schema.Number,
        y: Schema.Number,
        force: Schema.optional(Schema.Number),
      })
    ),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('TouchEnd'),
    touches: Schema.Array(
      Schema.Struct({
        identifier: Schema.Number,
        x: Schema.Number,
        y: Schema.Number,
        force: Schema.optional(Schema.Number),
      })
    ),
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  })
)

export type InputEvent = Schema.Schema.Type<typeof InputEventSchema>

// 入力状態スキーマ
export const InputStateSchema = Schema.Struct({
  _tag: Schema.Literal('InputState'),
  keys: Schema.instanceOf(Set<KeyCode>),
  mouseButtons: Schema.instanceOf(Set<'left' | 'right' | 'middle'>),
  mousePosition: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  mouseDelta: Schema.Struct({ deltaX: Schema.Number, deltaY: Schema.Number }),
  gamepadAxes: Schema.Array(Schema.Number),
  gamepadButtons: Schema.instanceOf(Set<ButtonId>),
  touchPoints: Schema.Array(
    Schema.Struct({
      identifier: Schema.Number,
      x: Schema.Number,
      y: Schema.Number,
      force: Schema.optional(Schema.Number),
    })
  ),
  timestamp: Schema.Number,
})

export type InputState = Schema.Schema.Type<typeof InputStateSchema>

// ゲームアクションスキーマ
export const GameActionSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('MovementAction'),
    direction: Schema.Union(
      Schema.Literal('forward'),
      Schema.Literal('backward'),
      Schema.Literal('left'),
      Schema.Literal('right')
    ),
    intensity: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('JumpAction'),
    intensity: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('RunAction'),
    active: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SneakAction'),
    active: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InteractAction'),
    target: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('AttackAction'),
    target: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('UseItemAction'),
    itemSlot: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OpenInventoryAction'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('OpenChatAction'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PauseAction'),
  })
)

export type GameAction = Schema.Schema.Type<typeof GameActionSchema>

// 入力マッピングスキーマ
export const InputMappingSchema = Schema.Struct({
  _tag: Schema.Literal('InputMapping'),
  actionName: Schema.String,
  keys: Schema.Array(Schema.String.pipe(Schema.brand('KeyCode'))),
  gamepadButtons: Schema.Array(Schema.Number.pipe(Schema.brand('ButtonId'))),
  gamepadAxes: Schema.Array(
    Schema.Struct({
      axis: Schema.Number,
      direction: Schema.Union(Schema.Literal('positive'), Schema.Literal('negative')),
      threshold: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ),
  mouseButtons: Schema.Array(Schema.Union(Schema.Literal('left'), Schema.Literal('right'), Schema.Literal('middle'))),
  touchGestures: Schema.Array(
    Schema.Union(
      Schema.Literal('tap'),
      Schema.Literal('doubleTap'),
      Schema.Literal('hold'),
      Schema.Literal('swipeUp'),
      Schema.Literal('swipeDown'),
      Schema.Literal('swipeLeft'),
      Schema.Literal('swipeRight'),
      Schema.Literal('pinch'),
      Schema.Literal('spread')
    )
  ),
})

export type InputMapping = Schema.Schema.Type<typeof InputMappingSchema>

// コントロールスキーマ
export const ControlSchemeSchema = Schema.Struct({
  _tag: Schema.Literal('ControlScheme'),
  name: Schema.String,
  description: Schema.String,
  targetDevices: Schema.Array(DeviceTypeSchema),
  mappings: Schema.Record({ key: Schema.String, value: InputMappingSchema }),
  sensitivity: Schema.Struct({
    mouse: Schema.Number.pipe(Schema.brand('MouseSensitivity')),
    gamepad: Schema.Number.pipe(Schema.brand('GamepadSensitivity')),
  }),
  deadzone: Schema.Struct({
    leftStick: Schema.Number.pipe(Schema.brand('DeadzoneValue')),
    rightStick: Schema.Number.pipe(Schema.brand('DeadzoneValue')),
    triggers: Schema.Number.pipe(Schema.brand('DeadzoneValue')),
  }),
})

export type ControlScheme = Schema.Schema.Type<typeof ControlSchemeSchema>

// アクセシビリティ設定スキーマ
export const AccessibilitySettingsSchema = Schema.Struct({
  _tag: Schema.Literal('AccessibilitySettings'),
  holdToSprint: Schema.Boolean,
  toggleCrouch: Schema.Boolean,
  autoJump: Schema.Boolean,
  mouseKeyNavigation: Schema.Boolean,
  colorBlindSupport: Schema.Boolean,
})

export type AccessibilitySettings = Schema.Schema.Type<typeof AccessibilitySettingsSchema>

// 入力トラッカースキーマ
export const InputTrackerSchema = Schema.Struct({
  _tag: Schema.Literal('InputTracker'),
  wasPressed: Schema.Boolean,
  isPressed: Schema.Boolean,
  justPressed: Schema.Boolean,
  justReleased: Schema.Boolean,
})

export type InputTracker = Schema.Schema.Type<typeof InputTrackerSchema>
