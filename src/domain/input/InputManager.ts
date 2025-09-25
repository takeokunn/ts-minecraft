import { Context, Effect, Layer, Match, Option, Stream, Queue, Ref, Schema } from 'effect'
import type { InputSystemError } from './types'
import type { InputEvent, InputState, DeviceType } from './schemas'
import { InputEventSchema, DeviceTypeSchema, InputStateSchema } from './schemas'
import { KeyBindingService, KeyBindingServiceLive } from './KeyBindingService'
import { InputContextManager, InputContextManagerLive } from './InputContextManager'
import { GamepadService, GamepadServiceLive } from './GamepadService'
import { TouchInputService, TouchInputServiceLive } from './TouchInputService'

// 入力マネージャーのエラー定義
export const InputManagerErrorSchema = Schema.Struct({
  _tag: Schema.Literal('InputManagerError'),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})
export type InputManagerError = Schema.Schema.Type<typeof InputManagerErrorSchema>

// 入力優先度
export const InputPriority = Schema.Literal('GUI', 'CHAT', 'SETTINGS', 'GAME', 'DEFAULT')
export type InputPriority = Schema.Schema.Type<typeof InputPriority>

// 統合入力マネージャーインターフェース
export interface InputManager {
  readonly registerDevice: (device: DeviceType) => Effect.Effect<void, InputManagerError>
  readonly unregisterDevice: (deviceId: string) => Effect.Effect<void, InputManagerError>
  readonly processInputEvent: (event: InputEvent) => Effect.Effect<void, InputManagerError>
  readonly getInputState: () => Effect.Effect<InputState, InputManagerError>
  readonly setInputPriority: (priority: InputPriority) => Effect.Effect<void, never>
  readonly createInputStream: () => Effect.Effect<Stream.Stream<InputEvent, InputManagerError>, never>
  readonly isActionActive: (actionName: string) => Effect.Effect<boolean, InputManagerError>
  readonly getActiveActions: () => Effect.Effect<ReadonlyArray<string>, InputManagerError>
  readonly enableDevice: (deviceType: DeviceType['_tag']) => Effect.Effect<void, InputManagerError>
  readonly disableDevice: (deviceType: DeviceType['_tag']) => Effect.Effect<void, InputManagerError>
}

export const InputManager = Context.GenericTag<InputManager>('@minecraft/InputManager')

// 内部状態管理
interface InputManagerState {
  readonly devices: Map<string, DeviceType>
  readonly inputState: InputState
  readonly currentPriority: InputPriority
  readonly activeActions: Set<string>
  readonly enabledDeviceTypes: Set<DeviceType['_tag']>
}

