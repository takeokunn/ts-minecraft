import { Effect, Ref, Schedule, Clock } from 'effect'
import { pipe } from 'effect/Function'
import { DeltaTime, RendererService } from './services'

// --- Game Loop ---

/* v8 ignore start */
export const createGameTick = <E, R>(systems: ReadonlyArray<Effect.Effect<void, E, R>>, lastTimeRef: Ref.Ref<number>) =>
  Effect.gen(function* (_) {
    const renderer = yield* _(RendererService)
    const currentTime = yield* _(Clock.currentTimeMillis)
    const lastTime = yield* _(Ref.getAndSet(lastTimeRef, currentTime))
    const deltaTime = (currentTime - lastTime) / 1000

    const systemsEffect = Effect.forEach(systems, (system) => Effect.catchAll(system, (e) => Effect.logError('Error in system', e)), { discard: true, concurrency: 'inherit' })

    const tickEffect = pipe(systemsEffect, Effect.provideService(DeltaTime, deltaTime))

    yield* _(tickEffect)

    // Execute all rendering logic for the frame
    yield* _(renderer.processRenderQueue)
    yield* _(renderer.syncCameraToWorld)
    yield* _(renderer.updateHighlight)
    yield* _(renderer.updateInstancedMeshes)
    yield* _(renderer.renderScene)
  })
/* v8 ignore stop */

/* v8 ignore start */
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
    const lastTimeRef = yield* _(Ref.make(yield* _(Clock.currentTimeMillis)))
    const gameTick = createGameTick(systems, lastTimeRef)
    yield* _(Effect.repeat(gameTick, animationFrameSchedule))
  })
/* v8 ignore stop */
