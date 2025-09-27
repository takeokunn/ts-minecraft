import { it } from '@effect/vitest'
import { Effect, Either, Layer } from 'effect'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import { describe, expect, it as vitestIt } from 'vitest'
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
          return pipe(
            key,
            Match.value,
            Match.when('invalid', () =>
              Effect.fail(
                InputSystemError({
                  message: 'Invalid key',
                  key,
                })
              )
            ),
            Match.orElse(() => Effect.succeed(key === 'w'))
          )
        }).pipe(Effect.flatten),

      isMousePressed: (button: number) =>
        Effect.gen(function* () {
          return pipe(
            button < 0 || button > 2,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                InputSystemError({
                  message: 'Invalid button',
                  button,
                })
              )
            ),
            Match.when(false, () => Effect.succeed(button === 0)),
            Match.exhaustive
          )
        }).pipe(Effect.flatten),

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
          return pipe(
            !handler,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                InputHandlerRegistrationError({
                  message: 'Invalid handler',
                })
              )
            ),
            Match.when(false, () => Effect.void),
            Match.exhaustive
          )
        }).pipe(Effect.flatten),
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

        expect(Either.isLeft(result)).toBe(true)
        yield* pipe(
          result,
          Either.match({
            onLeft: (error) =>
              Effect.sync(() => {
                expect(error._tag).toBe('InputSystemError')
                expect(error.message).toBe('Invalid key')
                expect(error.key).toBe('invalid')
              }),
            onRight: () => Effect.succeed(undefined),
          })
        )
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

        expect(Either.isLeft(result)).toBe(true)
        yield* pipe(
          result,
          Either.match({
            onLeft: (error) =>
              Effect.sync(() => {
                expect(error._tag).toBe('InputSystemError')
                expect(error.message).toBe('Invalid button')
                expect(error.button).toBe(5)
              }),
            onRight: () => Effect.succeed(undefined),
          })
        )
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

        expect(Either.isLeft(result)).toBe(true)
        yield* pipe(
          result,
          Either.match({
            onLeft: (error) =>
              Effect.sync(() => {
                expect(error._tag).toBe('InputHandlerRegistrationError')
                expect(error.message).toBe('Invalid handler')
              }),
            onRight: () => Effect.succeed(undefined),
          })
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle multiple key presses simultaneously', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService
        const keys = ['w', 'a', 's', 'd']

        const results = yield* Effect.all(
          keys.map((key) => inputService.isKeyPressed(key)),
          { concurrency: 'unbounded' }
        )

        expect(results[0]).toBe(true) // 'w' is pressed
        expect(results[1]).toBe(false) // 'a' is not pressed
        expect(results[2]).toBe(false) // 's' is not pressed
        expect(results[3]).toBe(false) // 'd' is not pressed
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle mouse button range validation', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        // Valid buttons (0-2)
        for (let button = 0; button <= 2; button++) {
          const result = yield* inputService.isMousePressed(button)
          expect(typeof result).toBe('boolean')
        }

        // Invalid buttons
        const invalidButtons = [-1, 3, 10, 100]
        for (const button of invalidButtons) {
          const result = yield* Effect.either(inputService.isMousePressed(button))
          expect(Either.isLeft(result)).toBe(true)
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

    it.effect('should handle error propagation through Effect chains', () => {
      // Create local mock service for this test
      const localMockInputService: InputService = {
        isKeyPressed: (key: string) =>
          Effect.gen(function* () {
            return pipe(
              key,
              Match.value,
              Match.when('invalid', () =>
                Effect.fail(
                  InputSystemError({
                    message: 'Invalid key',
                    key,
                  })
                )
              ),
              Match.orElse(() => Effect.succeed(key === 'w'))
            )
          }).pipe(Effect.flatten),

        isMousePressed: (button: number) =>
          Effect.gen(function* () {
            return pipe(
              button < 0 || button > 2,
              Match.value,
              Match.when(true, () =>
                Effect.fail(
                  InputSystemError({
                    message: 'Invalid button',
                    button,
                  })
                )
              ),
              Match.when(false, () => Effect.succeed(button === 0)),
              Match.exhaustive
            )
          }).pipe(Effect.flatten),

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
            return pipe(
              !handler,
              Match.value,
              Match.when(true, () =>
                Effect.fail(
                  InputHandlerRegistrationError({
                    message: 'Invalid handler',
                  })
                )
              ),
              Match.when(false, () => Effect.void),
              Match.exhaustive
            )
          }).pipe(Effect.flatten),
      }

      const localTestLayer = Layer.succeed(InputService, localMockInputService)

      return Effect.gen(function* () {
        const inputService = yield* InputService

        const errorChain = pipe(
          inputService.isKeyPressed('invalid'),
          Effect.flatMap(() => inputService.isMousePressed(0)),
          Effect.flatMap(() => inputService.getMouseDelta())
        )

        const result = yield* Effect.either(errorChain)
        expect(Either.isLeft(result)).toBe(true)
        yield* pipe(
          result,
          Either.match({
            onLeft: (error) =>
              Effect.sync(() => {
                expect(error._tag).toBe('InputSystemError')
              }),
            onRight: () => Effect.succeed(undefined),
          })
        )
      }).pipe(Effect.provide(localTestLayer))
    })
  })

  describe('Performance and Concurrency', () => {
    // Create mock service for performance tests
    const mockInputService: InputService = {
      isKeyPressed: (key: string) =>
        Effect.gen(function* () {
          return pipe(
            key,
            Match.value,
            Match.when('invalid', () =>
              Effect.fail(
                InputSystemError({
                  message: 'Invalid key',
                  key,
                })
              )
            ),
            Match.orElse(() => Effect.succeed(key === 'w'))
          )
        }).pipe(Effect.flatten),

      isMousePressed: (button: number) =>
        Effect.gen(function* () {
          return pipe(
            button < 0 || button > 2,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                InputSystemError({
                  message: 'Invalid button',
                  button,
                })
              )
            ),
            Match.when(false, () => Effect.succeed(button === 0)),
            Match.exhaustive
          )
        }).pipe(Effect.flatten),

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
          return pipe(
            !handler,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                InputHandlerRegistrationError({
                  message: 'Invalid handler',
                })
              )
            ),
            Match.when(false, () => Effect.void),
            Match.exhaustive
          )
        }).pipe(Effect.flatten),
    }

    const TestLayer = Layer.succeed(InputService, mockInputService)

    it.effect('should handle concurrent input checks', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const operations = [
          inputService.isKeyPressed('w'),
          inputService.isMousePressed(0),
          inputService.getMouseDelta(),
          inputService.isKeyPressed('a'),
          inputService.isMousePressed(1),
        ]

        const results = yield* Effect.all(operations, { concurrency: 'unbounded' })

        expect(results[0]).toBe(true) // key 'w'
        expect(results[1]).toBe(true) // mouse button 0
        expect(typeof results[2]).toBe('object') // mouse delta
        expect(results[3]).toBe(false) // key 'a'
        expect(results[4]).toBe(false) // mouse button 1
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should maintain consistent timestamps', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const deltas = yield* Effect.all(
          Array(5)
            .fill(null)
            .map(() => inputService.getMouseDelta()),
          { concurrency: 'unbounded' }
        )

        // All timestamps should be valid numbers
        for (const delta of deltas) {
          expect(typeof delta.timestamp).toBe('number')
          expect(delta.timestamp).toBeGreaterThan(0)
        }

        // Timestamps should be in ascending or equal order (allowing for same millisecond)
        const timestamps = deltas.map((d) => d.timestamp)
        for (let i = 1; i < timestamps.length; i++) {
          const currentTimestamp = timestamps[i]!
          const previousTimestamp = timestamps[i - 1]!
          expect(currentTimestamp).toBeGreaterThanOrEqual(previousTimestamp)
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle rapid sequential operations', () =>
      Effect.gen(function* () {
        const inputService = yield* InputService

        const startTime = Date.now()

        // Perform 100 rapid operations
        for (let i = 0; i < 100; i++) {
          yield* inputService.isKeyPressed('test')
        }

        const endTime = Date.now()
        const duration = endTime - startTime

        // Should complete reasonably quickly (less than 100ms for mock implementation)
        expect(duration).toBeLessThan(100)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
