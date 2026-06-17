import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Fiber, TestClock, TestContext } from 'effect'

import { waitForPollingGate } from './session-loading-gates-polling'

describe('application/main/session-loading-gates-polling', () => {
  it.effect('settles when a polling gate eventually succeeds', () => {
    return Effect.gen(function* () {
      let attempts = 0
        const fiber = yield* Effect.fork(
          waitForPollingGate({
            pollMs: 10,
            timeoutMs: 100,
          step: () =>
            Effect.sync(() => {
              attempts += 1
              return attempts >= 3
            }),
          }),
        )

        yield* TestClock.adjust('20 millis')
        yield* Effect.yieldNow()
        const settled = yield* Fiber.join(fiber)

        expect(settled).toBe(true)
        expect(attempts).toBe(3)
    }).pipe(Effect.provide(TestContext.TestContext))
  })

  it.effect('times out when the gate never settles', () => {
    return Effect.gen(function* () {
      let attempts = 0
        const fiber = yield* Effect.fork(
          waitForPollingGate({
            pollMs: 10,
            timeoutMs: 30,
          step: () =>
            Effect.sync(() => {
              attempts += 1
              return false
            }),
          }),
        )

        yield* TestClock.adjust('30 millis')
        yield* Effect.yieldNow()
        const settled = yield* Fiber.join(fiber)

        expect(settled).toBe(false)
        expect(attempts).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(TestContext.TestContext))
    })
  })
