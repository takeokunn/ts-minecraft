import { Context, Effect, Layer, Match, Ref, Schema, pipe, Option, Stream, Schedule, Duration } from 'effect'
import type { ButtonId, DeadzoneValue, GamepadSensitivity } from './schemas'

// ゲームパッドエラー
export const GamepadErrorSchema = Schema.TaggedError('GamepadError', {
  message: Schema.String,
  gamepadIndex: Schema.optional(Schema.Number),
})
export const GamepadError = Schema.TaggedError(GamepadErrorSchema)
export type GamepadError = Schema.Schema.Type<typeof GamepadErrorSchema>

// ゲームパッド状態
export const GamepadStateSchema = Schema.Struct({
  _tag: Schema.Literal('GamepadState'),
  index: Schema.Number,
  connected: Schema.Boolean,
  id: Schema.String,
  axes: Schema.Array(Schema.Number),
  buttons: Schema.Array(Schema.Struct({
    pressed: Schema.Boolean,
    touched: Schema.Boolean,
    value: Schema.Number,
  })),
  vibrationActuator: Schema.optional(Schema.Boolean),
  timestamp: Schema.Number,
})

export type GamepadState = Schema.Schema.Type<typeof GamepadStateSchema>

// ゲームパッド設定
export const GamepadSettingsSchema = Schema.Struct({
  _tag: Schema.Literal('GamepadSettings'),
  sensitivity: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.01),
    Schema.lessThanOrEqualTo(0.1),
    Schema.brand('GamepadSensitivity')
  ),
  invertX: Schema.Boolean,
  invertY: Schema.Boolean,
  deadzone: Schema.Struct({
    leftStick: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0.0),
      Schema.lessThanOrEqualTo(0.3),
      Schema.brand('DeadzoneValue')
    ),
    rightStick: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0.0),
      Schema.lessThanOrEqualTo(0.3),
      Schema.brand('DeadzoneValue')
    ),
    triggers: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0.0),
      Schema.lessThanOrEqualTo(0.3),
      Schema.brand('DeadzoneValue')
    ),
  }),
  vibration: Schema.Boolean,
})

export type GamepadSettings = Schema.Schema.Type<typeof GamepadSettingsSchema>

// ゲームパッドサービスインターフェース
export interface GamepadService {
  readonly initialize: () => Effect.Effect<void, GamepadError>
  readonly cleanup: () => Effect.Effect<void, GamepadError>
  readonly getConnectedGamepads: () => Effect.Effect<ReadonlyArray<GamepadState>, GamepadError>
  readonly getGamepadState: (index: number) => Effect.Effect<GamepadState | null, GamepadError>
  readonly updateSettings: (settings: GamepadSettings) => Effect.Effect<void, GamepadError>
  readonly getSettings: () => Effect.Effect<GamepadSettings, GamepadError>
  readonly vibrate: (index: number, duration: number, intensity?: number) => Effect.Effect<void, GamepadError>
  readonly applyDeadzone: (value: number, threshold: DeadzoneValue) => Effect.Effect<number, never>
  readonly createPollingStream: () => Effect.Effect<Stream.Stream<GamepadState, GamepadError>, never>
}

export const GamepadService = Context.GenericTag<GamepadService>('@minecraft/GamepadService')

// デフォルト設定
const DEFAULT_SETTINGS: GamepadSettings = {
  _tag: 'GamepadSettings',
  sensitivity: 0.05 as GamepadSensitivity,
  invertX: false,
  invertY: false,
  deadzone: {
    leftStick: 0.15 as DeadzoneValue,
    rightStick: 0.15 as DeadzoneValue,
    triggers: 0.1 as DeadzoneValue,
  },
  vibration: true,
}

