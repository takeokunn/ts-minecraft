import { Effect, Ref, Schedule, Clock } from 'effect'
import { pipe } from 'effect/Function'
import { DeltaTime, RendererService } from './services'

const GAME_TICK_RATE = 1000 / 60 // 60 FPS

const animationFrameSchedule = pipe(
  Schedule.forever,
  Schedule.mapEffect(() =>
    Effect.async<void>((resume) => {
      const id = requestAnimationFrame(() => resume(Effect.void))
      return Effect.sync(() => cancelAnimationFrame(id))
    }),
  ),
)

export const gameLoop = <E, R>(systems: ReadonlyArray<Effect.Effect<void, E, R>>) =>
  Effect.gen(function* (_) {
    const renderer = yield* _(RendererService)
    const lastTimeRef = yield* _(Ref.make(yield* _(Clock.currentTimeMillis)))

    const gameTick = Effect.gen(function* (_) {
      const currentTime = yield* _(Clock.currentTimeMillis)
      const lastTime = yield* _(Ref.getAndSet(lastTimeRef, currentTime))
      const deltaTime = (currentTime - lastTime) / 1000

      const systemsEffect = Effect.forEach(systems, (system) => Effect.catchAll(system, (e) => Effect.logError('Error in system', e)), {
        discard: true,
        concurrency: 'inherit',
      })

      yield* _(pipe(systemsEffect, Effect.provideService(DeltaTime, deltaTime)))

      // Execute all rendering logic for the frame
      yield* _(renderer.processRenderQueue)
      yield* _(renderer.syncCameraToWorld)
      yield* _(renderer.updateHighlight)
      yield* _(renderer.updateInstancedMeshes)
      yield* _(renderer.renderScene)
    })

    yield* _(Effect.repeat(gameTick, animationFrameSchedule))
  })
