import { describe, expect, it } from 'vitest'
import {
  INITIAL_TIME_STATE,
  advanceTimeState,
  getTimeOfDayFromState,
  getMoonPhaseFromState,
  isNightFromState,
  getDayLengthFromState,
  setDayLengthOnState,
  setTimeOfDayOnState,
} from '../application/time-service-state'
import { DeltaTimeSecs } from '@ts-minecraft/core'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const dt = (n: number) => DeltaTimeSecs.make(n)
const state = INITIAL_TIME_STATE // { ticks: 0, dayLengthTicks: 24000 }

// ─── advanceTimeState ─────────────────────────────────────────────────────────

describe('advanceTimeState', () => {
  it('increments ticks by deltaTime × 60', () => {
    const next = advanceTimeState(dt(1))(state)
    expect(next.ticks).toBe(60)
  })

  it('accumulates ticks across multiple steps', () => {
    const s1 = advanceTimeState(dt(1))(state)
    const s2 = advanceTimeState(dt(1))(s1)
    expect(s2.ticks).toBe(120)
  })

  it('preserves dayLengthTicks', () => {
    expect(advanceTimeState(dt(1))(state).dayLengthTicks).toBe(state.dayLengthTicks)
  })
})

// ─── getTimeOfDayFromState ────────────────────────────────────────────────────

describe('getTimeOfDayFromState', () => {
  it('returns 0 at the start of the day', () => {
    expect(getTimeOfDayFromState(state)).toBe(0)
  })

  it('returns 0.5 at noon (ticks = half dayLength)', () => {
    expect(getTimeOfDayFromState({ ...state, ticks: 12000 })).toBeCloseTo(0.5)
  })

  it('wraps around at dayLengthTicks (one full day)', () => {
    expect(getTimeOfDayFromState({ ...state, ticks: 24000 })).toBeCloseTo(0)
    expect(getTimeOfDayFromState({ ...state, ticks: 24001 })).toBeGreaterThan(0)
  })
})

// ─── getMoonPhaseFromState ────────────────────────────────────────────────────

describe('getMoonPhaseFromState', () => {
  it('returns 0 on day 0', () => {
    expect(getMoonPhaseFromState(state)).toBe(0)
  })

  it('increments by 1 after each full day', () => {
    expect(getMoonPhaseFromState({ ...state, ticks: 24000 })).toBe(1)
    expect(getMoonPhaseFromState({ ...state, ticks: 48000 })).toBe(2)
  })

  it('wraps to 0 after 8 days', () => {
    expect(getMoonPhaseFromState({ ...state, ticks: 24000 * 8 })).toBe(0)
  })
})

// ─── isNightFromState ─────────────────────────────────────────────────────────

describe('isNightFromState', () => {
  it('returns false at noon (timeOfDay=0.5)', () => {
    expect(isNightFromState({ ...state, ticks: 12000 })).toBe(false)
  })

  it('returns true at midnight (timeOfDay=0)', () => {
    expect(isNightFromState({ ...state, ticks: 0 })).toBe(true)
  })

  it('returns true late at night (timeOfDay>0.75)', () => {
    expect(isNightFromState({ ...state, ticks: 20000 })).toBe(true)
  })
})

// ─── getDayLengthFromState ────────────────────────────────────────────────────

describe('getDayLengthFromState', () => {
  it('returns ticks/60 as seconds', () => {
    expect(getDayLengthFromState(state)).toBe(24000 / 60)
  })
})

// ─── setDayLengthOnState ──────────────────────────────────────────────────────

describe('setDayLengthOnState', () => {
  it('sets dayLengthTicks = clamp(120,1200,secs) × 60', () => {
    const next = setDayLengthOnState(300)(state)
    expect(next.dayLengthTicks).toBe(300 * 60)
  })

  it('clamps below 120s to 120s', () => {
    expect(setDayLengthOnState(10)(state).dayLengthTicks).toBe(120 * 60)
  })

  it('clamps above 1200s to 1200s', () => {
    expect(setDayLengthOnState(9999)(state).dayLengthTicks).toBe(1200 * 60)
  })
})

// ─── setTimeOfDayOnState ──────────────────────────────────────────────────────

describe('setTimeOfDayOnState', () => {
  it('sets ticks to fraction × dayLengthTicks', () => {
    const next = setTimeOfDayOnState(0.5)(state)
    expect(next.ticks).toBeCloseTo(12000)
  })

  it('clamps fraction to 0.9999 at maximum', () => {
    const next = setTimeOfDayOnState(1)(state)
    expect(next.ticks).toBeLessThan(state.dayLengthTicks)
  })

  it('clamps fraction to 0 at minimum', () => {
    const next = setTimeOfDayOnState(-1)(state)
    expect(next.ticks).toBe(0)
  })
})
