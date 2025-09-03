import { Effect } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { StatsLive } from '../stats'
import { Stats } from '@/runtime/services'

describe('Stats', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      const stats = yield* _(Stats)
      yield* _(stats.begin)
      yield* _(stats.end)
    }).pipe(Effect.provide(StatsLive)))
})
