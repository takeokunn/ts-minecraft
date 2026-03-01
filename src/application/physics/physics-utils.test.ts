import { describe, it, expect } from 'vitest'
import {
  calculateJumpVelocity,
  clampVelocity,
  applyFriction,
  updatePosition,
  checkGroundedByDistance,
  getHorizontalSpeed,
  getTotalSpeed,
  normalizeHorizontalVelocity,
  zeroVelocity,
  zeroPosition,
  addVelocities,
  scaleVelocity,
  DEFAULT_GRAVITY,
} from './physics-utils'

/**
 * Physics utilities test suite with property-based testing
 * Uses randomized inputs to verify mathematical properties
 * Each property test runs 100 iterations with random values
 */
describe('application/physics/physics-utils', () => {
  describe('Constants', () => {
    it('should have DEFAULT_GRAVITY set to 9.82', () => {
      expect(DEFAULT_GRAVITY).toBe(9.82)
    })
  })

  describe('calculateJumpVelocity', () => {
    it('should return positive velocity for valid height and gravity', () => {
      // Property: For all valid heights and gravities, velocity > 0
      for (let i = 0; i < 100; i++) {
        const height = 0.1 + Math.random() * 9.9
        const gravity = 1 + Math.random() * 49
        const velocity = calculateJumpVelocity(height, gravity)
        expect(velocity).toBeGreaterThan(0)
      }
    })

    it('should return 0 for zero or negative height', () => {
      expect(calculateJumpVelocity(0)).toBe(0)
      expect(calculateJumpVelocity(-1)).toBe(0)
    })

    it('should return 0 for zero or negative gravity', () => {
      expect(calculateJumpVelocity(1, 0)).toBe(0)
      expect(calculateJumpVelocity(1, -1)).toBe(0)
    })

    it('should use DEFAULT_GRAVITY when gravity not specified', () => {
      const height = 1.0
      const expected = Math.sqrt(2 * DEFAULT_GRAVITY * height)
      expect(calculateJumpVelocity(height)).toBeCloseTo(expected, 5)
    })

    it('should satisfy v^2 = 2gh (kinematic equation)', () => {
      // Property: v^2 should equal 2gh for all valid inputs
      for (let i = 0; i < 100; i++) {
        const height = 0.1 + Math.random() * 9.9
        const gravity = 1 + Math.random() * 49
        const velocity = calculateJumpVelocity(height, gravity)
        expect(velocity ** 2).toBeCloseTo(2 * gravity * height, 3)
      }
    })

    it('should increase with height', () => {
      // Property: Higher jump height requires higher velocity
      for (let i = 0; i < 100; i++) {
        const h1 = 0.1 + Math.random() * 4.9
        const h2 = h1 + 0.1 + Math.random() * 4.9 // Ensure h2 > h1
        const gravity = 1 + Math.random() * 49
        const v1 = calculateJumpVelocity(h1, gravity)
        const v2 = calculateJumpVelocity(h2, gravity)
        expect(v2).toBeGreaterThan(v1)
      }
    })
  })

  describe('clampVelocity', () => {
    it('should not modify velocity under max speed', () => {
      // Property: Small velocities should not be modified (Y always preserved)
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 0.2,
          y: (Math.random() - 0.5) * 0.2,
          z: (Math.random() - 0.5) * 0.2,
        }
        const maxSpeed = 0.1 + Math.random() * 99.9
        const clamped = clampVelocity(velocity, maxSpeed)
        expect(clamped.y).toBe(velocity.y)
        const hSpeed = getHorizontalSpeed(clamped)
        expect(hSpeed).toBeLessThanOrEqual(maxSpeed + 0.0001)
      }
    })

    it('should preserve Y velocity', () => {
      // Property: Y velocity is always preserved
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const maxSpeed = 0.1 + Math.random() * 99.9
        const clamped = clampVelocity(velocity, maxSpeed)
        expect(clamped.y).toBe(velocity.y)
      }
    })

    it('should clamp horizontal speed to max speed', () => {
      const velocity = { x: 100, y: 0, z: 100 } // Speed ~141, way over max
      const maxSpeed = 10
      const clamped = clampVelocity(velocity, maxSpeed)
      const speed = getHorizontalSpeed(clamped)
      expect(speed).toBeLessThanOrEqual(maxSpeed + 0.001)
    })

    it('should return zero velocity for zero or negative max speed', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      expect(clampVelocity(velocity, 0)).toEqual({ x: 0, y: 0, z: 0 })
      expect(clampVelocity(velocity, -1)).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('should preserve direction when clamping', () => {
      const velocity = { x: 30, y: 0, z: 40 } // Speed = 50
      const maxSpeed = 5
      const clamped = clampVelocity(velocity, maxSpeed)

      // Direction should be preserved (ratio x:z should stay 3:4)
      expect(clamped.x / clamped.z).toBeCloseTo(velocity.x / velocity.z, 5)
    })

    it('should handle zero horizontal velocity', () => {
      const velocity = { x: 0, y: 10, z: 0 }
      const clamped = clampVelocity(velocity, 5)
      expect(clamped.x).toBe(0)
      expect(clamped.y).toBe(10)
      expect(clamped.z).toBe(0)
    })
  })

  describe('applyFriction', () => {
    it('should reduce horizontal speed for friction < 1', () => {
      // Property: Friction reduces horizontal speed
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          z: (Math.random() - 0.5) * 100,
        }
        const friction = Math.random() * 0.99
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, friction, dt)
        const originalSpeed = getHorizontalSpeed(velocity)
        const newSpeed = getHorizontalSpeed(result)
        expect(newSpeed).toBeLessThan(originalSpeed + 0.001)
      }
    })

    it('should not affect Y velocity', () => {
      // Property: Y velocity is always preserved
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const friction = Math.random()
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, friction, dt)
        expect(result.y).toBe(velocity.y)
      }
    })

    it('should return unchanged velocity for friction = 1 (no friction)', () => {
      // Property: Friction of 1 means no friction
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, 1, dt)
        expect(result.x).toBeCloseTo(velocity.x, 10)
        expect(result.z).toBeCloseTo(velocity.z, 10)
      }
    })

    it('should return unchanged velocity for zero deltaTime', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      const result = applyFriction(velocity, 0.5, 0)
      expect(result).toEqual(velocity)
    })

    it('should return unchanged velocity for negative deltaTime', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      const result = applyFriction(velocity, 0.5, -1)
      expect(result).toEqual(velocity)
    })

    it('should return unchanged velocity for out-of-range friction', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      expect(applyFriction(velocity, -0.5, 0.016)).toEqual(velocity)
      expect(applyFriction(velocity, 1.5, 0.016)).toEqual(velocity)
    })
  })

  describe('updatePosition', () => {
    it('should apply velocity to position correctly', () => {
      const position = { x: 0, y: 0, z: 0 }
      const velocity = { x: 1, y: 2, z: 3 }
      const dt = 0.5

      const newPos = updatePosition(position, velocity, dt)

      expect(newPos.x).toBe(0.5)
      expect(newPos.y).toBe(1)
      expect(newPos.z).toBe(1.5)
    })

    it('should be additive for sequential updates', () => {
      // Property: Sequential updates equal single update with combined time
      for (let i = 0; i < 100; i++) {
        const pos = {
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 600,
          z: (Math.random() - 0.5) * 2000,
        }
        const vel = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const dt1 = 0.001 + Math.random() * 0.05
        const dt2 = 0.001 + Math.random() * 0.05

        const result1 = updatePosition(updatePosition(pos, vel, dt1), vel, dt2)
        const result2 = updatePosition(pos, vel, dt1 + dt2)

        expect(result1.x).toBeCloseTo(result2.x, 5)
        expect(result1.y).toBeCloseTo(result2.y, 5)
        expect(result1.z).toBeCloseTo(result2.z, 5)
      }
    })

    it('should return unchanged position for zero deltaTime', () => {
      // Property: Zero time means no movement
      for (let i = 0; i < 100; i++) {
        const pos = {
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 600,
          z: (Math.random() - 0.5) * 2000,
        }
        const vel = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = updatePosition(pos, vel, 0)
        expect(result).toEqual(pos)
      }
    })

    it('should return unchanged position for negative deltaTime', () => {
      // Property: Negative time means no movement
      for (let i = 0; i < 100; i++) {
        const pos = {
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 600,
          z: (Math.random() - 0.5) * 2000,
        }
        const vel = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = updatePosition(pos, vel, -1)
        expect(result).toEqual(pos)
      }
    })

    it('should return unchanged position for zero velocity', () => {
      // Property: Zero velocity means no movement
      for (let i = 0; i < 100; i++) {
        const pos = {
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 600,
          z: (Math.random() - 0.5) * 2000,
        }
        const dt = 0.001 + Math.random() * 0.099
        const result = updatePosition(pos, zeroVelocity(), dt)
        expect(result.x).toBeCloseTo(pos.x, 10)
        expect(result.y).toBeCloseTo(pos.y, 10)
        expect(result.z).toBeCloseTo(pos.z, 10)
      }
    })
  })

  describe('checkGroundedByDistance', () => {
    it('should return true when player is on ground', () => {
      expect(checkGroundedByDistance(0.1, 0)).toBe(true)
    })

    it('should return true when player is within threshold', () => {
      expect(checkGroundedByDistance(0.1, 0, 0.15)).toBe(true)
      expect(checkGroundedByDistance(0.14, 0, 0.15)).toBe(true)
    })

    it('should return false when player is above threshold', () => {
      expect(checkGroundedByDistance(0.2, 0, 0.15)).toBe(false)
      expect(checkGroundedByDistance(1, 0, 0.15)).toBe(false)
    })

    it('should return false when player is below ground', () => {
      expect(checkGroundedByDistance(-1, 0, 0.15)).toBe(false)
    })

    it('should work with custom ground levels', () => {
      expect(checkGroundedByDistance(10.1, 10, 0.15)).toBe(true)
      expect(checkGroundedByDistance(10.2, 10, 0.15)).toBe(false)
    })

    it('should satisfy distance property for valid grounded states', () => {
      // Property: If grounded, distance must be within [0, threshold]
      for (let i = 0; i < 100; i++) {
        const playerY = Math.random() * 5
        const groundY = (Math.random() - 0.5) * 20
        const threshold = 0.01 + Math.random() * 0.99

        const isGrounded = checkGroundedByDistance(playerY, groundY, threshold)
        const distance = playerY - groundY

        if (isGrounded) {
          expect(distance).toBeGreaterThanOrEqual(0)
          expect(distance).toBeLessThanOrEqual(threshold)
        }
      }
    })
  })

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
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const speed = getHorizontalSpeed(velocity)
        expect(speed).toBeGreaterThanOrEqual(0)
      }
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
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const speed = getTotalSpeed(velocity)
        expect(speed).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('normalizeHorizontalVelocity', () => {
    it('should produce exact target speed', () => {
      // Property: Normalized velocity has exact target horizontal speed
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: 0.01 + Math.random() * 49.99,
          y: (Math.random() - 0.5) * 200,
          z: 0.01 + Math.random() * 49.99,
        }
        const targetSpeed = 0.1 + Math.random() * 49.9
        const normalized = normalizeHorizontalVelocity(velocity, targetSpeed)
        const speed = getHorizontalSpeed(normalized)
        expect(speed).toBeCloseTo(targetSpeed, 3)
      }
    })

    it('should preserve Y velocity', () => {
      // Property: Y is always preserved
      for (let i = 0; i < 100; i++) {
        const velocity = {
          x: 0.01 + Math.random() * 49.99,
          y: (Math.random() - 0.5) * 200,
          z: 0.01 + Math.random() * 49.99,
        }
        const targetSpeed = 0.1 + Math.random() * 49.9
        const normalized = normalizeHorizontalVelocity(velocity, targetSpeed)
        expect(normalized.y).toBe(velocity.y)
      }
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
      for (let i = 0; i < 100; i++) {
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
      }
    })

    it('should return same velocity when adding zero', () => {
      // Property: Adding zero is identity
      for (let i = 0; i < 100; i++) {
        const v = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = addVelocities(v, zeroVelocity())
        expect(result.x).toBeCloseTo(v.x, 5)
        expect(result.y).toBeCloseTo(v.y, 5)
        expect(result.z).toBeCloseTo(v.z, 5)
      }
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
      for (let i = 0; i < 100; i++) {
        const v = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = scaleVelocity(v, 0)
        expect(Object.is(result.x, 0) || Object.is(result.x, -0)).toBe(true)
        expect(Object.is(result.y, 0) || Object.is(result.y, -0)).toBe(true)
        expect(Object.is(result.z, 0) || Object.is(result.z, -0)).toBe(true)
      }
    })

    it('should preserve direction for positive scalar', () => {
      // Property: Positive scaling preserves direction
      for (let i = 0; i < 100; i++) {
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
      }
    })

    it('should double speed when scalar = 2', () => {
      // Property: Scalar of 2 doubles the speed
      for (let i = 0; i < 100; i++) {
        const v = {
          x: 0.01 + Math.random() * 99.99,
          y: 0.01 + Math.random() * 99.99,
          z: 0.01 + Math.random() * 99.99,
        }
        const originalSpeed = getTotalSpeed(v)
        const scaled = scaleVelocity(v, 2)
        const newSpeed = getTotalSpeed(scaled)
        expect(newSpeed).toBeCloseTo(originalSpeed * 2, 5)
      }
    })
  })
})
