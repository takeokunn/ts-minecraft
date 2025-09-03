import { Effect } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { createTick, gameLoop } from '../../runtime/loop'
import { Stats, Clock, DeltaTime } from '@/runtime/services'
import { Layer } from 'effect'

const StatsTest = Layer.succeed(
  Stats,
  {
    begin: Effect.void,
    end: Effect.void,
  }
)

const ClockTest = Layer.succeed(
  Clock,
  {
    deltaTime: { get: Effect.succeed(0.016) } as any,
    onFrame: () => Effect.void,
  }
)

const TestLayers = Layer.mergeAll(StatsTest, ClockTest)

describe('Game Loop', () => {
  it.effect('createTick should run systems', () =>
    Effect.gen(function* (_) {
      let system1Called = false
      let system2Called = false
      const system1 = Effect.sync(() => {
        system1Called = true
      })
      const system2 = Effect.sync(() => {
        system2Called = true
      })
      const tick = createTick([system1, system2])
      yield* _(tick)
      expect(system1Called).toBe(true)
      expect(system2Called).toBe(true)
    }).pipe(Effect.provide(TestLayers)))
})