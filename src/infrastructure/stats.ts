import { Stats } from '@/infrastructure/layers/unified.layer'
import { Effect, Layer } from 'effect'
import StatsJs from 'stats.js'

export const StatsLive = Layer.scoped(
  Stats,
  Effect.acquireRelease(
    Effect.sync(() => {
      const stats = new StatsJs()
      stats.dom.style.left = '0px'
      stats.dom.style.top = '0px'
      document.body.appendChild(stats.dom)
      return stats
    }),
    (stats) => Effect.sync(() => document.body.removeChild(stats.dom)),
  ).pipe(
    Effect.map((stats) => ({
      begin: Effect.sync(() => stats.begin()),
      end: Effect.sync(() => stats.end()),
    })),
  ),
)

export const StatsTest = Layer.succeed(
  Stats,
  {
    begin: Effect.void,
    end: Effect.void,
  },
)
