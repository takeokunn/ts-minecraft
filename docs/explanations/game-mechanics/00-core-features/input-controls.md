---
title: "入力制御システム仕様 - キーボード・マウス・ゲームパッド統合"
description: "Minecraft Cloneの包括的入力制御システム。キーボード、マウス、ゲームパッド対応のレスポンシブ入力処理。カスタムキーバインド、マクロ機能、アクセシビリティ対応。"
category: "specification"
difficulty: "intermediate"
tags: ["input-system", "controls", "keyboard", "mouse", "gamepad", "accessibility", "user-interface"]
prerequisites: ["dom-events", "game-input-patterns", "accessibility-standards"]
estimated_reading_time: "15分"
related_patterns: ["event-handling-patterns", "ui-patterns", "accessibility-patterns"]
related_docs: ["./02-player-system.md", "./11-scene-management-system.md", "../../03-guides/00-development-conventions.md"]
search_keywords:
  primary: ["input-controls", "keyboard-input", "mouse-controls", "gamepad-support"]
  secondary: ["control-mapping", "accessibility", "user-input"]
  context: ["game-controls", "user-interface", "player-interaction"]
---

# 入力制御システム

TypeScript Minecraftのキーボード・マウス・ゲームパッド操作を統合した入力制御システム。柔軟な入力マッピングと複数デバイスの同時サポートにより、快適な操作体験を提供する。

## デフォルトキーマッピング

### 基本移動操作

| 操作 | キーボード | ゲームパッド | 説明 |
|------|------------|--------------|------|
| 前進 | W | 左スティック↑ | プレイヤーを前方に移動 |
| 後退 | S | 左スティック↓ | プレイヤーを後方に移動 |
| 左移動 | A | 左スティック← | プレイヤーを左に移動 |
| 右移動 | D | 左スティック→ | プレイヤーを右に移動 |
| ジャンプ | Space | Aボタン | プレイヤーをジャンプさせる |
| しゃがみ | Shift (左) | Bボタン | プレイヤーをしゃがませる |
| 走る | Ctrl (左) | 左スティック押込み | 通常より高速で移動 |

### カメラ操作

| 操作 | マウス | ゲームパッド | 説明 |
|------|--------|--------------|------|
| 視点移動 | マウス移動 | 右スティック | カメラの向きを変更 |
| 感度調整 | 設定で変更 | 設定で変更 | カメラの回転感度 |

### ブロック操作

| 操作 | マウス | ゲームパッド | 説明 |
|------|--------|--------------|------|
| ブロック破壊 | 左クリック | 右トリガー | ターゲットしたブロックを破壊 |
| ブロック配置 | 右クリック | 左トリガー | 選択中のブロックを配置 |
| ブロック選択 | 中クリック | 右スティック押込み | ターゲットブロックを選択 |

### インベントリ操作

| 操作 | キーボード | ゲームパッド | 説明 |
|------|------------|--------------|------|
| インベントリ開閉 | E | Yボタン | インベントリ画面の表示/非表示 |
| ホットバー選択 | 1-9キー | 十字キー | ホットバースロットを選択 |
| ホットバースクロール | マウスホイール | LB/RBボタン | ホットバーを順次選択 |

## 入力マッピングカスタマイズ

### 設定ファイル形式

