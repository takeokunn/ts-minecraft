import { Effect, Ref } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  advanceTimeState,
  getDayLengthFromState,
  getMoonPhaseFromState,
  getTimeOfDayFromState,
  INITIAL_TIME_STATE,
  isNightFromState,
  setDayLengthOnState,
  setTimeOfDayOnState,
  type TimeState,
} from './time-service-state'

// Time-of-day: 0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk. One tick = one frame ≈ 16ms at 60fps.
export class TimeService extends Effect.Service<TimeService>()(
  '@minecraft/application/TimeService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<TimeState>({
        ...INITIAL_TIME_STATE,
      })
      return {
        advanceTick: (deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
          Ref.update(stateRef, advanceTimeState(deltaTime)),

        getTimeOfDay: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return getTimeOfDayFromState(state)
          }),

        getMoonPhase: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return getMoonPhaseFromState(state)
          }),

        isNight: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return isNightFromState(state)
          }),

        getDayLength: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return getDayLengthFromState(state)
          }),

        setDayLength: (seconds: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, setDayLengthOnState(seconds)),

        setTimeOfDay: (fraction: number): Effect.Effect<void, never> =>
          Ref.update(stateRef, setTimeOfDayOnState(fraction)),
      }
    }),
  }
) {}
