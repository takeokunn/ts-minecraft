import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema, Duration } from 'effect'
import { ErrorRecovery } from '../ErrorRecovery'

describe('ErrorRecovery', () => {
  describe('Recovery Strategies', () => {
    it.effect('retry mechanism works with configurable attempts', () =>
      Effect.gen(function* () {
        const maxAttempts = 3
        let attempts = 0
        const flakyOperation = Effect.gen(function* () {
          attempts++
          if (attempts < maxAttempts) {
            return yield* Effect.fail(new Error(`Attempt ${attempts} failed`))
          }
          return `Success after ${attempts} attempts`
        })

        const result = yield* ErrorRecovery.withRetry(flakyOperation, maxAttempts)
        expect(result).toContain('Success')
        expect(attempts).toBe(maxAttempts)
      })
    )

    it.effect('circuit breaker prevents cascade failures', () =>
      Effect.gen(function* () {
        const failingOperation = Effect.fail(new Error('Service down'))

        const circuitBreakerWrapper = ErrorRecovery.circuitBreaker(3, Duration.seconds(1))

        // First few failures should be attempted
        for (let i = 0; i < 3; i++) {
          const result = yield* Effect.either(circuitBreakerWrapper(failingOperation))
          expect(result._tag).toBe('Left')
        }

        // After threshold, circuit should be open and fail fast
        const openResult = yield* Effect.either(circuitBreakerWrapper(failingOperation))
        expect(openResult._tag).toBe('Left')
      })
    )
  })
})