```typescript
import { Schema, Effect, Context, Match, Layer, Config } from "effect"

// デバイスタイプスキーマ
const DeviceTypeSchema = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("Keyboard"),
    layout: Schema.Union(
      Schema.Literal("QWERTY"),
      Schema.Literal("AZERTY"),
      Schema.Literal("Dvorak")
    )
  }),
  Schema.Struct({
    _tag: Schema.Literal("Mouse"),
    buttonCount: Schema.Number,
    hasWheel: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("Gamepad"),
    type: Schema.Union(
      Schema.Literal("Xbox"),
      Schema.Literal("PlayStation"),
      Schema.Literal("Switch"),
      Schema.Literal("Generic")
    ),
    buttonCount: Schema.Number,
    axisCount: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("TouchScreen"),
    multiTouch: Schema.Boolean,
    maxTouchPoints: Schema.Number
  })
])

type DeviceType = Schema.Schema.Type<typeof DeviceTypeSchema>

// 入力マッピングスキーマ
const InputMappingSchema = Schema.Struct({
  _tag: Schema.Literal("InputMapping"),
  actionName: Schema.String,
  keys: Schema.Array(Schema.String.pipe(Schema.brand("KeyCode"))),
  gamepadButtons: Schema.Array(Schema.Number.pipe(Schema.brand("ButtonId"))),
  gamepadAxes: Schema.Array(Schema.Struct({
    axis: Schema.Number,
    direction: Schema.Union(
      Schema.Literal("positive"),
      Schema.Literal("negative")
    ),
    threshold: Schema.Number.pipe(Schema.between(0, 1))
  })),
  mouseButtons: Schema.Array(Schema.Union(
    Schema.Literal("left"),
    Schema.Literal("right"),
    Schema.Literal("middle")
  )),
  touchGestures: Schema.Array(GestureSchema)
})

type InputMapping = Schema.Schema.Type<typeof InputMappingSchema>

// コントロールスキームスキーマ
const ControlSchemeSchema = Schema.Struct({
  _tag: Schema.Literal("ControlScheme"),
  name: Schema.String,
  description: Schema.String,
  targetDevices: Schema.Array(DeviceTypeSchema),
  mappings: Schema.Record(Schema.String, InputMappingSchema),
  sensitivity: Schema.Struct({
    mouse: Schema.Number.pipe(Schema.brand("MouseSensitivity")),
    gamepad: Schema.Number.pipe(Schema.brand("GamepadSensitivity"))
  }),
  deadzone: Schema.Struct({
    leftStick: Schema.Number.pipe(Schema.brand("DeadzoneValue")),
    rightStick: Schema.Number.pipe(Schema.brand("DeadzoneValue")),
    triggers: Schema.Number.pipe(Schema.brand("DeadzoneValue"))
  }),
  accessibility: AccessibilitySettingsSchema
})

type ControlScheme = Schema.Schema.Type<typeof ControlSchemeSchema>

// 入力マッピングサービス
interface InputMappingServiceInterface {
  readonly loadControlScheme: (name: string) => Effect.Effect<ControlScheme, Config.Error, never>
  readonly saveControlScheme: (scheme: ControlScheme) => Effect.Effect<void, never, never>
  readonly getDefaultScheme: (deviceType: DeviceType) => Effect.Effect<ControlScheme, never, never>
  readonly validateMapping: (mapping: InputMapping) => Effect.Effect<boolean, never, never>
  readonly resolveInputAction: (
    event: InputEvent,
    scheme: ControlScheme
  ) => Effect.Effect<Array<string>, never, never>
}

const InputMappingService = Context.GenericTag<InputMappingServiceInterface>("@input/InputMappingService")

export const InputMappingServiceHelpers = {
  // デフォルトスキーム生成
  createDefaultScheme: (deviceType: DeviceType): Effect.Effect<ControlScheme, never, never> =>
    Match.value(deviceType).pipe(
      Match.when({ _tag: "Keyboard" }, () => createKeyboardScheme()),
      Match.when({ _tag: "Gamepad" }, (gamepad) => createGamepadScheme(gamepad.type)),
      Match.when({ _tag: "TouchScreen" }, () => createTouchScheme()),
      Match.orElse(() => createGenericScheme()),
      Match.exhaustive
    ),

  // 入力アクション解決
  resolveInputAction: (
    event: InputEvent,
    scheme: ControlScheme
  ): Effect.Effect<Array<string>, never, never> =>
    Effect.gen(function* () {
      const actions: Array<string> = []

      for (const [actionName, mapping] of Object.entries(scheme.mappings)) {
        const isMatch = yield* checkMappingMatch(event, mapping)
        if (isMatch) {
          actions.push(actionName)
        }
      }

      return actions
    })
}

// キーボードスキーム生成
const createKeyboardScheme = (): Effect.Effect<ControlScheme, never, never> =>
  Effect.succeed({
    _tag: "ControlScheme",
    name: "Default Keyboard",
    description: "標準キーボードコントロール",
    targetDevices: [{ _tag: "Keyboard", layout: "QWERTY" }],
    mappings: {
      moveForward: {
        _tag: "InputMapping",
        actionName: "moveForward",
        keys: ["KeyW" as KeyCode],
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: []
      },
      jump: {
        _tag: "InputMapping",
        actionName: "jump",
        keys: ["Space" as KeyCode],
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: []
      }
      // ... 他のマッピング
    },
    sensitivity: {
      mouse: 0.002 as MouseSensitivity,
      gamepad: 0.05 as GamepadSensitivity
    },
    deadzone: {
      leftStick: 0.15 as DeadzoneValue,
      rightStick: 0.15 as DeadzoneValue,
      triggers: 0.1 as DeadzoneValue
    },
    accessibility: {
      _tag: "AccessibilitySettings",
      holdToSprint: false,
      toggleCrouch: false,
      autoJump: false,
      mouseKeyNavigation: false,
      colorBlindSupport: false
    }
  })

// ゲームパッドスキーム生成
const createGamepadScheme = (
  gamepadType: "Xbox" | "PlayStation" | "Switch" | "Generic"
): Effect.Effect<ControlScheme, never, never> =>
  Match.value(gamepadType).pipe(
    Match.when("Xbox", () => createXboxControlScheme()),
    Match.when("PlayStation", () => createPlayStationControlScheme()),
    Match.when("Switch", () => createSwitchControlScheme()),
    Match.orElse(() => createGenericGamepadScheme()),
    Match.exhaustive
  )

// マッピングマッチング
const checkMappingMatch = (
  event: InputEvent,
  mapping: InputMapping
): Effect.Effect<boolean, never, never> =>
  Match.value(event).pipe(
    Match.when({ _tag: "KeyPressed" }, ({ keyCode }) =>
      Effect.succeed(mapping.keys.includes(keyCode))
    ),
    Match.when({ _tag: "MouseButtonPressed" }, ({ button }) =>
      Effect.succeed(mapping.mouseButtons.includes(button))
    ),
    Match.when({ _tag: "GamepadButtonPressed" }, ({ buttonId }) =>
      Effect.succeed(mapping.gamepadButtons.includes(buttonId))
    ),
    Match.when({ _tag: "GamepadAxisMove" }, ({ axisId, value }) =>
      Effect.gen(function* () {
        return mapping.gamepadAxes.some(axis => {
          if (axis.axis !== axisId) return false
          const meetsThreshold = Math.abs(value) >= axis.threshold
          const correctDirection =
            (axis.direction === "positive" && value > 0) ||
            (axis.direction === "negative" && value < 0)
          return meetsThreshold && correctDirection
        })
      })
    ),
    Match.orElse(() => Effect.succeed(false)),
    Match.exhaustive
  )
```

