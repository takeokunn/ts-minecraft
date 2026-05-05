import { describe, it, expect } from 'vitest'
import {
  LIMB_SWING_AMPLITUDE,
  computeLimbAngle,
} from '@ts-minecraft/rendering'

const APPROX = 1e-9

describe('walk-cycle', () => {
  describe('computeLimbAngle', () => {
    it('returns 0 when speed is below the threshold', () => {
      expect(computeLimbAngle(0, 1, 'L', 'leg')).toBe(0)
      expect(computeLimbAngle(0.04, 5.5, 'R', 'arm')).toBe(0)
    })

    it('returns a non-zero swing when speed is above threshold (and bounded by amplitude)', () => {
      const a = computeLimbAngle(2, 0.3, 'L', 'leg')
      expect(Math.abs(a)).toBeGreaterThan(0)
      expect(Math.abs(a)).toBeLessThanOrEqual(LIMB_SWING_AMPLITUDE + APPROX)
    })

    it('puts leg-L and leg-R π out of phase (same magnitude, opposite sign)', () => {
      const left = computeLimbAngle(2, 1, 'L', 'leg')
      const right = computeLimbAngle(2, 1, 'R', 'leg')
      expect(left).toBeCloseTo(-right, 12)
    })

    it('puts arm-L in phase with leg-R (same value)', () => {
      const armL = computeLimbAngle(2, 0.7, 'L', 'arm')
      const legR = computeLimbAngle(2, 0.7, 'R', 'leg')
      expect(armL).toBeCloseTo(legR, 12)
    })

    it('puts arm-R in phase with leg-L (same value)', () => {
      const armR = computeLimbAngle(2, 0.7, 'R', 'arm')
      const legL = computeLimbAngle(2, 0.7, 'L', 'leg')
      expect(armR).toBeCloseTo(legL, 12)
    })
  })

})
