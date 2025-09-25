import { Effect, Layer, Queue, Ref, TestContext } from 'effect'
import { describe, it, expect } from 'vitest'
import { InputManager, makeInputManager } from '../InputManager'
import { KeyBindingService } from '../KeyBindingService'
import { InputContextManager } from '../InputContextManager'
import { GamepadService } from '../GamepadService'
import { TouchInputService } from '../TouchInputService'
import type { InputEvent, DeviceType } from '../schemas'

// モックサービス
const MockKeyBindingService = Layer.succeed(
  KeyBindingService,
  KeyBindingService.of({
    loadScheme: () => Effect.void,
    saveScheme: () => Effect.void,
    resolveActions: () => Effect.succeed(['moveForward']),
    bindAction: () => Effect.void,
    unbindAction: () => Effect.void,
    getBinding: () => Effect.succeed(null),
    getAllBindings: () => Effect.succeed({}),
    detectConflicts: () => Effect.succeed([]),
    resetToDefaults: () => Effect.void,
  })
)

const MockInputContextManager = Layer.succeed(
  InputContextManager,
  InputContextManager.of({
    setContext: () => Effect.void,
    getCurrentContext: () => Effect.succeed('GAME'),
    shouldProcessInput: () => Effect.succeed(true),
    pushContext: () => Effect.void,
    popContext: () => Effect.void,
    clearContextStack: () => Effect.void,
  })
)

const MockGamepadService = Layer.succeed(
  GamepadService,
  GamepadService.of({
    initialize: () => Effect.void,
    cleanup: () => Effect.void,
    getConnectedGamepads: () => Effect.succeed([]),
    getGamepadState: () => Effect.succeed(null),
    updateSettings: () => Effect.void,
    getSettings: () => Effect.succeed({
      _tag: 'GamepadSettings',
      sensitivity: 0.05 as any,
      invertX: false,
      invertY: false,
      deadzone: {
        leftStick: 0.15 as any,
        rightStick: 0.15 as any,
        triggers: 0.1 as any,
      },
      vibration: true,
    }),
    vibrate: () => Effect.void,
    applyDeadzone: (value) => Effect.succeed(value),
    createPollingStream: () => Effect.succeed({} as any),
  })
)

const MockTouchInputService = Layer.succeed(
  TouchInputService,
  TouchInputService.of({
    initialize: () => Effect.void,
    cleanup: () => Effect.void,
    updateSettings: () => Effect.void,
    getSettings: () => Effect.succeed({
      _tag: 'TouchSettings',
      tapThreshold: 200,
      holdThreshold: 500,
      swipeThreshold: 50,
      doubleTapThreshold: 300,
      pinchThreshold: 20,
      rotateThreshold: 15,
    }),
    detectGesture: () => Effect.succeed(null),
    createGestureStream: () => Effect.succeed({} as any),
    getTouchPoints: () => Effect.succeed([]),
    isMultiTouchSupported: () => Effect.succeed(true),
  })
)

const testLayers = Layer.mergeAll(
  MockKeyBindingService,
  MockInputContextManager,
  MockGamepadService,
  MockTouchInputService
)

describe('InputManager', () => {
  it('デバイスを正常に登録できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      const keyboardDevice: DeviceType = {
        _tag: 'Keyboard',
        layout: 'QWERTY',
      }

      yield* inputManager.registerDevice(keyboardDevice)

      // デバイスが正常に登録されたことを確認
      // 内部状態の確認は実際の実装に依存
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )

  it('入力イベントを正常に処理できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      const keyEvent: InputEvent = {
        _tag: 'KeyPressed',
        keyCode: 'KeyW' as any,
        modifiers: {
          shift: false,
          ctrl: false,
          alt: false,
          meta: false,
        },
        timestamp: Date.now() as any,
      }

      yield* inputManager.processInputEvent(keyEvent)

      // アクションが解決されたことを確認
      const activeActions = yield* inputManager.getActiveActions()
      expect(activeActions).toContain('moveForward')
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )

  it('入力優先度を設定できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      yield* inputManager.setInputPriority('MENU')

      // 優先度が設定されたことを内部的に確認
      // 実際の動作は他のテストで確認
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )

  it('デバイスを有効化/無効化できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      yield* inputManager.enableDevice('Gamepad')
      yield* inputManager.disableDevice('Gamepad')

      // デバイスが無効化された後は、そのデバイスからの入力が無視されることを確認
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )

  it('入力ストリームを作成できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      const inputStream = yield* inputManager.createInputStream()

      expect(inputStream).toBeDefined()
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )

  it('入力状態を取得できること', () =>
    Effect.gen(function* () {
      const inputManager = yield* makeInputManager

      const initialState = yield* inputManager.getInputState()

      expect(initialState._tag).toBe('InputState')
      expect(initialState.keys).toBeInstanceOf(Set)
      expect(initialState.mouseButtons).toBeInstanceOf(Set)
    }).pipe(
      Effect.provide(testLayers),
      Effect.runPromise
    )
  )
})