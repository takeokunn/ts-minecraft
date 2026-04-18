import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  LIMB_SWING_AMPLITUDE,
  WALK_DAMPING_SECONDS,
  computeLimbAngle,
  dampLimbAngle,
} from './walk-cycle'

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

  describe('dampLimbAngle', () => {
    it('returns current when target == current', () => {
      expect(dampLimbAngle(0.3, 0.3, 0.016)).toBeCloseTo(0.3, 12)
    })

    it('monotonically approaches the target across small steps', () => {
      const target = 1
      const dt = 0.016
      const finalValue = Arr.reduce(Arr.makeBy(200, (i) => i), 0, (prev, _) => {
        const next = dampLimbAngle(prev, target, dt)
        expect(next).toBeGreaterThanOrEqual(prev)
        expect(next).toBeLessThanOrEqual(target + APPROX)
        return next
      })
      expect(finalValue).toBeCloseTo(target, 3)
    })

    it('after one time-constant has covered ≈ (1 - 1/e) of the gap', () => {
      const start = 0
      const target = 1
      const after = dampLimbAngle(start, target, WALK_DAMPING_SECONDS)
      expect(after).toBeCloseTo(1 - Math.exp(-1), 12)
    })
  })
})
