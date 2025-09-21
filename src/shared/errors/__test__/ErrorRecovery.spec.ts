import { describe, it, expect } from '@effect/vitest'
import { Effect, Exit, Duration, Ref } from 'effect'
import * as fc from 'fast-check'
import { ErrorRecovery } from '../ErrorRecovery'
import { NetworkError } from '../NetworkErrors'

describe('ErrorRecovery', () => {
  describe('exponentialBackoff', () => {
    it('指数バックオフスケジュールを作成する', () => {
      const schedule = ErrorRecovery.exponentialBackoff(3, Duration.millis(100))
      expect(schedule).toBeDefined()
      expect(typeof schedule).toBe('object')
    })

    it.effect('即座に失敗するエフェクトでリトライしない', () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0)
        const effect = Effect.gen(function* () {
          yield* Ref.update(attempts, n => n + 1)
          return 'success' // 常に成功
        })

        const program = effect.pipe(Effect.retry(ErrorRecovery.exponentialBackoff(2, Duration.millis(1))))

        const result = yield* program
        const finalAttempts = yield* Ref.get(attempts)

        expect(result).toBe('success')
        expect(finalAttempts).toBe(1) // リトライなし
      })
    )
  })

  describe('linearRetry', () => {
    it('線形リトライスケジュールを作成する', () => {
      const schedule = ErrorRecovery.linearRetry(3, Duration.millis(100))
      expect(schedule).toBeDefined()
      expect(typeof schedule).toBe('object')
    })

    it.effect('成功するエフェクトでリトライしない', () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0)
        const effect = Effect.gen(function* () {
          yield* Ref.update(attempts, n => n + 1)
          return 'success'
        })

        const program = effect.pipe(Effect.retry(ErrorRecovery.linearRetry(1, Duration.millis(1))))

        const result = yield* program
        const finalAttempts = yield* Ref.get(attempts)

        expect(result).toBe('success')
        expect(finalAttempts).toBe(1)
      })
    )
  })

  describe('immediateRetry', () => {
    it.effect('即座にリトライする', () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0)
        const effect = Effect.gen(function* () {
          const currentAttempt = yield* Ref.updateAndGet(attempts, n => n + 1)
          if (currentAttempt === 1) {
            return yield* Effect.fail(NetworkError({ message: 'Network error' }))
          }
          return 'success'
        })

        const program = effect.pipe(Effect.retry(ErrorRecovery.immediateRetry(1)))

        const result = yield* program
        const finalAttempts = yield* Ref.get(attempts)

        expect(result).toBe('success')
        expect(finalAttempts).toBe(2)
      })
    )
  })

  describe('conditionalRetry', () => {
    it.effect('特定のエラーのみリトライする', () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0)
        type NetworkErrorType = ReturnType<typeof NetworkError>

        const effect: Effect.Effect<string, NetworkErrorType, never> = Effect.gen(function* () {
          const currentAttempt = yield* Ref.updateAndGet(attempts, n => n + 1)
          if (currentAttempt === 1) {
            return yield* Effect.fail(NetworkError({ message: 'Network error' }))
          }
          return 'success'
        })

        const shouldRetry = (error: unknown): boolean => {
          return error !== null && typeof error === 'object' && '_tag' in error && error._tag === 'NetworkError'
        }

        const retrySchedule = ErrorRecovery.conditionalRetry(shouldRetry, ErrorRecovery.immediateRetry(2))
        const program: Effect.Effect<string, NetworkErrorType, never> = effect.pipe(Effect.retry(retrySchedule))

        const result = yield* program
        const finalAttempts = yield* Ref.get(attempts)

        expect(result).toBe('success')
        expect(finalAttempts).toBe(2)
      })
    )
  })

  describe('circuitBreaker', () => {
    it.effect('失敗閾値でサーキットが開く', () =>
      Effect.gen(function* () {
        const breaker = ErrorRecovery.circuitBreaker(2, Duration.seconds(1))
        const attempts = yield* Ref.make(0)

        const makeEffect = () =>
          Effect.gen(function* () {
            yield* Ref.update(attempts, n => n + 1)
            return yield* Effect.fail(NetworkError({ message: 'Network error' }))
          })

        // 失敗を2回実行してサーキットを開く
        for (let i = 0; i < 2; i++) {
          const result = yield* Effect.exit(breaker(makeEffect()))
          expect(Exit.isFailure(result)).toBe(true)
        }

        // サーキットが開いている間は即座に失敗
        yield* Ref.set(attempts, 0) // カウントをリセットしてサーキットが実際のエフェクトを実行しないことを確認
        const result = yield* Effect.exit(breaker(makeEffect()))
        const finalAttempts = yield* Ref.get(attempts)

        expect(Exit.isFailure(result)).toBe(true)
        // サーキットが開いているので、実際のエフェクトは実行されない
        expect(finalAttempts).toBe(0)
      })
    )
  })

  describe('Property-based testing', () => {
    it('exponentialBackoffのパラメータ検証', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 1000 }),
          (maxRetries, delayMs) => {
            const schedule = ErrorRecovery.exponentialBackoff(maxRetries, Duration.millis(delayMs))
            expect(schedule).toBeDefined()
            expect(typeof schedule).toBe('object')
          }
        ),
        { numRuns: 50 }
      )
    })

    it('linearRetryのパラメータ検証', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 1000 }),
          (maxRetries, delayMs) => {
            const schedule = ErrorRecovery.linearRetry(maxRetries, Duration.millis(delayMs))
            expect(schedule).toBeDefined()
            expect(typeof schedule).toBe('object')
          }
        ),
        { numRuns: 50 }
      )
    })

    it('immediateRetryのパラメータ検証', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (maxRetries) => {
            const schedule = ErrorRecovery.immediateRetry(maxRetries)
            expect(schedule).toBeDefined()
            expect(typeof schedule).toBe('object')
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})

// ErrorHandlersとErrorReporterのテストは別ファイルで処理
