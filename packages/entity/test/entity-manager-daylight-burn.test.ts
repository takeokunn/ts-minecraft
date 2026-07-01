import { describe, expect, it } from 'vitest'
import {
  advanceDaylightBurnCadence,
  DAYTIME_BURN_INTERVAL_SECS,
} from '@ts-minecraft/entity/application/mob/entity-manager-daylight-burn'
import { DeltaTimeSecs } from '@ts-minecraft/core'

// ─── advanceDaylightBurnCadence ───────────────────────────────────────────────

const delta = (n: number) => DeltaTimeSecs.make(n)

describe('advanceDaylightBurnCadence', () => {
  it('returns [false, newAccum] when accumulator has not reached the interval', () => {
    const [shouldBurn, next] = advanceDaylightBurnCadence(0, delta(0.5))
    expect(shouldBurn).toBe(false)
    expect(next).toBeCloseTo(0.5)
  })

  it('returns [true, overflow] when accumulator crosses DAYTIME_BURN_INTERVAL_SECS', () => {
    const [shouldBurn, overflow] = advanceDaylightBurnCadence(0.9, delta(0.2))
    expect(shouldBurn).toBe(true)
    expect(overflow).toBeCloseTo(1.1 - DAYTIME_BURN_INTERVAL_SECS)
  })

  it('returns [true, ...] at exact threshold', () => {
    const [shouldBurn] = advanceDaylightBurnCadence(0, delta(DAYTIME_BURN_INTERVAL_SECS))
    expect(shouldBurn).toBe(true)
  })

  it('accumulates correctly over multiple sub-threshold calls', () => {
    // Use 0.25s steps: 4 × 0.25 = 1.0 (exact in float64)
    let accum = 0
    for (let i = 0; i < 3; i++) {
      const [burn, next] = advanceDaylightBurnCadence(accum, delta(0.25))
      expect(burn).toBe(false)
      accum = next
    }
    // After 3 × 0.25 = 0.75s, still below 1.0 → false
    expect(accum).toBeCloseTo(0.75)
    // 4th call: 0.75 + 0.25 = 1.0 → crosses threshold
    const [burn] = advanceDaylightBurnCadence(accum, delta(0.25))
    expect(burn).toBe(true)
  })

  it('overflow wraps the remainder back for next cycle', () => {
    const [, overflow] = advanceDaylightBurnCadence(0.95, delta(0.2))
    // next = 1.15, overflow = 1.15 - 1.0 = 0.15
    expect(overflow).toBeCloseTo(0.15)
  })
})
