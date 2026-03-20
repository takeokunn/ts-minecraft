import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Effect, Layer } from 'effect'
import { PlayerInputService } from '@/application/input/player-input-service'
import type { InputServicePort as InputServiceType } from '@/application/input'
import {
  MovementService,
  MovementServiceLive,
  type MovementInput,
  DEFAULT_WALK_SPEED,
  DEFAULT_SPRINT_SPEED,
  DEFAULT_JUMP_VELOCITY,
} from './movement-service'

/**
 * Test implementation of InputService with controllable key state
 */
const createTestInputService = (
  initialState: Partial<MovementInput> = {}
): InputServiceType & { setKeyPressed: (key: string, pressed: boolean) => void } => {
  const pressedKeys = new Map<string, boolean>([
    ['KeyW', initialState.forward ?? false],
    ['KeyS', initialState.backward ?? false],
    ['KeyA', initialState.left ?? false],
    ['KeyD', initialState.right ?? false],
    ['Space', initialState.jump ?? false],
    ['ControlLeft', initialState.sprint ?? false],
  ])
  // For consumeKeyPress, track "just pressed" keys
  // In tests, jump=true means Space was just pressed
  const justPressedKeys = new Set<string>()
  if (initialState.jump) {
    justPressedKeys.add('Space')
  }

  return {
    isKeyPressed: (key: string) => Effect.sync(() => pressedKeys.get(key) ?? false),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (justPressedKeys.has(key)) {
          justPressedKeys.delete(key)
          return true
        }
        return false
      }),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => true),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
    setKeyPressed: (key: string, pressed: boolean) => {
      pressedKeys.set(key, pressed)
    },
  } as unknown as InputServiceType & { setKeyPressed: (key: string, pressed: boolean) => void }
}

/**
 * Helper to create test layers with mock PlayerInputService
 */
const createTestLayers = (inputService: InputServiceType) =>
  Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)