// InputManager実装
export const makeInputManager = Effect.gen(function* () {
  const keyBindingService = yield* KeyBindingService
  const contextManager = yield* InputContextManager
  const gamepadService = yield* GamepadService
  const touchService = yield* TouchInputService

  // 入力キューの作成
  const inputQueue = yield* Queue.bounded<InputEvent>(1000)

  // 内部状態の初期化
  const stateRef = yield* Ref.make<InputManagerState>({
    devices: new Map(),
    inputState: {
      _tag: 'InputState',
      keys: new Set(),
      mouseButtons: new Set(),
      mousePosition: { x: 0, y: 0 },
      mouseDelta: { deltaX: 0, deltaY: 0 },
      gamepadAxes: [],
      gamepadButtons: new Set(),
      touchPoints: [],
      timestamp: Date.now(),
    },
    currentPriority: 'GAME',
    activeActions: new Set(),
    enabledDeviceTypes: new Set(['Keyboard', 'Mouse']),
  })

  // デバイス登録
  const registerDevice = (device: DeviceType): Effect.Effect<void, InputManagerError> =>
    Effect.gen(function* () {
      yield* Ref.update(stateRef, (state) => ({
        ...state,
        devices: new Map(state.devices).set(
          Match.value(device).pipe(
            Match.when({ _tag: 'Keyboard' }, () => 'keyboard'),
            Match.when({ _tag: 'Mouse' }, () => 'mouse'),
            Match.when({ _tag: 'Gamepad' }, (g) => `gamepad-${g.index}`),
            Match.when({ _tag: 'TouchScreen' }, () => 'touch'),
            Match.exhaustive
          ),
          device
        ),
      }))
    })

  // デバイス登録解除
  const unregisterDevice = (deviceId: string): Effect.Effect<void, InputManagerError> =>
    Effect.gen(function* () {
      yield* Ref.update(stateRef, (state) => {
        const newDevices = new Map(state.devices)
        newDevices.delete(deviceId)
        return { ...state, devices: newDevices }
      })
    })

  // 入力イベント処理
  const processInputEvent = (event: InputEvent): Effect.Effect<void, InputManagerError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // デバイスタイプが有効か確認
      const deviceType = yield* Match.value(event).pipe(
        Match.when({ _tag: 'KeyPressed' }, () => Effect.succeed('Keyboard' as const)),
        Match.when({ _tag: 'KeyReleased' }, () => Effect.succeed('Keyboard' as const)),
        Match.when({ _tag: 'MouseButtonPressed' }, () => Effect.succeed('Mouse' as const)),
        Match.when({ _tag: 'MouseButtonReleased' }, () => Effect.succeed('Mouse' as const)),
        Match.when({ _tag: 'MouseMoved' }, () => Effect.succeed('Mouse' as const)),
        Match.when({ _tag: 'MouseWheel' }, () => Effect.succeed('Mouse' as const)),
        Match.when({ _tag: 'GamepadButtonPressed' }, () => Effect.succeed('Gamepad' as const)),
        Match.when({ _tag: 'GamepadButtonReleased' }, () => Effect.succeed('Gamepad' as const)),
        Match.when({ _tag: 'GamepadAxisMove' }, () => Effect.succeed('Gamepad' as const)),
        Match.when({ _tag: 'TouchStart' }, () => Effect.succeed('TouchScreen' as const)),
        Match.when({ _tag: 'TouchMove' }, () => Effect.succeed('TouchScreen' as const)),
        Match.when({ _tag: 'TouchEnd' }, () => Effect.succeed('TouchScreen' as const)),
        Match.exhaustive
      )

      // デバイスが無効な場合は早期リターン
      if (!state.enabledDeviceTypes.has(deviceType)) {
        return
      }

      // コンテキストに基づいて処理するか判断
      const shouldProcess = yield* contextManager.shouldProcessInput(event, state.currentPriority)
      if (!shouldProcess) {
        return
      }

      // キューに追加
      yield* Queue.offer(inputQueue, event)

      // 状態更新
      yield* updateInputState(event)

      // アクション解決
      const actions = yield* keyBindingService
        .resolveActions(event)
        .pipe(Effect.mapError((e) => ({ _tag: 'InputManagerError' as const, message: e.message, cause: e })))
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        activeActions: new Set([...s.activeActions, ...actions]),
      }))
    })

  // 入力状態更新
  const updateInputState = (event: InputEvent): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.update(stateRef, (state) => {
        const newInputState = { ...state.inputState, timestamp: Date.now() }

        Match.value(event).pipe(
          Match.when({ _tag: 'KeyPressed' }, ({ keyCode }) => {
            newInputState.keys.add(keyCode)
          }),
          Match.when({ _tag: 'KeyReleased' }, ({ keyCode }) => {
            newInputState.keys.delete(keyCode)
          }),
          Match.when({ _tag: 'MouseButtonPressed' }, ({ button }) => {
            newInputState.mouseButtons.add(button)
          }),
          Match.when({ _tag: 'MouseButtonReleased' }, ({ button }) => {
            newInputState.mouseButtons.delete(button)
          }),
          Match.when({ _tag: 'MouseMoved' }, ({ x, y, deltaX, deltaY }) => {
            newInputState.mousePosition = { x, y }
            newInputState.mouseDelta = { deltaX, deltaY }
          }),
          Match.when({ _tag: 'GamepadButtonPressed' }, ({ buttonId }) => {
            newInputState.gamepadButtons.add(buttonId)
          }),
          Match.when({ _tag: 'GamepadButtonReleased' }, ({ buttonId }) => {
            newInputState.gamepadButtons.delete(buttonId)
          }),
          Match.when({ _tag: 'GamepadAxisMove' }, ({ axisId, value }) => {
            const newAxes = [...newInputState.gamepadAxes]
            // Extend array if necessary to accommodate axisId
            while (newAxes.length <= axisId) {
              newAxes.push(0)
            }
            newAxes[axisId] = value
            newInputState.gamepadAxes = newAxes
          }),
          Match.when({ _tag: 'TouchStart' }, ({ touches }) => {
            newInputState.touchPoints = touches
          }),
          Match.when({ _tag: 'TouchMove' }, ({ touches }) => {
            newInputState.touchPoints = touches
          }),
          Match.when({ _tag: 'TouchEnd' }, ({ touches }) => {
            newInputState.touchPoints = touches
          }),
          Match.orElse(() => {})
        )

        return { ...state, inputState: newInputState }
      })
    })

  // 入力状態取得
  const getInputState = (): Effect.Effect<InputState, InputManagerError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.inputState
    })

  // 優先度設定
  const setInputPriority = (priority: InputPriority): Effect.Effect<void, never> =>
    Ref.update(stateRef, (state) => ({ ...state, currentPriority: priority }))

  // 入力ストリーム作成
  const createInputStream = (): Effect.Effect<Stream.Stream<InputEvent, InputManagerError>, never> =>
    Effect.succeed(Stream.fromQueue(inputQueue))

  // アクション確認
  const isActionActive = (actionName: string): Effect.Effect<boolean, InputManagerError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.activeActions.has(actionName)
    })

  // アクティブなアクション取得
  const getActiveActions = (): Effect.Effect<ReadonlyArray<string>, InputManagerError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return Array.from(state.activeActions)
    })

  // デバイス有効化
  const enableDevice = (deviceType: DeviceType['_tag']): Effect.Effect<void, InputManagerError> =>
    Effect.gen(function* () {
      yield* Ref.update(stateRef, (state) => ({
        ...state,
        enabledDeviceTypes: new Set([...state.enabledDeviceTypes, deviceType]),
      }))

      // デバイス固有の初期化
      yield* Match.value(deviceType).pipe(
        Match.when('Gamepad', () =>
          gamepadService
            .initialize()
            .pipe(Effect.mapError((e) => ({ _tag: 'InputManagerError' as const, message: e.message })))
        ),
        Match.when('TouchScreen', () =>
          touchService
            .initialize()
            .pipe(Effect.mapError((e) => ({ _tag: 'InputManagerError' as const, message: e.message })))
        ),
        Match.orElse(() => Effect.void)
      )
    })

  // デバイス無効化
  const disableDevice = (deviceType: DeviceType['_tag']): Effect.Effect<void, InputManagerError> =>
    Effect.gen(function* () {
      yield* Ref.update(stateRef, (state) => {
        const newEnabledTypes = new Set(state.enabledDeviceTypes)
        newEnabledTypes.delete(deviceType)
        return { ...state, enabledDeviceTypes: newEnabledTypes }
      })

      // デバイス固有のクリーンアップ
      yield* Match.value(deviceType).pipe(
        Match.when('Gamepad', () =>
          gamepadService
            .cleanup()
            .pipe(Effect.mapError((e) => ({ _tag: 'InputManagerError' as const, message: e.message })))
        ),
        Match.when('TouchScreen', () =>
          touchService
            .cleanup()
            .pipe(Effect.mapError((e) => ({ _tag: 'InputManagerError' as const, message: e.message })))
        ),
        Match.orElse(() => Effect.void)
      )
    })

  // DOMイベントリスナー設定
  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      // クリーンアップ処理
      yield* Queue.shutdown(inputQueue)
    })
  )

  return {
    registerDevice,
    unregisterDevice,
    processInputEvent,
    getInputState,
    setInputPriority,
    createInputStream,
    isActionActive,
    getActiveActions,
    enableDevice,
    disableDevice,
  }
})

// InputManagerレイヤー
export const InputManagerLive = Layer.effect(InputManager, makeInputManager).pipe(
  Layer.provide(
    Layer.mergeAll(KeyBindingServiceLive, InputContextManagerLive, GamepadServiceLive, TouchInputServiceLive)
  )
)
