import { Effect, Context, Layer, Ref } from 'effect'

export interface FPSCounter {
  readonly tick: (deltaTime: number) => Effect.Effect<void, never>
  readonly getFPS: () => Effect.Effect<number, never>
  readonly getFrameCount: () => Effect.Effect<number, never>
  readonly reset: () => Effect.Effect<void, never>
}

export const FPSCounter = Context.GenericTag<FPSCounter>('@minecraft/presentation/FPSCounter')

interface FPSCounterState {
  readonly frameCount: number
  readonly fps: number
  readonly accumulatedTime: number
}

const FPS_SAMPLE_INTERVAL = 0.5 // seconds

export const FPSCounterLive = Layer.effect(
  FPSCounter,
  Effect.gen(function* () {
    const state = yield* Ref.make<FPSCounterState>({
      frameCount: 0,
      fps: 0,
      accumulatedTime: 0,
    })

    return FPSCounter.of({
      tick: (deltaTime: number) =>
        Effect.gen(function* () {
          yield* Ref.update(state, (s) => ({
            ...s,
            frameCount: s.frameCount + 1,
            accumulatedTime: s.accumulatedTime + deltaTime,
          }))

          const current = yield* Ref.get(state)

          // Calculate FPS when sample interval is reached
          if (current.accumulatedTime >= FPS_SAMPLE_INTERVAL) {
            const calculatedFPS = current.frameCount / current.accumulatedTime
            yield* Ref.set(state, {
              frameCount: 0,
              fps: calculatedFPS,
              accumulatedTime: 0,
            })
          }
        }),

      getFPS: () =>
        Ref.get(state).pipe(
          Effect.map((s) => s.fps)
        ),

      getFrameCount: () =>
        Ref.get(state).pipe(
          Effect.map((s) => s.frameCount)
        ),

      reset: () =>
        Effect.gen(function* () {
          yield* Ref.set(state, { frameCount: 0, fps: 0, accumulatedTime: 0 })
        }),
    })
  })
)
