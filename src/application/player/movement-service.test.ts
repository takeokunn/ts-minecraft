import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Layer, MutableHashMap, MutableHashSet, Option, Ref, Schema } from 'effect'
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
  const pressedKeys = MutableHashMap.make(
    ['KeyW', Option.getOrElse(Option.fromNullable(initialState.forward), () => false)],
    ['KeyS', Option.getOrElse(Option.fromNullable(initialState.backward), () => false)],
    ['KeyA', Option.getOrElse(Option.fromNullable(initialState.left), () => false)],
    ['KeyD', Option.getOrElse(Option.fromNullable(initialState.right), () => false)],
    ['Space', Option.getOrElse(Option.fromNullable(initialState.jump), () => false)],
    ['ControlLeft', Option.getOrElse(Option.fromNullable(initialState.sprint), () => false)],
  )
  // For consumeKeyPress, track "just pressed" keys
  // In tests, jump=true means Space was just pressed
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }

  return {
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
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
      MutableHashMap.set(pressedKeys, key, pressed)
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
    it.effect('should return false for all inputs when no keys are pressed', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(false)
        expect(input.backward).toBe(false)
        expect(input.left).toBe(false)
        expect(input.right).toBe(false)
        expect(input.jump).toBe(false)
        expect(input.sprint).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return forward true when W is pressed', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.backward).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return backward true when S is pressed', () => {
      const inputService = createTestInputService({ backward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.backward).toBe(true)
        expect(input.forward).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return left true when A is pressed', () => {
      const inputService = createTestInputService({ left: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.left).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return right true when D is pressed', () => {
      const inputService = createTestInputService({ right: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.right).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return jump true when Space is pressed', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.jump).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return sprint true when ControlLeft is pressed', () => {
      const inputService = createTestInputService({ sprint: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.sprint).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle multiple keys pressed simultaneously', () => {
      const inputService = createTestInputService({
        forward: true,
        left: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.backward).toBe(false)
        expect(input.left).toBe(true)
        expect(input.right).toBe(false)
        expect(input.jump).toBe(false)
        expect(input.sprint).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

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

    describe('camera-relative direction', () => {
      it.effect('should adjust movement direction based on yaw angle', () => {
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
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          yield* Effect.forEach(testAngles, yaw =>
            Effect.gen(function* () {
              const velocity = yield* movementService.calculateVelocity(input, yaw, true)
              // Forward direction should be -sin(yaw), -cos(yaw)
              expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
              expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
            })
          , { concurrency: 1 })
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })

      it.effect('should handle 180-degree rotation correctly', () => {
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
          const velocity = yield* movementService.calculateVelocity(input, Math.PI, true)
          // At yaw=PI: sin(PI)=0, cos(PI)=-1
          // Forward: x -= 0, z -= (-1) => z = walkSpeed
          expect(velocity.x).toBeCloseTo(0)
          expect(velocity.z).toBeCloseTo(DEFAULT_WALK_SPEED)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      })
    })
  })

  describe('update', () => {
    it.effect('should combine getInput and calculateVelocity', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Should move forward
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return zero Y velocity when not jumping', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Y velocity should be zero when not jumping
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return jump velocity when jumping', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Y velocity should be jump velocity when jumping
        expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should not jump when not grounded', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, false)
        // Y velocity should be zero (no jump in air)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle sprint in update', () => {
      const inputService = createTestInputService({ forward: true, sprint: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_SPRINT_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle complex input combinations', () => {
      const inputService = createTestInputService({
        forward: true,
        right: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Should have diagonal movement normalized to sprint speed
        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_SPRINT_SPEED, 5)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle zero current Y velocity', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should apply camera-relative movement in update', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      const yaw = Math.PI / 4 // 45 degrees
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(yaw, true)
        // Verify movement is relative to yaw angle
        expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
        expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

  // ---------------------------------------------------------------------------
  // B7: Sprint distance > walk distance for same duration
  // ---------------------------------------------------------------------------

  describe('sprint vs walk distance comparison', () => {
    it.effect('sprint distance is greater than walk distance for the same number of frames', () => {
      const FRAMES = 60
      const yaw = 0 // facing negative-Z

      // Walk: forward=true, sprint=false
      const walkInputService = createTestInputService({ forward: true, sprint: false })
      const walkLayers = createTestLayers(walkInputService)

      const sprintInputService = createTestInputService({ forward: true, sprint: true })
      const sprintLayers = createTestLayers(sprintInputService)

      return Effect.gen(function* () {
        const walkDistRef = yield* Ref.make(0)
        const sprintDistRef = yield* Ref.make(0)

        yield* Effect.gen(function* () {
          const movementService = yield* MovementService
          const accRef = yield* Ref.make({ x: 0, z: 0 })
          yield* Effect.forEach(Arr.makeBy(FRAMES, () => undefined), () =>
            movementService.calculateVelocity(
              { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
              yaw,
              true
            ).pipe(Effect.flatMap(vel => Ref.update(accRef, acc => ({ x: acc.x + vel.x, z: acc.z + vel.z }))))
          , { concurrency: 1 })
          const { x: totalX, z: totalZ } = yield* Ref.get(accRef)
          yield* Ref.set(walkDistRef, Math.sqrt(totalX * totalX + totalZ * totalZ))
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(walkLayers))

        yield* Effect.gen(function* () {
          const movementService = yield* MovementService
          const accRef = yield* Ref.make({ x: 0, z: 0 })
          yield* Effect.forEach(Arr.makeBy(FRAMES, () => undefined), () =>
            movementService.calculateVelocity(
              { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
              yaw,
              true
            ).pipe(Effect.flatMap(vel => Ref.update(accRef, acc => ({ x: acc.x + vel.x, z: acc.z + vel.z }))))
          , { concurrency: 1 })
          const { x: totalX, z: totalZ } = yield* Ref.get(accRef)
          yield* Ref.set(sprintDistRef, Math.sqrt(totalX * totalX + totalZ * totalZ))
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(sprintLayers))

        const walkDist = yield* Ref.get(walkDistRef)
        const sprintDist = yield* Ref.get(sprintDistRef)
        expect(sprintDist).toBeGreaterThan(walkDist)
      })
    })

    it.effect('sprint displacement per frame equals DEFAULT_SPRINT_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
          0,
          true
        )
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
        expect(speed).toBeCloseTo(DEFAULT_SPRINT_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('walk displacement per frame equals DEFAULT_WALK_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
          0,
          true
        )
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
        expect(speed).toBeCloseTo(DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

  describe('integration scenarios', () => {
    it.effect('should handle typical gameplay movement sequence', () => {
      const pressedKeys = MutableHashMap.make(
        ['KeyW', false],
        ['KeyS', false],
        ['KeyA', false],
        ['KeyD', false],
        ['Space', false],
        ['ControlLeft', false],
      )
      // Track "just pressed" keys for consumeKeyPress
      const justPressedKeys = MutableHashSet.empty<string>()

      const inputService = {
        isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
        consumeKeyPress: (key: string) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justPressedKeys, key)) {
              MutableHashSet.remove(justPressedKeys, key)
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

      return Effect.gen(function* () {
        const movementService = yield* MovementService

        // Start moving forward
        MutableHashMap.set(pressedKeys, 'KeyW', true)
        const velocity1 = yield* movementService.update(0, true)

        // Start sprinting
        MutableHashMap.set(pressedKeys, 'ControlLeft', true)
        const velocity2 = yield* movementService.update(0, true)

        // Jump while sprinting - need to add to justPressedKeys
        MutableHashMap.set(pressedKeys, 'Space', true)
        MutableHashSet.add(justPressedKeys, 'Space')
        const velocity3 = yield* movementService.update(0, true)

        // In air, can't jump again (Space still pressed but not in justPressedKeys)
        const velocity4 = yield* movementService.update(0, false)

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
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle strafing while moving forward', () => {
      const inputService = createTestInputService({ forward: true, right: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Should have both X and Z components, normalized
        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
        expect(velocity.x).toBeGreaterThan(0) // Right
        expect(velocity.z).toBeLessThan(0) // Forward (negative Z)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle opposite keys cancelling out', () => {
      const inputService = createTestInputService({ forward: true, backward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Forward and backward cancel out
        expect(velocity.x).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle all movement keys pressed', () => {
      const inputService = createTestInputService({
        forward: true,
        backward: true,
        left: true,
        right: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // All horizontal keys cancel out
        expect(velocity.x).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

  // ---------------------------------------------------------------------------
  // D6: Property-based test — velocity magnitude never exceeds sprint speed
  // ---------------------------------------------------------------------------

  describe('velocity magnitude invariant (property test)', () => {
    it.effect.prop(
      '|velocity| ≤ sprintSpeed for any combination of movement inputs and yaw angle',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        sprint: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, sprint, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump: false, sprint }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeLessThanOrEqual(DEFAULT_SPRINT_SPEED + 0.001)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      }
    )

    it.effect.prop(
      '|velocity| ≤ walkSpeed when sprint is false, for any inputs and yaw',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump: false, sprint: false }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeLessThanOrEqual(DEFAULT_WALK_SPEED + 0.001)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      }
    )

    it.effect.prop(
      'velocity.y is always either 0 or DEFAULT_JUMP_VELOCITY (no other values)',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        jump: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, jump, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump, sprint: false }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          expect(velocity.y === 0 || velocity.y === DEFAULT_JUMP_VELOCITY).toBe(true)
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
      }
    )
  })

  // ---------------------------------------------------------------------------
  // Task 5: consumeKeyPress one-shot — jump key is consumed on first read
  // ---------------------------------------------------------------------------

  describe('consumeKeyPress one-shot behavior', () => {
    it.effect('jump key is consumed: second getInput() in same frame returns jump=false', () => {
      // createTestInputService({ jump: true }) adds 'Space' to justPressedKeys
      // consumeKeyPress deletes from justPressedKeys on first call → returns true once, then false
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        // First read: Space is in justPressedKeys → consumeKeyPress returns true → jump=true
        expect(first.jump).toBe(true)
        // Second read: Space was deleted from justPressedKeys → consumeKeyPress returns false → jump=false
        expect(second.jump).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('non-jump keys are not consumed: forward remains true on second getInput()', () => {
      // forward uses isKeyPressed (not consumeKeyPress), so it remains true across calls
      const inputService = createTestInputService({ forward: true, jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        // forward is still pressed (isKeyPressed, not consumed)
        expect(first.forward).toBe(true)
        expect(second.forward).toBe(true)
        // jump consumed on first read
        expect(first.jump).toBe(true)
        expect(second.jump).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('jump=false from the start: getInput() returns jump=false on both calls', () => {
      // justPressedKeys is empty, so consumeKeyPress('Space') always returns false
      const inputService = createTestInputService({ jump: false })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        expect(first.jump).toBe(false)
        expect(second.jump).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })
})
