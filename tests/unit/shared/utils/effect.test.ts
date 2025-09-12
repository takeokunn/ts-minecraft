import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Ref from 'effect/Ref'
import * as EffectUtils from '@shared/utils/effect'

describe('effect utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('withErrorLog', () => {
    it('should log errors and pass them through', async () => {
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('test error')
      const failingEffect = Effect.fail(error)
      
      const effectWithLog = EffectUtils.withErrorLog(failingEffect, 'TestContext')
      const exit = await Effect.runPromiseExit(effectWithLog)
      
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail')
      }
      
      logSpy.mockRestore()
    })

    it('should not interfere with successful effects', async () => {
      const successEffect = Effect.succeed(42)
      const effectWithLog = EffectUtils.withErrorLog(successEffect, 'TestContext')
      
      const result = await Effect.runPromise(effectWithLog)
      expect(result).toBe(42)
    })
  })

  describe('withTiming', () => {
    it('should measure execution time', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const effect = Effect.succeed(42)
      
      const timedEffect = EffectUtils.withTiming(effect, 'TestOperation')
      const result = await Effect.runPromise(timedEffect)
      
      expect(result).toBe(42)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[TestOperation] completed in'))
      
      logSpy.mockRestore()
    })

    it('should work with failing effects', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const error = new Error('test error')
      const failingEffect = Effect.fail(error)
      
      const timedEffect = EffectUtils.withTiming(failingEffect, 'FailingOperation')
      const exit = await Effect.runPromiseExit(timedEffect)
      
      expect(Exit.isFailure(exit)).toBe(true)
      // Timing should still be logged even on failure
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[FailingOperation] completed in'))
      
      logSpy.mockRestore()
    })
  })

  describe('retryWithBackoff', () => {
    it('should retry failed effects with exponential backoff', async () => {
      let attempts = 0
      const flakyEffect = Effect.gen(function* () {
        attempts++
        if (attempts < 3) {
          yield* Effect.fail(new Error('not yet'))
        }
        return 'success'
      })
      
      const retriedEffect = EffectUtils.retryWithBackoff(flakyEffect, 3, 10)
      const result = await Effect.runPromise(retriedEffect)
      
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should give up after max retries', async () => {
      let attempts = 0
      const alwaysFailingEffect = Effect.gen(function* () {
        attempts++
        yield* Effect.fail(new Error('always fails'))
      })
      
      const retriedEffect = EffectUtils.retryWithBackoff(alwaysFailingEffect, 2, 10)
      const exit = await Effect.runPromiseExit(retriedEffect)
      
      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(3) // Initial attempt + 2 retries
    })
  })

  describe('forEachWithConcurrency', () => {
    it('should process items with limited concurrency', async () => {
      const items = [1, 2, 3, 4, 5]
      const processItem = (n: number) => Effect.succeed(n * 2)
      
      const result = await Effect.runPromise(
        EffectUtils.forEachWithConcurrency(items, 2, processItem)
      )
      
      expect(result).toEqual([2, 4, 6, 8, 10])
    })

    it('should handle empty arrays', async () => {
      const items: number[] = []
      const processItem = (n: number) => Effect.succeed(n * 2)
      
      const result = await Effect.runPromise(
        EffectUtils.forEachWithConcurrency(items, 2, processItem)
      )
      
      expect(result).toEqual([])
    })
  })

  describe('cached', () => {
    it('should cache effect results for the specified TTL', async () => {
      let executions = 0
      const effect = Effect.gen(function* () {
        executions++
        return `result-${executions}`
      })
      
      const cachedEffect = EffectUtils.cached(effect, 1000) // 1 second TTL
      
      // First execution
      const result1 = await Effect.runPromise(cachedEffect)
      expect(result1).toBe('result-1')
      expect(executions).toBe(1)
      
      // Second execution should use cache
      const result2 = await Effect.runPromise(cachedEffect)
      expect(result2).toBe('result-1') // Same result
      expect(executions).toBe(1) // No additional execution
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1001)
      
      // Third execution should re-execute
      const result3 = await Effect.runPromise(cachedEffect)
      expect(result3).toBe('result-2')
      expect(executions).toBe(2)
    })

    it('should not cache failed effects', async () => {
      let attempts = 0
      const flakyEffect = Effect.gen(function* () {
        attempts++
        if (attempts === 1) {
          yield* Effect.fail(new Error('first attempt fails'))
        }
        return 'success'
      })
      
      const cachedEffect = EffectUtils.cached(flakyEffect, 1000)
      
      // First execution fails
      const exit1 = await Effect.runPromiseExit(cachedEffect)
      expect(Exit.isFailure(exit1)).toBe(true)
      expect(attempts).toBe(1)
      
      // Second execution should retry (not cached)
      const result2 = await Effect.runPromise(cachedEffect)
      expect(result2).toBe('success')
      expect(attempts).toBe(2)
    })
  })

  describe('withCleanup', () => {
    it('should run cleanup effect after success', async () => {
      let cleanupExecuted = false
      const cleanup = Effect.sync(() => { cleanupExecuted = true })
      const mainEffect = Effect.succeed(42)
      
      const result = await Effect.runPromise(
        EffectUtils.withCleanup(mainEffect, cleanup)
      )
      
      expect(result).toBe(42)
      expect(cleanupExecuted).toBe(true)
    })

    it('should run cleanup effect after failure', async () => {
      let cleanupExecuted = false
      const cleanup = Effect.sync(() => { cleanupExecuted = true })
      const mainEffect = Effect.fail(new Error('test error'))
      
      const exit = await Effect.runPromiseExit(
        EffectUtils.withCleanup(mainEffect, cleanup)
      )
      
      expect(Exit.isFailure(exit)).toBe(true)
      expect(cleanupExecuted).toBe(true)
    })
  })

  describe('withPerformanceMonitoring', () => {
    it('should monitor performance and log slow operations', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Simulate slow operation
      const slowEffect = Effect.gen(function* () {
        // Mock performance.now to simulate time passage
        const originalNow = performance.now
        let callCount = 0
        vi.spyOn(performance, 'now').mockImplementation(() => {
          callCount++
          return callCount === 1 ? 0 : 200 // 200ms duration
        })
        
        const result = yield* Effect.succeed(42)
        
        // Restore original implementation
        performance.now = originalNow
        return result
      })
      
      const monitoredEffect = EffectUtils.withPerformanceMonitoring(slowEffect, 'SlowOperation', 100)
      const result = await Effect.runPromise(monitoredEffect)
      
      expect(result).toBe(42)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Performance] SlowOperation took'))
      
      warnSpy.mockRestore()
    })

    it('should not log warnings for fast operations', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const fastEffect = Effect.succeed(42)
      const monitoredEffect = EffectUtils.withPerformanceMonitoring(fastEffect, 'FastOperation', 100)
      
      const result = await Effect.runPromise(monitoredEffect)
      
      expect(result).toBe(42)
      expect(warnSpy).not.toHaveBeenCalled()
      
      warnSpy.mockRestore()
    })
  })

  describe('withFallback', () => {
    it('should use primary effect when successful', async () => {
      const primary = Effect.succeed('primary')
      const fallback = Effect.succeed('fallback')
      
      const result = await Effect.runPromise(
        EffectUtils.withFallback(primary, fallback)
      )
      
      expect(result).toBe('primary')
    })

    it('should use fallback when primary fails', async () => {
      const primary = Effect.fail(new Error('primary failed'))
      const fallback = Effect.succeed('fallback')
      
      const result = await Effect.runPromise(
        EffectUtils.withFallback(primary, fallback)
      )
      
      expect(result).toBe('fallback')
    })

    it('should propagate fallback errors', async () => {
      const primary = Effect.fail(new Error('primary failed'))
      const fallback = Effect.fail(new Error('fallback failed'))
      
      const exit = await Effect.runPromiseExit(
        EffectUtils.withFallback(primary, fallback)
      )
      
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('withTimeout', () => {
    it('should complete normally when within timeout', async () => {
      const effect = Effect.succeed(42)
      const timeoutError = new Error('timeout')
      
      const result = await Effect.runPromise(
        EffectUtils.withTimeout(effect, 1000, timeoutError)
      )
      
      expect(result).toBe(42)
    })

    it('should fail with timeout error when exceeding timeout', async () => {
      const slowEffect = Effect.gen(function* () {
        yield* Effect.sleep('2000 millis')
        return 42
      })
      const timeoutError = new Error('operation timed out')
      
      const exit = await Effect.runPromiseExit(
        EffectUtils.withTimeout(slowEffect, 1000, timeoutError)
      )
      
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('batchOperations', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7]
      const operations = [
        (batch: readonly number[]) => Effect.succeed(batch.map(n => n * 2))
      ]
      
      const batchProcessor = EffectUtils.batchOperations(operations, 3)
      const result = await Effect.runPromise(batchProcessor(items))
      
      // Should process in batches of 3: [1,2,3], [4,5,6], [7]
      expect(result).toEqual([2, 4, 6, 8, 10, 12, 14])
    })

    it('should handle empty arrays', async () => {
      const items: number[] = []
      const operations = [
        (batch: readonly number[]) => Effect.succeed(batch.map(n => n * 2))
      ]
      
      const batchProcessor = EffectUtils.batchOperations(operations, 3)
      const result = await Effect.runPromise(batchProcessor(items))
      
      expect(result).toEqual([])
    })
  })

  describe('CircuitBreaker', () => {
    it('should allow operations when closed', async () => {
      const circuitBreaker = await Effect.runPromise(
        EffectUtils.createCircuitBreaker({ threshold: 3, timeout: 1000 })
      )
      
      const result = await Effect.runPromise(
        circuitBreaker.execute(Effect.succeed(42))
      )
      
      expect(result).toBe(42)
      
      const state = await Effect.runPromise(circuitBreaker.getState())
      expect(state.state).toBe('closed')
      expect(state.failureCount).toBe(0)
    })

    it('should open after reaching failure threshold', async () => {
      const circuitBreaker = await Effect.runPromise(
        EffectUtils.createCircuitBreaker({ threshold: 2, timeout: 1000 })
      )
      
      const failingEffect = Effect.fail(new Error('operation failed'))
      
      // First failure
      await Effect.runPromiseExit(circuitBreaker.execute(failingEffect))
      
      // Second failure should open the circuit
      await Effect.runPromiseExit(circuitBreaker.execute(failingEffect))
      
      const state = await Effect.runPromise(circuitBreaker.getState())
      expect(state.state).toBe('open')
      expect(state.failureCount).toBe(2)
    })

    it('should fail fast when open', async () => {
      const circuitBreaker = await Effect.runPromise(
        EffectUtils.createCircuitBreaker({ threshold: 1, timeout: 1000 })
      )
      
      const failingEffect = Effect.fail(new Error('operation failed'))
      
      // Trigger circuit to open
      await Effect.runPromiseExit(circuitBreaker.execute(failingEffect))
      
      // Next call should fail fast
      const exit = await Effect.runPromiseExit(
        circuitBreaker.execute(Effect.succeed(42))
      )
      
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail')
      }
    })

    it('should transition to half-open after timeout', async () => {
      const circuitBreaker = await Effect.runPromise(
        EffectUtils.createCircuitBreaker({ threshold: 1, timeout: 100 })
      )
      
      const failingEffect = Effect.fail(new Error('operation failed'))
      
      // Open the circuit
      await Effect.runPromiseExit(circuitBreaker.execute(failingEffect))
      
      // Advance time past timeout
      vi.advanceTimersByTime(150)
      
      // Should be half-open now
      await Effect.runPromise(circuitBreaker.execute(Effect.succeed(42)))
      
      const state = await Effect.runPromise(circuitBreaker.getState())
      expect(state.state).toBe('closed') // Success should close it
      expect(state.failureCount).toBe(0)
    })
  })

  describe('memoize', () => {
    it('should cache function results', async () => {
      let executions = 0
      const expensiveFn = (x: number, y: number) => Effect.sync(() => {
        executions++
        return x + y
      })
      
      const memoizedFn = EffectUtils.memoize(expensiveFn)
      
      // First call
      const result1 = await Effect.runPromise(memoizedFn(1, 2))
      expect(result1).toBe(3)
      expect(executions).toBe(1)
      
      // Second call with same args should use cache
      const result2 = await Effect.runPromise(memoizedFn(1, 2))
      expect(result2).toBe(3)
      expect(executions).toBe(1) // No additional execution
      
      // Third call with different args should execute
      const result3 = await Effect.runPromise(memoizedFn(2, 3))
      expect(result3).toBe(5)
      expect(executions).toBe(2)
    })

    it('should handle different argument combinations', async () => {
      let executions = 0
      const fn = (a: string, b: number, c: boolean) => Effect.sync(() => {
        executions++
        return `${a}-${b}-${c}`
      })
      
      const memoizedFn = EffectUtils.memoize(fn)
      
      const result1 = await Effect.runPromise(memoizedFn('test', 1, true))
      const result2 = await Effect.runPromise(memoizedFn('test', 1, true))
      const result3 = await Effect.runPromise(memoizedFn('test', 1, false))
      
      expect(result1).toBe('test-1-true')
      expect(result2).toBe('test-1-true')
      expect(result3).toBe('test-1-false')
      expect(executions).toBe(2) // Only two unique combinations
    })

    it('should not cache failed effects', async () => {
      let attempts = 0
      const flakyFn = (x: number) => Effect.gen(function* () {
        attempts++
        if (attempts === 1) {
          yield* Effect.fail(new Error('first attempt'))
        }
        return x * 2
      })
      
      const memoizedFn = EffectUtils.memoize(flakyFn)
      
      // First call fails
      const exit1 = await Effect.runPromiseExit(memoizedFn(5))
      expect(Exit.isFailure(exit1)).toBe(true)
      expect(attempts).toBe(1)
      
      // Second call should retry (not cached)
      const result2 = await Effect.runPromise(memoizedFn(5))
      expect(result2).toBe(10)
      expect(attempts).toBe(2)
      
      // Third call should use cache
      const result3 = await Effect.runPromise(memoizedFn(5))
      expect(result3).toBe(10)
      expect(attempts).toBe(2) // No additional attempt
    })
  })
})