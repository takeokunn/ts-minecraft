import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Context, Effect, Layer } from 'effect'
import { InputService } from '../InputService'
import type { InputHandler } from '../types'
import { InputHandlerRegistrationError, InputSystemError, MouseDelta } from '../types'

describe('InputService', () => {
  describe('Interface Definition', () => {
    vitestIt('should define InputService interface correctly', () => {
      expect(InputService).toBeDefined()
      expect(typeof InputService).toBe('object')
    })

    vitestIt('should have correct tag identifier', () => {
      expect(InputService.toString()).toContain('@minecraft/InputService')
    })
  })

  describe('Service Contract', () => {
    const mockInputService: InputService = {
      isKeyPressed: (key: string) =>
        Effect.gen(function* () {
          yield* pipe(key === 'invalid', Match.value, Match.when(true, () => Effect.sync(() => {
            return yield* Effect.fail(
              InputSystemError({
                message: 'Invalid key',
                key,
              })
            )
          }
          return key === 'w'
        }),

      isMousePressed: (button: number) =>
        Effect.gen(function* () {
          yield* pipe(button < 0 || button > 2, Match.value, Match.when(true, () => Effect.sync(() => {
            return yield* Effect.fail(
              InputSystemError({
                message: 'Invalid button',
                button,
              })
            )
          }
          return button === 0
        }),

      getMouseDelta: () =>
        Effect.gen(function* () {
          return {
            deltaX: 10.5,
            deltaY: -5.2,
            timestamp: Date.now(),
          } satisfies MouseDelta
        }),

      registerHandler: (handler: InputHandler) =>
        Effect.gen(function* () {
          yield* pipe(!handler, Match.value, Match.when(true, () => Effect.sync(() => {
            return yield* Effect.fail(
              InputHandlerRegistrationError({
                message: 'Invalid handler',
              })
            )
          }
          // Registration logic would go here
        }),
    }

    const TestLayer = Layer.succeed(InputService, mockInputService)

    it.effect('should check key press state', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const isPressed = yield* inputService.isKeyPressed('w')
        expect(isPressed).toBe(true)

        const isNotPressed = yield* inputService.isKeyPressed('a')
        expect(isNotPressed).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle invalid key press check', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const result = yield* Effect.either(inputService.isKeyPressed('invalid'))

        expect(result._tag).toBe('Left')
        yield* pipe(result, Either.match({ onLeft: (error) => Effect.sync(() => {
          expect(result.left._tag).toBe('InputSystemError')
          expect(result.left.message).toBe('Invalid key')
          expect(result.left.key).toBe('invalid')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should check mouse button press state', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const isPressed = yield* inputService.isMousePressed(0) // left button
        expect(isPressed).toBe(true)

        const isNotPressed = yield* inputService.isMousePressed(1) // middle button
        expect(isNotPressed).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle invalid mouse button check', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const result = yield* Effect.either(inputService.isMousePressed(5))

        expect(result._tag).toBe('Left')
        yield* pipe(result, Either.match({ onLeft: (error) => Effect.sync(() => {
          expect(result.left._tag).toBe('InputSystemError')
          expect(result.left.message).toBe('Invalid button')
          expect(result.left.button).toBe(5)
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should get mouse delta', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const delta = yield* inputService.getMouseDelta()

        expect(delta.deltaX).toBe(10.5)
        expect(delta.deltaY).toBe(-5.2)
        expect(typeof delta.timestamp).toBe('number')
        expect(delta.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should register input handler successfully', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const handler: InputHandler = {
          onKeyDown: (key: string) => {
            console.log(`Key down: ${key}`)
          },
          onKeyUp: (key: string) => {
            console.log(`Key up: ${key}`)
          },
        }

        // Should not throw an error
        yield* inputService.registerHandler(handler)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle invalid handler registration', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const result = yield* Effect.either(inputService.registerHandler(null as any))

        expect(result._tag).toBe('Left')
        yield* pipe(result, Either.match({ onLeft: (error) => Effect.sync(() => {
          expect(result.left._tag).toBe('InputHandlerRegistrationError')
          expect(result.left.message).toBe('Invalid handler')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Type Safety', () => {
    it.effect('should ensure InputHandler interface is correctly typed', () =>
      Effect.gen(function* () {
        const handler: InputHandler = {
          onKeyDown: (key: string) => {
            expect(typeof key).toBe('string')
          },
          onKeyUp: (key: string) => {
            expect(typeof key).toBe('string')
          },
          onMouseDown: (button: number) => {
            expect(typeof button).toBe('number')
          },
          onMouseUp: (button: number) => {
            expect(typeof button).toBe('number')
          },
          onMouseMove: (delta: MouseDelta) => {
            expect(typeof delta.deltaX).toBe('number')
            expect(typeof delta.deltaY).toBe('number')
            expect(typeof delta.timestamp).toBe('number')
          },
        }

        // Test that handler can be called with correct types
        handler.onKeyDown?.('w')
        handler.onKeyUp?.('w')
        handler.onMouseDown?.(0)
        handler.onMouseUp?.(0)
        handler.onMouseMove?.({
          deltaX: 10,
          deltaY: -5,
          timestamp: Date.now(),
        })
      })
    )

    it.effect('should allow partial handler implementation', () =>
      Effect.gen(function* () {
        const partialHandler: InputHandler = {
          onKeyDown: (key: string) => {
            expect(typeof key).toBe('string')
          },
          // Only implementing key down handler
        }

        expect(partialHandler.onKeyDown).toBeDefined()
        expect(partialHandler.onKeyUp).toBeUndefined()
        expect(partialHandler.onMouseDown).toBeUndefined()
      })
    )
  })

  describe('Error Types', () => {
    it.effect('should create InputSystemError with proper structure', () =>
      Effect.gen(function* () {
        const error = InputSystemError({
          message: 'Test error',
          key: 'test-key',
        })

        expect(error._tag).toBe('InputSystemError')
        expect(error.message).toBe('Test error')
        expect(error.key).toBe('test-key')
      })
    )

    it.effect('should create InputHandlerRegistrationError with proper structure', () =>
      Effect.gen(function* () {
        const error = InputHandlerRegistrationError({
          message: 'Registration failed',
          handlerId: 'handler-123',
        })

        expect(error._tag).toBe('InputHandlerRegistrationError')
        expect(error.message).toBe('Registration failed')
        expect(error.handlerId).toBe('handler-123')
      })
    )
  })
})
