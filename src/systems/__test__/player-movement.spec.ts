import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { playerMovementSystem } from '../player-movement'
import { World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { CameraState, InputState, Player, Velocity } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerMovementQuery } from '@/domain/queries'
import { JUMP_FORCE, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
  updateComponent: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)

describe('playerMovementSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should update velocity and state based on input', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const inputState = new InputState({
        forward: true,
        backward: false,
        left: false,
        right: true,
        jump: true,
        sprint: true,
      })
      const player = new Player({ isGrounded: true })
      const velocity = new Velocity({ dx: 0, dy: 0, dz: 0 })
      const cameraState = new CameraState({ yaw: Math.PI / 4, pitch: 0 })

      const soa: SoA<typeof playerMovementQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          inputState: [inputState],
          velocity: [velocity],
          cameraState: [cameraState],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(playerMovementSystem)

      const speed = PLAYER_SPEED * SPRINT_MULTIPLIER
      const expectedDx = (speed * Math.cos(Math.PI / 4) - speed * Math.sin(Math.PI / 4)) / Math.sqrt(2)
      const expectedDz = (speed * Math.sin(Math.PI / 4) + speed * Math.cos(Math.PI / 4)) / Math.sqrt(2)

      const updatedVelocity = vi.mocked(mockWorld.updateComponent).mock.calls[0][2] as Velocity
      expect(updatedVelocity.dx).toBeCloseTo(expectedDx)
      expect(updatedVelocity.dz).toBeCloseTo(expectedDz)
      expect(updatedVelocity.dy).toBe(JUMP_FORCE)

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(
        entityId,
        'player',
        new Player({ isGrounded: false }),
      )
    }).pipe(Effect.provide(worldLayer)))

  it.effect('should apply deceleration when there is no horizontal input', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const inputState = new InputState({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
      })
      const player = new Player({ isGrounded: true })
      const velocity = new Velocity({ dx: 1, dy: 0, dz: 1 })
      const cameraState = new CameraState({ yaw: 0, pitch: 0 })

      const soa: SoA<typeof playerMovementQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          inputState: [inputState],
          velocity: [velocity],
          cameraState: [cameraState],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(playerMovementSystem)

      const updatedVelocity = vi.mocked(mockWorld.updateComponent).mock.calls[0][2] as Velocity
      expect(updatedVelocity.dx).toBeCloseTo(0)
      expect(updatedVelocity.dz).toBeCloseTo(0)
    }).pipe(Effect.provide(worldLayer)))
})
