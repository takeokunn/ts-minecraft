/**
 * Unit tests for performance utilities
 * Tests Effect-TS-based performance monitoring (replaces decorators)
 */

import { describe, it, expect, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Duration from 'effect/Duration'
import * as TestClock from 'effect/TestClock'
import { 
  PerformanceUtils,
  withMeasurement,
  debounce,
  throttle,
  memoize,
  withLogging,
  withTimeout,
  withRetry 
} from '@shared/utils/performance'

describe('Performance Utilities', () => {
  describe('withMeasurement', () => {
    it('should measure execution time', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const slowOperation = Effect.delay(Effect.succeed('result'), Duration.millis(100))
      const measuredOperation = withMeasurement('test-operation')(slowOperation)

      const result = await Effect.runPromise(measuredOperation)
      
      expect(result).toBe('result')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-operation:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ms'))
      
      consoleSpy.mockRestore()
    })

    it('should measure both successful and failed operations', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const failingOperation = Effect.delay(
        Effect.fail(new Error('test error')), 
        Duration.millis(50)
      )
      const measuredOperation = withMeasurement('failing-operation')(failingOperation)

      const result = await Effect.runPromiseExit(measuredOperation)
      
      expect(Effect.isFailure(result)).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('failing-operation:'))
      
      consoleSpy.mockRestore()
    })
  })

  describe('debounce', () => {
    it('should debounce rapid calls', async () => {
      let callCount = 0
      const operation = Effect.sync(() => {
        callCount++
        return 'result'
      })

      const debouncedOperation = debounce(Duration.millis(100))(operation)

      // Make multiple rapid calls
      const promises = [
        Effect.runPromise(debouncedOperation),
        Effect.runPromise(debouncedOperation),
        Effect.runPromise(debouncedOperation)
      ]

      await Promise.allSettled(promises)
      
      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Only the last call should have executed
      expect(callCount).toBe(1)
    })
  })

  describe('throttle', () => {
    it('should throttle rapid calls', async () => {
      let callCount = 0
      const operation = Effect.sync(() => {
        callCount++
        return 'result'
      })

      const throttledOperation = throttle(Duration.millis(100))(operation)

      // First call should succeed
      const result1 = await Effect.runPromise(throttledOperation)
      expect(result1).toBe('result')
      expect(callCount).toBe(1)

      // Immediate second call should be throttled
      const result2 = await Effect.runPromiseExit(throttledOperation)
      expect(Effect.isFailure(result2)).toBe(true)
      expect(callCount).toBe(1) // Still 1, not incremented
    })
  })

  describe('memoize', () => {
    it('should cache function results', async () => {
      let callCount = 0
      const expensiveFunction = (x: number, y: number) => Effect.sync(() => {
        callCount++
        return x + y
      })

      const memoizedFunction = memoize(expensiveFunction)

      // First call
      const result1 = await Effect.runPromise(memoizedFunction(2, 3))
      expect(result1).toBe(5)
      expect(callCount).toBe(1)

      // Second call with same arguments should use cache
      const result2 = await Effect.runPromise(memoizedFunction(2, 3))
      expect(result2).toBe(5)
      expect(callCount).toBe(1) // Still 1, cached result used

      // Different arguments should trigger new computation
      const result3 = await Effect.runPromise(memoizedFunction(4, 5))
      expect(result3).toBe(9)
      expect(callCount).toBe(2)
    })

    it('should handle complex argument serialization', async () => {
      let callCount = 0
      const functionWithComplexArgs = (obj: { a: number; b: string }) => Effect.sync(() => {
        callCount++
        return `${obj.a}-${obj.b}`
      })

      const memoizedFunction = memoize(functionWithComplexArgs)

      const args1 = { a: 1, b: 'test' }
      const args2 = { a: 1, b: 'test' } // Same content, different object
      const args3 = { a: 2, b: 'test' } // Different content

      const result1 = await Effect.runPromise(memoizedFunction(args1))
      const result2 = await Effect.runPromise(memoizedFunction(args2))
      const result3 = await Effect.runPromise(memoizedFunction(args3))

      expect(result1).toBe('1-test')
      expect(result2).toBe('1-test')
      expect(result3).toBe('2-test')
      expect(callCount).toBe(2) // args1 and args2 should use same cache
    })
  })

  describe('withLogging', () => {
    it('should log operation start and success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const operation = Effect.succeed('test result')
      const loggedOperation = withLogging('test-operation')(operation)

      const result = await Effect.runPromise(loggedOperation)
      
      expect(result).toBe('test result')
      expect(consoleSpy).toHaveBeenCalledWith('Starting: test-operation')
      expect(consoleSpy).toHaveBeenCalledWith('Completed: test-operation', 'test result')
      
      consoleSpy.mockRestore()
    })

    it('should log operation start and failure', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const error = new Error('test error')
      const operation = Effect.fail(error)
      const loggedOperation = withLogging('failing-operation')(operation)

      const result = await Effect.runPromiseExit(loggedOperation)
      
      expect(Effect.isFailure(result)).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('Starting: failing-operation')
      expect(consoleSpy).toHaveBeenCalledWith('Failed: failing-operation', error)
      
      consoleSpy.mockRestore()
    })
  })

  describe('withTimeout', () => {
    it('should complete within timeout', async () => {
      const operation = Effect.delay(Effect.succeed('result'), Duration.millis(50))
      const timedOperation = withTimeout(Duration.millis(100))(operation)

      const result = await Effect.runPromise(timedOperation)
      expect(result).toBe('result')
    })

    it('should timeout long-running operations', async () => {
      const operation = Effect.delay(Effect.succeed('result'), Duration.millis(200))
      const timedOperation = withTimeout(Duration.millis(100))(operation)

      const result = await Effect.runPromiseExit(timedOperation)
      expect(Effect.isFailure(result)).toBe(true)
      
      if (Effect.isFailure(result)) {
        expect(result.cause.error.message).toContain('Operation timed out after 100ms')
      }
    })
  })

  describe('PerformanceUtils combinators', () => {
    describe('measureAndLog', () => {
      it('should combine measurement and logging', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        
        const operation = Effect.succeed('combined result')
        const enhanced = PerformanceUtils.measureAndLog('combined-operation')(operation)

        const result = await Effect.runPromise(enhanced)
        
        expect(result).toBe('combined result')
        expect(consoleSpy).toHaveBeenCalledWith('Starting: combined-operation')
        expect(consoleSpy).toHaveBeenCalledWith('Completed: combined-operation', 'combined result')
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('combined-operation:'))
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ms'))
        
        consoleSpy.mockRestore()
      })
    })

    describe('resilient', () => {
      it('should apply multiple resilience patterns', async () => {
        let attemptCount = 0
        const flakyOperation = Effect.sync(() => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`)
          }
          return 'success after retries'
        })

        const resilientOperation = PerformanceUtils.resilient({
          timeout: Duration.seconds(1),
          retries: Effect.Schedule.recurs(3),
          circuitBreaker: { threshold: 5, timeout: Duration.seconds(10) }
        })(flakyOperation)

        const result = await Effect.runPromise(resilientOperation)
        expect(result).toBe('success after retries')
        expect(attemptCount).toBe(3)
      })

      it('should handle complete failures gracefully', async () => {
        const alwaysFailingOperation = Effect.fail(new Error('Always fails'))

        const resilientOperation = PerformanceUtils.resilient({
          timeout: Duration.millis(100),
          retries: Effect.Schedule.recurs(2)
        })(alwaysFailingOperation)

        const result = await Effect.runPromiseExit(resilientOperation)
        expect(Effect.isFailure(result)).toBe(true)
      })
    })
  })

  describe('Integration tests', () => {
    it('should work well when combined', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let callCount = 0
      
      const expensiveOperation = (x: number) => Effect.sync(() => {
        callCount++
        return x * 2
      })

      const enhanced = Effect.succeed(5).pipe(
        Effect.flatMap(memoize(expensiveOperation)),
        withMeasurement('combined-test'),
        withLogging('combined-test'),
        withTimeout(Duration.seconds(1))
      )

      const result1 = await Effect.runPromise(enhanced)
      const result2 = await Effect.runPromise(enhanced) // Should use memoized result

      expect(result1).toBe(10)
      expect(result2).toBe(10)
      expect(callCount).toBe(1) // Memoization working
      expect(consoleSpy).toHaveBeenCalled() // Logging working
      
      consoleSpy.mockRestore()
    })
  })
})