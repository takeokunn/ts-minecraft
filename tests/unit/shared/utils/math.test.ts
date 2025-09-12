import { describe, it, expect } from 'vitest'
import {
  clamp,
  lerp,
  distance2D,
  distance3D,
  normalizeAngle,
  degreesToRadians,
  radiansToDegrees,
  isPowerOfTwo,
  nextPowerOfTwo
} from '@shared/utils/math'

describe('math utilities', () => {
  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(0, 0, 10)).toBe(0)
      expect(clamp(10, 0, 10)).toBe(10)
    })

    it('should clamp values below minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(-100, -50, 50)).toBe(-50)
    })

    it('should clamp values above maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10)
      expect(clamp(100, -50, 50)).toBe(50)
    })
  })

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5)
      expect(lerp(0, 10, 0)).toBe(0)
      expect(lerp(0, 10, 1)).toBe(10)
    })

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0)
      expect(lerp(-5, -2, 0.5)).toBe(-3.5)
    })
  })

  describe('distance2D', () => {
    it('should calculate distance between 2D points', () => {
      expect(distance2D(0, 0, 3, 4)).toBe(5) // 3-4-5 triangle
      expect(distance2D(0, 0, 0, 0)).toBe(0)
    })

    it('should be symmetric', () => {
      expect(distance2D(1, 2, 5, 7)).toBe(distance2D(5, 7, 1, 2))
    })
  })

  describe('distance3D', () => {
    it('should calculate distance between 3D points', () => {
      expect(distance3D(0, 0, 0, 3, 4, 0)).toBe(5) // 3-4-5 triangle in XY plane
      expect(distance3D(0, 0, 0, 0, 0, 0)).toBe(0)
    })

    it('should be symmetric', () => {
      expect(distance3D(1, 2, 3, 7, 8, 9)).toBe(distance3D(7, 8, 9, 1, 2, 3))
    })
  })

  describe('normalizeAngle', () => {
    it('should normalize angles to [0, 2π) range', () => {
      expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 10)
      expect(normalizeAngle(0)).toBe(0)
      expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 10)
    })

    it('should handle negative angles', () => {
      expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 10)
      expect(normalizeAngle(-Math.PI/2)).toBeCloseTo(3 * Math.PI / 2, 10)
    })
  })

  describe('degreesToRadians', () => {
    it('should convert common degree values', () => {
      expect(degreesToRadians(0)).toBe(0)
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10)
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10)
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10)
    })
  })

  describe('radiansToDegrees', () => {
    it('should convert common radian values', () => {
      expect(radiansToDegrees(0)).toBe(0)
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10)
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10)
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10)
    })

    it('should be inverse of degreesToRadians', () => {
      const testValues = [0, 30, 45, 90, 180, 270, 360]
      for (const degrees of testValues) {
        const radians = degreesToRadians(degrees)
        const backToDegrees = radiansToDegrees(radians)
        expect(backToDegrees).toBeCloseTo(degrees, 10)
      }
    })
  })

  describe('isPowerOfTwo', () => {
    it('should identify powers of two', () => {
      expect(isPowerOfTwo(1)).toBe(true)   // 2^0
      expect(isPowerOfTwo(2)).toBe(true)   // 2^1
      expect(isPowerOfTwo(4)).toBe(true)   // 2^2
      expect(isPowerOfTwo(8)).toBe(true)   // 2^3
      expect(isPowerOfTwo(16)).toBe(true)  // 2^4
      expect(isPowerOfTwo(1024)).toBe(true) // 2^10
    })

    it('should reject non-powers of two', () => {
      expect(isPowerOfTwo(0)).toBe(false)
      expect(isPowerOfTwo(3)).toBe(false)
      expect(isPowerOfTwo(5)).toBe(false)
      expect(isPowerOfTwo(100)).toBe(false)
    })

    it('should reject negative numbers', () => {
      expect(isPowerOfTwo(-1)).toBe(false)
      expect(isPowerOfTwo(-2)).toBe(false)
    })
  })

  describe('nextPowerOfTwo', () => {
    it('should return same value for powers of two', () => {
      expect(nextPowerOfTwo(1)).toBe(1)
      expect(nextPowerOfTwo(2)).toBe(2)
      expect(nextPowerOfTwo(4)).toBe(4)
      expect(nextPowerOfTwo(16)).toBe(16)
    })

    it('should find next power of two for non-powers', () => {
      expect(nextPowerOfTwo(3)).toBe(4)
      expect(nextPowerOfTwo(5)).toBe(8)
      expect(nextPowerOfTwo(9)).toBe(16)
      expect(nextPowerOfTwo(100)).toBe(128)
    })

    it('should handle edge cases', () => {
      expect(nextPowerOfTwo(0)).toBe(1)
    })

    it('should be consistent with isPowerOfTwo', () => {
      const testValues = [3, 5, 7, 9, 15, 17, 100]
      for (const value of testValues) {
        const nextPower = nextPowerOfTwo(value)
        expect(isPowerOfTwo(nextPower)).toBe(true)
        expect(nextPower).toBeGreaterThanOrEqual(value)
      }
    })
  })
})