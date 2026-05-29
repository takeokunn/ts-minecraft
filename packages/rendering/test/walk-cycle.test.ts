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

    it('advancing time at fixed speed actually moves the angle (not constant)', () => {
      // Sample two times on the SAME monotonic rising quarter of the swing so the
      // angles genuinely differ. At speed 2 the sin argument is k·t with
      // k = 2π·2/STRIDE_LENGTH ≈ 10.47, so t=0.05 → arg≈0.52 (sin 0.5) and
      // t=0.1 → arg≈1.05 (sin 0.87). (t=0.1 vs t=0.2 would be a false choice:
      // their args sum to π, making sin — and thus the angle — identical.)
      const a = computeLimbAngle(2, 0.05, 'L', 'leg')
      const b = computeLimbAngle(2, 0.1, 'L', 'leg')
      expect(a).not.toBeCloseTo(b, 9)
    })

    it('puts leg-L and leg-R π out of phase (same magnitude, opposite sign)', () => {
      const left = computeLimbAngle(2, 1, 'L', 'leg')
      const right = computeLimbAngle(2, 1, 'R', 'leg')
      expect(left).toBeCloseTo(-right, 12)
    })

    it('puts arm and leg on the SAME side π out of phase (opposite sign)', () => {
      // arm-L phase = PI, leg-L phase = 0 -> sin differs by PI -> opposite sign.
      const armL = computeLimbAngle(2, 0.7, 'L', 'arm')
      const legL = computeLimbAngle(2, 0.7, 'L', 'leg')
      expect(armL).toBeCloseTo(-legL, 12)

      const armR = computeLimbAngle(2, 1.3, 'R', 'arm')
      const legR = computeLimbAngle(2, 1.3, 'R', 'leg')
      expect(armR).toBeCloseTo(-legR, 12)
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
