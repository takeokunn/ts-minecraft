import { Context, Effect, Layer, Match, Ref, pipe, Option, Stream, Schedule, Duration } from 'effect'
import { Schema } from '@effect/schema'
import type { ButtonId, DeadzoneValue, GamepadSensitivity } from './schemas'

// ゲームパッドエラー
export const GamepadErrorSchema = Schema.Struct({
  _tag: Schema.Literal('GamepadError'),
  message: Schema.String,
  gamepadIndex: Schema.optional(Schema.Number),
})
export type GamepadError = Schema.Schema.Type<typeof GamepadErrorSchema>

// ゲームパッド状態
export const GamepadStateSchema = Schema.Struct({
  _tag: Schema.Literal('GamepadState'),
  index: Schema.Number,
  connected: Schema.Boolean,
  id: Schema.String,
  axes: Schema.Array(Schema.Number),
  buttons: Schema.Array(
    Schema.Struct({
      pressed: Schema.Boolean,
      touched: Schema.Boolean,
      value: Schema.Number,
    })
  ),
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

export const GamepadService = Context.GenericTag<GamepadService>('@minecraft/domain/GamepadService')

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

      if (!hasSupport) {
        yield* Effect.fail({
          _tag: 'GamepadError' as const,
          message: 'Gamepad API is not supported in this browser',
        })
      }

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

      return yield* Effect.forEach(
        Array.from({ length: gamepads.length }, (_, i) => i),
        (index) =>
          Effect.gen(function* () {
            const gamepad = gamepads[index]
            return yield* pipe(
              Option.fromNullable(gamepad),
              Option.match({
                onNone: () => Effect.succeed(Option.none<GamepadState>()),
                onSome: (gp) =>
                  Effect.succeed(
                    Option.some<GamepadState>({
                      _tag: 'GamepadState',
                      index,
                      connected: true,
                      id: gp.id,
                      axes: Array.from(gp.axes),
                      buttons: Array.from(gp.buttons).map((btn) => ({
                        pressed: btn.pressed,
                        touched: btn.touched,
                        value: btn.value,
                      })),
                      vibrationActuator: gp.vibrationActuator !== undefined,
                      timestamp: gp.timestamp,
                    })
                  ),
              })
            )
          })
      ).pipe(Effect.map((results) => results.filter(Option.isSome).map(Option.getOrThrow)))
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
          onSome: (gp) =>
            Effect.succeed({
              _tag: 'GamepadState' as const,
              index,
              connected: true,
              id: gp.id,
              axes: Array.from(gp.axes),
              buttons: Array.from(gp.buttons).map((btn) => ({
                pressed: btn.pressed,
                touched: btn.touched,
                value: btn.value,
              })),
              vibrationActuator: gp.vibrationActuator !== undefined,
              timestamp: gp.timestamp,
            }),
        })
      )
    })

  // 設定更新
  const updateSettings = (settings: GamepadSettings): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      const validated = yield* Schema.decode(GamepadSettingsSchema)(settings).pipe(
        Effect.mapError((e) => ({ _tag: 'GamepadError' as const, message: `Invalid settings: ${e}` }))
      )
      yield* Ref.set(settingsRef, validated)
    })

  // 設定取得
  const getSettings = (): Effect.Effect<GamepadSettings, GamepadError> => Ref.get(settingsRef)

  // 振動
  const vibrate = (index: number, duration: number, intensity: number = 1.0): Effect.Effect<void, GamepadError> =>
    Effect.gen(function* () {
      const settings = yield* Ref.get(settingsRef)

      // 振動が無効なら何もしない
      if (!settings.vibration) {
        return yield* Effect.void
      }

      const gamepads = yield* Effect.sync(() => navigator.getGamepads())
      const gamepad = gamepads[index]

      yield* pipe(
        Option.fromNullable(gamepad),
        Option.match({
          onNone: () =>
            Effect.fail({
              _tag: 'GamepadError' as const,
              message: `Gamepad ${index} not found`,
              gamepadIndex: index,
            }),
          onSome: (gp) =>
            Effect.gen(function* () {
              yield* pipe(
                Option.fromNullable(gp.vibrationActuator),
                Option.match({
                  onNone: () => Effect.logWarning(`Gamepad ${index} does not support vibration`),
                  onSome: (actuator) =>
                    Effect.tryPromise({
                      try: () =>
                        actuator.playEffect('dual-rumble', {
                          duration,
                          strongMagnitude: intensity,
                          weakMagnitude: intensity * 0.5,
                        }),
                      catch: (e) => ({
                        _tag: 'GamepadError' as const,
                        message: `Vibration failed: ${e}`,
                        gamepadIndex: index,
                      }),
                    }),
                })
              )
            }),
        })
      )
    })

  // デッドゾーン適用
  const applyDeadzone = (value: number, threshold: DeadzoneValue): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const absValue = Math.abs(value)

      if (absValue < threshold) {
        return yield* Effect.succeed(0)
      } else {
        return yield* Effect.succeed(Math.sign(value) * ((absValue - threshold) / (1 - threshold)))
      }
    })

  // ポーリングストリーム作成
  const createPollingStream = (): Effect.Effect<Stream.Stream<GamepadState, GamepadError>, never> =>
    Effect.succeed(
      Stream.repeatEffect(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(pollingActiveRef)

          if (!isActive) {
            yield* Effect.interrupt
          }

          const gamepads = yield* getConnectedGamepads()
          // 最初のゲームパッドまたはデフォルト状態を返す
          return (
            gamepads[0] || {
              _tag: 'GamepadState' as const,
              index: 0,
              connected: false,
              id: '',
              axes: [],
              buttons: [],
              vibrationActuator: false,
              timestamp: Date.now(),
            }
          )
        })
      ).pipe(
        Stream.schedule(Schedule.fixed(Duration.millis(16))) // 60fps
      )
    )

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
export const GamepadServiceLive = Layer.effect(GamepadService, makeGamepadService)
