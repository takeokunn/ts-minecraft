import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Ref } from 'effect'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'

// The autosave daemon is `Effect.repeat(performAutoSaveTick(...), Schedule.spaced(5s))`.
// `Effect.repeat` re-runs its effect only while it SUCCEEDS, so each tick must be
// total (`Effect<void, never>`) — a failure escaping the tick would stop the repeat
// and silently disable autosave for the rest of the session. Each "swallowed" test
// asserts the tick's success value (`undefined`); if the tick instead failed, the
// `yield*` would abort the effect and the test would error before asserting.

describe('performAutoSaveTick (autosave daemon resilience)', () => {
  it.effect('runs both the chunk save and the session persist when both succeed', () =>
    Effect.gen(function* () {
      const ran = yield* Ref.make<ReadonlyArray<string>>([])
      const save = Ref.update(ran, (a) => [...a, 'chunks'])
      const persist = Ref.update(ran, (a) => [...a, 'session'])

      yield* performAutoSaveTick(save, persist)

      const order = yield* Ref.get(ran)
      expect(order).toContain('chunks')
      expect(order).toContain('session')
    }),
  )

  it.effect('SUCCEEDS (swallows the error) when the chunk save fails with a typed error', () =>
    Effect.gen(function* () {
      const result = yield* performAutoSaveTick(Effect.fail(new Error('IndexedDB transaction failed')), Effect.void)
      expect(result).toBeUndefined()
    }),
  )

  it.effect('SUCCEEDS when the session persist fails with a typed error', () =>
    Effect.gen(function* () {
      const result = yield* performAutoSaveTick(Effect.void, Effect.fail(new Error('quota exceeded')))
      expect(result).toBeUndefined()
    }),
  )

  it.effect('SUCCEEDS when BOTH saves fail simultaneously (parallel cause is folded)', () =>
    Effect.gen(function* () {
      const result = yield* performAutoSaveTick(
        Effect.fail(new Error('chunk write failed')),
        Effect.fail(new Error('metadata write failed')),
      )
      expect(result).toBeUndefined()
    }),
  )

  it.effect('SUCCEEDS when a save throws (a DEFECT) — this is why catchAllCause, not catchAll, is used', () =>
    Effect.gen(function* () {
      // A thrown exception inside a save surfaces as Cause.Die. `catchAll` would NOT
      // catch it (it would escape and kill the daemon); `catchAllCause` does. This
      // test pins that deliberate choice — swapping to catchAll breaks only this case.
      const result = yield* performAutoSaveTick(Effect.die(new Error('unexpected IDB exception')), Effect.void)
      expect(result).toBeUndefined()
    }),
  )

  it.effect('a failing tick does not stop a later tick from saving (repeat stays alive)', () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0)
      // The chunk save fails on its first invocation, then succeeds — modelling a
      // transient storage error followed by recovery.
      const save = Effect.gen(function* () {
        const n = yield* Ref.updateAndGet(attempts, (x) => x + 1)
        if (n === 1) return yield* Effect.fail(new Error('transient'))
      })

      // Two scheduler ticks, back to back (Effect.repeat minus the delay).
      yield* performAutoSaveTick(save, Effect.void) // tick 1: save fails, tick recovers
      yield* performAutoSaveTick(save, Effect.void) // tick 2: must still attempt the save

      // Both ticks attempted the save → the first failure never killed the loop.
      // Without the in-tick catch, tick 1 would propagate and this would never run,
      // leaving attempts at 1.
      expect(yield* Ref.get(attempts)).toBe(2)
    }),
  )
})
