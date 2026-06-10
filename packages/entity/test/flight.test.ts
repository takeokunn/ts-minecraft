import { describe, it, expect } from 'vitest'
import { MetersPerSec } from '@ts-minecraft/core'
import { computeFlightVerticalVelocity, nextFlightState, DEFAULT_FLY_VERTICAL_SPEED } from '@ts-minecraft/entity/domain/flight'

describe('computeFlightVerticalVelocity', () => {
  const s = MetersPerSec.toNumber(DEFAULT_FLY_VERTICAL_SPEED)

  it('ascends at +speed when only JUMP is held', () => {
    expect(computeFlightVerticalVelocity(true, false)).toBe(s)
  })

  it('descends at -speed when only SNEAK is held', () => {
    expect(computeFlightVerticalVelocity(false, true)).toBe(-s)
  })

  it('hovers (0) when neither key is held', () => {
    expect(computeFlightVerticalVelocity(false, false)).toBe(0)
  })

  it('hovers (0) when both keys are held (opposing inputs cancel)', () => {
    expect(computeFlightVerticalVelocity(true, true)).toBe(0)
  })

  it('honors a custom speed', () => {
    expect(computeFlightVerticalVelocity(true, false, MetersPerSec.make(3))).toBe(3)
  })
})

describe('nextFlightState', () => {
  it('toggles on when creative and the key is pressed', () => {
    expect(nextFlightState(false, true, true)).toBe(true)
  })

  it('toggles off again on a second creative press', () => {
    expect(nextFlightState(true, true, true)).toBe(false)
  })

  it('preserves state when creative but no key press', () => {
    expect(nextFlightState(true, true, false)).toBe(true)
    expect(nextFlightState(false, true, false)).toBe(false)
  })

  it('force-disables flight outside creative regardless of input', () => {
    expect(nextFlightState(true, false, true)).toBe(false)
    expect(nextFlightState(true, false, false)).toBe(false)
  })
})
