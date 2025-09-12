/**
 * Functional utility functions for ts-minecraft
 * Effect-TS compliant implementation providing common FP utilities
 */

import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import * as Array from 'effect/Array'
import * as Function from 'effect/Function'
import * as Duration from 'effect/Duration'
import * as Clock from 'effect/Clock'
import * as Schedule from 'effect/Schedule'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'

// JSON value type for better type safety than unknown
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue }

/**
 * Array utilities using Effect-TS Array module
 */
export const chunk = Array.chunksOf
export const flatten = Array.flatten
export const unique = Array.dedupe
export const groupBy = Array.groupBy

/**
 * Safe array operations
 */
export const safeHead = <T>(arr: ReadonlyArray<T>): Option.Option<T> =>
  arr.length > 0 ? Option.some(arr[0]!) : Option.none()

export const safeLast = <T>(arr: ReadonlyArray<T>): Option.Option<T> =>
  arr.length > 0 ? Option.some(arr[arr.length - 1]!) : Option.none()

export const safeGet = <T>(index: number) => (arr: ReadonlyArray<T>): Option.Option<T> =>
  Array.get(arr, index)

/**
 * Debounce effect execution
 */
export const debounce = <A, E, R>(
  delay: Duration.Duration
) => (
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    // Create new fiber with delay
    const delayedEffect = pipe(
      Effect.sleep(delay),
      Effect.flatMap(() => effect)
    )
    
    return yield* delayedEffect
  })

/**
 * Throttle effect execution
 */
export const throttle = <A, E, R>(
  interval: Duration.Duration
) => (
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const lastExecutionRef = yield* Ref.make<Option.Option<number>>(Option.none())
    
    return yield* Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const lastExecution = yield* Ref.get(lastExecutionRef)
      
      const shouldExecute = pipe(
        lastExecution,
        Option.match({
          onNone: () => true,
          onSome: (lastTime) => now - lastTime >= Duration.toMillis(interval)
        })
      )
      
      if (shouldExecute) {
        yield* Ref.set(lastExecutionRef, Option.some(now))
        return yield* effect
      } else {
        // Return cached result or wait
        yield* Effect.sleep(Duration.millis(Duration.toMillis(interval) - (now - Option.getOrElse(lastExecution, () => 0))))
        return yield* effect
      }
    })
  })

/**
 * Memoize effect results with TTL
 */
export const memoize = <Args extends ReadonlyArray<JsonValue>, A, E, R>(
  f: (...args: Args) => Effect.Effect<A, E, R>,
  ttl?: Duration.Duration
): ((...args: Args) => Effect.Effect<A, E, R>) => {
  const cache = new Map<string, { value: A; expiry?: number }>()

  return (...args: Args) =>
    Effect.gen(function* () {
      const key = JSON.stringify(args)
      const now = yield* Clock.currentTimeMillis
      const cached = cache.get(key)

      if (cached && (!cached.expiry || now < cached.expiry)) {
        return cached.value
      }

      const result = yield* f(...args)
      const expiry = ttl ? now + Duration.toMillis(ttl) : undefined
      cache.set(key, { value: result, expiry })

      return result
    })
}

/**
 * Retry with custom policy
 */
export const retryWithPolicy = <A, E, R>(
  policy: Schedule.Schedule<JsonValue, E, JsonValue>
) => (
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, policy)

/**
 * Compose effects sequentially
 */
export const compose = <A, B, C, E1, E2, R1, R2>(
  f: (a: A) => Effect.Effect<B, E1, R1>,
  g: (b: B) => Effect.Effect<C, E2, R2>
) => (a: A): Effect.Effect<C, E1 | E2, R1 | R2> =>
  pipe(f(a), Effect.flatMap(g))

/**
 * Parallel execution with concurrency control
 */
export const forEachParallel = <A, B, E, R>(
  concurrency: number | 'unbounded'
) => (
  f: (a: A) => Effect.Effect<B, E, R>
) => (
  items: Iterable<A>
): Effect.Effect<Array<B>, E, R> =>
  Effect.forEach(items, f, { concurrency })

/**
 * Safe division avoiding division by zero
 */
export const safeDivide = (a: number, b: number): Option.Option<number> =>
  b === 0 ? Option.none() : Option.some(a / b)

/**
 * Conditional effect execution
 */
