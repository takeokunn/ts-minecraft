import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { WorldClock, WorldClockLive, makeWorldClockTestLayer } from '../time'

describe('domain/world/time', () => {
  it.prop([fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER })])(
    'test layer returns provided timestamp',
    ([millis]) =>
      Effect.gen(function* () {
        const clock = yield* Effect.service(WorldClock)
        const current = yield* clock.currentMillis
        expect(current).toBe(millis)
      }).pipe(Layer.provide(makeWorldClockTestLayer(millis)))
  )

  it.effect('live layer exposes monotonic clock', () =>
    Effect.gen(function* () {
      const clock = yield* Effect.service(WorldClock)
      const first = yield* clock.currentMillis
      const second = yield* clock.currentMillis
      expect(second).toBeGreaterThanOrEqual(first)
    }).pipe(Layer.provide(WorldClockLive))
  )
})
