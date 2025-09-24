import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Duration, Schema } from 'effect'
import { ErrorHandlers } from '../ErrorHandlers'

describe('ErrorHandlers', () => {
  describe('logAndFallback', () => {
    it.effect('should return fallback value for string error', () =>
      Effect.gen(function* () {
        const fallbackValue = 'fallback'
        const errorInput = 'test error'
        const handler = ErrorHandlers.logAndFallback(fallbackValue)
        const result = handler(errorInput)
        const value = yield* result
        expect(value).toBe(fallbackValue)
      })
    )

    it.effect('should return fallback value for number error', () =>
      Effect.gen(function* () {
        const fallbackValue = 42
        const errorInput = 500
        const handler = ErrorHandlers.logAndFallback(fallbackValue)
        const result = handler(errorInput)
        const value = yield* result
        expect(value).toBe(fallbackValue)
      })
    )
  })

  describe('mapError', () => {
    it.effect('should transform error correctly', () =>
      Effect.gen(function* () {
        const originalError = 'original'
        const expectedError = 'transformed'
        const mapper = () => expectedError
        const handler = ErrorHandlers.mapError(mapper)

        const result = yield* Effect.flip(handler(originalError))
        expect(result).toBe(expectedError)
      })
    )
  })

  describe('withTimeout', () => {
    it.effect('should create timeout handler', () =>
      Effect.gen(function* () {
        const timeoutError = 'timeout'
        const quickEffect = Effect.succeed('success')
        const withTimeoutHandler = ErrorHandlers.withTimeout(Duration.millis(1000), () => timeoutError)

        const result = yield* withTimeoutHandler(quickEffect)
        expect(result).toBe('success')
      })
    )
  })
})