export const when = <A, E, R>(
  condition: boolean,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, E, R> =>
  condition ? Effect.map(effect, Option.some) : Effect.succeed(Option.none())

/**
 * Unless (inverse of when)
 */
export const unless = <A, E, R>(
  condition: boolean,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, E, R> =>
  when(!condition, effect)

/**
 * Tap with condition
 */
export const tapWhen = <A, E, R, E2, R2>(
  condition: (a: A) => boolean,
  effect: (a: A) => Effect.Effect<void, E2, R2>
) => (
  source: Effect.Effect<A, E, R>
): Effect.Effect<A, E | E2, R | R2> =>
  pipe(
    source,
    Effect.tap(a => condition(a) ? effect(a) : Effect.void)
  )

/**
 * Measure execution time
 */
export const withTiming = <A, E, R>(
  label: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<{ result: A; duration: Duration.Duration }, E, R> =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const result = yield* effect
    const end = yield* Clock.currentTimeMillis
    const duration = Duration.millis(end - start)
    
    return { result, duration }
  })

/**
 * Measure execution time and log performance (decorator replacement)
 * Replaces @measureTime decorator
 */
export const withMeasurement = <A, E, R>(
  label: string
) => (
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const result = yield* effect
    const end = yield* Clock.currentTimeMillis
    const duration = end - start
    
    // Log performance information
    console.log(`[Performance] ${label}: ${duration}ms`)
    
    // Warn about slow operations (> 16ms = 1 frame at 60fps)
    if (duration > 16) {
      console.warn(`[Performance] Slow operation: ${label} took ${duration}ms`)
    }
    
    return result
  })

/**
 * Resource-safe operations
 */
export const bracket = <A, B, E, R, E2, R2>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Effect.Effect<B, E2, R2>,
  release: (a: A) => Effect.Effect<void, never, R>
): Effect.Effect<B, E | E2, R | R2> =>
  Effect.acquireUseRelease(acquire, use, release)

/**
 * Race multiple effects
 */
export const raceAll = <A, E, R>(
  effects: ReadonlyArray<Effect.Effect<A, E, R>>
): Effect.Effect<A, E, R> =>
  effects.reduce((acc, effect) => Effect.race(acc, effect))

/**
 * Try-catch pattern for effects
 */
export const tryCatch = <A, E>(
  f: () => A,
  onError: (error: Error) => E
): Effect.Effect<A, E, never> =>
  Effect.try({ try: f, catch: onError })

/**
 * Convert Promise to Effect
 */
export const fromPromise = <A>(
  promise: () => Promise<A>
): Effect.Effect<A, Error, never> =>
  Effect.tryPromise(promise)

/**
 * Convert callback-style function to Effect
 */
export const fromCallback = <A, E = Error>(
  f: (callback: (error: E | null, result?: A) => void) => void
): Effect.Effect<A, E, never> =>
  Effect.async<A, E, never>(resume => {
    f((error, result) => {
      if (error) {
        resume(Effect.fail(error))
      } else if (result !== undefined) {
        resume(Effect.succeed(result))
      } else {
        resume(Effect.fail(new Error('No result provided') as E)) // Safe assertion: Error type matches generic E
      }
    })
  })

/**
 * Sequence effects (run all, collect results)
 */
export const sequence = <A, E, R>(
  effects: ReadonlyArray<Effect.Effect<A, E, R>>
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  Effect.all(effects)

/**
 * Traverse with effect (map + sequence)
 */
export const traverse = <A, B, E, R>(
  f: (a: A) => Effect.Effect<B, E, R>
) => (
  items: ReadonlyArray<A>
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  Effect.forEach(items, f)

/**
 * Filter with effect predicate
 */
export const filterEffect = <A, E, R>(
  predicate: (a: A) => Effect.Effect<boolean, E, R>
) => (
  items: ReadonlyArray<A>
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  Effect.gen(function* () {
    const results: Array<A> = []
    
    for (const item of items) {
      const shouldInclude = yield* predicate(item)
      if (shouldInclude) {
        results.push(item)
      }
    }
    
    return results
  })

/**
 * Fold (reduce) with effects
 */
export const foldEffect = <A, B, E, R>(
  initial: B,
  f: (acc: B, a: A) => Effect.Effect<B, E, R>
) => (
  items: ReadonlyArray<A>
): Effect.Effect<B, E, R> =>
  items.reduce(
    (accEffect, item) => Effect.flatMap(accEffect, acc => f(acc, item)),
    Effect.succeed(initial)
  )

/**
 * Utility for creating pipelines
 */
export const pipeline = pipe

/**
 * Common combinators
 */
export const Combinators = {
  // Constant function
  constant: <A>(value: A) => (): A => value,
  
  // Identity function  
  identity: <A>(value: A): A => value,
  
  // Flip function arguments
  flip: <A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => f(a)(b),
  
  // Curry function
  curry: <A, B, C>(f: (a: A, b: B) => C) => (a: A) => (b: B) => f(a, b),
  
  // Uncurry function
  uncurry: <A, B, C>(f: (a: A) => (b: B) => C) => (a: A, b: B) => f(a)(b),
}

/**
 * Export all utilities as a namespace for convenient access
 */
export const Functional = {
  // Array utilities
  chunk, flatten, unique, groupBy,
  safeHead, safeLast, safeGet,
  
  // Control flow
  debounce, throttle, memoize,
  retryWithPolicy, compose, forEachParallel,
  
  // Conditional
  when, unless, tapWhen,
  
  // Measurement & Resource management
  withTiming, withMeasurement, bracket,
  
  // Concurrency
  raceAll, sequence, traverse,
  
  // Error handling
  tryCatch, fromPromise, fromCallback,
  
  // Effects
  filterEffect, foldEffect,
  
  // Math
  safeDivide,
  
  // Utilities
  pipeline,
  ...Combinators,
} as const