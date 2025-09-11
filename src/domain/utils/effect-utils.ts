import { Effect, pipe, Schedule } from 'effect'
import { DomainError } from '@domain/errors/base-errors'

/**
 * Effect utilities for consistent error handling and patterns
 */

/**
 * Add error logging to an effect
 */
export const withErrorLog = <A, E, R>(effect: Effect.Effect<A, E, R>, context: string) => effect.pipe(Effect.tapError((error) => Effect.logError(`[${context}] Error:`, error)))

/**
 * Convert specific errors to domain errors with context
 */
export const withDomainError = <A, E, R>(effect: Effect.Effect<A, E, R>, context: string) =>
  effect.pipe(Effect.catchAll((error) => Effect.fail(new DomainError({ message: `Error in ${context}: ${error}`, domain: context }))))

/**
 * Add timing information to an effect
 */
export const withTiming = <A, E, R>(effect: Effect.Effect<A, E, R>, label: string) =>
  Effect.gen(function* () {
    const start = Date.now()
    const result = yield* effect
    const duration = Date.now() - start
    yield* Effect.log(`[${label}] completed in ${duration}ms`)
    return result
  })

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = <A, E, R>(effect: Effect.Effect<A, E, R>, maxRetries: number = 3, initialDelay: number = 100) =>
  effect.pipe(
    Effect.retry({
      times: maxRetries,
      schedule: pipe(Schedule.exponential(initialDelay), Schedule.intersect(Schedule.recurs(maxRetries))),
    }),
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
    const now = Date.now()

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
    const start = performance.now()
    const result = yield* effect
    const duration = performance.now() - start

    if (duration > threshold) {
      yield* Effect.logWarning(`[Performance] ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`)
    }

    return result
  })

/**
 * Combine multiple effects with fallback
 */
export const withFallback = <A, E, R, E2, R2>(primary: Effect.Effect<A, E, R>, fallback: Effect.Effect<A, E2, R2>) => primary.pipe(Effect.catchAll(() => fallback))

/**
 * Add timeout with custom error
 */
export const withTimeout = <A, E, R>(effect: Effect.Effect<A, E, R>, duration: number, timeoutError: E) =>
  effect.pipe(
    Effect.timeoutFail({
      duration: `${duration} millis`,
      onTimeout: () => timeoutError,
    }),
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
 * Circuit breaker state
 */
interface CircuitBreakerState {
  readonly failureCount: number
  readonly lastFailureTime: number
  readonly state: 'closed' | 'open' | 'half-open'
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  readonly threshold: number
  readonly timeout: number
}

/**
 * Create initial circuit breaker state
 */
const createCircuitBreakerState = (): CircuitBreakerState => ({
  failureCount: 0,
  lastFailureTime: 0,
  state: 'closed',
})

/**
 * Update circuit breaker state on success
 */
const onCircuitBreakerSuccess = (state: CircuitBreakerState): CircuitBreakerState => ({
  ...state,
  failureCount: 0,
  state: 'closed',
})

/**
 * Update circuit breaker state on failure
 */
const onCircuitBreakerFailure = (state: CircuitBreakerState, config: CircuitBreakerConfig, now: number): CircuitBreakerState => {
  const newFailureCount = state.failureCount + 1
  return {
    failureCount: newFailureCount,
    lastFailureTime: now,
    state: newFailureCount >= config.threshold ? 'open' : state.state,
  }
}

/**
 * Check if circuit breaker should transition from open to half-open
 */
const shouldTransitionToHalfOpen = (state: CircuitBreakerState, config: CircuitBreakerConfig, now: number): boolean =>
  state.state === 'open' && now - state.lastFailureTime > config.timeout

/**
 * Circuit breaker functional implementation using Ref for state management
 */
export const createCircuitBreaker = <A, E, R>(config: CircuitBreakerConfig) => {
  const { Ref } = Effect

  return Effect.gen(function* () {
    const stateRef = yield* Ref.make(createCircuitBreakerState())

    const execute = (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | Error, R> =>
      Effect.gen(function* () {
        const now = Date.now()
        const currentState = yield* Ref.get(stateRef)

        // Check if circuit should transition to half-open
        if (shouldTransitionToHalfOpen(currentState, config, now)) {
          yield* Ref.set(stateRef, { ...currentState, state: 'half-open' })
        }

        const updatedState = yield* Ref.get(stateRef)

        // If circuit is open, fail fast
        if (updatedState.state === 'open') {
          return yield* Effect.fail(new Error('Circuit breaker is open'))
        }

        return yield* effect.pipe(
          Effect.tap(() => Ref.update(stateRef, onCircuitBreakerSuccess)),
          Effect.tapError(() => Ref.update(stateRef, (state) => onCircuitBreakerFailure(state, config, now))),
        )
      })

    return { execute }
  })
}

/**
 * Memoize effect results
 */
export const memoize = <Args extends ReadonlyArray<any>, A, E, R>(f: (...args: Args) => Effect.Effect<A, E, R>): ((...args: Args) => Effect.Effect<A, E, R>) => {
  const cache = new Map<string, A>()

  return (...args: Args) => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return Effect.succeed(cache.get(key)!)
    }

    return f(...args).pipe(
      Effect.tap((result) => {
        cache.set(key, result)
      }),
    )
  }
}
