import { Effect, Option, Ref, Schema, Metric } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'

export const FPSCounterStateSchema = Schema.Struct({
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  fps: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  accumulatedTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})
type FPSCounterState = Schema.Schema.Type<typeof FPSCounterStateSchema>

const FPS_SAMPLE_INTERVAL = 0.5 // seconds
const fpsGauge = Metric.gauge('fps')

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
            const maybeNewFPS = yield* Ref.modify(state, (s) => {
              const next = {
                ...s,
                frameCount: s.frameCount + 1,
                accumulatedTime: s.accumulatedTime + deltaTime,
              }
              if (next.accumulatedTime >= FPS_SAMPLE_INTERVAL) {
                const calculatedFPS = next.frameCount / next.accumulatedTime
                return [Option.some(calculatedFPS), { frameCount: 0, fps: calculatedFPS, accumulatedTime: 0 }]
              }
              return [Option.none<number>(), next]
            })
            yield* Option.match(maybeNewFPS, {
              onNone: () => Effect.void,
              onSome: (fps) => fpsGauge.pipe(Metric.set(fps)),
            })
          }),

        getFPS: (): Effect.Effect<number, never> =>
          Ref.get(state).pipe(
            Effect.map((s) => s.fps)
          ),

        getFrameCount: (): Effect.Effect<number, never> =>
          Ref.get(state).pipe(
            Effect.map((s) => s.frameCount)
          ),
      }
    })
  }
) {}
export const FPSCounterLive = FPSCounterService.Default
