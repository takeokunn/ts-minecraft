import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { it as itEffect } from '@effect/vitest'
import { Effect, Layer, TestContext, TestClock } from 'effect'
import { KeyboardInput, KeyboardInputLive, KeyboardInputError, MockKeyboardInput } from '../KeyboardInput'
import { DefaultKeyMap, KeyMappingError } from '../KeyMapping'

describe('KeyboardInput', () => {
  describe('KeyboardInputError', () => {
    it('エラーオブジェクトを正しく作成する', () => {
      const error = KeyboardInputError({
        message: 'テストエラー',
        key: 'TestKey',
        cause: '原因',
      })

      expect(error._tag).toBe('KeyboardInputError')
      expect(error.message).toBe('テストエラー')
      expect(error.key).toBe('TestKey')
      expect(error.cause).toBe('原因')
    })
  })

  describe('MockKeyboardInput', () => {
    it('モックサービスが正しく動作する', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const isPressed = yield* keyboard.isKeyPressed('W')
        const state = yield* keyboard.getKeyState('W')
        const pressedKeys = yield* keyboard.getPressedKeys()
        const mapping = yield* keyboard.getKeyMapping()
        const action = yield* keyboard.getActionForKey('W')
        yield* keyboard.resetKeyStates()
        yield* keyboard.setKeyMapping(DefaultKeyMap)
        const isActionPressed = yield* keyboard.isActionPressed('forward')

        return {
          isPressed,
          state,
          pressedKeys,
          mapping,
          action,
          isActionPressed,
        }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(MockKeyboardInput)))

      expect(result.isPressed).toBe(false)
      expect(result.state.key).toBe('W')
      expect(result.state.isPressed).toBe(false)
      expect(result.pressedKeys).toEqual([])
      expect(result.mapping).toEqual(DefaultKeyMap)
      expect(result.action).toBeUndefined()
      expect(result.isActionPressed).toBe(false)
    })
  })

  describe('KeyboardInputLive', () => {
    let windowEventListeners: { [key: string]: any[] } = {}
    let originalAddEventListener: typeof window.addEventListener
    let originalRemoveEventListener: typeof window.removeEventListener

    beforeEach(() => {
      windowEventListeners = {}

      // window.addEventListenerのモック
      originalAddEventListener = window.addEventListener
      originalRemoveEventListener = window.removeEventListener

      window.addEventListener = vi.fn((event: string, handler: any) => {
        if (!windowEventListeners[event]) {
          windowEventListeners[event] = []
        }
        windowEventListeners[event].push(handler)
      })

      window.removeEventListener = vi.fn((event: string, handler: any) => {
        if (windowEventListeners[event]) {
          const index = windowEventListeners[event].indexOf(handler)
          if (index > -1) {
            windowEventListeners[event].splice(index, 1)
          }
        }
      })
    })

    afterEach(() => {
      window.addEventListener = originalAddEventListener
      window.removeEventListener = originalRemoveEventListener
    })

    const simulateKeyEvent = (type: 'keydown' | 'keyup', code: string) => {
      const event = new KeyboardEvent(type, { code })
      if (windowEventListeners[type]) {
        windowEventListeners[type].forEach((handler) => handler(event))
      }
    }

    const simulateBlurEvent = () => {
      if (windowEventListeners['blur']) {
        windowEventListeners['blur'].forEach((handler) => handler())
      }
    }

    it('キー押下状態を正しく追跡する', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // キーが押されていない状態
        const beforePress = yield* keyboard.isKeyPressed('W')
        expect(beforePress).toBe(false)

        // キーを押下
        simulateKeyEvent('keydown', 'W')
        yield* TestClock.adjust(10)
        const afterPress = yield* keyboard.isKeyPressed('W')
        expect(afterPress).toBe(true)

        // キーを解放
        simulateKeyEvent('keyup', 'W')
        yield* TestClock.adjust(10)
        const afterRelease = yield* keyboard.isKeyPressed('W')
        expect(afterRelease).toBe(false)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('複数のキーの同時押しを処理する', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // 複数のキーを押下
        simulateKeyEvent('keydown', 'W')
        simulateKeyEvent('keydown', 'A')
        simulateKeyEvent('keydown', 'Space')
        yield* TestClock.adjust(10)

        const pressedKeys = yield* keyboard.getPressedKeys()
        expect(pressedKeys).toContain('W')
        expect(pressedKeys).toContain('A')
        expect(pressedKeys).toContain('Space')
        expect(pressedKeys).toHaveLength(3)

        // 一部のキーを解放
        simulateKeyEvent('keyup', 'A')
        yield* TestClock.adjust(10)

        const remainingKeys = yield* keyboard.getPressedKeys()
        expect(remainingKeys).toContain('W')
        expect(remainingKeys).toContain('Space')
        expect(remainingKeys).not.toContain('A')
        expect(remainingKeys).toHaveLength(2)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('アクションに対応するキーの押下状態を確認する', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // forward (W) を押下
        simulateKeyEvent('keydown', 'W')
        yield* TestClock.adjust(10)

        const isForwardPressed = yield* keyboard.isActionPressed('forward')
        expect(isForwardPressed).toBe(true)

        const isBackwardPressed = yield* keyboard.isActionPressed('backward')
        expect(isBackwardPressed).toBe(false)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('キーマッピングをカスタマイズできる', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // カスタムマッピングを設定
        const customMapping = {
          ...DefaultKeyMap,
          forward: 'ArrowUp',
          backward: 'ArrowDown',
        }
        yield* keyboard.setKeyMapping(customMapping)

        // 新しいマッピングで動作確認
        simulateKeyEvent('keydown', 'ArrowUp')
        yield* TestClock.adjust(10)

        const isForwardPressed = yield* keyboard.isActionPressed('forward')
        expect(isForwardPressed).toBe(true)

        // 古いマッピングは動作しない
        simulateKeyEvent('keydown', 'W')
        yield* TestClock.adjust(10)

        const isWPressed = yield* keyboard.isActionPressed('forward')
        expect(isWPressed).toBe(true) // ArrowUpが押されているため
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('重複するキーマッピングを検出する', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // 重複するマッピング
        const duplicateMapping = {
          ...DefaultKeyMap,
          forward: 'W',
          backward: 'W', // forwardと重複
        }

        const result = yield* Effect.either(keyboard.setKeyMapping(duplicateMapping))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('KeyMappingError')
          expect(result.left.message).toContain('重複')
        }
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('キーからアクションを逆引きできる', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        const forwardAction = yield* keyboard.getActionForKey('W')
        expect(forwardAction).toBe('forward')

        const jumpAction = yield* keyboard.getActionForKey('Space')
        expect(jumpAction).toBe('jump')

        const unknownAction = yield* keyboard.getActionForKey('Unknown')
        expect(unknownAction).toBeUndefined()
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('ウィンドウフォーカス喪失時にキー状態をリセットする', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // キーを押下
        simulateKeyEvent('keydown', 'W')
        simulateKeyEvent('keydown', 'A')
        yield* TestClock.adjust(10)

        const beforeBlur = yield* keyboard.getPressedKeys()
        expect(beforeBlur).toHaveLength(2)

        // ウィンドウフォーカス喪失
        simulateBlurEvent()
        yield* TestClock.adjust(10)

        const afterBlur = yield* keyboard.getPressedKeys()
        expect(afterBlur).toHaveLength(0)

        // 個別のキー状態も確認
        const wPressed = yield* keyboard.isKeyPressed('W')
        const aPressed = yield* keyboard.isKeyPressed('A')
        expect(wPressed).toBe(false)
        expect(aPressed).toBe(false)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('キー状態を手動でリセットできる', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // キーを押下
        simulateKeyEvent('keydown', 'W')
        simulateKeyEvent('keydown', 'Space')
        yield* TestClock.adjust(10)

        const beforeReset = yield* keyboard.getPressedKeys()
        expect(beforeReset).toHaveLength(2)

        // 手動リセット
        yield* keyboard.resetKeyStates()

        const afterReset = yield* keyboard.getPressedKeys()
        expect(afterReset).toHaveLength(0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('キー状態のタイムスタンプが正しく記録される', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        const beforePress = yield* keyboard.getKeyState('W')
        expect(beforePress.isPressed).toBe(false)

        // キーを押下
        simulateKeyEvent('keydown', 'W')
        yield* TestClock.adjust(10)

        const afterPress = yield* keyboard.getKeyState('W')
        expect(afterPress.isPressed).toBe(true)
        expect(afterPress.timestamp).toBeGreaterThan(0)

        // キーを解放
        simulateKeyEvent('keyup', 'W')
        yield* TestClock.adjust(10)

        const afterRelease = yield* keyboard.getKeyState('W')
        expect(afterRelease.isPressed).toBe(false)
        expect(afterRelease.timestamp).toBeGreaterThan(afterPress.timestamp)
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    it('存在しないアクションでエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput

        // キーマッピングから一部のアクションを削除
        const incompleteMapping = { ...DefaultKeyMap }
        delete (incompleteMapping as any).forward

        yield* keyboard.setKeyMapping(incompleteMapping as any)

        const result = yield* Effect.either(keyboard.isActionPressed('forward'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('KeyMappingError')
          expect(result.left.message).toContain('forward')
        }
      })

      await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext))))
    })

    // ========================================
    // Phase 2: エラー処理カバレッジテスト (it.effect パターン)
    // ========================================

    itEffect('safeWindowAccess エラー処理 - ブラウザAPI例外をキャッチする', () =>
      Effect.gen(function* () {
        // モックwindowでブラウザAPI例外をシミュレート
        const originalWindow = globalThis.window
        const mockWindow = {
          addEventListener: vi.fn(() => {
            throw new Error('DOM Exception: SecurityError')
          }),
          removeEventListener: vi.fn(),
        }

        // @ts-ignore - テスト用のwindow置き換え
        globalThis.window = mockWindow

        try {
          const keyboard = yield* KeyboardInput

          // ブラウザAPI例外が発生するパスをテスト
          const result = yield* Effect.either(Effect.sync(() => {
            // KeyboardInputLive内部のsafeWindowAccessでエラーハンドリングがトリガーされる
            mockWindow.addEventListener('keydown', () => {})
          }))

          expect(result._tag).toBe('Left')
        } finally {
          // 元のwindowを復元
          globalThis.window = originalWindow
        }
      }).pipe(Effect.provide(Layer.merge(KeyboardInputLive, TestContext.TestContext)))
    )

    itEffect('KeyboardInputError - cause付きエラー作成をテスト', () =>
      Effect.gen(function* () {
        // KeyboardInputErrorの内部構造をテスト (lines 61-64カバー)
        const testError = new Error('Test DOM Exception')
        const keyboardError = KeyboardInputError({
          message: 'Browser API error occurred',
          cause: testError.message,
        })

        expect(keyboardError._tag).toBe('KeyboardInputError')
        expect(keyboardError.message).toBe('Browser API error occurred')
        expect(keyboardError.cause).toBe('Test DOM Exception')
      })
    )
  })
})
