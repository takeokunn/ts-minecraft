import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { describe as effectDescribe, it as effectIt } from '@effect/vitest'
import { createArchetype } from '@/domain/archetypes'
import { CameraState, InputState } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { applyDeceleration, calculateHorizontalVelocity, calculateVerticalVelocity, playerMovementSystem } from '../player-movement'

const setupWorld = (inputState: Partial<InputState>, isGrounded: boolean, camera: Partial<CameraState>) =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
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
    yield* $(World.updateComponent(playerId, 'inputState', new InputState(fullInputState)))
    yield* $(World.updateComponent(playerId, 'player', { isGrounded }))
    yield* $(World.updateComponent(playerId, 'cameraState', new CameraState(fullCameraState)))
    return { playerId }
  })

describe('playerMovementSystem', () => {
  describe('pure functions', () => {
    const safeDouble = (constraints: fc.DoubleConstraints = {}) => fc.double({ ...constraints, noNaN: true })

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

      const hasEffectiveInput = (input.forward && !input.backward) || (input.backward && !input.forward) || (input.left && !input.right) || (input.right && !input.left)

      if (hasEffectiveInput) {
        expect(Math.sqrt(dx * dx + dz * dz)).toBeCloseTo(speed)
      } else {
        expect(dx).toBe(0)
        expect(dz).toBe(0)
      }
    })

    test.prop([fc.boolean(), fc.boolean(), safeDouble({ min: -100, max: 100 })])('calculateVerticalVelocity', (isGrounded, jumpPressed, currentDy) => {
      const { newDy, newIsGrounded } = calculateVerticalVelocity(isGrounded, jumpPressed, currentDy)
      if (jumpPressed && isGrounded) {
        expect(newDy).toBe(JUMP_FORCE)
        expect(newIsGrounded).toBe(false)
      } else {
        expect(newDy).toBe(currentDy)
        expect(newIsGrounded).toBe(isGrounded)
      }
    })

    describe('applyDeceleration', () => {
      test.prop([fc.record({ dx: fc.double(), dz: fc.double() })])('should decelerate finite velocities', (velocity) => {
        const { dx, dz } = applyDeceleration(velocity)

        if (!Number.isFinite(velocity.dx)) {
          expect(dx).toBe(0)
        } else if (Math.abs(velocity.dx) < MIN_VELOCITY_THRESHOLD) {
          expect(dx).toBe(0)
        } else {
          expect(Math.abs(dx)).toBeLessThan(Math.abs(velocity.dx))
        }

        if (!Number.isFinite(velocity.dz)) {
          expect(dz).toBe(0)
        } else if (Math.abs(velocity.dz) < MIN_VELOCITY_THRESHOLD) {
          expect(dz).toBe(0)
        } else {
          expect(Math.abs(dz)).toBeLessThan(Math.abs(velocity.dz))
        }
      })

      it('should handle non-finite values', () => {
        expect(applyDeceleration({ dx: NaN, dz: 0 })).toEqual({ dx: 0, dz: 0 })
        expect(applyDeceleration({ dx: 0, dz: NaN })).toEqual({ dx: 0, dz: 0 })
        expect(applyDeceleration({ dx: Infinity, dz: 0 })).toEqual({ dx: 0, dz: 0 })
        expect(applyDeceleration({ dx: 0, dz: Infinity })).toEqual({ dx: 0, dz: 0 })
        expect(applyDeceleration({ dx: -Infinity, dz: 0 })).toEqual({ dx: 0, dz: 0 })
        expect(applyDeceleration({ dx: 0, dz: -Infinity })).toEqual({ dx: 0, dz: 0 })
      })
    })
  })

  effectDescribe('system', () => {
    // Note: This is a simplified version of the property-based test.
    // A full conversion would require using @effect/test's Gen functionality.
    effectIt('should update velocity and state based on input', () =>
      Effect.gen(function* ($) {
        const input = {
          forward: true,
          backward: false,
          left: false,
          right: true,
          jump: true,
          sprint: true,
        }
        const isGrounded = true
        const camera = { yaw: Math.PI / 4 }

        yield* $(setupWorld(input, isGrounded, camera))
        yield* $(playerMovementSystem)
        const player = (yield* $(World.query(playerQuery)))[0]
        expect(player).toBeDefined()
        if (player) {
          const { velocity, player: playerComponent } = player

          const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
          expect(Math.sqrt(velocity.dx * velocity.dx + velocity.dz * velocity.dz)).toBeCloseTo(speed, 2)
          expect(velocity.dy).toBe(JUMP_FORCE)
          expect(playerComponent.isGrounded).toBe(false)
        }
      }).pipe(Effect.provide(provideTestLayer())),
    )
  })
})
