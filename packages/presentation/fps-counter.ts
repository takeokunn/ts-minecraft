import { Effect, MutableRef, Schema, Metric } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'

export const FPSCounterStateSchema = Schema.Struct({
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  fps: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  accumulatedTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})
interface MutableFPSCounterState {
  frameCount: number
  fps: number
  accumulatedTime: number
}

const FPS_SAMPLE_INTERVAL = 0.1 // seconds
const fpsGauge = Metric.gauge('fps')

export class FPSCounterService extends Effect.Service<FPSCounterService>()(
  '@minecraft/presentation/FPSCounter',
  {
    effect: Effect.sync(() => {
      const state = MutableRef.make<MutableFPSCounterState>({ frameCount: 0, fps: 0, accumulatedTime: 0 })
      return {
        tick: (deltaTime: DeltaTimeSecs): Effect.Effect<number, never> =>
          Effect.suspend(() => {
            const s = MutableRef.get(state)
            s.frameCount += 1
            s.accumulatedTime += deltaTime
            if (s.accumulatedTime >= FPS_SAMPLE_INTERVAL) {
              const calculatedFPS = s.frameCount / s.accumulatedTime
              s.frameCount = 0
              s.fps = calculatedFPS
              s.accumulatedTime = 0
              return fpsGauge.pipe(Metric.set(calculatedFPS), Effect.as(calculatedFPS))
            }
            return Effect.succeed(s.fps)
          }),

        getFPS: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            const s = MutableRef.get(state)
            return s.fps
          }),

        getFrameCount: (): Effect.Effect<number, never> =>
          Effect.sync(() => {
            const s = MutableRef.get(state)
            return s.frameCount
          }),
      }
    })
  }
) {}
