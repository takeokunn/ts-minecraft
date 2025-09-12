import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import * as Ref from 'effect/Ref'
import * as Duration from 'effect/Duration'
import * as Clock from 'effect/Clock'
import { pipe } from 'effect/Function'

/**
 * Effect utilities for consistent error handling and patterns
 */

/**
 * Add error logging to an effect
 */
export const withErrorLog = <A, E, R>(effect: Effect.Effect<A, E, R>, context: string) => 
  pipe(effect, Effect.tapError((error) => Effect.logError(`[${context}] Error:`, error)))

/**
 * Add timing information to an effect
 */
export const withTiming = <A, E, R>(effect: Effect.Effect<A, E, R>, label: string) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const result = yield* pipe(
      effect,
      Effect.tapError((error) => 
        Effect.gen(function* () {
          const currentTime = yield* Clock.currentTimeMillis
          return yield* Effect.log(`[${label}] Failed after ${currentTime - start}ms: ${error}`)
        })
      )
    )
    const end = yield* Clock.currentTimeMillis
    const duration = end - start
    yield* Effect.log(`[${label}] completed in ${duration}ms`)
    return result
  })

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = <A, E, R>(effect: Effect.Effect<A, E, R>, maxRetries: number = 3, initialDelay: number = 100) =>
  pipe(
    effect,
    Effect.retry(
      pipe(
        Schedule.exponential(Duration.millis(initialDelay)),
        Schedule.intersect(Schedule.recurs(maxRetries))
      )
    )
  )

/**
 * Run effects in parallel with concurrency limit
 */
export const forEachWithConcurrency = <A, B, E, R>(items: ReadonlyArray<A>, concurrency: number, f: (a: A) => Effect.Effect<B, E, R>): Effect.Effect<ReadonlyArray<B>, E, R> =>
  Effect.forEach(items, f, { concurrency })

/**
 * Cache effect results
 */
export const cached = <A, E, R>(effect: Effect.Effect<A, E, R>, ttl: number): Effect.Effect<A, E, R> => {
  let cache: { value: A; expiry: number } | undefined

  return Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis

    if (cache && cache.expiry > now) {
      return cache.value
    }

    const value = yield* effect
    cache = { value, expiry: now + ttl }
    return value
  })
}

/**
 * Ensure cleanup happens regardless of success or failure
 */
export const withCleanup = <A, E, R>(effect: Effect.Effect<A, E, R>, cleanup: Effect.Effect<void, never, R>) =>
  Effect.acquireUseRelease(
    Effect.succeed(undefined),
    () => effect,
    () => cleanup,
  )

/**
 * Add performance monitoring
 */
export const withPerformanceMonitoring = <A, E, R>(effect: Effect.Effect<A, E, R>, name: string, threshold: number = 100) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const result = yield* effect
    const end = yield* Clock.currentTimeMillis
    const duration = end - start

    if (duration > threshold) {
      yield* Effect.logWarning(`[Performance] ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`)
    }

    return result
  })

/**
 * Combine multiple effects with fallback
 */
export const withFallback = <A, E, R, E2, R2>(primary: Effect.Effect<A, E, R>, fallback: Effect.Effect<A, E2, R2>) => pipe(primary, Effect.catchAll(() => fallback))

/**
 * Add timeout with custom error
 */
export const withTimeout = <A, E, R>(effect: Effect.Effect<A, E, R>, duration: number, timeoutError: E) =>
  pipe(
    effect,
    Effect.timeout(Duration.millis(duration)),
    Effect.mapError(() => timeoutError)
  )

/**
 * Batch operations for efficiency
 */
export const batchOperations =
  <A, B, E, R>(operations: ReadonlyArray<(batch: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<B>, E, R>>, batchSize: number = 100) =>
  (items: ReadonlyArray<A>): Effect.Effect<ReadonlyArray<B>, E, R> =>
    Effect.gen(function* () {
      const results: B[] = []

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        for (const operation of operations) {
          const batchResults = yield* operation(batch)
          results.push(...batchResults)
        }
      }

      return results
    })

/**
 * Circuit breaker pattern - functional implementation
 */
export interface CircuitBreakerState {
  readonly failureCount: number
  readonly lastFailureTime: number
  readonly state: 'closed' | 'open' | 'half-open'
}

export interface CircuitBreakerConfig {
  readonly threshold: number
  readonly timeout: number
}

export const createCircuitBreaker = (config: CircuitBreakerConfig) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<CircuitBreakerState>({
      failureCount: 0,
      lastFailureTime: 0,
      state: 'closed',
    })

    const execute = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | Error, R> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const currentState = yield* Ref.get(stateRef)

        // Check if circuit should be reset to half-open
        if (currentState.state === 'open' && now - currentState.lastFailureTime > config.timeout) {
          yield* Ref.update(stateRef, (state) => ({ ...state, state: 'half-open' as const }))
        }

        const updatedState = yield* Ref.get(stateRef)

        // If circuit is open, fail fast
        if (updatedState.state === 'open') {
          return yield* Effect.fail(new Error('Circuit breaker is open'))
        }

        return yield* pipe(
          effect,
          Effect.tap(() =>
            // Success - reset failure count
            Ref.update(stateRef, (state) => ({
              failureCount: 0,
              lastFailureTime: state.lastFailureTime,
              state: 'closed' as const,
            })),
          ),
          Effect.tapError(() =>
            Effect.gen(function* () {
              const currentTime = yield* Clock.currentTimeMillis
              // Failure - increment count and potentially open circuit
              yield* Ref.update(stateRef, (state) => {
                const newFailureCount = state.failureCount + 1
                return {
                  failureCount: newFailureCount,
                  lastFailureTime: currentTime,
                  state: newFailureCount >= config.threshold ? 'open' : state.state,
                }
              })
            }),
          )
        )
      })

    const getState = () => Ref.get(stateRef)

    return { execute, getState } as const
  })

/**
 * Memoize effect results
 */
export const memoize = <Args extends ReadonlyArray<string | number | boolean>, A, E, R>(f: (...args: Args) => Effect.Effect<A, E, R>): ((...args: Args) => Effect.Effect<A, E, R>) => {
  const cache = new Map<string, A>()

  return (...args: Args) => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return Effect.succeed(cache.get(key)!)
    }

    return pipe(
      f(...args),
      Effect.tap((result) => {
        cache.set(key, result)
      })
    )
  }
}
