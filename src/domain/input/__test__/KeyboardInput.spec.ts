import { describe, expect, as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { KeyboardInput, KeyboardInputLive, KeyboardInputError, MockKeyboardInput } from '../KeyboardInput'
import { DefaultKeyMap, KeyMappingError } from '../KeyMapping'

describe('KeyboardInput', () => {
  describe('KeyboardInputError', () => {
  it.effect('should create error with proper structure', () => Effect.gen(function* () {
    const error = KeyboardInputError({
    message: 'Test error',
    key: 'TestKey',
    cause: 'Test cause',
})
).toBe('KeyboardInputError')
      expect(error.message).toBe('Test error')
      expect(error.key).toBe('TestKey')
      expect(error.cause).toBe('Test cause')
    })
  })

  describe('MockKeyboardInput', () => {
  const TestLayer = MockKeyboardInput
  it.effect('should check key press state', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const isPressed = yield* keyboard.isKeyPressed('W')
    expect(typeof isPressed).toBe('boolean')
}).pipe(Effect.provide(TestLayer))
    )
    it.effect('should get key state', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const state = yield* keyboard.getKeyState('W')
    expect(state.key).toBe('W')
    expect(typeof state.isPressed).toBe('boolean')
    expect(typeof state.timestamp).toBe('number')
    }).pipe(Effect.provide(TestLayer))
    )
    it.effect('should get pressed keys list', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const pressedKeys = yield* keyboard.getPressedKeys()
    expect(Array.isArray(pressedKeys)).toBe(true)
    }).pipe(Effect.provide(TestLayer))
    )
    it.effect('should get key mapping', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const mapping = yield* keyboard.getKeyMapping()
    expect(typeof mapping).toBe('object')
    }).pipe(Effect.provide(TestLayer))
    )
    it.effect('should set key mapping', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    // Should not throw error
    yield* keyboard.setKeyMapping(DefaultKeyMap)
    }).pipe(Effect.provide(TestLayer))
    )
    it.effect('should reset key states', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    // Should not throw error
    yield* keyboard.resetKeyStates()
    }).pipe(Effect.provide(TestLayer))
    )
    describe('Error Handling', () => {
    const failingKeyboard: KeyboardInput = {
    // Effect<boolean> - エラーなし
    isKeyPressed: () => Effect.succeed(false),
    // Effect<KeyState> - エラーなし
    getKeyState: () => Effect.succeed({
    key: 'test',
    isPressed: false,
    timestamp: Date.now(),
}),
    // Effect<ReadonlyArray<string>> - エラーなし
    getPressedKeys: () => Effect.succeed([]),
    // Effect<KeyMappingConfig> - エラーなし
    getKeyMapping: () => Effect.succeed(DefaultKeyMap),
    // Effect<void, KeyMappingError> - KeyMappingErrorを返す
    setKeyMapping: () => Effect.fail(
    KeyMappingError({
    message: 'Failed to set mapping',}),
    // Effect<KeyAction | undefined> - エラーなし
    getActionForKey: () => Effect.succeed(undefined),
    // Effect<boolean, KeyMappingError> - KeyMappingErrorを返す
    isActionPressed: () => Effect.fail(
    KeyMappingError({
    message: 'Failed to check action',
    action: 'forward',
  })
),
      // Effect<void> - エラーなし
      resetKeyStates: () => Effect.succeed(undefined),
    }

    const FailingLayer = Layer.succeed(KeyboardInput, failingKeyboard)

    it.effect('should handle action press check error', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const result = yield* Effect.either(keyboard.isActionPressed('forward'))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
    expect(result.left._tag).toBe('KeyMappingError')
    expect(result.left.message).toBe('Failed to check action')
    }
  }).pipe(Effect.provide(FailingLayer))
)

    it.effect('should handle set key mapping error', () => Effect.gen(function* () {
    const keyboard = yield* KeyboardInput
    const result = yield* Effect.either(keyboard.setKeyMapping(DefaultKeyMap))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
    expect(result.left._tag).toBe('KeyMappingError')
    expect(result.left.message).toBe('Failed to set mapping')
    }
  }).pipe(Effect.provide(FailingLayer))
)
  })
