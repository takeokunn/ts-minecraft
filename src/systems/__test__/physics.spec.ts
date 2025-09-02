import { Effect, Layer, Option } from 'effect'
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
  it('should apply gravity to a falling entity', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld(false, { dx: 0, dy: 0, dz: 0 }))

      yield* _(physicsSystem)

      const player = (yield* _(world.query(playerQuery)))[0]!
      const gravity = (yield* _(world.getComponent(playerId, 'gravity'))).pipe(Option.getOrThrow)
      const expectedDy = -gravity.value * 0.016
      expect(player.velocity.dy).toBeCloseTo(expectedDy)
      expect(player.position.y).toBeCloseTo(expectedDy * 0.016)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(0.016))))
  })

  it('should apply friction to a grounded entity', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld(true, { dx: 10, dy: 0, dz: 10 }))

      yield* _(physicsSystem)

      const player = (yield* _(world.query(playerQuery)))[0]!
      expect(player.velocity.dx).toBeCloseTo(10 * FRICTION)
      expect(player.velocity.dz).toBeCloseTo(10 * FRICTION)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(0.016))))
  })

  it('should not exceed terminal velocity', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld(false, { dx: 0, dy: -TERMINAL_VELOCITY - 1, dz: 0 }))

      yield* _(physicsSystem)

      const player = (yield* _(world.query(playerQuery)))[0]!
      expect(player.velocity.dy).toBe(-TERMINAL_VELOCITY)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockDeltaTime(0.016))))
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
})