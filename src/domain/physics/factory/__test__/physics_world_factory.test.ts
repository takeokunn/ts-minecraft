import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { PhysicsWorldFactory } from '../physics_world_factory'

describe('PhysicsWorldFactory', () => {
  it.effect('creates world and steps', () =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldFactory.create()
      const stepped = yield* PhysicsWorldFactory.step(world, 0.016, 0)
      expect(stepped.state.totalTime).toBeGreaterThan(0)
    })
  )

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('steps handle active body counts', () => Effect.unit)
})