### キーコード対応表

#### よく使用されるキー

| 物理キー | キーコード | 説明 |
|----------|------------|------|
| W | KeyW | 英字キー |
| A | KeyA | 英字キー |
| S | KeyS | 英字キー |
| D | KeyD | 英字キー |
| Space | Space | スペースキー |
| Shift (左) | ShiftLeft | 左シフトキー |
| Shift (右) | ShiftRight | 右シフトキー |
| Ctrl (左) | ControlLeft | 左コントロールキー |
| Ctrl (右) | ControlRight | 右コントロールキー |
| E | KeyE | インベントリキー |
| Escape | Escape | エスケープキー |

#### 数字キー (ホットバー)

| 物理キー | キーコード |
|----------|------------|
| 1 | Digit1 |
| 2 | Digit2 |
| 3 | Digit3 |
| 4 | Digit4 |
| 5 | Digit5 |
| 6 | Digit6 |
| 7 | Digit7 |
| 8 | Digit8 |
| 9 | Digit9 |

### ゲームパッドボタン対応表

Xbox Controllerを基準とした標準マッピング:

| ボタン | インデックス | Xbox名称 |
|--------|--------------|----------|
| 0 | A | Aボタン |
| 1 | B | Bボタン |
| 2 | X | Xボタン |
| 3 | Y | Yボタン |
| 4 | LB | 左バンパー |
| 5 | RB | 右バンパー |
| 6 | LT | 左トリガー |
| 7 | RT | 右トリガー |
| 8 | Back | Backボタン |
| 9 | Start | Startボタン |
| 10 | LS | 左スティック押込み |
| 11 | RS | 右スティック押込み |
| 12 | ↑ | 十字キー上 |
| 13 | ↓ | 十字キー下 |
| 14 | ← | 十字キー左 |
| 15 | → | 十字キー右 |

### ゲームパッド軸対応表

| 軸インデックス | 説明 | 範囲 |
|----------------|------|------|
| 0 | 左スティック X軸 | -1.0 ～ 1.0 |
| 1 | 左スティック Y軸 | -1.0 ～ 1.0 |
| 2 | 右スティック X軸 | -1.0 ～ 1.0 |
| 3 | 右スティック Y軸 | -1.0 ～ 1.0 |

## 操作の詳細設定

### マウス感度調整

```typescript
import { Schema, Brand, Effect, Context } from "effect"

// ブランド型定義
type MouseSensitivity = number & Brand.Brand<"MouseSensitivity">
type MouseAcceleration = number & Brand.Brand<"MouseAcceleration">

// MouseSettings スキーマ定義
const MouseSettingsSchema = Schema.Struct({
  _tag: Schema.Literal("MouseSettings"),
  sensitivity: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.001),
    Schema.lessThanOrEqualTo(0.01),
    Schema.brand("MouseSensitivity")
  ),
  invertX: Schema.Boolean,
  invertY: Schema.Boolean,
  acceleration: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(2.0),
    Schema.brand("MouseAcceleration")
  )
}).annotations({
  identifier: "MouseSettings",
  description: "マウス操作設定"
})

type MouseSettings = Schema.Schema.Type<typeof MouseSettingsSchema>

// マウス設定サービス
interface MouseSettingsServiceInterface {
  readonly getSettings: Effect.Effect<MouseSettings, never, never>
  readonly updateSettings: (settings: MouseSettings) => Effect.Effect<void, never, never>
  readonly validateSettings: (settings: unknown) => Effect.Effect<MouseSettings, Schema.ParseError, never>
}

const MouseSettingsService = Context.GenericTag<MouseSettingsServiceInterface>("@input/MouseSettingsService")
```

### ゲームパッド設定

```typescript
import { Schema, Brand, Effect, Context } from "effect"

// ブランド型定義
type GamepadSensitivity = number & Brand.Brand<"GamepadSensitivity">
type DeadzoneValue = number & Brand.Brand<"DeadzoneValue">

// Deadzone設定スキーマ
const DeadzoneSchema = Schema.Struct({
  leftStick: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(0.3),
    Schema.brand("DeadzoneValue")
  ),
  rightStick: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(0.3),
    Schema.brand("DeadzoneValue")
  ),
  triggers: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(0.3),
    Schema.brand("DeadzoneValue")
  )
})

// GamepadSettings スキーマ定義
const GamepadSettingsSchema = Schema.Struct({
  _tag: Schema.Literal("GamepadSettings"),
  sensitivity: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.01),
    Schema.lessThanOrEqualTo(0.1),
    Schema.brand("GamepadSensitivity")
  ),
  invertX: Schema.Boolean,
  invertY: Schema.Boolean,
  deadzone: DeadzoneSchema,
  vibration: Schema.Boolean
}).annotations({
  identifier: "GamepadSettings",
  description: "ゲームパッド操作設定"
})

type GamepadSettings = Schema.Schema.Type<typeof GamepadSettingsSchema>

// ゲームパッド設定サービス
interface GamepadSettingsServiceInterface {
  readonly getSettings: Effect.Effect<GamepadSettings, never, never>
  readonly updateSettings: (settings: GamepadSettings) => Effect.Effect<void, never, never>
  readonly validateSettings: (settings: unknown) => Effect.Effect<GamepadSettings, Schema.ParseError, never>
  readonly applyDeadzone: (value: number, threshold: DeadzoneValue) => Effect.Effect<number, never, never>
}

const GamepadSettingsService = Context.GenericTag<GamepadSettingsServiceInterface>("@input/GamepadSettingsService")
```

