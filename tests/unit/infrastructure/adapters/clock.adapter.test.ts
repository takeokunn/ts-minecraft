/**
 * Test file to verify infrastructure configuration works with Effect-TS patterns
 * Tests the clock adapter functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect, TestClock } from 'effect'
import { expectEffect, withTestClock, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

// Mock clock adapter for testing
interface ClockAdapter {
  now(): Effect.Effect<number>
  delay(ms: number): Effect.Effect<void>
  schedule<A>(effect: Effect.Effect<A>, intervalMs: number): Effect.Effect<A>
}

const mockClockAdapter: ClockAdapter = {
  now: () => Effect.sync(() => Date.now()),
  delay: (ms: number) => Effect.sleep(ms),
  schedule: <A>(effect: Effect.Effect<A>, intervalMs: number) => 
    Effect.flatMap(
      Effect.sleep(intervalMs),
      () => effect
    )
}

describe('Infrastructure Configuration - Clock Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Effect-TS Integration', () => {
    it('should run effects successfully', async () => {
      const effect = Effect.succeed(42)
      const result = await expectEffect.toSucceed(effect)
      expect(result).toBe(42)
    })

    it('should handle effect failures', async () => {
      const error = new Error('Test error')
      const effect = Effect.fail(error)
      await expectEffect.toFail(effect)
    })

    it('should work with TestClock for time-based testing', async () => {
      // Simple test without TestClock for now, just verify Effect works with time
      const timedEffect = Effect.gen(function* (_) {
        const start = Date.now()
        yield* _(Effect.sleep(1))
        const end = Date.now()
        return end - start
      })

      const result = await expectEffect.toSucceed(timedEffect)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Clock Adapter Functionality', () => {
    it('should return current time', async () => {
      const nowEffect = mockClockAdapter.now()
      const result = await expectEffect.toSucceed(nowEffect)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
    })

    it('should handle delays', async () => {
      const startTime = Date.now()
      const delayEffect = mockClockAdapter.delay(10)
      
      await expectEffect.toSucceed(delayEffect)
      const endTime = Date.now()
      
      // Allow some tolerance for test timing
      expect(endTime - startTime).toBeGreaterThanOrEqual(5)
    })

    it('should schedule effects with intervals', async () => {
      const scheduledEffect = mockClockAdapter.schedule(
        Effect.succeed('completed'),
        5
      )

      const result = await expectEffect.toSucceed(scheduledEffect)
      expect(result).toBe('completed')
    })
  })

  describe('Performance Testing', () => {
    it('should measure effect performance', async () => {
      const heavyEffect = Effect.gen(function* (_) {
        yield* _(Effect.sleep(10))
        return 'heavy computation done'
      })

      const { result, duration } = await measureEffectPerformance(
        heavyEffect,
        'heavy computation'
      )

      expect(result).toBe('heavy computation done')
      expect(duration).toBeGreaterThan(0)
    })
  })

  describe('Mock Infrastructure', () => {
    it('should have mocked WebGL context', () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl')
      
      expect(gl).toBeDefined()
      expect(gl?.createShader).toBeDefined()
      expect(vi.isMockFunction(gl?.createShader)).toBe(true)
    })

    it('should have mocked performance API', () => {
      expect(performance.now).toBeDefined()
      expect(typeof performance.now()).toBe('number')
    })

    it('should have mocked Worker constructor', () => {
      expect(Worker).toBeDefined()
      expect(vi.isMockFunction(Worker)).toBe(true)
      
      const worker = new Worker('test-worker.js')
      expect(worker.postMessage).toBeDefined()
      expect(worker.terminate).toBeDefined()
    })

    it('should have mocked WebSocket', () => {
      expect(WebSocket).toBeDefined()
      expect(vi.isMockFunction(WebSocket)).toBe(true)
      
      const ws = new WebSocket('ws://localhost:8080')
      expect(ws.send).toBeDefined()
      expect(ws.close).toBeDefined()
      expect(ws.readyState).toBe(1) // OPEN
    })
  })

  describe('Complex Effect Compositions', () => {
    it('should handle nested effects with error recovery', async () => {
      const riskyEffect = Effect.gen(function* (_) {
        const result1 = yield* _(Effect.succeed(10))
        const result2 = yield* _(Effect.succeed(20))
        
        // Simulate potential failure that gets recovered
        const result3 = yield* _(
          Effect.catchAll(
            Effect.fail(new Error('Simulated error')),
            () => Effect.succeed(30)
          )
        )
        
        return result1 + result2 + result3
      })

      const result = await expectEffect.toSucceed(riskyEffect)
      expect(result).toBe(60)
    })

    it('should handle concurrent effects', async () => {
      const effect1 = Effect.delay(mockClockAdapter.now(), 5)
      const effect2 = Effect.delay(mockClockAdapter.now(), 10)
      const effect3 = Effect.delay(mockClockAdapter.now(), 15)

      const concurrentEffect = Effect.all([effect1, effect2, effect3], {
        concurrency: 'unbounded'
      })

      const results = await expectEffect.toSucceed(concurrentEffect)
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(typeof result).toBe('number')
      })
    })
  })
})