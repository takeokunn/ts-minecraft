import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { isPerfEnabled, markEffect } from '@ts-minecraft/rendering'

// In vitest node environment, `window` is undefined → PERF_ENABLED module constant is false.
// These tests verify the no-op code path, which is the only path reachable in tests.

describe('perf-marks', () => {
  describe('isPerfEnabled', () => {
    it('returns false in Node.js test environment (no window.location)', () => {
      expect(isPerfEnabled()).toBe(false)
    })
  })

  describe('markEffect', () => {
    it('is a transparent pass-through that returns the inner result unchanged', async () => {
      const inner = Effect.succeed(42)
      const wrapped = markEffect('test-operation', inner)
      expect(await Effect.runPromise(wrapped)).toBe(42)
    })

    it('preserves reference equality of the wrapped effect when disabled', () => {
      const inner = Effect.succeed('hello')
      const wrapped = markEffect('test', inner)
      // When PERF_ENABLED=false, markEffect returns the original effect directly
      expect(wrapped).toBe(inner)
    })

    it('propagates errors from the inner effect unchanged', async () => {
      class TestError extends Error {}
      const inner: Effect.Effect<never, TestError> = Effect.fail(new TestError('propagated'))
      const wrapped = markEffect('failing-op', inner)
      const exit = await Effect.runPromiseExit(wrapped)
      expect(exit._tag).toBe('Failure')
    })
  })
})
