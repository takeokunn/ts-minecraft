import { DeltaTimeSecs } from '@ts-minecraft/core'
import { Schema } from 'effect'

export const TimeStateSchema = Schema.Struct({
  ticks: Schema.Number.pipe(Schema.nonNegative()),
  dayLengthTicks: Schema.Number.pipe(Schema.positive()),
})

export type TimeState = Schema.Schema.Type<typeof TimeStateSchema>

// Fresh worlds start at mid-morning (timeOfDay 0.30), not ticks:0 — in this
// cycle 0 is MIDNIGHT (0.25=dawn, 0.5=noon, 0.75=dusk). A midnight start
// spawned the night-mob roster on top of brand-new players and daylight-immune
// hostiles (creeper/witch/spider) then camped the respawn point: an
// unrecoverable death loop on world creation. 0.30 clears the sunrise twilight
// band and leaves most of day one for gathering, matching vanilla's day start.
// Saved worlds are unaffected: their persisted timeOfDay overwrites this.
export const INITIAL_TIME_STATE: TimeState = {
  ticks: 7200,
  dayLengthTicks: 24000,
}

const clampDayLengthSeconds = (seconds: number): number => Math.max(120, Math.min(1200, seconds))

const clampTimeFraction = (fraction: number): number => Math.max(0, Math.min(0.9999, fraction))

export const advanceTimeState = (deltaTime: DeltaTimeSecs) => (state: TimeState): TimeState => ({
  ...state,
  ticks: state.ticks + deltaTime * 60,
})

export const getTimeOfDayFromState = (state: TimeState): number =>
  (state.ticks % state.dayLengthTicks) / state.dayLengthTicks

export const getMoonPhaseFromState = (state: TimeState): number =>
  Math.floor(state.ticks / state.dayLengthTicks) % 8

export const isNightFromState = (state: TimeState): boolean => {
  const timeOfDay = getTimeOfDayFromState(state)
  return timeOfDay < 0.25 || timeOfDay > 0.75
}

export const getDayLengthFromState = (state: TimeState): number => state.dayLengthTicks / 60

export const setDayLengthOnState = (seconds: number) => (state: TimeState): TimeState => ({
  ...state,
  dayLengthTicks: clampDayLengthSeconds(seconds) * 60,
})

export const setTimeOfDayOnState = (fraction: number) => (state: TimeState): TimeState => ({
  ...state,
  ticks: clampTimeFraction(fraction) * state.dayLengthTicks,
})
