// Unified Test Pattern - Context7準拠
import { it, expect, Effect, Layer, Schema } from '../../../test/unified-test-helpers'
import { KeyboardInput, KeyboardInputLive, KeyboardInputError, MockKeyboardInput } from '../KeyboardInput'
import { DefaultKeyMap, KeyMappingError } from '../KeyMapping'

describe('KeyboardInput', () => {
  describe('KeyboardInputError', () => {
    it('エラーオブジェクトを正しく作成する', () => {
      const effect = Effect.gen(function* () {
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

      Effect.runSync(effect)
    })
  })

  describe('MockKeyboardInput', () => {
    it('モックサービスが正しく動作する', () => {
      const effect = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const isPressed = yield* keyboard.isKeyPressed('W')
        const state = yield* keyboard.getKeyState('W')
        const pressedKeys = yield* keyboard.getPressedKeys()
        const mapping = yield* keyboard.getKeyMapping()
        const action = yield* keyboard.getActionForKey('W')
        yield* keyboard.resetKeyStates()
        yield* keyboard.setKeyMapping(DefaultKeyMap)
        const isActionPressed = yield* keyboard.isActionPressed('forward')

        expect(isPressed).toBe(false)
        expect(state.key).toBe('W')
        expect(state.isPressed).toBe(false)
        expect(Array.isArray(pressedKeys)).toBe(true)
        expect(typeof mapping).toBe('object')
        expect(typeof isActionPressed).toBe('boolean')
      }).pipe(Effect.provide(MockKeyboardInput))

      Effect.runSync(effect)
    })
  })

  // DEPRECATED: Legacy KeyboardInputLive tests removed
  // Use unified test pattern with TestPattern.live for live environment testing

  describe('Unified Test Pattern Examples', () => {
    it('Schema検証テスト例', () => {
      const effect = Effect.gen(function* () {
        const error = KeyboardInputError({
          message: 'Test error',
          key: 'TestKey',
        })

        expect(error._tag).toBe('KeyboardInputError')
        expect(error.message).toBe('Test error')
      })

      Effect.runSync(effect)
    })

    it('Effect成功アサーション例', () => {
      const effect = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const result = yield* keyboard.getPressedKeys()
        expect(Array.isArray(result)).toBe(true)
      }).pipe(Effect.provide(MockKeyboardInput))

      Effect.runSync(effect)
    })

    it('パフォーマンステスト例', () => {
      const effect = Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const start = Date.now()
        yield* keyboard.isKeyPressed('W')
        const duration = Date.now() - start
        expect(duration).toBeLessThan(50)
      }).pipe(Effect.provide(MockKeyboardInput))

      Effect.runSync(effect)
    })
  })
})
