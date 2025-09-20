import { Duration, Effect, Exit } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { ErrorHandlers, ErrorRecovery, ErrorReporter } from '../index'
import { NetworkError } from '../NetworkErrors'

describe('ErrorRecovery', () => {
  describe('exponentialBackoff', () => {
    it('should retry with exponential backoff', async () => {
      let attemptCount = 0
      const effect = Effect.gen(function* () {
        attemptCount++
        if (attemptCount < 3) {
          return yield* Effect.fail(NetworkError({ message: 'Network error' }))
        }
        return 'success'
      })

      const program = effect.pipe(Effect.retry(ErrorRecovery.exponentialBackoff(5, Duration.millis(10))))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attemptCount).toBe(3)
    })
  })

  describe('linearRetry', () => {
    it('should retry with linear delay', async () => {
      let attemptCount = 0
      const effect = Effect.gen(function* () {
        attemptCount++
        if (attemptCount < 2) {
          return yield* Effect.fail(NetworkError({ message: 'Network error' }))
        }
        return 'success'
      })

      const program = effect.pipe(Effect.retry(ErrorRecovery.linearRetry(3, Duration.millis(10))))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attemptCount).toBe(2)
    })
  })

  describe('immediateRetry', () => {
    it('should retry immediately', async () => {
      let attemptCount = 0
      const effect = Effect.gen(function* () {
        attemptCount++
        if (attemptCount === 1) {
          return yield* Effect.fail(NetworkError({ message: 'Network error' }))
        }
        return 'success'
      })

      const program = effect.pipe(Effect.retry(ErrorRecovery.immediateRetry(1)))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attemptCount).toBe(2)
    })
  })

  describe('conditionalRetry', () => {
    it('should only retry specific errors', async () => {
      let attemptCount = 0
      type NetworkErrorType = ReturnType<typeof NetworkError>

      const effect: Effect.Effect<string, NetworkErrorType, never> = Effect.gen(function* () {
        attemptCount++
        if (attemptCount === 1) {
          return yield* Effect.fail(NetworkError({ message: 'Network error' }))
        }
        return 'success'
      })

      const shouldRetry = (error: unknown): boolean => {
        return error !== null && typeof error === 'object' && '_tag' in error && error._tag === 'NetworkError'
      }

      const retrySchedule = ErrorRecovery.conditionalRetry(shouldRetry, ErrorRecovery.immediateRetry(2))
      const program: Effect.Effect<string, NetworkErrorType, never> = effect.pipe(Effect.retry(retrySchedule))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attemptCount).toBe(2)
    })
  })

  describe('circuitBreaker', () => {
    it('should open circuit after threshold failures', async () => {
      const breaker = ErrorRecovery.circuitBreaker(2, Duration.seconds(1))
      let attemptCount = 0

      const makeEffect = () =>
        Effect.gen(function* () {
          attemptCount++
          return yield* Effect.fail(NetworkError({ message: 'Network error' }))
        })

      // 失敗を2回実行してサーキットを開く
      for (let i = 0; i < 2; i++) {
        const result = await Effect.runPromiseExit(breaker(makeEffect()))
        expect(Exit.isFailure(result)).toBe(true)
      }

      // サーキットが開いている間は即座に失敗
      attemptCount = 0 // Reset count to verify circuit doesn't execute the effect
      const result = await Effect.runPromiseExit(breaker(makeEffect()))
      expect(Exit.isFailure(result)).toBe(true)
      // サーキットが開いているので、実際のエフェクトは実行されない
      expect(attemptCount).toBe(0)
    })
  })
})

