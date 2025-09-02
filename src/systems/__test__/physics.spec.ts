import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { DeltaTime } from '@/runtime/services'
import { World, WorldLive } from '@/runtime/world'
import { physicsSystem } from '../physics'
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { playerQuery } from '@/domain/queries'

const MockDeltaTime = (dt: number) => Layer.succeed(DeltaTime, dt)

const setupWorld = (isGrounded: boolean, velocity: { dx: number; dy: number; dz: number }) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    yield* _(world.updateComponent(playerId, 'player', { isGrounded }))
    yield* _(world.updateComponent(playerId, 'velocity', velocity))
    return { playerId }
  })

describe('physicsSystem', () => {
  it.skip('property-based test for physics calculations', () => {})

  it('should do nothing if deltaTime is 0', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld(false, { dx: 1, dy: 1, dz: 1 }))
      const initialPlayer = (yield* _(world.query(playerQuery)))[0]!

      yield* _(physicsSystem)

      const finalPlayer = (yield* _(world.query(playerQuery)))[0]!
      expect(finalPlayer.position).toEqual(initialPlayer.position)
      expect(finalPlayer.velocity).toEqual(initialPlayer.velocity)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(0))))
  })

  it('should apply gravity when not grounded', async () => {
    const deltaTime = 0.1
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld(false, { dx: 0, dy: 10, dz: 0 }))
      const initialPlayer = (yield* _(world.query(playerQuery)))[0]!
      const gravityValue = initialPlayer.gravity.value

      yield* _(physicsSystem)

      const finalPlayer = (yield* _(world.query(playerQuery)))[0]!
      const expectedDy = Math.max(-TERMINAL_VELOCITY, 10 - gravityValue * deltaTime)
      const expectedY = initialPlayer.position.y + expectedDy * deltaTime

      expect(finalPlayer.velocity.dy).toBeCloseTo(expectedDy)
      expect(finalPlayer.position.y).toBeCloseTo(expectedY)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(deltaTime))))
  })

  it('should apply friction when grounded', async () => {
    const deltaTime = 0.1
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld(true, { dx: 10, dy: 0, dz: 10 }))
      const initialPlayer = (yield* _(world.query(playerQuery)))[0]!

      yield* _(physicsSystem)

      const finalPlayer = (yield* _(world.query(playerQuery)))[0]!
      const expectedDx = 10 * FRICTION
      const expectedDz = 10 * FRICTION
      const expectedX = initialPlayer.position.x + expectedDx * deltaTime
      const expectedZ = initialPlayer.position.z + expectedDz * deltaTime

      expect(finalPlayer.velocity.dx).toBeCloseTo(expectedDx)
      expect(finalPlayer.velocity.dz).toBeCloseTo(expectedDz)
      expect(finalPlayer.position.x).toBeCloseTo(expectedX)
      expect(finalPlayer.position.z).toBeCloseTo(expectedZ)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(deltaTime))))
  })
})
