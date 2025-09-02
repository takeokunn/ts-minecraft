import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
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
  test('property-based test for physics calculations', async () => {
    await test.prop([
      fc.record({
        isGrounded: fc.boolean(),
        velocity: fc.record({
          dx: fc.double({ min: -100, max: 100, noNaN: true }),
          dy: fc.double({ min: -TERMINAL_VELOCITY * 2, max: 100, noNaN: true }),
          dz: fc.double({ min: -100, max: 100, noNaN: true }),
        }),
        deltaTime: fc.double({ min: 0, max: 0.1, noNaN: true }),
      }),
    ])(async ({ isGrounded, velocity, deltaTime }) => {
      if (deltaTime < 1e-9) {
        return
      }

      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld(isGrounded, velocity))
        const initialPlayer = (yield* _(world.query(playerQuery)))[0]!
        const gravityValue = initialPlayer.gravity.value
        yield* _(physicsSystem)
        const updatedPlayer = (yield* _(world.query(playerQuery)))[0]!
        const newPosition = updatedPlayer.position
        const newVelocity = updatedPlayer.velocity
        // Expected Velocity Calculation
        let expectedDy = velocity.dy
        if (!isGrounded) {
          expectedDy = Math.max(-TERMINAL_VELOCITY, velocity.dy - gravityValue * deltaTime)
        }
        let expectedDx = velocity.dx
        let expectedDz = velocity.dz
        if (isGrounded) {
          expectedDx *= FRICTION
          expectedDz *= FRICTION
        }
        // Expected Position Calculation
        const expectedX = initialPlayer.position.x + expectedDx * deltaTime
        const expectedY = initialPlayer.position.y + expectedDy * deltaTime
        const expectedZ = initialPlayer.position.z + expectedDz * deltaTime
        const tolerance = 1e-8
        expect(Math.abs(newVelocity.dy - expectedDy)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(newVelocity.dx - expectedDx)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(newVelocity.dz - expectedDz)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(newPosition.x - expectedX)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(newPosition.y - expectedY)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(newPosition.z - expectedZ)).toBeLessThanOrEqual(tolerance)
      })
      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(deltaTime))))
    })
  })

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
      const { playerId } = yield* _(setupWorld(false, { dx: 0, dy: 10, dz: 0 }))
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
      const { playerId } = yield* _(setupWorld(true, { dx: 10, dy: 0, dz: 10 }))
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
