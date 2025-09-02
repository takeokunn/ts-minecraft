import { Effect, Ref, Schedule } from 'effect'
import { pipe } from 'effect/Function'
import { DeltaTime, RendererService } from './services'

// --- Types ---

export type System = Effect.Effect<void, never, unknown>

// --- Game Loop ---

export const createGameTick = (systems: ReadonlyArray<System>, lastTimeRef: Ref.Ref<number>) =>
  Effect.gen(function* (_) {
    const renderer = yield* _(RendererService)
    const currentTime = performance.now()
    const lastTime = yield* _(Ref.getAndSet(lastTimeRef, currentTime))
    const deltaTime = (currentTime - lastTime) / 1000

    const systemsEffect = Effect.forEach(systems, (system) => system, { discard: true })

    const tickEffect = pipe(systemsEffect, Effect.provideService(DeltaTime, deltaTime))

    yield* _(tickEffect)

    // Execute all rendering logic for the frame
    yield* _(renderer.processRenderQueue)
    yield* _(renderer.syncCameraToWorld)
    yield* _(renderer.updateHighlight)
    yield* _(renderer.updateInstancedMeshes)
    yield* _(renderer.renderScene)
  })

const animationFrameSchedule = pipe(
  Schedule.forever,
  Schedule.mapEffect(() =>
    Effect.async<void>((resume) => {
      const id = requestAnimationFrame(() => resume(Effect.void))
      return Effect.sync(() => cancelAnimationFrame(id))
    }),
  ),
)

export const gameLoop = <R>(systems: ReadonlyArray<Effect.Effect<void, never, R>>) =>
  Effect.gen(function* (_) {
    const lastTimeRef = yield* _(Ref.make(performance.now()))
    const gameTick = createGameTick(systems, lastTimeRef)
    yield* _(Effect.repeat(gameTick, animationFrameSchedule))
  })