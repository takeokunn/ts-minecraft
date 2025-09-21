// Unified Test Pattern - Context7準拠
import { it, expect, Effect, Layer, Schema } from '../../../test/unified-test-helpers'
import { KeyboardInput, KeyboardInputLive, KeyboardInputError, MockKeyboardInput } from '../KeyboardInput'
import { DefaultKeyMap, KeyMappingError } from '../KeyMapping'

describe('KeyboardInput', () => {
  describe('KeyboardInputError', () => {
    it.effect('エラーオブジェクトを正しく作成する', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('MockKeyboardInput', () => {
    it.effect('モックサービスが正しく動作する', () =>
      Effect.gen(function* () {
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
    )
  })

  // DEPRECATED: Legacy KeyboardInputLive tests removed
  // Use unified test pattern with TestPattern.live for live environment testing

  describe('Unified Test Pattern Examples', () => {
    it.effect('Schema検証テスト例', () =>
      Effect.gen(function* () {
        const error = KeyboardInputError({
          message: 'Test error',
          key: 'TestKey'
        })

        expect(error._tag).toBe('KeyboardInputError')
        expect(error.message).toBe('Test error')
      })
    )

    it.effect('Effect成功アサーション例', () =>
      Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const result = yield* keyboard.getPressedKeys()
        expect(Array.isArray(result)).toBe(true)
      }).pipe(Effect.provide(MockKeyboardInput))
    )

    it.effect('パフォーマンステスト例', () =>
      Effect.gen(function* () {
        const keyboard = yield* KeyboardInput
        const start = Date.now()
        yield* keyboard.isKeyPressed('W')
        const duration = Date.now() - start
        expect(duration).toBeLessThan(50)
      }).pipe(Effect.provide(MockKeyboardInput))
    )
  })
})