describe('ErrorHandlers', () => {
  describe('logAndFallback', () => {
    it('should log error and return fallback value', async () => {
      const logger = vi.fn()
      const error = NetworkError({ message: 'Test error' })

      const program: Effect.Effect<string, never, never> = Effect.fail(error).pipe(
        Effect.catchAll(ErrorHandlers.logAndFallback('fallback', logger))
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('fallback')
      expect(logger).toHaveBeenCalledWith(error)
    })
  })

  describe('mapError', () => {
    it('should transform errors', async () => {
      const error = NetworkError({ message: 'Original error' })

      const program = Effect.fail(error).pipe(
        Effect.catchAll(ErrorHandlers.mapError((e: NetworkError) => new Error(`Mapped: ${e.message}`)))
      )

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect(result.cause.error).toEqual(new Error('Mapped: Original error'))
      }
    })
  })

  describe('partial', () => {
    it('should allow partial success', async () => {
      const effects: Effect.Effect<number, Error, never>[] = [
        Effect.succeed(1),
        Effect.fail(new Error('Failed')),
        Effect.succeed(3),
      ]

      const program = ErrorHandlers.partial(effects, 2)
      const result = await Effect.runPromise(program)

      expect(result).toEqual([1, 3])
    })

    it('should fail if minimum not met', async () => {
      const effects: Effect.Effect<number, Error, never>[] = [
        Effect.fail(new Error('Failed 1')),
        Effect.fail(new Error('Failed 2')),
        Effect.succeed(3),
      ]

      const program = ErrorHandlers.partial(effects, 2)
      const result = await Effect.runPromiseExit(program)

      expect(Exit.isFailure(result)).toBe(true)
    })
  })

  describe('withTimeout', () => {
    it('should timeout if effect takes too long', async () => {
      const effect: Effect.Effect<string, never, never> = Effect.sleep(Duration.seconds(1)).pipe(
        Effect.map(() => 'success')
      )

      const program: Effect.Effect<string, Error, never> = ErrorHandlers.withTimeout(
        Duration.millis(10),
        () => new Error('Timeout')
      )(effect)

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result) && result.cause._tag === 'Fail') {
        expect(result.cause.error).toEqual(new Error('Timeout'))
      }
    })

    it('should succeed if effect completes in time', async () => {
      const effect: Effect.Effect<string, never, never> = Effect.succeed('success')

      const program: Effect.Effect<string, Error, never> = ErrorHandlers.withTimeout(
        Duration.seconds(1),
        () => new Error('Timeout')
      )(effect)

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
    })
  })
})

describe('ErrorReporter', () => {
  describe('format', () => {
    it('should format tagged errors', () => {
      const error = NetworkError({
        message: 'Test error',
        code: 'NET_001',
      })

      const formatted = ErrorReporter.format(error)
      const parsed = JSON.parse(formatted)

      expect(parsed.type).toBe('NetworkError')
      expect(parsed.message).toBe('Test error')
      expect(parsed.details.code).toBe('NET_001')
    })

    it('should handle plain errors', () => {
      const error = new Error('Plain error')
      const formatted = ErrorReporter.format(error)
      expect(formatted).toContain('Plain error')
    })
  })

  describe('getStackTrace', () => {
    it('should extract stack trace from Error', () => {
      const error = new Error('Test error')
      const stack = ErrorReporter.getStackTrace(error)
      expect(stack).toBeDefined()
      expect(stack).toContain('Test error')
    })

    it('should return undefined for non-errors', () => {
      const stack = ErrorReporter.getStackTrace('string error')
      expect(stack).toBeUndefined()
    })
  })

  describe('getCauseChain', () => {
    it('should extract cause chain', () => {
      const rootCause = new Error('Root cause')
      const middleError = NetworkError({
        message: 'Middle error',
        cause: rootCause,
      })
      const topError = NetworkError({
        message: 'Top error',
        cause: middleError,
      })

      const chain = ErrorReporter.getCauseChain(topError)
      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe(topError)
      expect(chain[1]).toBe(middleError)
      expect(chain[2]).toBe(rootCause)
    })

    it('should handle errors without causes', () => {
      const error = new Error('No cause')
      const chain = ErrorReporter.getCauseChain(error)
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe(error)
    })
  })
})
