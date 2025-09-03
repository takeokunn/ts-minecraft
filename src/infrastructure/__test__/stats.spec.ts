import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'
import { StatsTest } from '../stats'
import { Stats } from '@/runtime/services'

describe('Stats', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      const stats = yield* _(Stats)
      yield* _(stats.begin)
      yield* _(stats.end)
    }).pipe(Effect.provide(StatsTest)))
})
