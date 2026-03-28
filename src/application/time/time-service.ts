import { Effect, Ref, Schema } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'

/**
 * State for the time system
 */
const TimeStateSchema = Schema.Struct({
  ticks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  dayLengthTicks: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
type TimeState = Schema.Schema.Type<typeof TimeStateSchema>

/**
 * TimeService manages the in-game day/night cycle.
 *
 * Time is measured in ticks. At 60fps, one tick = one frame ≈ 16ms.
 * Default day length: 24000 ticks ≈ 400 seconds.
 *
 * Time of day mapping:
 *   0.0 = midnight  (dark)
 *   0.25 = dawn     (sunrise)
 *   0.5 = noon      (bright)
 *   0.75 = dusk     (sunset)
 */
export class TimeService extends Effect.Service<TimeService>()(
  '@minecraft/application/TimeService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<TimeState>({
        ticks: 0,
        dayLengthTicks: 24000,  // 400 seconds at 60fps
      })

      return {
        advanceTick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            ticks: state.ticks + deltaTime * 60,
          })),

        getTimeOfDay: (): Effect.Effect<number, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => (state.ticks % state.dayLengthTicks) / state.dayLengthTicks)
          ),

        isNight: (): Effect.Effect<boolean, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => {
              const timeOfDay = (state.ticks % state.dayLengthTicks) / state.dayLengthTicks
              return timeOfDay < 0.25 || timeOfDay > 0.75
            })
          ),

        getDayLength: (): Effect.Effect<number, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => state.dayLengthTicks / 60)
          ),

        setDayLength: (seconds: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            dayLengthTicks: Math.max(120, Math.min(1200, seconds)) * 60, // clamps to 120-1200s range
          })),

        setTimeOfDay: (fraction: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            ticks: Math.max(0, Math.min(0.9999, fraction)) * state.dayLengthTicks, // 0.9999 avoids exact midnight wrap
          })),
      }
    }),
  }
) {}

export const TimeServiceLive = TimeService.Default
