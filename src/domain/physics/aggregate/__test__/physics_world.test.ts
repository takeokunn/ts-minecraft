import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { PhysicsWorldAggregate } from '../physics_world'

describe('PhysicsWorldAggregate', () => {
  it.effect('creates world', () =>
    Effect.map(PhysicsWorldAggregate.create({}), (world) => {
      expect(world.state.isRunning).toBe(false)
    })
  )

  it.effect('starts and steps world', () =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const running = yield* PhysicsWorldAggregate.start(world)
      expect(running.state.isRunning).toBe(true)
      const stepped = yield* PhysicsWorldAggregate.step(running, 0.016, 2)
      expect(stepped.state.totalTime).toBeGreaterThan(0)
    })
  )

  it.effect.prop('step accumulates simulation time', [fc.float({ min: 0.01, max: 0.1 })], ([dt]) =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldAggregate.create({})
      const stepped = yield* PhysicsWorldAggregate.step(world, dt, 0)
      expect(stepped.state.totalTime).toBeGreaterThan(world.state.totalTime)
    })
  )
})