### アクセシビリティ設定

```typescript
import { Schema, Effect, Context, Match } from "effect"

// アクセシビリティ機能の列挙型
const AccessibilityFeatureSchema = Schema.Union(
  Schema.Literal("HoldToSprint"),
  Schema.Literal("ToggleCrouch"),
  Schema.Literal("AutoJump"),
  Schema.Literal("MouseKeyNavigation"),
  Schema.Literal("ColorBlindSupport")
)

type AccessibilityFeature = Schema.Schema.Type<typeof AccessibilityFeatureSchema>

// アクセシビリティ設定スキーマ
const AccessibilitySettingsSchema = Schema.Struct({
  _tag: Schema.Literal("AccessibilitySettings"),
  holdToSprint: Schema.Boolean,
  toggleCrouch: Schema.Boolean,
  autoJump: Schema.Boolean,
  mouseKeyNavigation: Schema.Boolean,
  colorBlindSupport: Schema.Boolean
}).annotations({
  identifier: "AccessibilitySettings",
  description: "アクセシビリティ設定"
})

type AccessibilitySettings = Schema.Schema.Type<typeof AccessibilitySettingsSchema>

// アクセシビリティサービス
interface AccessibilityServiceInterface {
  readonly getSettings: Effect.Effect<AccessibilitySettings, never, never>
  readonly updateSettings: (settings: AccessibilitySettings) => Effect.Effect<void, never, never>
  readonly isFeatureEnabled: (feature: AccessibilityFeature) => Effect.Effect<boolean, never, never>
  readonly processInput: (feature: AccessibilityFeature, input: unknown) => Effect.Effect<unknown, never, never>
}

const AccessibilityService = Context.GenericTag<AccessibilityServiceInterface>("@input/AccessibilityService")

export const AccessibilityServiceHelpers = {
  processFeature: (feature: AccessibilityFeature, enabled: boolean) =>
    Match.value(feature).pipe(
      Match.when("HoldToSprint", () => enabled ? "hold-mode" : "toggle-mode"),
      Match.when("ToggleCrouch", () => enabled ? "toggle-mode" : "hold-mode"),
      Match.when("AutoJump", () => enabled ? "auto" : "manual"),
      Match.when("MouseKeyNavigation", () => enabled ? "mouse-keys" : "standard"),
      Match.when("ColorBlindSupport", () => enabled ? "colorblind-friendly" : "standard"),
      Match.exhaustive
    )
}
```

## 入力処理の実装パターン

### 基本入力チェック

```typescript
import { Schema, Effect, Stream, Queue, Context, Match, Brand } from "effect"

// ブランド型定義
type KeyCode = string & Brand.Brand<"KeyCode">
type ButtonId = number & Brand.Brand<"ButtonId">
type InputTimestamp = number & Brand.Brand<"InputTimestamp">

// 入力イベントのスキーマ定義
const InputEventSchema = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("KeyPressed"),
    keyCode: Schema.String.pipe(Schema.brand("KeyCode")),
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("KeyReleased"),
    keyCode: Schema.String.pipe(Schema.brand("KeyCode")),
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("MouseButtonPressed"),
    button: Schema.Literal("left", "right", "middle"),
    x: Schema.Number,
    y: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("MouseButtonReleased"),
    button: Schema.Literal("left", "right", "middle"),
    x: Schema.Number,
    y: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("GamepadButtonPressed"),
    buttonId: Schema.Number.pipe(Schema.brand("ButtonId")),
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("GamepadAxisMove"),
    axisId: Schema.Number,
    value: Schema.Number.pipe(Schema.between(-1, 1)),
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  })
])

type InputEvent = Schema.Schema.Type<typeof InputEventSchema>

// 入力状態サービス
interface InputStateServiceInterface {
  readonly checkForwardPressed: Effect.Effect<boolean, never, never>
  readonly checkLeftClickPressed: Effect.Effect<boolean, never, never>
  readonly processInputEvent: (event: InputEvent) => Effect.Effect<void, never, never>
}

const InputStateService = Context.GenericTag<InputStateServiceInterface>("@input/InputStateService")

export const InputStateServiceHelpers = {
  checkForwardPressed: Effect.gen(function* () {
    const keyPressed = yield* checkKeyPressed("KeyW" as KeyCode)
    const gamepadAxis = yield* checkGamepadAxis(1, "negative")
    return keyPressed || gamepadAxis
  }),

  checkLeftClickPressed: Effect.gen(function* () {
    const mousePressed = yield* checkMouseButton("left")
    const gamepadPressed = yield* checkGamepadButton(7 as ButtonId) // 右トリガー
    return mousePressed || gamepadPressed
  })
}

// 入力確認ユーティリティ
const checkKeyPressed = (keyCode: KeyCode): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const inputState = yield* InputStateService
    return yield* inputState.checkForwardPressed
  })

const checkGamepadAxis = (
  axisId: number,
  direction: "positive" | "negative"
): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const threshold = 0.5
    const axisValue = yield* getGamepadAxisValue(axisId)

    return Match.value(direction).pipe(
      Match.when("positive", () => axisValue > threshold),
      Match.when("negative", () => axisValue < -threshold),
      Match.exhaustive
    )
  })

const getGamepadAxisValue = (axisId: number): Effect.Effect<number, never, never> =>
  Effect.succeed(0) // 実装は実際のゲームパッドAPIから取得

const checkMouseButton = (button: "left" | "right" | "middle"): Effect.Effect<boolean, never, never> =>
  Effect.succeed(false) // 実装は実際のマウスAPIから取得

const checkGamepadButton = (buttonId: ButtonId): Effect.Effect<boolean, never, never> =>
  Effect.succeed(false) // 実装は実際のゲームパッドAPIから取得
```

