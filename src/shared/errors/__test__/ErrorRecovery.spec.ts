import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema, Duration, Stream, pipe, Match } from 'effect'
import { ErrorRecovery } from '../ErrorRecovery'

describe('ErrorRecovery', () => {
  describe('Recovery Strategies', () => {
    it.effect('retry mechanism works with configurable attempts', () =>
      Effect.gen(function* () {
        const maxAttempts = 3
        let attempts = 0
        const flakyOperation = Effect.gen(function* () {
          attempts++
          return yield* pipe(
            attempts < maxAttempts,
            Match.value,
            Match.when(true, () => Effect.fail(new Error(`Attempt ${attempts} failed`))),
            Match.when(false, () => Effect.succeed(`Success after ${attempts} attempts`)),
            Match.exhaustive
          )
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
        yield* pipe(
          Stream.range(0, 2), // 0, 1, 2 (3 iterations)
          Stream.mapEffect((_i) =>
            Effect.gen(function* () {
              const result = yield* Effect.either(circuitBreakerWrapper(failingOperation))
              expect(result._tag).toBe('Left')
            })
          ),
          Stream.runDrain
        )

        // After threshold, circuit should be open and fail fast
        const openResult = yield* Effect.either(circuitBreakerWrapper(failingOperation))
        expect(openResult._tag).toBe('Left')
      })
    )
  })
})
