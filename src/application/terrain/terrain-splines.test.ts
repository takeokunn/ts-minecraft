import { describe, it, expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { evaluateSpline } from '@/domain/spline'
import {
  OFFSET_SPLINE,
  FACTOR_SPLINE,
  PV_OFFSET,
  JAGGED_AMP,
} from './terrain-splines'

describe('application/terrain/terrain-splines', () => {
  it('OFFSET_SPLINE at C=-0.5 returns ~40 (ocean band); at C=0.8 returns ~128 (plateau band, +/-5 OK)', () => {
    const ocean = evaluateSpline(OFFSET_SPLINE, -0.5)
    const plateau = evaluateSpline(OFFSET_SPLINE, 0.8)
    expect(Math.abs(ocean - 40)).toBeLessThanOrEqual(5)
    expect(Math.abs(plateau - 128)).toBeLessThanOrEqual(5)
  })

  it('FACTOR_SPLINE at E=-0.8 returns > 1.0 (jagged); at E=0.8 returns < 0.3 (eroded)', () => {
    expect(evaluateSpline(FACTOR_SPLINE, -0.8)).toBeGreaterThan(1.0)
    expect(evaluateSpline(FACTOR_SPLINE, 0.8)).toBeLessThan(0.3)
  })

  it('JAGGED_AMP at E>=0 returns exactly 0 (amplitude suppressed)', () => {
    Arr.forEach([0.0, 0.1, 0.25, 0.5, 0.75, 1.0] as const, (e) => {
      expect(evaluateSpline(JAGGED_AMP, e)).toBe(0)
    })
  })

  it('PV_OFFSET monotonic-increasing from low to high input', () => {
    const samples = Arr.map([-1, -0.6, -0.2, 0.2, 0.6, 1] as const, (pv) => evaluateSpline(PV_OFFSET, pv))
    Arr.reduce(Arr.drop(samples, 1), Option.getOrThrow(Arr.get(samples, 0)), (prev, cur) => {
      expect(cur).toBeGreaterThanOrEqual(prev)
      return cur
    })
    expect(Option.getOrThrow(Arr.last(samples))).toBeGreaterThan(Option.getOrThrow(Arr.get(samples, 0)))
  })
})