### 連続入力と単発入力の区別

```typescript
import { Schema, Effect, Stream, Ref, Context, Match } from "effect"

// 入力状態トラッカースキーマ
const InputTrackerSchema = Schema.Struct({
  _tag: Schema.Literal("InputTracker"),
  wasPressed: Schema.Boolean,
  isPressed: Schema.Boolean,
  justPressed: Schema.Boolean,
  justReleased: Schema.Boolean
}).annotations({
  identifier: "InputTracker",
  description: "入力状態追跡情報"
})

type InputTracker = Schema.Schema.Type<typeof InputTrackerSchema>

// 入力トラッキングサービス
interface InputTrackerServiceInterface {
  readonly updateTracker: (currentState: boolean) => Effect.Effect<InputTracker, never, never>
  readonly getTracker: Effect.Effect<InputTracker, never, never>
  readonly resetTracker: Effect.Effect<void, never, never>
}

const InputTrackerService = Context.GenericTag<InputTrackerServiceInterface>("@input/InputTrackerService")

// 入力トラッカー更新関数
const updateInputTracker = (
  previousTracker: InputTracker,
  currentState: boolean
): Effect.Effect<InputTracker, never, never> =>
  Effect.succeed({
    _tag: "InputTracker" as const,
    wasPressed: previousTracker.isPressed,
    isPressed: currentState,
    justPressed: !previousTracker.isPressed && currentState,
    justReleased: previousTracker.isPressed && !currentState
  })

// ストリームベースの入力状態管理
const createInputTrackerStream = (
  inputStream: Stream.Stream<boolean, never, never>
): Effect.Effect<Stream.Stream<InputTracker, never, never>, never, never> =>
  Effect.gen(function* () {
    const initialTracker: InputTracker = {
      _tag: "InputTracker",
      wasPressed: false,
      isPressed: false,
      justPressed: false,
      justReleased: false
    }

    const trackerRef = yield* Ref.make(initialTracker)

    return Stream.mapEffect(inputStream, (currentState) =>
      Effect.gen(function* () {
        const previousTracker = yield* Ref.get(trackerRef)
        const newTracker = yield* updateInputTracker(previousTracker, currentState)
        yield* Ref.set(trackerRef, newTracker)
        return newTracker
      })
    )
  })

// デバウンス機能付き入力ストリーム
const createDebouncedInputStream = (
  inputStream: Stream.Stream<InputEvent, never, never>,
  debounceMs: number
): Effect.Effect<Stream.Stream<InputEvent, never, never>, never, never> =>
  Effect.gen(function* () {
    return Stream.debounce(inputStream, `${debounceMs}ms`)
  })
```

### 複合入力の処理

