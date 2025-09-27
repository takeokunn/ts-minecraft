import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { KeyBindingService, KeyBindingServiceLive } from '../KeyBindingService'
import type { InputEvent, InputMapping } from '../schemas'

describe('KeyBindingService', () => {
  it('デフォルトマッピングが正しく読み込まれること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const allBindings = yield* keyBindingService.getAllBindings()

      expect(allBindings['moveForward']).toBeDefined()
      expect(allBindings['moveForward']?.keys).toContain('KeyW')
      expect(allBindings['jump']).toBeDefined()
      expect(allBindings['jump']?.keys).toContain('Space')
      expect(allBindings['hotbar1']).toBeDefined()
      expect(allBindings['hotbar1']?.keys).toContain('Digit1')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('キー入力イベントからアクションを解決できること', async () => {
    const effect = Effect.gen(function* () {
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
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('マウス入力イベントからアクションを解決できること', async () => {
    const effect = Effect.gen(function* () {
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
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('ゲームパッド入力イベントからアクションを解決できること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const gamepadEvent: InputEvent = {
        _tag: 'GamepadButtonPressed',
        buttonId: 0 as any, // A button
        value: 1.0,
        timestamp: Date.now() as any,
      }

      const actions = yield* keyBindingService.resolveActions(gamepadEvent)

      expect(actions).toContain('jump')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('ゲームパッド軸入力からアクションを解決できること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const axisEvent: InputEvent = {
        _tag: 'GamepadAxisMove',
        axisId: 1, // 左スティック Y軸
        value: -0.8, // 上方向
        timestamp: Date.now() as any,
      }

      const actions = yield* keyBindingService.resolveActions(axisEvent)

      expect(actions).toContain('moveForward')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('新しいアクションをバインドできること', async () => {
    const effect = Effect.gen(function* () {
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
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('アクションをアンバインドできること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      yield* keyBindingService.unbindAction('moveForward')

      const binding = yield* keyBindingService.getBinding('moveForward')
      expect(binding).toBeNull()
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('キーバインドの競合を検出できること', async () => {
    const effect = Effect.gen(function* () {
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
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('競合するキーバインドは追加できないこと', async () => {
    const effect = Effect.gen(function* () {
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

      const result = yield* Effect.either(keyBindingService.bindAction('conflictAction', conflictingMapping))

      expect(result._tag).toBe('Left')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('設定をデフォルトにリセットできること', async () => {
    const effect = Effect.gen(function* () {
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
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('複合アクション（同時押し）が正しく動作すること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      // sprintJumpアクション（ControlLeft + Space）の確認
      const binding = yield* keyBindingService.getBinding('sprintJump')
      expect(binding?.keys).toContain('ControlLeft')
      expect(binding?.keys).toContain('Space')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })

  it('カメラ制御のアナログ入力が正しく設定されていること', async () => {
    const effect = Effect.gen(function* () {
      const keyBindingService = yield* KeyBindingService

      const lookUpBinding = yield* keyBindingService.getBinding('lookUp')
      expect(lookUpBinding?.gamepadAxes).toHaveLength(1)
      expect(lookUpBinding?.gamepadAxes?.[0]?.axis).toBe(3) // 右スティック Y軸
      expect(lookUpBinding?.gamepadAxes?.[0]?.direction).toBe('negative')
      expect(lookUpBinding?.gamepadAxes?.[0]?.threshold).toBe(0.2)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(KeyBindingServiceLive)))
  })
})
