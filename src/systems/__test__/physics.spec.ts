import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { physicsSystem } from '../physics'
import { Clock, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Player, Position, Velocity } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY } from '@/domain/world-constants'

describe('physicsSystem', () => {
  it.effect('should apply gravity and friction and update components', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const player = new Player({ isGrounded: true })
      const position = new Position({ x: 0, y: 0, z: 0 })
      const velocity = new Velocity({ dx: 1, dy: 0, dz: 1 })
      const deltaTime = 1

      const soa: SoAResult<typeof physicsQuery.components> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
          gravity: [],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentMock,
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(deltaTime),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld as World), Layer.succeed(Clock, mockClock))

      yield* $(physicsSystem.pipe(Effect.provide(testLayer)))

      const expectedVelocity = new Velocity({
        dx: velocity.dx * FRICTION,
        dy: 0,
        dz: velocity.dz * FRICTION,
      })
      const expectedPosition = new Position({
        x: position.x + expectedVelocity.dx * deltaTime,
        y: position.y + expectedVelocity.dy * deltaTime,
        z: position.z + expectedVelocity.dz * deltaTime,
      })

      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'velocity', expectedVelocity)
      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'position', expectedPosition)
    }),
  )

  it.effect('should apply gravity when not grounded', () =>
    Effect.gen(function* ($) {
      const entityId = toEntityId(1)
      const player = new Player({ isGrounded: false })
      const position = new Position({ x: 0, y: 10, z: 0 })
      const velocity = new Velocity({ dx: 0, dy: 0, dz: 0 })
      const deltaTime = 1

      const soa: SoAResult<typeof physicsQuery.components> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
          gravity: [],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentMock,
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(deltaTime),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld as World), Layer.succeed(Clock, mockClock))

      yield* $(physicsSystem.pipe(Effect.provide(testLayer)))

      const expectedVelocity = new Velocity({
        dx: 0,
        dy: -GRAVITY * deltaTime,
        dz: 0,
      })
      const expectedPosition = new Position({
        x: position.x,
        y: position.y + expectedVelocity.dy * deltaTime,
        z: position.z,
      })

      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'velocity', expectedVelocity)
      expect(updateComponentMock).toHaveBeenCalledWith(entityId, 'position', expectedPosition)
    }),
  )

  it.effect('should not do anything if deltaTime is 0', () =>
    Effect.gen(function* ($) {
      const querySoaMock = vi.fn(() => Effect.succeed({ entities: [], components: {} } as any))

      const mockWorld: Partial<World> = {
        querySoA: querySoaMock,
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(0),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld as World), Layer.succeed(Clock, mockClock))

      yield* $(physicsSystem.pipe(Effect.provide(testLayer)))

      expect(querySoaMock).not.toHaveBeenCalled()
    }),
  )
})