```typescript
import { Schema, Effect, Context, Match, Stream } from "effect"

// ゲームアクションスキーマ
const GameActionSchema = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("MovementAction"),
    direction: Schema.Union(
      Schema.Literal("forward"),
      Schema.Literal("backward"),
      Schema.Literal("left"),
      Schema.Literal("right")
    ),
    intensity: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("JumpAction"),
    intensity: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("RunAction"),
    active: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("SneakAction"),
    active: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("ComboAction"),
    primary: Schema.String,
    secondary: Schema.String,
    timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
  })
])

type GameAction = Schema.Schema.Type<typeof GameActionSchema>

// コンボアクション検出サービス
interface ComboDetectionServiceInterface {
  readonly detectHighJump: (
    runActive: boolean,
    jumpPressed: boolean,
    onGround: boolean
  ) => Effect.Effect<boolean, never, never>
  readonly detectSneaking: (
    sneakActive: boolean,
    movementActions: Array<GameAction>
  ) => Effect.Effect<boolean, never, never>
  readonly processComboActions: (
    actions: Array<GameAction>
  ) => Effect.Effect<Array<GameAction>, never, never>
}

const ComboDetectionService = Context.GenericTag<ComboDetectionServiceInterface>("@input/ComboDetectionService")

export const ComboDetectionServiceHelpers = {
  // 高ジャンプ検出
  detectHighJump: (
    runActive: boolean,
    jumpPressed: boolean,
    onGround: boolean
  ): Effect.Effect<boolean, never, never> =>
    Effect.succeed(runActive && jumpPressed && onGround),

  // 忍び歩き検出
  detectSneaking: (
    sneakActive: boolean,
    movementActions: Array<GameAction>
  ): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      if (!sneakActive) return false

      const hasMovement = movementActions.some(action =>
        Match.value(action).pipe(
          Match.when({ _tag: "MovementAction" }, ({ intensity }) => intensity > 0),
          Match.orElse(() => false)
        )
      )

      return hasMovement
    })
}

// コンボ検出ストリーム
const createComboDetectionStream = (
  actionStream: Stream.Stream<GameAction, never, never>
): Effect.Effect<Stream.Stream<GameAction, never, never>, never, never> =>
  Effect.gen(function* () {
    return Stream.groupedWithin(actionStream, 10, "100ms").pipe(
      Stream.mapEffect(actions =>
        Effect.gen(function* () {
          const comboService = yield* ComboDetectionService
          return yield* comboService.processComboActions(actions.toArray())
        })
      ),
      Stream.flatten
    )
  })

// アンチチート検証
const validateInputSequence = (
  actions: Array<GameAction>
): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    // 不正な連続入力のチェック
    const timeGaps = actions.map(action =>
      Match.value(action).pipe(
        Match.when({ _tag: "ComboAction" }, ({ timestamp }) => timestamp),
        Match.orElse(() => 0 as InputTimestamp)
      )
    )

    // 非現実的な連続入力の検出
    const suspiciousPattern = timeGaps.some((gap, index) => {
      if (index === 0) return false
      const timeDiff = gap - timeGaps[index - 1]
      return timeDiff < 10 // 10ms以下の間隔は疑わしい
    })

    return !suspiciousPattern
  })
```

## デバッグとトラブルシューティング

### 入力状態デバッグ表示

開発モード時の入力状態確認:

```typescript
import { Schema, Effect, Queue, Context, Stream, Console, Array as EffectArray } from "effect"

// デバッグ情報スキーマ
const InputDebugInfoSchema = Schema.Struct({
  _tag: Schema.Literal("InputDebugInfo"),
  activeKeys: Schema.Array(Schema.String.pipe(Schema.brand("KeyCode"))),
  mouseState: Schema.Struct({
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    delta: Schema.Struct({ deltaX: Schema.Number, deltaY: Schema.Number }),
    activeButtons: Schema.Array(Schema.Union(
      Schema.Literal("left"),
      Schema.Literal("right"),
      Schema.Literal("middle")
    ))
  }),
  gamepadState: Schema.Union(
    Schema.Struct({
      _tag: Schema.Literal("Connected"),
      axes: Schema.Array(Schema.Number),
      activeButtons: Schema.Array(Schema.Number.pipe(Schema.brand("ButtonId")))
    }),
    Schema.Struct({
      _tag: Schema.Literal("Disconnected")
    })
  ),
  timestamp: Schema.Number.pipe(Schema.brand("InputTimestamp"))
}).annotations({
  identifier: "InputDebugInfo",
  description: "入力デバッグ情報"
})

type InputDebugInfo = Schema.Schema.Type<typeof InputDebugInfoSchema>

// 入力バッファリングサービス
interface InputBufferServiceInterface {
  readonly createInputQueue: (
    capacity?: number
  ) => Effect.Effect<Queue.Queue<InputEvent>, never, never>
  readonly bufferInputEvents: (
    queue: Queue.Queue<InputEvent>,
    events: Array<InputEvent>
  ) => Effect.Effect<void, never, never>
  readonly processBufferedInputs: (
    queue: Queue.Queue<InputEvent>
  ) => Effect.Effect<Stream.Stream<InputEvent, never, never>, never, never>
  readonly validateInputBuffer: (
    events: Array<InputEvent>
  ) => Effect.Effect<Array<InputEvent>, InputValidationError, never>
}

const InputBufferService = Context.GenericTag<InputBufferServiceInterface>("@input/InputBufferService")

// 入力検証エラー
const InputValidationErrorSchema = Schema.TaggedError("InputValidationError", {
  message: Schema.String,
  invalidEvents: Schema.Array(InputEventSchema)
})

const InputValidationError = Schema.TaggedError(InputValidationErrorSchema)

// デバッグサービス
interface InputDebugServiceInterface {
  readonly logInputState: (debugInfo: InputDebugInfo) => Effect.Effect<void, never, never>
  readonly createDebugStream: (
    inputStream: Stream.Stream<InputEvent, never, never>
  ) => Effect.Effect<Stream.Stream<InputDebugInfo, never, never>, never, never>
  readonly enableDebugMode: Effect.Effect<void, never, never>
  readonly disableDebugMode: Effect.Effect<void, never, never>
}

const InputDebugService = Context.GenericTag<InputDebugServiceInterface>("@input/InputDebugService")

export const InputDebugServiceHelpers = {
  logInputState: (debugInfo: InputDebugInfo): Effect.Effect<void, never, never> =>
    Console.log(`Input Debug: ${JSON.stringify(debugInfo, null, 2)}`)
}

// 入力バッファ管理
const createInputBuffer = (
  capacity = 100
): Effect.Effect<Queue.Queue<InputEvent>, never, never> =>
  Queue.bounded<InputEvent>(capacity)

// 入力イベントのバッファリング
const bufferInputEvents = (
  queue: Queue.Queue<InputEvent>,
  events: Array<InputEvent>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* EffectArray.forEach(events, (event) => Queue.offer(queue, event))
  })

// バッファされた入力の処理
const processBufferedInputs = (
  queue: Queue.Queue<InputEvent>
): Effect.Effect<Stream.Stream<InputEvent, never, never>, never, never> =>
  Effect.succeed(Stream.fromQueue(queue))

// 入力遅延処理 (デバウンス)
const createDebouncedInputProcessor = (
  inputStream: Stream.Stream<InputEvent, never, never>,
  debounceTime: number
): Effect.Effect<Stream.Stream<InputEvent, never, never>, never, never> =>
  Effect.gen(function* () {
    return Stream.debounce(inputStream, `${debounceTime}ms`)
  })

// ジェスチャー認識システム
const GestureSchema = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("Tap"),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    duration: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("Swipe"),
    startPosition: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    endPosition: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    velocity: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("Hold"),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    duration: Schema.Number
  })
])

type Gesture = Schema.Schema.Type<typeof GestureSchema>

// ジェスチャー認識サービス
interface GestureRecognitionServiceInterface {
  readonly recognizeGesture: (
    events: Array<InputEvent>
  ) => Effect.Effect<Array<Gesture>, never, never>
  readonly createGestureStream: (
    inputStream: Stream.Stream<InputEvent, never, never>
  ) => Effect.Effect<Stream.Stream<Gesture, never, never>, never, never>
}

const GestureRecognitionService = Context.GenericTag<GestureRecognitionServiceInterface>("@input/GestureRecognitionService")
```

