import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { physicsSystem } from '../physics'
import { Clock, World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { Player, Position, Velocity } from '@/domain/components'
import { SoA } from '@/domain/world'
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

      const soa: SoA<typeof physicsQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: World = {
        state: Ref.unsafeMake(undefined as any),
        addArchetype: () => Effect.die('Not implemented'),
        removeEntity: () => Effect.die('Not implemented'),
        getComponent: () => Effect.die('Not implemented'),
        getComponentUnsafe: () => Effect.die('Not implemented'),
        updateComponent: updateComponentMock,
        query: () => Effect.die('Not implemented'),
        querySoA: () => Effect.succeed(soa),
        queryUnsafe: () => Effect.die('Not implemented'),
        querySingle: () => Effect.die('Not implemented'),
        querySingleUnsafe: () => Effect.die('Not implemented'),
        getChunk: () => Effect.die('Not implemented'),
        setChunk: () => Effect.die('Not implemented'),
        getVoxel: () => Effect.die('Not implemented'),
        setVoxel: () => Effect.die('Not implemented'),
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(deltaTime),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld), Layer.succeed(Clock, mockClock))

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

      const soa: SoA<typeof physicsQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: World = {
        state: Ref.unsafeMake(undefined as any),
        addArchetype: () => Effect.die('Not implemented'),
        removeEntity: () => Effect.die('Not implemented'),
        getComponent: () => Effect.die('Not implemented'),
        getComponentUnsafe: () => Effect.die('Not implemented'),
        updateComponent: updateComponentMock,
        query: () => Effect.die('Not implemented'),
        querySoA: () => Effect.succeed(soa),
        queryUnsafe: () => Effect.die('Not implemented'),
        querySingle: () => Effect.die('Not implemented'),
        querySingleUnsafe: () => Effect.die('Not implemented'),
        getChunk: () => Effect.die('Not implemented'),
        setChunk: () => Effect.die('Not implemented'),
        getVoxel: () => Effect.die('Not implemented'),
        setVoxel: () => Effect.die('Not implemented'),
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(deltaTime),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld), Layer.succeed(Clock, mockClock))

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

      const mockWorld: World = {
        state: Ref.unsafeMake(undefined as any),
        addArchetype: () => Effect.die('Not implemented'),
        removeEntity: () => Effect.die('Not implemented'),
        getComponent: () => Effect.die('Not implemented'),
        getComponentUnsafe: () => Effect.die('Not implemented'),
        updateComponent: () => Effect.die('Not implemented'),
        query: () => Effect.die('Not implemented'),
        querySoA: querySoaMock,
        queryUnsafe: () => Effect.die('Not implemented'),
        querySingle: () => Effect.die('Not implemented'),
        querySingleUnsafe: () => Effect.die('Not implemented'),
        getChunk: () => Effect.die('Not implemented'),
        setChunk: () => Effect.die('Not implemented'),
        getVoxel: () => Effect.die('Not implemented'),
        setVoxel: () => Effect.die('Not implemented'),
      }

      const mockClock: Clock = {
        deltaTime: Ref.unsafeMake(0),
        onFrame: () => Effect.void,
      }

      const testLayer = Layer.merge(Layer.succeed(World, mockWorld), Layer.succeed(Clock, mockClock))

      yield* $(physicsSystem.pipe(Effect.provide(testLayer)))

      expect(querySoaMock).not.toHaveBeenCalled()
    }),
  )
})
