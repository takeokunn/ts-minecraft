import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { playerMovementSystem } from '../player-movement'
import { World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { CameraState, InputState, Player, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerMovementQuery } from '@/domain/queries'
import { JUMP_FORCE, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'

describe('playerMovementSystem', () => {
  it.effect('should update velocity and state based on input', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const inputState = new InputState({
        forward: true,
        backward: false,
        left: false,
        right: true,
        jump: true,
        sprint: true,
        place: false,
        destroy: false,
        isLocked: false,
      })
      const player = new Player({ isGrounded: true })
      const velocity = new Velocity({ dx: 0, dy: 0, dz: 0 })
      const cameraState = new CameraState({ yaw: Math.PI / 4, pitch: 0 })

      const soa: SoAResult<typeof playerMovementQuery.components> = {
        entities: [entityId],
        components: {
          player: [player],
          inputState: [inputState],
          velocity: [velocity],
          cameraState: [cameraState],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentMock,
      }

      const testLayer = Layer.succeed(World, mockWorld as World)

      yield* $(playerMovementSystem.pipe(Effect.provide(testLayer)))

      const speed = PLAYER_SPEED * SPRINT_MULTIPLIER
      const expectedDx = (speed * Math.cos(Math.PI / 4) - speed * Math.sin(Math.PI / 4)) / Math.sqrt(2)
      const expectedDz = (speed * Math.sin(Math.PI / 4) + speed * Math.cos(Math.PI / 4)) / Math.sqrt(2)

      const updatedVelocity = updateComponentMock.mock.calls[0][2] as Velocity
      expect(updatedVelocity.dx).toBeCloseTo(expectedDx)
      expect(updatedVelocity.dz).toBeCloseTo(expectedDz)
      expect(updatedVelocity.dy).toBe(JUMP_FORCE)

      expect(updateComponentMock).toHaveBeenCalledWith(
        entityId,
        'player',
        new Player({ isGrounded: false }),
      )
    }))

  it.effect('should apply deceleration when there is no horizontal input', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const inputState = new InputState({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false,
      })
      const player = new Player({ isGrounded: true })
      const velocity = new Velocity({ dx: 1, dy: 0, dz: 1 })
      const cameraState = new CameraState({ yaw: 0, pitch: 0 })

      const soa: SoAResult<typeof playerMovementQuery.components> = {
        entities: [entityId],
        components: {
          player: [player],
          inputState: [inputState],
          velocity: [velocity],
          cameraState: [cameraState],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentMock,
      }

      const testLayer = Layer.succeed(World, mockWorld as World)

      yield* $(playerMovementSystem.pipe(Effect.provide(testLayer)))

      const updatedVelocity = updateComponentMock.mock.calls[0][2] as Velocity
      expect(updatedVelocity.dx).toBeCloseTo(0)
      expect(updatedVelocity.dz).toBeCloseTo(0)
    }))
})
