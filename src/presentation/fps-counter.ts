import { Effect, Ref, Schema, Metric } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'

export const FPSCounterStateSchema = Schema.Struct({
  frameCount: Schema.Number,
  fps: Schema.Number,
  accumulatedTime: Schema.Number,
})
type FPSCounterState = Schema.Schema.Type<typeof FPSCounterStateSchema>

const FPS_SAMPLE_INTERVAL = 0.5 // seconds

export class FPSCounterService extends Effect.Service<FPSCounterService>()(
  // FPSCounterLive alias kept below for test compatibility
  '@minecraft/presentation/FPSCounter',
  {
    effect: Effect.gen(function* () {
      const state = yield* Ref.make<FPSCounterState>({
        frameCount: 0,
        fps: 0,
        accumulatedTime: 0,
      })

      return {
        tick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
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
              yield* Metric.gauge('fps').pipe(Metric.set(calculatedFPS))
            }
          }),

        getFPS: (): Effect.Effect<number, never> =>
          Ref.get(state).pipe(
            Effect.map((s) => s.fps)
          ),

        getFrameCount: (): Effect.Effect<number, never> =>
          Ref.get(state).pipe(
            Effect.map((s) => s.frameCount)
          ),

        reset: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(state, { frameCount: 0, fps: 0, accumulatedTime: 0 })
          }),
      }
    })
  }
) {}
export const FPSCounterLive = FPSCounterService.Default
