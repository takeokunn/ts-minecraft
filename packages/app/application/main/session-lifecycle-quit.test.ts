import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Duration, Effect, Fiber, TestClock, TestContext } from 'effect'

import { runBestEffortQuitStep } from '@ts-minecraft/app/main/session-lifecycle-quit'

describe('runBestEffortQuitStep', () => {
  it.effect('swallows a typed failure and resolves', () =>
    Effect.gen(function* () {
      const result = yield* runBestEffortQuitStep(Effect.fail(new Error('flush failed')), Duration.seconds(1))
      expect(result).toBeUndefined()
    }),
  )

  it.effect('returns when the timeout wins the race', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        runBestEffortQuitStep(Effect.sleep(Duration.hours(1)), Duration.millis(20)),
      )

      yield* TestClock.adjust('20 millis')
      yield* Effect.yieldNow()

      const result = yield* Fiber.join(fiber)
      expect(result).toBeUndefined()
    }).pipe(Effect.provide(TestContext.TestContext)),
  )
})
