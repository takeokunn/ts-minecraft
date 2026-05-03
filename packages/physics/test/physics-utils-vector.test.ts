import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  getHorizontalSpeed,
  getTotalSpeed,
  normalizeHorizontalVelocity,
  zeroVelocity,
  zeroPosition,
  addVelocities,
  scaleVelocity,
} from '@ts-minecraft/physics'

describe('application/physics/physics-utils', () => {
  describe('getHorizontalSpeed', () => {
    it('should return 0 for zero velocity', () => {
      expect(getHorizontalSpeed(zeroVelocity())).toBe(0)
    })

    it('should ignore Y component', () => {
      expect(getHorizontalSpeed({ x: 0, y: 100, z: 0 })).toBe(0)
    })

    it('should calculate correct speed for simple cases', () => {
      expect(getHorizontalSpeed({ x: 3, y: 0, z: 4 })).toBe(5)
      expect(getHorizontalSpeed({ x: 1, y: 0, z: 0 })).toBe(1)
    })

    it('should always return non-negative', () => {
      // Property: Speed is always non-negative
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const speed = getHorizontalSpeed(velocity)
        expect(speed).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('getTotalSpeed', () => {
    it('should return 0 for zero velocity', () => {
      expect(getTotalSpeed(zeroVelocity())).toBe(0)
    })

    it('should include Y component', () => {
      expect(getTotalSpeed({ x: 0, y: 3, z: 4 })).toBe(5)
    })

    it('should calculate correct 3D speed', () => {
      expect(getTotalSpeed({ x: 1, y: 2, z: 2 })).toBeCloseTo(3, 5)
    })

    it('should always return non-negative', () => {
      // Property: Speed is always non-negative
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const speed = getTotalSpeed(velocity)
        expect(speed).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('normalizeHorizontalVelocity', () => {
    it('should produce exact target speed', () => {
      // Property: Normalized velocity has exact target horizontal speed
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: 0.01 + Math.random() * 49.99,
          y: (Math.random() - 0.5) * 200,
          z: 0.01 + Math.random() * 49.99,
        }
        const targetSpeed = 0.1 + Math.random() * 49.9
        const normalized = normalizeHorizontalVelocity(velocity, targetSpeed)
        const speed = getHorizontalSpeed(normalized)
        expect(speed).toBeCloseTo(targetSpeed, 3)
      })
    })

    it('should preserve Y velocity', () => {
      // Property: Y is always preserved
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: 0.01 + Math.random() * 49.99,
          y: (Math.random() - 0.5) * 200,
          z: 0.01 + Math.random() * 49.99,
        }
        const targetSpeed = 0.1 + Math.random() * 49.9
        const normalized = normalizeHorizontalVelocity(velocity, targetSpeed)
        expect(normalized.y).toBe(velocity.y)
      })
    })

    it('should preserve direction', () => {
      const velocity = { x: 3, y: 0, z: 4 }
      const normalized = normalizeHorizontalVelocity(velocity, 10)

      // Direction ratio should be preserved
      expect(normalized.x / normalized.z).toBeCloseTo(3 / 4, 5)
    })

    it('should return zero velocity for zero target speed', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      const result = normalizeHorizontalVelocity(velocity, 0)
      expect(result.x).toBe(0)
      expect(result.z).toBe(0)
      expect(result.y).toBe(5) // Y preserved
    })

    it('should return zero horizontal velocity for zero input velocity', () => {
      const velocity = { x: 0, y: 5, z: 0 }
      const result = normalizeHorizontalVelocity(velocity, 10)
      expect(result.x).toBe(0)
      expect(result.z).toBe(0)
    })
  })

  describe('zeroVelocity', () => {
    it('should return zero velocity', () => {
      const v = zeroVelocity()
      expect(v.x).toBe(0)
      expect(v.y).toBe(0)
      expect(v.z).toBe(0)
    })
  })

  describe('zeroPosition', () => {
    it('should return zero position', () => {
      const p = zeroPosition()
      expect(p.x).toBe(0)
      expect(p.y).toBe(0)
      expect(p.z).toBe(0)
    })
  })

  describe('addVelocities', () => {
    it('should add components correctly', () => {
      const a = { x: 1, y: 2, z: 3 }
      const b = { x: 4, y: 5, z: 6 }
      const result = addVelocities(a, b)

      expect(result.x).toBe(5)
      expect(result.y).toBe(7)
      expect(result.z).toBe(9)
    })

    it('should be commutative', () => {
      // Property: Addition is commutative
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const a = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const b = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const ab = addVelocities(a, b)
        const ba = addVelocities(b, a)

        expect(ab.x).toBeCloseTo(ba.x, 5)
        expect(ab.y).toBeCloseTo(ba.y, 5)
        expect(ab.z).toBeCloseTo(ba.z, 5)
      })
    })

    it('should return same velocity when adding zero', () => {
      // Property: Adding zero is identity
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const v = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = addVelocities(v, zeroVelocity())
        expect(result.x).toBeCloseTo(v.x, 5)
        expect(result.y).toBeCloseTo(v.y, 5)
        expect(result.z).toBeCloseTo(v.z, 5)
      })
    })
  })

  describe('scaleVelocity', () => {
    it('should scale all components by scalar', () => {
      const v = { x: 1, y: 2, z: 3 }
      const result = scaleVelocity(v, 2)

      expect(result.x).toBe(2)
      expect(result.y).toBe(4)
      expect(result.z).toBe(6)
    })

    it('should return zero for scalar = 0', () => {
      // Property: Zero scale = zero velocity
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const v = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = scaleVelocity(v, 0)
        expect(Object.is(result.x, 0) || Object.is(result.x, -0)).toBe(true)
        expect(Object.is(result.y, 0) || Object.is(result.y, -0)).toBe(true)
        expect(Object.is(result.z, 0) || Object.is(result.z, -0)).toBe(true)
      })
    })

    it('should preserve direction for positive scalar', () => {
      // Property: Positive scaling preserves direction
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const v = {
          x: 0.01 + Math.random() * 99.99,
          y: 0.01 + Math.random() * 99.99,
          z: 0.01 + Math.random() * 99.99,
        }
        const scalar = 0.1 + Math.random() * 9.9
        const scaled = scaleVelocity(v, scalar)

        // Direction ratios should be preserved
        if (v.x !== 0 && v.z !== 0) {
          expect(scaled.x / scaled.z).toBeCloseTo(v.x / v.z, 5)
        }
        if (v.y !== 0 && v.z !== 0) {
          expect(scaled.y / scaled.z).toBeCloseTo(v.y / v.z, 5)
        }
      })
    })

    it('should double speed when scalar = 2', () => {
      // Property: Scalar of 2 doubles the speed
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const v = {
          x: 0.01 + Math.random() * 99.99,
          y: 0.01 + Math.random() * 99.99,
          z: 0.01 + Math.random() * 99.99,
        }
        const originalSpeed = getTotalSpeed(v)
        const scaled = scaleVelocity(v, 2)
        const newSpeed = getTotalSpeed(scaled)
        expect(newSpeed).toBeCloseTo(originalSpeed * 2, 5)
      })
    })
  })
})
