import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { MouseInput, MouseInputError, MockMouseInput } from '../MouseInput'
import type { MousePosition, PointerLockState } from '../MouseInput'
import { MouseDelta } from '../types'

describe('MouseInput', () => {
  describe('Interface Definition', () => {
    vitestIt('should define MouseInput interface correctly', () => {
      expect(MouseInput).toBeDefined()
      expect(typeof MouseInput).toBe('object')
    })

    vitestIt('should have correct tag identifier', () => {
      expect(MouseInput.toString()).toContain('@minecraft/MouseInput')
    })
  })

  describe('Service Contract', () => {
    const TestLayer = MockMouseInput

    it.effect('should get mouse position', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const position = yield* mouseInput.getPosition()

        expect(typeof position.x).toBe('number')
        expect(typeof position.y).toBe('number')
        expect(typeof position.timestamp).toBe('number')
        expect(position.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should get mouse delta', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const delta = yield* mouseInput.getDelta()

        expect(typeof delta.deltaX).toBe('number')
        expect(typeof delta.deltaY).toBe('number')
        expect(typeof delta.timestamp).toBe('number')
        expect(delta.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should get button state', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const buttonState = yield* mouseInput.getButtonState(0)

        expect(typeof buttonState.button).toBe('number')
        expect(typeof buttonState.isPressed).toBe('boolean')
        expect(typeof buttonState.timestamp).toBe('number')
        expect(buttonState.button).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should check if button is pressed', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const isPressed = yield* mouseInput.isButtonPressed(0)

        expect(typeof isPressed).toBe('boolean')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should request pointer lock', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput

        // Should not throw an error
        yield* mouseInput.requestPointerLock()
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should request pointer lock with element ID', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput

        // Should not throw an error
        yield* mouseInput.requestPointerLock('game-canvas')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should exit pointer lock', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput

        // Should not throw an error
        yield* mouseInput.exitPointerLock()
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should get pointer lock state', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const state = yield* mouseInput.getPointerLockState()

        expect(typeof state.isLocked).toBe('boolean')
        expect(state.isLocked).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should reset delta', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput

        // Should not throw an error
        yield* mouseInput.resetDelta()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error Handling', () => {
    const failingMouseInput: MouseInput = {
      getPosition: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to get position',
            cause: 'DOM not available',
          })
        ),

      getDelta: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to get delta',
          })
        ),

      getButtonState: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to get button state',
          })
        ),

      isButtonPressed: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to check button state',
          })
        ),

      requestPointerLock: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to request pointer lock',
            cause: 'Element not found',
          })
        ),

      exitPointerLock: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to exit pointer lock',
          })
        ),

      getPointerLockState: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to get pointer lock state',
          })
        ),

      resetDelta: () =>
        Effect.fail(
          MouseInputError({
            message: 'Failed to reset delta',
          })
        ),
    }

    const FailingLayer = Layer.succeed(MouseInput, failingMouseInput)

    it.effect('should handle position fetch error', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const result = yield* Effect.either(mouseInput.getPosition())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MouseInputError')
          expect(result.left.message).toBe('Failed to get position')
          expect(result.left.cause).toBe('DOM not available')
        }
      }).pipe(Effect.provide(FailingLayer))
    )

    it.effect('should handle delta fetch error', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const result = yield* Effect.either(mouseInput.getDelta())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MouseInputError')
          expect(result.left.message).toBe('Failed to get delta')
        }
      }).pipe(Effect.provide(FailingLayer))
    )

    it.effect('should handle pointer lock request error', () =>
      Effect.gen(function* () {
        const mouseInput = yield* MouseInput
        const result = yield* Effect.either(mouseInput.requestPointerLock('non-existent'))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MouseInputError')
          expect(result.left.message).toBe('Failed to request pointer lock')
          expect(result.left.cause).toBe('Element not found')
        }
      }).pipe(Effect.provide(FailingLayer))
    )
  })

  describe('Type Safety', () => {
    it('should ensure MousePosition interface is correctly typed', () => {
      const position: MousePosition = {
        x: 100,
        y: 200,
        timestamp: Date.now(),
      }

      expect(typeof position.x).toBe('number')
      expect(typeof position.y).toBe('number')
      expect(typeof position.timestamp).toBe('number')
    })

    it('should ensure PointerLockState interface is correctly typed', () => {
      const state: PointerLockState = {
        isLocked: true,
        element: 'game-canvas',
        lockTime: Date.now(),
      }

      expect(typeof state.isLocked).toBe('boolean')
      expect(typeof state.element).toBe('string')
      expect(typeof state.lockTime).toBe('number')
    })

    it('should allow optional fields in PointerLockState', () => {
      const minimalState: PointerLockState = {
        isLocked: false,
      }

      expect(typeof minimalState.isLocked).toBe('boolean')
      expect(minimalState.element).toBeUndefined()
      expect(minimalState.lockTime).toBeUndefined()
    })
  })

  describe('Error Types', () => {
    it('should create MouseInputError with proper structure', () => {
      const error = MouseInputError({
        message: 'Test error',
        cause: 'Test cause',
      })

      expect(error._tag).toBe('MouseInputError')
      expect(error.message).toBe('Test error')
      expect(error.cause).toBe('Test cause')
    })

    it('should create MouseInputError without optional fields', () => {
      const error = MouseInputError({
        message: 'Test error',
      })

      expect(error._tag).toBe('MouseInputError')
      expect(error.message).toBe('Test error')
      expect(error.cause).toBeUndefined()
    })
  })
})
