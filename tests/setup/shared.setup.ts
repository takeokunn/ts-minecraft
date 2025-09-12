/**
 * Vitest setup file for shared module tests
 * Provides Effect-TS testing utilities and environment setup
 */

import { beforeAll } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as TestClock from 'effect/TestClock'
import * as Runtime from 'effect/Runtime'

// Mock global objects that might not be available in test environment
beforeAll(() => {
  // Mock performance API if not available
  if (typeof global.performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    } as any
  }

  // Mock PerformanceObserver if not available
  if (typeof global.PerformanceObserver === 'undefined') {
    global.PerformanceObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return [] }
    } as any
  }
})

// Effect-TS testing utilities
const runtime = Runtime.defaultRuntime

/**
 * Run an effect and return the result as a Promise
 */
export const runEffect = <A, E = never>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(effect)

/**
 * Run an effect synchronously and return the result
 */
export const runEffectSync = <A>(effect: Effect.Effect<A, never, never>): A =>
  Effect.runSync(effect)

/**
 * Run an effect and return the Exit result
 */
export const runEffectExit = <A, E = never>(effect: Effect.Effect<A, E, never>): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(effect)

/**
 * Run an effect with TestClock
 */
export const withTestClock = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, never> =>
  Effect.provide(effect, TestClock.TestClock)

/**
 * Enhanced expect utilities for Effect testing
 */
export const expectEffect = {
  /**
   * Expect an effect to succeed with a specific value
   */
  toSucceedWith: async <A>(effect: Effect.Effect<A, unknown, never>, expected: A): Promise<void> => {
    const result = await runEffect(effect)
    expect(result).toEqual(expected)
  },

  /**
   * Expect an effect to fail
   */
  toFail: async <E>(effect: Effect.Effect<unknown, E, never>): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
  },

  /**
   * Expect an effect to fail with a specific error
   */
  toFailWith: async <E>(effect: Effect.Effect<unknown, E, never>, expectedError: E): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe('Fail')
      if (exit.cause._tag === 'Fail') {
        expect(exit.cause.error).toEqual(expectedError)
      }
    }
  },

  /**
   * Expect an effect to succeed
   */
  toSucceed: async <A>(effect: Effect.Effect<A, unknown, never>): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isSuccess(exit)).toBe(true)
  }
}

// Re-export vitest's expect for convenience
export { expect } from 'vitest'

