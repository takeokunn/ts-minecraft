import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import {
  MovementService,
  MovementServiceLive,
  type MovementInput,
  DEFAULT_WALK_SPEED,
  DEFAULT_SPRINT_SPEED,
  DEFAULT_JUMP_VELOCITY,
} from '@ts-minecraft/player'
import { createTestInputService, createTestLayers } from './movement-service-test-utils'

describe('MovementService', () => {
  describe('calculateVelocity', () => {
    const zeroYaw = 0
    const isGrounded = true

    it.effect('should return zero velocity when no input is provided', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      const input: MovementInput = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
      }
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.calculateVelocity(input, zeroYaw, isGrounded)
        expect(velocity.x).toBe(0)
        expect(velocity.y).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    describe('forward movement (W key)', () => {
      it.effect('should move in negative Z direction when facing forward (yaw=0)', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          // At yaw=0: sin(0)=0, cos(0)=1
          // Forward: x -= 0, z -= 1 => z = -walkSpeed
          expect(velocity.x).toBeCloseTo(0)
          expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
          expect(velocity.y).toBe(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should move in correct direction when facing right (yaw=PI/2)', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, Math.PI / 2, isGrounded)
          // At yaw=PI/2: sin(PI/2)=1, cos(PI/2)=0
          // Forward: x -= 1, z -= 0 => x = -walkSpeed
          expect(velocity.x).toBeCloseTo(-DEFAULT_WALK_SPEED)
          expect(velocity.z).toBeCloseTo(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('backward movement (S key)', () => {
      it.effect('should move in positive Z direction when facing forward (yaw=0)', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: true,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          // At yaw=0: sin(0)=0, cos(0)=1
          // Backward: x += 0, z += 1 => z = walkSpeed
          expect(velocity.x).toBeCloseTo(0)
          expect(velocity.z).toBeCloseTo(DEFAULT_WALK_SPEED)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('left movement (A key)', () => {
      it.effect('should strafe left when facing forward (yaw=0)', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: false,
          left: true,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          // At yaw=0: cos(0)=1, sin(0)=0
          // Left: x -= 1, z += 0 => x = -walkSpeed
          expect(velocity.x).toBeCloseTo(-DEFAULT_WALK_SPEED)
          expect(velocity.z).toBeCloseTo(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('right movement (D key)', () => {
      it.effect('should strafe right when facing forward (yaw=0)', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: false,
          left: false,
          right: true,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          // At yaw=0: cos(0)=1, sin(0)=0
          // Right: x += 1, z -= 0 => x = walkSpeed
          expect(velocity.x).toBeCloseTo(DEFAULT_WALK_SPEED)
          expect(velocity.z).toBeCloseTo(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('diagonal movement normalization', () => {
      it.effect('should normalize diagonal movement to prevent faster speeds', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: true,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          // The magnitude should equal walk speed, not sqrt(2) * walk speed
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should normalize forward+right diagonal movement', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: true,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should normalize backward+left diagonal movement', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: true,
          left: true,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('sprint speed modifier', () => {
      it.effect('should apply sprint speed when sprint is true', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: true,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_SPRINT_SPEED)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should use walk speed when sprint is false', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, isGrounded)
          expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_WALK_SPEED)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })

    describe('jump mechanics', () => {
      it.effect('should return positive Y velocity when jump is pressed and grounded', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: true,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, true)
          expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should return zero Y velocity when jump is pressed but not grounded', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: true,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, false)
          expect(velocity.y).toBe(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should return zero Y velocity when grounded but jump not pressed', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, 0, true)
          expect(velocity.y).toBe(0)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })
  })
})
