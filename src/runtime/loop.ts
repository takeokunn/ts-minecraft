import { Effect } from 'effect'
import { Stats, Clock, DeltaTime } from '@/runtime/services'

export const createTick = <E, R>(systems: ReadonlyArray<Effect.Effect<void, E, R>>) =>
  Effect.gen(function* (_) {
    const stats = yield* _(Stats)
    const clock = yield* _(Clock)

    const systemsEffect = Effect.forEach(
      systems,
      (system) => Effect.catchAll(system, (e) => Effect.logError('Error in system', e)),
      {
        discard: true,
        concurrency: 'inherit',
      },
    )

    yield* _(stats.begin)
    const deltaTime = yield* _(clock.deltaTime.get)
    yield* _(systemsEffect.pipe(Effect.provideService(DeltaTime, { value: deltaTime })))
    yield* _(stats.end)
  })

export const gameLoop = <E, R>(systems: ReadonlyArray<Effect.Effect<void, E, R>>) => {
  const tick = createTick(systems)
  return Effect.gen(function* (_) {
    const clock = yield* _(Clock)
    const context = yield* _(Effect.context<R | Stats | Clock>())
    yield* _(clock.onFrame(() => tick.pipe(Effect.provide(context))))
  })
}
