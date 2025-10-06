import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Clock, Effect } from 'effect'
import { now, sleepUntil, withinDeadline } from './time'
import { EpochMillisecondsSchema } from './types'

describe('chunk_system/time', () => {
  it.effect('now returns branded epoch milliseconds', () =>
    Effect.gen(function* () {
      const current = yield* now()
      const decoded = yield* Schema.decodeUnknown(EpochMillisecondsSchema)(current)
      expect(decoded).toBe(current)
    })
  )

  it.effect('withinDeadline resolves boolean inside Effect', () =>
    Effect.gen(function* () {
      const truthful = yield* withinDeadline(10, 20)
      const falsy = yield* withinDeadline(30, 20)
      expect(truthful).toBe(true)
      expect(falsy).toBe(false)
    })
  )

  it.effect('sleepUntil waits for the remaining duration', () =>
    Effect.gen(function* () {
      const start = yield* Clock.currentTimeMillis
      yield* sleepUntil(start + 5, start)
      const end = yield* Clock.currentTimeMillis
      expect(end - start).toBeGreaterThanOrEqual(5)
    })
  )
})
