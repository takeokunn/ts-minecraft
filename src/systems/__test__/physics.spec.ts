import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { physicsSystem } from '../physics'
import { Clock, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Player, Position, Velocity } from '@/domain/components'
import { SoA } from '@/domain/world'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY } from '@/domain/world-constants'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
  updateComponent: vi.fn(),
}

const mockClock: Partial<Clock> = {
  deltaTime: Ref.unsafeMake(1),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const clockLayer = Layer.succeed(Clock, mockClock as Clock)
const testLayer = worldLayer.pipe(Layer.provide(clockLayer))

describe('physicsSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should apply gravity and friction and update components', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const player = new Player({ isGrounded: true })
      const position = new Position({ x: 0, y: 0, z: 0 })
      const velocity = new Velocity({ dx: 1, dy: 0, dz: 1 })

      const soa: SoA<typeof physicsQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(physicsSystem)

      const expectedVelocity = new Velocity({
        dx: velocity.dx * FRICTION,
        dy: 0,
        dz: velocity.dz * FRICTION,
      })
      const expectedPosition = new Position({
        x: position.x + expectedVelocity.dx,
        y: position.y + expectedVelocity.dy,
        z: position.z + expectedVelocity.dz,
      })

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'velocity', expectedVelocity)
      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'position', expectedPosition)
    }).pipe(Effect.provide(testLayer)))

  it.effect('should apply gravity when not grounded', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('player')
      const player = new Player({ isGrounded: false })
      const position = new Position({ x: 0, y: 10, z: 0 })
      const velocity = new Velocity({ dx: 0, dy: 0, dz: 0 })

      const soa: SoA<typeof physicsQuery> = {
        entities: [entityId],
        components: {
          player: [player],
          position: [position],
          velocity: [velocity],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockWorld, 'updateComponent').mockReturnValue(Effect.succeed(undefined))

      yield* $(physicsSystem)

      const expectedVelocity = new Velocity({
        dx: 0,
        dy: -GRAVITY,
        dz: 0,
      })
      const expectedPosition = new Position({
        x: position.x,
        y: position.y - GRAVITY,
        z: position.z,
      })

      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'velocity', expectedVelocity)
      expect(mockWorld.updateComponent).toHaveBeenCalledWith(entityId, 'position', expectedPosition)
    }).pipe(Effect.provide(testLayer)))

  it.effect('should not do anything if deltaTime is 0', () =>
    Effect.gen(function* ($) {
      const clock = yield* $(Clock)
      yield* $(Ref.set(clock.deltaTime, 0))

      yield* $(physicsSystem)

      expect(mockWorld.querySoA).not.toHaveBeenCalled()
    }).pipe(Effect.provide(testLayer)))
})