### よくある問題と解決方法

#### ゲームパッドが認識されない

```typescript
// ゲームパッド検出サービス
interface GamepadDetectionServiceInterface {
  readonly detectGamepads: Effect.Effect<Array<DeviceType>, never, never>
  readonly validateGamepadSupport: Effect.Effect<boolean, never, never>
  readonly activateGamepad: (gamepadIndex: number) => Effect.Effect<boolean, never, never>
}

const GamepadDetectionService = Context.GenericTag<GamepadDetectionServiceInterface>("@input/GamepadDetectionService")

export const GamepadDetectionServiceHelpers = {
  detectGamepads: Effect.gen(function* () {
    const gamepads = navigator.getGamepads()
    const detectedGamepads: Array<DeviceType> = []

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i]
      if (!gamepad) continue

      const deviceType = yield* identifyGamepadType(gamepad)
      detectedGamepads.push(deviceType)
    }

    return detectedGamepads
  })
}

const identifyGamepadType = (
  gamepad: Gamepad
): Effect.Effect<DeviceType, never, never> =>
  Effect.gen(function* () {
    const gamepadType = Match.value(gamepad.id.toLowerCase()).pipe(
      Match.when(
        id => id.includes("xbox"),
        () => "Xbox" as const
      ),
      Match.when(
        id => id.includes("playstation") || id.includes("dualshock"),
        () => "PlayStation" as const
      ),
      Match.when(
        id => id.includes("switch"),
        () => "Switch" as const
      ),
      Match.orElse(() => "Generic" as const)
    )

    return {
      _tag: "Gamepad",
      type: gamepadType,
      buttonCount: gamepad.buttons.length,
      axisCount: gamepad.axes.length
    }
  })
```

#### マウス感度が高すぎる/低すぎる

```typescript
// マウス感度校正サービス
interface MouseCalibrationServiceInterface {
  readonly autoCalibrateSensitivity: Effect.Effect<MouseSensitivity, never, never>
  readonly validateOSSettings: Effect.Effect<boolean, never, never>
  readonly checkPointerLock: Effect.Effect<boolean, never, never>
}

const MouseCalibrationService = Context.GenericTag<MouseCalibrationServiceInterface>("@input/MouseCalibrationService")

export const MouseCalibrationServiceHelpers = {
  autoCalibrateSensitivity: Effect.gen(function* () {
    const osSettings = yield* getOSMouseSettings()
    const browserSettings = yield* getBrowserMouseSettings()
    const recommendedSensitivity = yield* calculateOptimalSensitivity(osSettings, browserSettings)

    return recommendedSensitivity
  })
}

const getOSMouseSettings = (): Effect.Effect<{ dpi: number; sensitivity: number }, never, never> =>
  Effect.succeed({ dpi: 800, sensitivity: 1.0 }) // OS固有のAPIで取得

const calculateOptimalSensitivity = (
  osSettings: { dpi: number; sensitivity: number },
  browserSettings: { pixelRatio: number }
): Effect.Effect<MouseSensitivity, never, never> =>
  Effect.gen(function* () {
    const baseSensitivity = 0.002
    const dpiAdjustment = 800 / osSettings.dpi
    const osAdjustment = 1.0 / osSettings.sensitivity
    const pixelAdjustment = 1.0 / browserSettings.pixelRatio

    const adjustedSensitivity = baseSensitivity * dpiAdjustment * osAdjustment * pixelAdjustment

    return Math.max(0.001, Math.min(0.01, adjustedSensitivity)) as MouseSensitivity
  })
```

