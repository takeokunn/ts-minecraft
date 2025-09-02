import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { createArchetype } from '@/domain/archetypes'
import { CameraState, InputState } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import { World, WorldLive } from '@/runtime/world'
import { applyDeceleration, calculateHorizontalVelocity, calculateVerticalVelocity, playerMovementSystem } from '../player-movement'

const setupWorld = (inputState: Partial<InputState>, isGrounded: boolean, camera: Partial<CameraState>) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    const fullInputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
      isLocked: false,
      ...inputState,
    }
    const fullCameraState = {
      pitch: 0,
      yaw: 0,
      ...camera,
    }
    yield* _(world.updateComponent(playerId, 'inputState', new InputState(fullInputState)))
    yield* _(world.updateComponent(playerId, 'player', { isGrounded }))
    yield* _(world.updateComponent(playerId, 'cameraState', new CameraState(fullCameraState)))
    return { playerId }
  })

describe('playerMovementSystem', () => {
  describe('pure functions', () => {
    const safeDouble = (constraints: fc.DoubleConstraints = {}) => fc.double({ ...constraints, noNaN: true });

    test.prop([
      fc.record({
        forward: fc.boolean(),
        backward: fc.boolean(),
        left: fc.boolean(),
        right: fc.boolean(),
        sprint: fc.boolean(),
      }),
      fc.record({
        yaw: safeDouble({ min: -Math.PI, max: Math.PI }),
      }),
    ])('calculateHorizontalVelocity', (input, camera) => {
      const { dx, dz } = calculateHorizontalVelocity(input, camera)
      const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED

      const hasEffectiveInput =
        (input.forward && !input.backward) ||
        (input.backward && !input.forward) ||
        (input.left && !input.right) ||
        (input.right && !input.left)

      if (hasEffectiveInput) {
        expect(Math.sqrt(dx * dx + dz * dz)).toBeCloseTo(speed)
      } else {
        expect(dx).toBe(0)
        expect(dz).toBe(0)
      }
    })

    test.prop([fc.boolean(), fc.boolean(), safeDouble({ min: -100, max: 100 })])(
      'calculateVerticalVelocity',
      (isGrounded, jumpPressed, currentDy) => {
        const { newDy, newIsGrounded } = calculateVerticalVelocity(isGrounded, jumpPressed, currentDy)
        if (jumpPressed && isGrounded) {
          expect(newDy).toBe(JUMP_FORCE)
          expect(newIsGrounded).toBe(false)
        } else {
          expect(newDy).toBe(currentDy)
          expect(newIsGrounded).toBe(isGrounded)
        }
      },
    )

    test.prop([fc.record({ dx: safeDouble(), dz: safeDouble() })])('applyDeceleration', (velocity) => {
      const { dx, dz } = applyDeceleration(velocity)
      if (Math.abs(velocity.dx) < MIN_VELOCITY_THRESHOLD) {
        expect(dx).toBe(0)
      } else {
        expect(Math.abs(dx)).toBeLessThan(Math.abs(velocity.dx))
      }
      if (Math.abs(velocity.dz) < MIN_VELOCITY_THRESHOLD) {
        expect(dz).toBe(0)
      } else {
        expect(Math.abs(dz)).toBeLessThan(Math.abs(velocity.dz))
      }
    })
  })

  describe('system', () => {
    test.prop([
      fc.record({
        forward: fc.boolean(),
        backward: fc.boolean(),
        left: fc.boolean(),
        right: fc.boolean(),
        jump: fc.boolean(),
        sprint: fc.boolean(),
      }),
      fc.boolean(),
      fc.record({
        yaw: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
      }),
    ])('should update velocity and state based on input', async (input, isGrounded, camera) => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld(input, isGrounded, camera))
        yield* _(playerMovementSystem)
        const player = (yield* _(world.query(playerQuery)))[0]!
        const { velocity, player: playerComponent } = player

        const hasEffectiveInput =
          (input.forward && !input.backward) ||
          (input.backward && !input.forward) ||
          (input.left && !input.right) ||
          (input.right && !input.left)

        if (hasEffectiveInput) {
          const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
          expect(Math.sqrt(velocity.dx * velocity.dx + velocity.dz * velocity.dz)).toBeCloseTo(speed)
        } else {
          expect(velocity.dx).toBe(0)
          expect(velocity.dz).toBe(0)
        }

        if (input.jump && isGrounded) {
          expect(velocity.dy).toBe(JUMP_FORCE)
          expect(playerComponent.isGrounded).toBe(false)
        } else {
          expect(velocity.dy).toBe(0)
          expect(playerComponent.isGrounded).toBe(isGrounded)
        }
      })

      await Effect.runPromise(Effect.provide(program, WorldLive))
    })
  })
})