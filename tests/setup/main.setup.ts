/**
 * Main Vitest setup file for domain and application layer tests
 * Configures test environment and mocks for Effect-TS testing
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Effect, TestClock, TestContext } from 'effect'

// Mock global objects that might not be available in test environment
beforeAll(() => {
  // Mock performance API
  if (typeof global.performance === 'undefined') {
    global.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    } as any
  }

  // Mock console methods for consistent testing
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }

  // Mock PerformanceObserver
  if (typeof global.PerformanceObserver === 'undefined') {
    global.PerformanceObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => [])
    }))
  }
})

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Reset performance.now to return consistent values
  vi.spyOn(performance, 'now').mockReturnValue(0)
})

afterEach(() => {
  // Clean up any timers or async operations
  vi.clearAllTimers()
})

afterAll(() => {
  // Restore all mocks
  vi.restoreAllMocks()
})

// Helper functions for Effect-TS testing
export const runEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => 
  Effect.runPromise(effect)

export const runEffectSync = <A, E>(effect: Effect.Effect<A, E>): A => 
  Effect.runSync(effect)

export const runEffectExit = <A, E>(effect: Effect.Effect<A, E>) => 
  Effect.runPromiseExit(effect)

// TestClock helpers for time-based testing
export const withTestClock = <A, E>(
  effect: Effect.Effect<A, E, TestClock.TestClock>
): Effect.Effect<A, E> => 
  Effect.provide(effect, TestClock.make())

// Common test utilities
export const expectEffect = {
  toSucceed: async <A>(effect: Effect.Effect<A, any>) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Success')
    return result._tag === 'Success' ? result.value : undefined
  },
  
  toFail: async <E>(effect: Effect.Effect<any, E>) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Failure')
    return result._tag === 'Failure' ? result.cause : undefined
  },
  
  toFailWith: async <E>(effect: Effect.Effect<any, E>, expectedError: E) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.cause).toEqual(expectedError)
    }
  }
}