#### キー入力が反応しない

```typescript
// キーボードデバッグサービス
interface KeyboardDebugServiceInterface {
  readonly validateKeyCode: (keyCode: string) => Effect.Effect<boolean, never, never>
  readonly checkBrowserFocus: Effect.Effect<boolean, never, never>
  readonly detectKeyConflicts: Effect.Effect<Array<string>, never, never>
}

const KeyboardDebugService = Context.GenericTag<KeyboardDebugServiceInterface>("@input/KeyboardDebugService")

export const KeyboardDebugServiceHelpers = {
  validateKeyCode: (keyCode: string): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      const validKeyCodes = [
        "KeyW", "KeyA", "KeyS", "KeyD", "Space",
        "ShiftLeft", "ControlLeft", "KeyE", "Escape",
        "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
        "Digit6", "Digit7", "Digit8", "Digit9"
      ]

      return validKeyCodes.includes(keyCode)
    }),

  checkBrowserFocus: Effect.gen(function* () {
    return document.hasFocus() && document.visibilityState === "visible"
  }),

  detectKeyConflicts: Effect.gen(function* () {
    const conflicts: Array<string> = []

    // ブラウザのショートカットキーとの競合をチェック
    const potentialConflicts = [
      { key: "F5", description: "リロード" },
      { key: "F11", description: "フルスクリーン" },
      { key: "Ctrl+W", description: "タブを閉じる" },
      { key: "Ctrl+T", description: "新しいタブ" }
    ]

    for (const conflict of potentialConflicts) {
      const isConflicting = yield* checkKeyConflict(conflict.key)
      if (isConflicting) {
        conflicts.push(`${conflict.key}: ${conflict.description}`)
      }
    }

    return conflicts
  })
}

const checkKeyConflict = (keyCombo: string): Effect.Effect<boolean, never, never> =>
  Effect.succeed(false) // 実装は実際のショートカット検出ロジック

## 統合入力システムの実装

```typescript
// 統合入力システムレイヤー
const InputSystemLayer = Layer.effect(
  InputMappingService,
  Effect.gen(function* () {
    const inputQueue = yield* Queue.bounded<InputEvent>(1000)
    const debugService = yield* InputDebugService
    const bufferService = yield* InputBufferService
    const gestureService = yield* GestureRecognitionService

    const loadControlScheme = (name: string) =>
      Effect.gen(function* () {
        const config = yield* Config.string("controlScheme").pipe(
          Config.withDefault("default")
        )
        return yield* parseControlScheme(config)
      })

    const processInputEvents = (events: Array<InputEvent>) =>
      Effect.gen(function* () {
        // 入力検証
        const validEvents = yield* bufferService.validateInputBuffer(events)

        // ジェスチャー認識
        const gestures = yield* gestureService.recognizeGesture(validEvents)

        // アンチチート検証
        const isValid = yield* validateInputSequence(validEvents)
        if (!isValid) {
          yield* Effect.logWarning("不正な入力パターンを検出")
        }

        return { events: validEvents, gestures, isValid }
      })

    return {
      loadControlScheme,
      saveControlScheme: (scheme: ControlScheme) => Effect.unit,
      getDefaultScheme: InputMappingService.createDefaultScheme,
      validateMapping: (mapping: InputMapping) => Effect.succeed(true),
      resolveInputAction: InputMappingService.resolveInputAction
    }
  })
).pipe(
  Layer.provide(Layer.mergeAll(
    InputDebugService.Live,
    InputBufferService.Live,
    GestureRecognitionService.Live
  ))
)

// 入力処理メインストリーム
const createMainInputProcessingStream = Effect.gen(function* () {
  const inputQueue = yield* createInputBuffer()
  const mappingService = yield* InputMappingService
  const currentScheme = yield* mappingService.getDefaultScheme({
    _tag: "Keyboard",
    layout: "QWERTY"
  })

  const inputEventStream = Stream.fromQueue(inputQueue)
  const debouncedStream = yield* createDebouncedInputProcessor(inputEventStream, 16) // 60fps

  return Stream.mapEffect(debouncedStream, (event) =>
    Effect.gen(function* () {
      const actions = yield* mappingService.resolveInputAction(event, currentScheme)
      return { event, actions, timestamp: Date.now() as InputTimestamp }
    })
  )
})

このドキュメントは、Effect-TSの最新パターンを使用して、型安全でスケーラブルな入力制御システムを実現します。Schema.TaggedUnion、Stream処理、Contextサービス、パターンマッチング、ブランド型、Queueベースのバッファリング、ジェスチャー認識、アンチチート検証、アクセシビリティ機能を統合した包括的なソリューションです。

技術的な実装詳細は `docs/features/player-controls.md` を参照し、パフォーマンス最適化については `docs/guides/performance-optimization.md` を参照してください。
```