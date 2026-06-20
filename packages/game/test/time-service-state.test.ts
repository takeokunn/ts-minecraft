import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
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
} from '../application/time-service-state'

describe('application/time/time-service-state', () => {
  it('advances ticks at 60 ticks per second', () => {
    const nextState = advanceTimeState(DeltaTimeSecs.make(2))(INITIAL_TIME_STATE)
    expect(nextState.ticks).toBe(120)
    expect(nextState.dayLengthTicks).toBe(INITIAL_TIME_STATE.dayLengthTicks)
  })

  it('derives time-of-day and moon phase from the current state', () => {
    const state = {
      ticks: (24000 * 11) + 6000,
      dayLengthTicks: 24000,
    }

    expect(getTimeOfDayFromState(state)).toBeCloseTo(0.25, 6)
    expect(getMoonPhaseFromState(state)).toBe(3)
  })

  it('detects night using the dawn/dusk thresholds', () => {
    expect(isNightFromState({ ticks: 0, dayLengthTicks: 24000 })).toBe(true)
    expect(isNightFromState({ ticks: 12000, dayLengthTicks: 24000 })).toBe(false)
    expect(isNightFromState({ ticks: 18000, dayLengthTicks: 24000 })).toBe(false)
    expect(isNightFromState({ ticks: 19000, dayLengthTicks: 24000 })).toBe(true)
  })

  it('clamps day length and time-of-day writes', () => {
    const longDay = setDayLengthOnState(9999)(INITIAL_TIME_STATE)
    expect(getDayLengthFromState(longDay)).toBe(1200)

    const shortDay = setDayLengthOnState(50)(INITIAL_TIME_STATE)
    expect(getDayLengthFromState(shortDay)).toBe(120)

    const midnight = setTimeOfDayOnState(1.0)(longDay)
    expect(getTimeOfDayFromState(midnight)).toBeCloseTo(0.9999, 4)

    const floor = setTimeOfDayOnState(-0.1)(longDay)
    expect(getTimeOfDayFromState(floor)).toBe(0)
  })
})
