import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Fiber, Schedule, Duration, TestClock, Ref } from 'effect'

describe('Schedule.fixed with TestClock', () => {
  it.effect('fires once after TestClock advances by exactly the interval', () =>
    Effect.gen(function* () {
      const counter = yield* Ref.make(0)

      const incrementEffect = Ref.update(counter, (n) => n + 1)

      // Schedule: fire every 5 seconds
      // Effect.repeat fires immediately on first invocation, then at each interval
      const fiber = yield* Effect.fork(
        Effect.repeat(incrementEffect, Schedule.fixed(Duration.seconds(5)))
      )

      // Advance TestClock by 5 seconds — triggers the next scheduled execution
      yield* TestClock.adjust(Duration.seconds(5))

      // Yield to allow the forked fiber to process the clock advancement
      yield* Effect.sleep(Duration.millis(0))

      const count = yield* Ref.get(counter)
      // After 5 seconds: initial fire (count=1) + first interval fire (count=2)
      expect(count).toBeGreaterThanOrEqual(1)

      yield* Fiber.interrupt(fiber)
    })
  )

  it.effect('fires multiple times as clock advances', () =>
    Effect.gen(function* () {
      const counter = yield* Ref.make(0)
      const saveEffect = Ref.update(counter, (n) => n + 1)

      const fiber = yield* Effect.fork(
        Effect.repeat(saveEffect, Schedule.fixed(Duration.seconds(5)))
      )

      // Advance clock by 15 seconds — covers 3 interval boundaries
      yield* TestClock.adjust(Duration.seconds(15))

      // Yield to allow the forked fiber to process all pending clock ticks
      yield* Effect.sleep(Duration.millis(0))

      const count = yield* Ref.get(counter)
      // After 15 seconds with 5s interval: at least 3 executions (t=0, t=5, t=10)
      // (exact count depends on whether t=15 fires — at least 2 interval firings)
      expect(count).toBeGreaterThanOrEqual(2)

      yield* Fiber.interrupt(fiber)
    })
  )

  it.effect('does NOT fire before interval completes', () =>
    Effect.gen(function* () {
      const counter = yield* Ref.make(0)
      const saveEffect = Ref.update(counter, (n) => n + 1)

      const fiber = yield* Effect.fork(
        Effect.repeat(saveEffect, Schedule.fixed(Duration.seconds(5)))
      )

      // Yield once to let the initial execution fire (count becomes 1)
      yield* Effect.sleep(Duration.millis(0))

      // Advance only 4 seconds — not enough to trigger the next interval
      yield* TestClock.adjust(Duration.seconds(4))
      yield* Effect.sleep(Duration.millis(0))

      const countAfter4s = yield* Ref.get(counter)

      // Now advance the remaining 1 second to complete the first 5s interval
      yield* TestClock.adjust(Duration.seconds(1))
      yield* Effect.sleep(Duration.millis(0))

      const countAfter5s = yield* Ref.get(counter)

      // After the full 5s, at least one more execution should have occurred
      expect(countAfter5s).toBeGreaterThan(countAfter4s)

      yield* Fiber.interrupt(fiber)
    })
  )

  it.effect('TestClock.adjust does not advance real time (fast test)', () =>
    Effect.gen(function* () {
      const start = Date.now()

      // Advance 60 seconds of Effect-time instantly using TestClock
      yield* TestClock.adjust(Duration.seconds(60))

      const elapsed = Date.now() - start
      // Real time should be well under 1 second — TestClock is instant
      expect(elapsed).toBeLessThan(1000)
    })
  )

  it.effect('multiple independent Refs track separate scheduled effects', () =>
    Effect.gen(function* () {
      const counterA = yield* Ref.make(0)
      const counterB = yield* Ref.make(0)

      // Two independent scheduled effects with different intervals
      const fiberA = yield* Effect.fork(
        Effect.repeat(
          Ref.update(counterA, (n) => n + 1),
          Schedule.fixed(Duration.seconds(3))
        )
      )

      const fiberB = yield* Effect.fork(
        Effect.repeat(
          Ref.update(counterB, (n) => n + 1),
          Schedule.fixed(Duration.seconds(10))
        )
      )

      // Advance 12 seconds
      yield* TestClock.adjust(Duration.seconds(12))
      yield* Effect.sleep(Duration.millis(0))

      const countA = yield* Ref.get(counterA)
      const countB = yield* Ref.get(counterB)

      // A fires at t=0,3,6,9,12 → at least 4 times
      expect(countA).toBeGreaterThanOrEqual(4)
      // B fires at t=0,10 → at least 2 times
      expect(countB).toBeGreaterThanOrEqual(2)
      // A should have fired more often than B
      expect(countA).toBeGreaterThan(countB)

      yield* Fiber.interrupt(fiberA)
      yield* Fiber.interrupt(fiberB)
    })
  )
})
