import { Effect, Context, Layer, Ref } from 'effect'

/**
 * State for the time system
 */
interface TimeState {
  readonly ticks: number        // accumulated fractional ticks
  readonly dayLengthTicks: number  // ticks per full day (default 24000 = 400s at 60fps)
}

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
export interface TimeService {
  /**
   * Advance the time by deltaTime seconds.
   * Accumulates fractional ticks: ticks += deltaTime * 60
   */
  readonly advanceTick: (deltaTime: number) => Effect.Effect<void, never>

  /**
   * Get the current time of day as a value in [0, 1).
   * 0 = midnight, 0.5 = noon.
   */
  readonly getTimeOfDay: () => Effect.Effect<number, never>

  /**
   * Returns true during night time (timeOfDay < 0.25 or > 0.75)
   */
  readonly isNight: () => Effect.Effect<boolean, never>

  /**
   * Set the day length in seconds. Converts to ticks at 60fps.
   * Valid range: 120-1200 seconds.
   */
  readonly setDayLength: (seconds: number) => Effect.Effect<void, never>

  /**
   * Set the current time of day as a value in [0, 1).
   * 0 = midnight, 0.5 = noon.
   */
  readonly setTimeOfDay: (fraction: number) => Effect.Effect<void, never>
}

/**
 * Context tag for TimeService
 */
export const TimeService = Context.GenericTag<TimeService>('@minecraft/application/TimeService')

/**
 * Live implementation of TimeService
 */
export const TimeServiceLive = Layer.effect(
  TimeService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<TimeState>({
      ticks: 0,
      dayLengthTicks: 24000,  // 400 seconds at 60fps
    })

    return TimeService.of({
      advanceTick: (deltaTime) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          ticks: state.ticks + deltaTime * 60,
        })),

      getTimeOfDay: () =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => (state.ticks % state.dayLengthTicks) / state.dayLengthTicks)
        ),

      isNight: () =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => {
            const timeOfDay = (state.ticks % state.dayLengthTicks) / state.dayLengthTicks
            return timeOfDay < 0.25 || timeOfDay > 0.75
          })
        ),

      setDayLength: (seconds) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          dayLengthTicks: Math.max(120, Math.min(1200, seconds)) * 60,
        })),

      setTimeOfDay: (fraction) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          ticks: Math.max(0, Math.min(0.9999, fraction)) * state.dayLengthTicks,
        })),
    })
  })
)
