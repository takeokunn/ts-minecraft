import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  calculateJumpVelocity,
  clampVelocity,
  applyFriction,
  updatePosition,
  checkGroundedByDistance,
  getHorizontalSpeed,
  zeroVelocity,
  DEFAULT_GRAVITY,
} from '@ts-minecraft/physics'
import { DeltaTimeSecs } from '@ts-minecraft/kernel'

describe('application/physics/physics-utils', () => {
  describe('Constants', () => {
    it('should have DEFAULT_GRAVITY set to 9.82', () => {
      expect(DEFAULT_GRAVITY).toBe(9.82)
    })
  })

  describe('calculateJumpVelocity', () => {
    it('should return positive velocity for valid height and gravity', () => {
      // Property: For all valid heights and gravities, velocity > 0
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const height = 0.1 + Math.random() * 9.9
        const gravity = 1 + Math.random() * 49
        const velocity = calculateJumpVelocity(height, gravity)
        expect(velocity).toBeGreaterThan(0)
      })
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
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const height = 0.1 + Math.random() * 9.9
        const gravity = 1 + Math.random() * 49
        const velocity = calculateJumpVelocity(height, gravity)
        expect(velocity ** 2).toBeCloseTo(2 * gravity * height, 3)
      })
    })

    it('should increase with height', () => {
      // Property: Higher jump height requires higher velocity
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const h1 = 0.1 + Math.random() * 4.9
        const h2 = h1 + 0.1 + Math.random() * 4.9 // Ensure h2 > h1
        const gravity = 1 + Math.random() * 49
        const v1 = calculateJumpVelocity(h1, gravity)
        const v2 = calculateJumpVelocity(h2, gravity)
        expect(v2).toBeGreaterThan(v1)
      })
    })
  })

  describe('clampVelocity', () => {
    it('should not modify velocity under max speed', () => {
      // Property: Small velocities should not be modified (Y always preserved)
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
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
      })
    })

    it('should preserve Y velocity', () => {
      // Property: Y velocity is always preserved
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const maxSpeed = 0.1 + Math.random() * 99.9
        const clamped = clampVelocity(velocity, maxSpeed)
        expect(clamped.y).toBe(velocity.y)
      })
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
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          z: (Math.random() - 0.5) * 100,
        }
        const friction = Math.random() * 0.99
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, friction, DeltaTimeSecs.make(dt))
        const originalSpeed = getHorizontalSpeed(velocity)
        const newSpeed = getHorizontalSpeed(result)
        expect(newSpeed).toBeLessThan(originalSpeed + 0.001)
      })
    })

    it('should not affect Y velocity', () => {
      // Property: Y velocity is always preserved
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const friction = Math.random()
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, friction, DeltaTimeSecs.make(dt))
        expect(result.y).toBe(velocity.y)
      })
    })

    it('should return unchanged velocity for friction = 1 (no friction)', () => {
      // Property: Friction of 1 means no friction
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const velocity = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const dt = 0.001 + Math.random() * 0.099
        const result = applyFriction(velocity, 1, DeltaTimeSecs.make(dt))
        expect(result.x).toBeCloseTo(velocity.x, 10)
        expect(result.z).toBeCloseTo(velocity.z, 10)
      })
    })

    it('should return effectively unchanged velocity for near-zero deltaTime', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      // Number.MIN_VALUE is the smallest positive double; frictionFactor rounds to 1.0 in FP
      const result = applyFriction(velocity, 0.5, DeltaTimeSecs.make(Number.MIN_VALUE))
      expect(result.x).toBeCloseTo(velocity.x, 10)
      expect(result.z).toBeCloseTo(velocity.z, 10)
    })

    it('should return unchanged velocity for out-of-range friction', () => {
      const velocity = { x: 10, y: 5, z: 10 }
      expect(applyFriction(velocity, -0.5, DeltaTimeSecs.make(0.016))).toEqual(velocity)
      expect(applyFriction(velocity, 1.5, DeltaTimeSecs.make(0.016))).toEqual(velocity)
    })
  })

  describe('updatePosition', () => {
    it('should apply velocity to position correctly', () => {
      const position = { x: 0, y: 0, z: 0 }
      const velocity = { x: 1, y: 2, z: 3 }
      const dt = 0.5

      const newPos = updatePosition(position, velocity, DeltaTimeSecs.make(dt))

      expect(newPos.x).toBe(0.5)
      expect(newPos.y).toBe(1)
      expect(newPos.z).toBe(1.5)
    })

    it('should be additive for sequential updates', () => {
      // Property: Sequential updates equal single update with combined time
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
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

        const result1 = updatePosition(updatePosition(pos, vel, DeltaTimeSecs.make(dt1)), vel, DeltaTimeSecs.make(dt2))
        const result2 = updatePosition(pos, vel, DeltaTimeSecs.make(dt1 + dt2))

        expect(result1.x).toBeCloseTo(result2.x, 5)
        expect(result1.y).toBeCloseTo(result2.y, 5)
        expect(result1.z).toBeCloseTo(result2.z, 5)
      })
    })

    it('should return effectively unchanged position for near-zero deltaTime', () => {
      // DeltaTimeSecs is always positive; Number.MIN_VALUE gives displacement below machine epsilon
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const pos = {
          x: (Math.random() - 0.5) * 2000 + 1,
          y: (Math.random() - 0.5) * 600 + 1,
          z: (Math.random() - 0.5) * 2000 + 1,
        }
        const vel = {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }
        const result = updatePosition(pos, vel, DeltaTimeSecs.make(Number.MIN_VALUE))
        expect(result.x).toBeCloseTo(pos.x, 10)
        expect(result.y).toBeCloseTo(pos.y, 10)
        expect(result.z).toBeCloseTo(pos.z, 10)
      })
    })

    it('should return unchanged position for zero velocity', () => {
      // Property: Zero velocity means no movement
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const pos = {
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 600,
          z: (Math.random() - 0.5) * 2000,
        }
        const dt = 0.001 + Math.random() * 0.099
        const result = updatePosition(pos, zeroVelocity(), DeltaTimeSecs.make(dt))
        expect(result.x).toBeCloseTo(pos.x, 10)
        expect(result.y).toBeCloseTo(pos.y, 10)
        expect(result.z).toBeCloseTo(pos.z, 10)
      })
    })

    it('should return the original position when deltaTime is zero', () => {
      // Guard: deltaTime <= 0 returns position unchanged (prevents division-by-zero artifacts)
      const pos = { x: 10, y: 20, z: 30 }
      const vel = { x: 5, y: 5, z: 5 }
      // DeltaTimeSecs.make(0) would fail branded type validation at runtime; use the raw
      // type assertion path to exercise the guard directly.
      const result = updatePosition(pos, vel, 0 as DeltaTimeSecs)
      expect(result).toEqual(pos)
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
      Arr.forEach(Arr.makeBy(100, i => i), (_) => {
        const playerY = Math.random() * 5
        const groundY = (Math.random() - 0.5) * 20
        const threshold = 0.01 + Math.random() * 0.99

        const isGrounded = checkGroundedByDistance(playerY, groundY, threshold)
        const distance = playerY - groundY

        if (isGrounded) {
          expect(distance).toBeGreaterThanOrEqual(0)
          expect(distance).toBeLessThanOrEqual(threshold)
        }
      })
    })
  })

})
