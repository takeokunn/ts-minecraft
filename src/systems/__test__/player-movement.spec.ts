import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  playerMovementSystem,
  calculateHorizontalVelocity,
  calculateVerticalVelocity,
  applyDeceleration,
} from '../player-movement'
import { World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { CameraState, InputState, Player, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerMovementQuery } from '@/domain/queries'
import { JUMP_FORCE, PLAYER_SPEED, SPRINT_MULTIPLIER, DECELERATION, MIN_VELOCITY_THRESHOLD } from '@/domain/world-constants'
import { arbitraryInputState, arbitraryPlayer, arbitraryVelocity, arbitraryCameraState } from '@test/arbitraries'
import { toFloat } from '@/domain/common'

describe('player-movement pure functions', () => {
  it.effect('calculateHorizontalVelocity', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(arbitraryInputState, arbitraryCameraState, (input, camera) => {
          const { dx, dz } = calculateHorizontalVelocity(input, camera)
          const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
          const hasInput = input.forward || input.backward || input.left || input.right
          if (hasInput) {
            const magnitude = Math.sqrt(dx * dx + dz * dz)
            assert.closeTo(magnitude, speed, 1e-9)
          } else {
            assert.strictEqual(dx, 0)
            assert.strictEqual(dz, 0)
          }
        }),
      ),
    ))

  it.effect('calculateVerticalVelocity', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(arbitraryPlayer, arbitraryInputState, arbitraryVelocity, (player, input, velocity) => {
          const { newDy, newIsGrounded } = calculateVerticalVelocity(
            player.isGrounded,
            input.jump,
            velocity.dy,
          )
          if (input.jump && player.isGrounded) {
            assert.strictEqual(newDy, JUMP_FORCE)
            assert.isFalse(newIsGrounded)
          } else {
            assert.strictEqual(newDy, velocity.dy)
            assert.strictEqual(newIsGrounded, player.isGrounded)
          }
        }),
      ),
    ))

  it.effect('applyDeceleration', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(arbitraryVelocity, (velocity) => {
          const { dx, dz } = applyDeceleration(velocity)
          const expectedDx = Math.abs(velocity.dx * DECELERATION) < MIN_VELOCITY_THRESHOLD ? 0 : velocity.dx * DECELERATION
          const expectedDz = Math.abs(velocity.dz * DECELERATION) < MIN_VELOCITY_THRESHOLD ? 0 : velocity.dz * DECELERATION
          assert.strictEqual(dx, toFloat(expectedDx))
          assert.strictEqual(dz, toFloat(expectedDz))
        }),
      ),
    ))
})

describe('playerMovementSystem', () => {
  const arbitraryPlayerEntity = fc.record({
    player: arbitraryPlayer,
    inputState: arbitraryInputState,
    velocity: arbitraryVelocity,
    cameraState: arbitraryCameraState,
  })

  it.effect('should adhere to player movement properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(fc.array(arbitraryPlayerEntity), async (entities) => {
          const entityIds = entities.map((_, i) => toEntityId(i))
          const soa: SoAResult<typeof playerMovementQuery.components> = {
            entities: entityIds,
            components: {
              player: entities.map((e) => e.player),
              inputState: entities.map((e) => e.inputState),
              velocity: entities.map((e) => e.velocity),
              cameraState: entities.map((e) => e.cameraState),
            },
          }

          const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))
          const mockWorld: Partial<World> = {
            querySoA: () => Effect.succeed(soa as any),
            updateComponent: updateComponentSpy,
          }
          const testLayer = Layer.succeed(World, mockWorld as World)

          await Effect.runPromise(playerMovementSystem.pipe(Effect.provide(testLayer)))

          assert.strictEqual(updateComponentSpy.mock.calls.length, entities.length * 2)

          entities.forEach((entity, i) => {
            const { player, inputState, velocity, cameraState } = entity
            const { newDy, newIsGrounded } = calculateVerticalVelocity(
              player.isGrounded,
              inputState.jump,
              velocity.dy,
            )
            const hasHorizontalInput =
              inputState.forward || inputState.backward || inputState.left || inputState.right
            const { dx, dz } = hasHorizontalInput
              ? calculateHorizontalVelocity(inputState, cameraState)
              : applyDeceleration(velocity)

            const expectedVelocity = new Velocity({ dx, dy: newDy, dz })
            const expectedPlayer = new Player({ isGrounded: newIsGrounded })

            const entityId = entityIds[i]
            const calls = updateComponentSpy.mock.calls.filter((call) => call[0] === entityId)
            expect(calls).toContainEqual([entityId, 'velocity', expectedVelocity])
            expect(calls).toContainEqual([entityId, 'player', expectedPlayer])
          })
        }),
      ),
    ),
  )
})