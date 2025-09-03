import { Effect } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { ClockLive } from '../clock'
import { Clock } from '@/runtime/services'

describe('Clock', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      const clock = yield* _(Clock)
      const deltaTime = yield* _(clock.deltaTime.get)
      assert.isNumber(deltaTime)
      const callback = () => Effect.void
      yield* _(clock.onFrame(callback))
    }).pipe(Effect.provide(ClockLive)))
})
