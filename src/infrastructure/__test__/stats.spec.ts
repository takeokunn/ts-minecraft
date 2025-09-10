import { vi } from 'vitest'

// Mock Stats.js constructor and methods
const mockStatsInstance = {
  dom: document.createElement('div'),
  begin: vi.fn(),
  end: vi.fn(),
}

vi.mock('stats.js', () => ({
  default: vi.fn(() => mockStatsInstance)
}))

import { Effect, Layer, Scope } from 'effect'
import { describe, it, assert, beforeEach } from '@effect/vitest'
import { StatsLive, StatsTest } from '../stats'
import { Stats } from '@/runtime/services'

describe('Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it.effect('StatsTest should run without errors', () =>
    Effect.gen(function* (_) {
      const stats = yield* _(Stats)
      yield* _(stats.begin)
      yield* _(stats.end)
    }).pipe(Effect.provide(StatsTest)))

  it.effect('StatsLive should add and remove the stats panel from the DOM', () =>
    Effect.gen(function* (_) {
      const scope = yield* _(Scope.make())
      const layer = yield* _(Layer.build(StatsLive), Effect.provideService(Scope.Scope, scope))
      yield* _(Effect.context(layer))

      const statsPanel = document.querySelector('body > div')
      assert.isNotNull(statsPanel)

      yield* _(Scope.close(scope, Effect.void))

      const statsPanelAfterClose = document.querySelector('body > div')
      assert.isNull(statsPanelAfterClose)
    }))
})
