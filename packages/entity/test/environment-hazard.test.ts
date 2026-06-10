import { describe, it, expect } from 'vitest'
import {
  accrueHazardTicks,
  nextAirSecs,
  MAX_AIR_SECS,
  LAVA_DAMAGE_INTERVAL_SECS,
} from '@ts-minecraft/entity'

describe('accrueHazardTicks', () => {
  it('emits no tick until the interval elapses', () => {
    const r = accrueHazardTicks(0, 0.2, LAVA_DAMAGE_INTERVAL_SECS)
    expect(r.ticks).toBe(0)
    expect(r.acc).toBeCloseTo(0.2)
  })

  it('emits one tick exactly at the interval and carries the remainder', () => {
    const r = accrueHazardTicks(0.4, 0.2, LAVA_DAMAGE_INTERVAL_SECS) // 0.6 total, interval 0.5
    expect(r.ticks).toBe(1)
    expect(r.acc).toBeCloseTo(0.1)
  })

  it('emits multiple ticks for a large dt (low-fps frame), frame-rate independent', () => {
    const r = accrueHazardTicks(0, 1.6, LAVA_DAMAGE_INTERVAL_SECS) // 3.2 intervals
    expect(r.ticks).toBe(3)
    expect(r.acc).toBeCloseTo(0.1)
  })
})

describe('nextAirSecs', () => {
  it('refills instantly to MAX when the head is not submerged', () => {
    expect(nextAirSecs(2, false, 0.1)).toBe(MAX_AIR_SECS)
  })

  it('drains by dt while submerged', () => {
    expect(nextAirSecs(10, true, 0.5)).toBeCloseTo(9.5)
  })

  it('clamps at 0 (never negative)', () => {
    expect(nextAirSecs(0.1, true, 0.5)).toBe(0)
  })
})
