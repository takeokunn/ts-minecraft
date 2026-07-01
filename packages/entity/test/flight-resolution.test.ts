import { describe, expect, it } from 'vitest'
import { MetersPerSec } from '@ts-minecraft/core'
import {
  computeFlightVerticalVelocity,
  nextFlightState,
} from '@ts-minecraft/entity/domain/flight-resolution'
import { DEFAULT_FLY_VERTICAL_SPEED } from '@ts-minecraft/entity/domain/flight'

const defaultSpeed = MetersPerSec.toNumber(DEFAULT_FLY_VERTICAL_SPEED) // 7.5

// ─── computeFlightVerticalVelocity ────────────────────────────────────────────
describe('computeFlightVerticalVelocity', () => {
  it('returns +speed when ascending only', () => {
    expect(computeFlightVerticalVelocity(true, false)).toBeCloseTo(defaultSpeed)
  })

  it('returns -speed when descending only', () => {
    expect(computeFlightVerticalVelocity(false, true)).toBeCloseTo(-defaultSpeed)
  })

  it('returns 0 when neither ascending nor descending (hover)', () => {
    expect(computeFlightVerticalVelocity(false, false)).toBe(0)
  })

  it('returns 0 when both ascending and descending (opposing inputs cancel)', () => {
    expect(computeFlightVerticalVelocity(true, true)).toBe(0)
  })

  it('respects a custom speed override', () => {
    const custom = MetersPerSec.make(3)
    expect(computeFlightVerticalVelocity(true, false, custom)).toBeCloseTo(3)
    expect(computeFlightVerticalVelocity(false, true, custom)).toBeCloseTo(-3)
  })
})

// ─── nextFlightState ──────────────────────────────────────────────────────────
describe('nextFlightState', () => {
  it('disables flight immediately when leaving creative mode, regardless of current state', () => {
    expect(nextFlightState(true, false, false)).toBe(false)
    expect(nextFlightState(true, false, true)).toBe(false)
  })

  it('keeps flight disabled in creative when toggle is not pressed', () => {
    expect(nextFlightState(false, true, false)).toBe(false)
  })

  it('enables flight in creative when toggle is pressed while disabled', () => {
    expect(nextFlightState(false, true, true)).toBe(true)
  })

  it('disables flight in creative when toggle is pressed while enabled', () => {
    expect(nextFlightState(true, true, true)).toBe(false)
  })

  it('stays enabled in creative without a toggle press', () => {
    expect(nextFlightState(true, true, false)).toBe(true)
  })

  it('returns false in survival even with toggle pressed (no-op)', () => {
    expect(nextFlightState(false, false, true)).toBe(false)
  })
})