describe('MovementService', () => {
  describe('constants', () => {
    it('should have default walk speed of 8.0 m/s', () => {
      expect(DEFAULT_WALK_SPEED).toBe(8.0)
    })

    it('should have default sprint speed of 14.0 m/s', () => {
      expect(DEFAULT_SPRINT_SPEED).toBe(14.0)
    })

    it('should have default jump velocity of 5.0 m/s', () => {
      expect(DEFAULT_JUMP_VELOCITY).toBe(5.0)
    })

    it('sprint speed should be greater than walk speed', () => {
      expect(DEFAULT_SPRINT_SPEED).toBeGreaterThan(DEFAULT_WALK_SPEED)
    })
  })

  describe('getInput', () => {
    it('should return false for all inputs when no keys are pressed', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.forward).toBe(false)
      expect(input.backward).toBe(false)
      expect(input.left).toBe(false)
      expect(input.right).toBe(false)
      expect(input.jump).toBe(false)
      expect(input.sprint).toBe(false)
    })

    it('should return forward true when W is pressed', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.forward).toBe(true)
      expect(input.backward).toBe(false)
    })

    it('should return backward true when S is pressed', () => {
      const inputService = createTestInputService({ backward: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.backward).toBe(true)
      expect(input.forward).toBe(false)
    })

    it('should return left true when A is pressed', () => {
      const inputService = createTestInputService({ left: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.left).toBe(true)
    })

    it('should return right true when D is pressed', () => {
      const inputService = createTestInputService({ right: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.right).toBe(true)
    })

    it('should return jump true when Space is pressed', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.jump).toBe(true)
    })

    it('should return sprint true when ControlLeft is pressed', () => {
      const inputService = createTestInputService({ sprint: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.sprint).toBe(true)
    })

    it('should handle multiple keys pressed simultaneously', () => {
      const inputService = createTestInputService({
        forward: true,
        left: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.getInput()
      })

      const input = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(input.forward).toBe(true)
      expect(input.backward).toBe(false)
      expect(input.left).toBe(true)
      expect(input.right).toBe(false)
      expect(input.jump).toBe(false)
      expect(input.sprint).toBe(true)
    })
  })

  describe('calculateVelocity', () => {
    const zeroYaw = 0
    const isGrounded = true

    it('should return zero velocity when no input is provided', () => {
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

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.calculateVelocity(input, zeroYaw, isGrounded)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(velocity.x).toBe(0)
      expect(velocity.y).toBe(0)
      expect(velocity.z).toBe(0)
    })

    describe('forward movement (W key)', () => {
      it('should move in negative Z direction when facing forward (yaw=0)', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=0: sin(0)=0, cos(0)=1
        // Forward: x -= 0, z -= 1 => z = -walkSpeed
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
        expect(velocity.y).toBe(0)
      })

      it('should move in correct direction when facing right (yaw=PI/2)', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, Math.PI / 2, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=PI/2: sin(PI/2)=1, cos(PI/2)=0
        // Forward: x -= 1, z -= 0 => x = -walkSpeed
        expect(velocity.x).toBeCloseTo(-DEFAULT_WALK_SPEED)
        expect(velocity.z).toBeCloseTo(0)
      })
    })

    describe('backward movement (S key)', () => {
      it('should move in positive Z direction when facing forward (yaw=0)', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=0: sin(0)=0, cos(0)=1
        // Backward: x += 0, z += 1 => z = walkSpeed
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.z).toBeCloseTo(DEFAULT_WALK_SPEED)
      })
    })

    describe('left movement (A key)', () => {
      it('should strafe left when facing forward (yaw=0)', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=0: cos(0)=1, sin(0)=0
        // Left: x -= 1, z += 0 => x = -walkSpeed
        expect(velocity.x).toBeCloseTo(-DEFAULT_WALK_SPEED)
        expect(velocity.z).toBeCloseTo(0)
      })
    })

    describe('right movement (D key)', () => {
      it('should strafe right when facing forward (yaw=0)', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=0: cos(0)=1, sin(0)=0
        // Right: x += 1, z -= 0 => x = walkSpeed
        expect(velocity.x).toBeCloseTo(DEFAULT_WALK_SPEED)
        expect(velocity.z).toBeCloseTo(0)
      })
    })

    describe('diagonal movement normalization', () => {
      it('should normalize diagonal movement to prevent faster speeds', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // The magnitude should equal walk speed, not sqrt(2) * walk speed
        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
      })

      it('should normalize forward+right diagonal movement', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
      })

      it('should normalize backward+left diagonal movement', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
      })
    })

    describe('sprint speed modifier', () => {
      it('should apply sprint speed when sprint is true', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_SPRINT_SPEED)
      })

      it('should use walk speed when sprint is false', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, isGrounded)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_WALK_SPEED)
      })
    })

    describe('jump mechanics', () => {
      it('should return positive Y velocity when jump is pressed and grounded', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, true)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
      })

      it('should return zero Y velocity when jump is pressed but not grounded', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, false)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        expect(velocity.y).toBe(0)
      })

      it('should return zero Y velocity when grounded but jump not pressed', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, 0, true)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        expect(velocity.y).toBe(0)
      })
    })

    describe('camera-relative direction', () => {
      it('should adjust movement direction based on yaw angle', () => {
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

        // Test multiple yaw angles
        const testAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]

        for (const yaw of testAngles) {
          const program = Effect.gen(function* () {
            const movementService = yield* MovementService
            return yield* movementService.calculateVelocity(input, yaw, true)
          })

          const velocity = Effect.runSync(
            program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
          )

          // Forward direction should be -sin(yaw), -cos(yaw)
          expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
          expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
        }
      })

      it('should handle 180-degree rotation correctly', () => {
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

        const program = Effect.gen(function* () {
          const movementService = yield* MovementService
          return yield* movementService.calculateVelocity(input, Math.PI, true)
        })

        const velocity = Effect.runSync(
          program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
        )

        // At yaw=PI: sin(PI)=0, cos(PI)=-1
        // Forward: x -= 0, z -= (-1) => z = walkSpeed
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.z).toBeCloseTo(DEFAULT_WALK_SPEED)
      })
    })
  })

  describe('update', () => {
    it('should combine getInput and calculateVelocity', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Should move forward
      expect(velocity.x).toBeCloseTo(0)
      expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
    })

    it('should return zero Y velocity when not jumping', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Y velocity should be zero when not jumping
      expect(velocity.y).toBe(0)
    })

    it('should return jump velocity when jumping', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Y velocity should be jump velocity when jumping
      expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
    })

    it('should not jump when not grounded', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, false)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Y velocity should be zero (no jump in air)
      expect(velocity.y).toBe(0)
    })

    it('should handle sprint in update', () => {
      const inputService = createTestInputService({ forward: true, sprint: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_SPRINT_SPEED)
    })

    it('should handle complex input combinations', () => {
      const inputService = createTestInputService({
        forward: true,
        right: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Should have diagonal movement normalized to sprint speed
      const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
      expect(magnitude).toBeCloseTo(DEFAULT_SPRINT_SPEED, 5)
    })

    it('should handle zero current Y velocity', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      expect(velocity.y).toBe(0)
    })

    it('should apply camera-relative movement in update', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)

      const yaw = Math.PI / 4 // 45 degrees

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(yaw, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Verify movement is relative to yaw angle
      expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
      expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
    })
  })

  // ---------------------------------------------------------------------------
  // B7: Sprint distance > walk distance for same duration
  // ---------------------------------------------------------------------------

  describe('sprint vs walk distance comparison', () => {
    it('sprint distance is greater than walk distance for the same number of frames', () => {
      const FRAMES = 60
      const yaw = 0 // facing negative-Z

      // Walk: forward=true, sprint=false
      const walkInputService = createTestInputService({ forward: true, sprint: false })
      const walkLayers = createTestLayers(walkInputService)

      const walkProgram = Effect.gen(function* () {
        const movementService = yield* MovementService
        let totalX = 0
        let totalZ = 0
        for (let i = 0; i < FRAMES; i++) {
          const vel = yield* movementService.calculateVelocity(
            { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
            yaw,
            true
          )
          totalX += vel.x
          totalZ += vel.z
        }
        return Math.sqrt(totalX * totalX + totalZ * totalZ)
      })

      // Sprint: forward=true, sprint=true
      const sprintProgram = Effect.gen(function* () {
        const movementService = yield* MovementService
        let totalX = 0
        let totalZ = 0
        for (let i = 0; i < FRAMES; i++) {
          const vel = yield* movementService.calculateVelocity(
            { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
            yaw,
            true
          )
          totalX += vel.x
          totalZ += vel.z
        }
        return Math.sqrt(totalX * totalX + totalZ * totalZ)
      })

      const walkDist = Effect.runSync(
        walkProgram.pipe(Effect.provide(MovementServiceLive), Effect.provide(walkLayers))
      )
      const sprintDist = Effect.runSync(
        sprintProgram.pipe(Effect.provide(MovementServiceLive), Effect.provide(createTestLayers(walkInputService)))
      )

      expect(sprintDist).toBeGreaterThan(walkDist)
    })

    it('sprint displacement per frame equals DEFAULT_SPRINT_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
          0,
          true
        )
        return Math.sqrt(vel.x * vel.x + vel.z * vel.z)
      })

      const speed = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )
      expect(speed).toBeCloseTo(DEFAULT_SPRINT_SPEED)
    })

    it('walk displacement per frame equals DEFAULT_WALK_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
          0,
          true
        )
        return Math.sqrt(vel.x * vel.x + vel.z * vel.z)
      })

      const speed = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )
      expect(speed).toBeCloseTo(DEFAULT_WALK_SPEED)
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical gameplay movement sequence', () => {
      let pressedKeys = new Map<string, boolean>([
        ['KeyW', false],
        ['KeyS', false],
        ['KeyA', false],
        ['KeyD', false],
        ['Space', false],
        ['ControlLeft', false],
      ])
      // Track "just pressed" keys for consumeKeyPress
      let justPressedKeys = new Set<string>()

      const inputService = {
        isKeyPressed: (key: string) => Effect.sync(() => pressedKeys.get(key) ?? false),
        consumeKeyPress: (key: string) =>
          Effect.sync(() => {
            if (justPressedKeys.has(key)) {
              justPressedKeys.delete(key)
              return true
            }
            return false
          }),
        getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
        isMouseDown: () => Effect.sync(() => false),
        requestPointerLock: () => Effect.sync(() => {}),
        exitPointerLock: () => Effect.sync(() => {}),
        isPointerLocked: () => Effect.sync(() => true),
        consumeMouseClick: () => Effect.sync(() => false),
        consumeWheelDelta: () => Effect.sync(() => 0),
      } as unknown as InputServiceType
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService

        // Start moving forward
        pressedKeys.set('KeyW', true)
        const velocity1 = yield* movementService.update(0, true)

        // Start sprinting
        pressedKeys.set('ControlLeft', true)
        const velocity2 = yield* movementService.update(0, true)

        // Jump while sprinting - need to add to justPressedKeys
        pressedKeys.set('Space', true)
        justPressedKeys.add('Space')
        const velocity3 = yield* movementService.update(0, true)

        // In air, can't jump again (Space still pressed but not in justPressedKeys)
        const velocity4 = yield* movementService.update(0, false)

        return { velocity1, velocity2, velocity3, velocity4 }
      })

      const { velocity1, velocity2, velocity3, velocity4 } = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Walking forward
      expect(velocity1.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
      expect(velocity1.y).toBe(0)

      // Sprinting
      expect(velocity2.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED)
      expect(velocity2.y).toBe(0)

      // Jumping while sprinting
      expect(velocity3.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED)
      expect(velocity3.y).toBe(DEFAULT_JUMP_VELOCITY)

      // In air (falling), horizontal movement maintained
      expect(velocity4.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED)
      expect(velocity4.y).toBe(0) // No jump because not grounded
    })

    it('should handle strafing while moving forward', () => {
      const inputService = createTestInputService({ forward: true, right: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Should have both X and Z components, normalized
      const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
      expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
      expect(velocity.x).toBeGreaterThan(0) // Right
      expect(velocity.z).toBeLessThan(0) // Forward (negative Z)
    })

    it('should handle opposite keys cancelling out', () => {
      const inputService = createTestInputService({ forward: true, backward: true })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // Forward and backward cancel out
      expect(velocity.x).toBe(0)
      expect(velocity.z).toBe(0)
    })

    it('should handle all movement keys pressed', () => {
      const inputService = createTestInputService({
        forward: true,
        backward: true,
        left: true,
        right: true,
      })
      const testLayers = createTestLayers(inputService)

      const program = Effect.gen(function* () {
        const movementService = yield* MovementService
        return yield* movementService.update(0, true)
      })

      const velocity = Effect.runSync(
        program.pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      )

      // All horizontal keys cancel out
      expect(velocity.x).toBe(0)
      expect(velocity.z).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // D6: Property-based test — velocity magnitude never exceeds sprint speed
  // ---------------------------------------------------------------------------

  describe('velocity magnitude invariant (property test)', () => {
    it('|velocity| ≤ sprintSpeed for any combination of movement inputs and yaw angle', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(Math.PI * 2), noNaN: true }), // yaw
          fc.boolean(), // forward
          fc.boolean(), // backward
          fc.boolean(), // left
          fc.boolean(), // right
          fc.boolean(), // sprint
          fc.boolean(), // isGrounded
          (yaw, forward, backward, left, right, sprint, isGrounded) => {
            const input: MovementInput = { forward, backward, left, right, jump: false, sprint }

            const velocity = Effect.runSync(
              Effect.gen(function* () {
                const movementService = yield* MovementService
                return yield* movementService.calculateVelocity(input, yaw, isGrounded)
              }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
            )

            const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
            // Horizontal magnitude must never exceed sprint speed (+ small epsilon for float precision)
            return magnitude <= DEFAULT_SPRINT_SPEED + 0.001
          }
        )
      )
    })

    it('|velocity| ≤ walkSpeed when sprint is false, for any inputs and yaw', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(Math.PI * 2), noNaN: true }),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(), // isGrounded
          (yaw, forward, backward, left, right, isGrounded) => {
            const input: MovementInput = { forward, backward, left, right, jump: false, sprint: false }

            const velocity = Effect.runSync(
              Effect.gen(function* () {
                const movementService = yield* MovementService
                return yield* movementService.calculateVelocity(input, yaw, isGrounded)
              }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
            )

            const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
            return magnitude <= DEFAULT_WALK_SPEED + 0.001
          }
        )
      )
    })

    it('velocity.y is always either 0 or DEFAULT_JUMP_VELOCITY (no other values)', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(Math.PI * 2), noNaN: true }),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(), // jump
          fc.boolean(), // isGrounded
          (yaw, forward, backward, left, right, jump, isGrounded) => {
            const input: MovementInput = { forward, backward, left, right, jump, sprint: false }

            const velocity = Effect.runSync(
              Effect.gen(function* () {
                const movementService = yield* MovementService
                return yield* movementService.calculateVelocity(input, yaw, isGrounded)
              }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
            )

            // Y velocity is always exactly 0 or DEFAULT_JUMP_VELOCITY
            return velocity.y === 0 || velocity.y === DEFAULT_JUMP_VELOCITY
          }
        )
      )
    })
  })
})