// ゲームパッドサービス実装
export const makeGamepadService = Effect.gen(function* () {
  // 設定の状態管理
  const settingsRef = yield* Ref.make<GamepadSettings>(DEFAULT_SETTINGS)

  // ポーリング状態
  const pollingActiveRef = yield* Ref.make<boolean>(false)

  // ゲームパッド初期化
  const initialize = (): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      // ブラウザサポート確認
      const hasSupport = yield* Effect.sync(() => 'getGamepads' in navigator)

      yield* Effect.when(
        Effect.succeed(!hasSupport),
        () => Effect.fail(GamepadError.make({
          message: 'Gamepad API is not supported in this browser',
        }) as GamepadError)
      )

      // ポーリング開始
      yield* Ref.set(pollingActiveRef, true)
      yield* Effect.logInfo('GamepadService initialized')
    })

  // クリーンアップ
  const cleanup = (): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      yield* Ref.set(pollingActiveRef, false)
      yield* Effect.logInfo('GamepadService cleaned up')
    })

  // 接続されているゲームパッド取得
  const getConnectedGamepads = (): Effect.Effect<ReadonlyArray<GamepadState>, GamepadError> =>
    Effect.gen(function* () {
      const gamepads = yield* Effect.sync(() => navigator.getGamepads())
      const states: GamepadState[] = []

      yield* Effect.forEach(gamepads, (gamepad, index) =>
        Effect.gen(function* () {
          yield* pipe(
            Option.fromNullable(gamepad),
            Option.match({
              onNone: () => Effect.void,
              onSome: (gp) => Effect.sync(() => {
                states.push({
                  _tag: 'GamepadState',
                  index,
                  connected: true,
                  id: gp.id,
                  axes: Array.from(gp.axes),
                  buttons: Array.from(gp.buttons).map(btn => ({
                    pressed: btn.pressed,
                    touched: btn.touched,
                    value: btn.value,
                  })),
                  vibrationActuator: gp.vibrationActuator !== undefined,
                  timestamp: gp.timestamp,
                })
              })
            })
          )
        })
      )

      return states
    })

  // 特定のゲームパッド状態取得
  const getGamepadState = (index: number): Effect.Effect<GamepadState | null, GamepadError> =>
    Effect.gen(function* () {
      const gamepads = yield* Effect.sync(() => navigator.getGamepads())
      const gamepad = gamepads[index]

      return yield* pipe(
        Option.fromNullable(gamepad),
        Option.match({
          onNone: () => Effect.succeed(null),
          onSome: (gp) => Effect.succeed({
            _tag: 'GamepadState' as const,
            index,
            connected: true,
            id: gp.id,
            axes: Array.from(gp.axes),
            buttons: Array.from(gp.buttons).map(btn => ({
              pressed: btn.pressed,
              touched: btn.touched,
              value: btn.value,
            })),
            vibrationActuator: gp.vibrationActuator !== undefined,
            timestamp: gp.timestamp,
          })
        })
      )
    })

  // 設定更新
  const updateSettings = (settings: GamepadSettings): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      const validated = yield* Schema.decode(GamepadSettingsSchema)(settings).pipe(
        Effect.mapError(e => GamepadError.make({ message: `Invalid settings: ${e}` }) as GamepadError)
      )
      yield* Ref.set(settingsRef, validated)
    })

  // 設定取得
  const getSettings = (): Effect.Effect<GamepadSettings, GamepadError> =>
    Ref.get(settingsRef)

  // 振動
  const vibrate = (index: number, duration: number, intensity: number = 1.0): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      const settings = yield* Ref.get(settingsRef)

      yield* Effect.when(
        Effect.succeed(!settings.vibration),
        () => Effect.void // 振動が無効なら何もしない
      )

      const gamepads = yield* Effect.sync(() => navigator.getGamepads())
      const gamepad = gamepads[index]

      yield* pipe(
        Option.fromNullable(gamepad),
        Option.match({
          onNone: () => Effect.fail(GamepadError.make({
            message: `Gamepad ${index} not found`,
            gamepadIndex: index,
          }) as GamepadError),
          onSome: (gp) => Effect.gen(function* () {
            yield* pipe(
              Option.fromNullable(gp.vibrationActuator),
              Option.match({
                onNone: () => Effect.logWarning(`Gamepad ${index} does not support vibration`),
                onSome: (actuator) => Effect.tryPromise({
                  try: () => actuator.playEffect('dual-rumble', {
                    duration,
                    strongMagnitude: intensity,
                    weakMagnitude: intensity * 0.5,
                  }),
                  catch: (e) => GamepadError.make({
                    message: `Vibration failed: ${e}`,
                    gamepadIndex: index,
                  }) as GamepadError
                })
              })
            )
          })
        })
      )
    })

  // デッドゾーン適用
  const applyDeadzone = (value: number, threshold: DeadzoneValue): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const absValue = Math.abs(value)

      return yield* Effect.if(
        absValue < threshold,
        {
          onTrue: () => Effect.succeed(0),
          onFalse: () => Effect.succeed(
            Math.sign(value) * ((absValue - threshold) / (1 - threshold))
          )
        }
      )
    })

  // ポーリングストリーム作成
  const createPollingStream = (): Effect.Effect<Stream.Stream<GamepadState, GamepadError>, never> =>
    Effect.gen(function* () {
      return Stream.repeatEffect(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(pollingActiveRef)

          yield* Effect.when(
            Effect.succeed(!isActive),
            () => Effect.interrupt
          )

          const gamepads = yield* getConnectedGamepads()
          return gamepads
        }).pipe(
          Stream.mapEffect(states => Effect.succeed(states[0])) // 最初のゲームパッドのみ（拡張可能）
        ),
        Stream.schedule(Schedule.fixed(Duration.millis(16))) // 60fps
      )
    })

  return {
    initialize,
    cleanup,
    getConnectedGamepads,
    getGamepadState,
    updateSettings,
    getSettings,
    vibrate,
    applyDeadzone,
    createPollingStream,
  }
})

// GamepadServiceレイヤー
export const GamepadServiceLive = Layer.effect(
  GamepadService,
  makeGamepadService
)