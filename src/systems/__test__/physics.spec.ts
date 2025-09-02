import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import * as World from '@/runtime/world-pure'
import { physicsSystem } from '../physics'
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { playerQuery } from '@/domain/queries'
import { DeltaTime } from '@/runtime/services'
import { provideTestLayer } from 'test/utils'

const MockDeltaTime = (dt: number) => Layer.succeed(DeltaTime, dt)

const setupWorld = (isGrounded: boolean, velocity: { dx: number; dy: number; dz: number }) =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
    yield* $(World.updateComponent(playerId, 'player', { isGrounded }))
    yield* $(World.updateComponent(playerId, 'velocity', velocity))
    return { playerId }
  })

describe('physicsSystem', () => {
  it.skip('property-based test for physics calculations', () => {})

  it('should do nothing if deltaTime is 0', () =>
    Effect.gen(function* ($) {
      yield* $(setupWorld(false, { dx: 1, dy: 1, dz: 1 }))
      const initialPlayer = (yield* $(World.query(playerQuery)))[0]
      expect(initialPlayer).toBeDefined()

      yield* $(physicsSystem)

      const finalPlayer = (yield* $(World.query(playerQuery)))[0]
      if (initialPlayer && finalPlayer) {
        expect(finalPlayer.position).toEqual(initialPlayer.position)
        expect(finalPlayer.velocity).toEqual(initialPlayer.velocity)
      } else {
        expect(finalPlayer).toBeDefined()
      }
    }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(MockDeltaTime(0))))))

  it('should apply gravity when not grounded', () =>
    Effect.gen(function* ($) {
      const deltaTime = 0.1
      yield* $(setupWorld(false, { dx: 0, dy: 10, dz: 0 }))
      const initialPlayer = (yield* $(World.query(playerQuery)))[0]
      expect(initialPlayer).toBeDefined()

      if (initialPlayer) {
        const gravityValue = initialPlayer.gravity.value

        yield* $(physicsSystem)

        const finalPlayer = (yield* $(World.query(playerQuery)))[0]
        expect(finalPlayer).toBeDefined()
        if (finalPlayer) {
          const expectedDy = Math.max(-TERMINAL_VELOCITY, 10 - gravityValue * deltaTime)
          const expectedY = initialPlayer.position.y + expectedDy * deltaTime

          expect(finalPlayer.velocity.dy).toBeCloseTo(expectedDy, 2)
          expect(finalPlayer.position.y).toBeCloseTo(expectedY, 2)
        }
      }
    }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(MockDeltaTime(0.1))))))

  it('should apply friction when grounded', () =>
    Effect.gen(function* ($) {
      const deltaTime = 0.1
      yield* $(setupWorld(true, { dx: 10, dy: 0, dz: 10 }))
      const initialPlayer = (yield* $(World.query(playerQuery)))[0]
      expect(initialPlayer).toBeDefined()

      if (initialPlayer) {
        yield* $(physicsSystem)

        const finalPlayer = (yield* $(World.query(playerQuery)))[0]
        expect(finalPlayer).toBeDefined()
        if (finalPlayer) {
          const expectedDx = 10 * FRICTION
          const expectedDz = 10 * FRICTION
          const expectedX = initialPlayer.position.x + expectedDx * deltaTime
          const expectedZ = initialPlayer.position.z + expectedDz * deltaTime

          expect(finalPlayer.velocity.dx).toBeCloseTo(expectedDx, 2)
          expect(finalPlayer.velocity.dz).toBeCloseTo(expectedDz, 2)
          expect(finalPlayer.position.x).toBeCloseTo(expectedX, 2)
          expect(finalPlayer.position.z).toBeCloseTo(expectedZ, 2)
        }
      }
    }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(MockDeltaTime(0.1))))))
})
