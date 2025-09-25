import { Effect, Layer, TestContext } from 'effect'
import { describe, it, expect } from 'vitest'
import { KeyBindingService, makeKeyBindingService, KeyBindingServiceLive } from '../KeyBindingService'
import type { InputEvent, InputMapping, ControlScheme } from '../schemas'

describe('KeyBindingService', () => {
  it('デフォルトマッピングが正しく読み込まれること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const allBindings = yield* keyBindingService.getAllBindings()

      expect(allBindings.moveForward).toBeDefined()
      expect(allBindings.moveForward.keys).toContain('KeyW')
      expect(allBindings.jump).toBeDefined()
      expect(allBindings.jump.keys).toContain('Space')
      expect(allBindings.hotbar1).toBeDefined()
      expect(allBindings.hotbar1.keys).toContain('Digit1')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('キー入力イベントからアクションを解決できること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

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

      const actions = yield* keyBindingService.resolveActions(keyEvent)

      expect(actions).toContain('moveForward')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('マウス入力イベントからアクションを解決できること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const mouseEvent: InputEvent = {
        _tag: 'MouseButtonPressed',
        button: 'left',
        x: 100,
        y: 100,
        timestamp: Date.now() as any,
      }

      const actions = yield* keyBindingService.resolveActions(mouseEvent)

      expect(actions).toContain('attack')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('ゲームパッド入力イベントからアクションを解決できること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const gamepadEvent: InputEvent = {
        _tag: 'GamepadButtonPressed',
        buttonId: 0 as any, // A button
        value: 1.0,
        timestamp: Date.now() as any,
      }

      const actions = yield* keyBindingService.resolveActions(gamepadEvent)

      expect(actions).toContain('jump')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('ゲームパッド軸入力からアクションを解決できること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const axisEvent: InputEvent = {
        _tag: 'GamepadAxisMove',
        axisId: 1, // 左スティック Y軸
        value: -0.8, // 上方向
        timestamp: Date.now() as any,
      }

      const actions = yield* keyBindingService.resolveActions(axisEvent)

      expect(actions).toContain('moveForward')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('新しいアクションをバインドできること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const newMapping: InputMapping = {
        _tag: 'InputMapping',
        actionName: 'testAction',
        keys: ['KeyT' as any],
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: [],
      }

      yield* keyBindingService.bindAction('testAction', newMapping)

      const binding = yield* keyBindingService.getBinding('testAction')
      expect(binding?.keys).toContain('KeyT')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('アクションをアンバインドできること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      yield* keyBindingService.unbindAction('moveForward')

      const binding = yield* keyBindingService.getBinding('moveForward')
      expect(binding).toBeNull()
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('キーバインドの競合を検出できること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const conflictingMapping: InputMapping = {
        _tag: 'InputMapping',
        actionName: 'conflictAction',
        keys: ['KeyW' as any], // moveForwardと競合
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: [],
      }

      const conflicts = yield* keyBindingService.detectConflicts(conflictingMapping)
      expect(conflicts).toContain('moveForward')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('競合するキーバインドは追加できないこと', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const conflictingMapping: InputMapping = {
        _tag: 'InputMapping',
        actionName: 'conflictAction',
        keys: ['KeyW' as any], // moveForwardと競合
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: [],
      }

      const result = yield* Effect.either(
        keyBindingService.bindAction('conflictAction', conflictingMapping)
      )

      expect(result._tag).toBe('Left')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('設定をデフォルトにリセットできること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      // カスタムバインドを追加
      const customMapping: InputMapping = {
        _tag: 'InputMapping',
        actionName: 'customAction',
        keys: ['KeyX' as any],
        gamepadButtons: [],
        gamepadAxes: [],
        mouseButtons: [],
        touchGestures: [],
      }

      yield* keyBindingService.bindAction('customAction', customMapping)

      // リセット
      yield* keyBindingService.resetToDefaults()

      // カスタムバインドが削除されていることを確認
      const binding = yield* keyBindingService.getBinding('customAction')
      expect(binding).toBeNull()

      // デフォルトバインドが復元されていることを確認
      const defaultBinding = yield* keyBindingService.getBinding('moveForward')
      expect(defaultBinding?.keys).toContain('KeyW')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('複合アクション（同時押し）が正しく動作すること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      // sprintJumpアクション（ControlLeft + Space）の確認
      const binding = yield* keyBindingService.getBinding('sprintJump')
      expect(binding?.keys).toContain('ControlLeft')
      expect(binding?.keys).toContain('Space')
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )

  it('カメラ制御のアナログ入力が正しく設定されていること', () =>
    Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const lookUpBinding = yield* keyBindingService.getBinding('lookUp')
      expect(lookUpBinding?.gamepadAxes).toHaveLength(1)
      expect(lookUpBinding?.gamepadAxes[0].axis).toBe(3) // 右スティック Y軸
      expect(lookUpBinding?.gamepadAxes[0].direction).toBe('negative')
      expect(lookUpBinding?.gamepadAxes[0].threshold).toBe(0.2)
    }).pipe(
      Effect.provide(KeyBindingServiceLive),
      Effect.runPromise
    )
  )
})