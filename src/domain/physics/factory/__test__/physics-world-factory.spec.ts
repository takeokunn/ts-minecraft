import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { PhysicsWorldFactory } from '../physics-world-factory'

describe('PhysicsWorldFactory', () => {
  it.effect('creates world and steps', () =>
    Effect.gen(function* () {
      const world = yield* PhysicsWorldFactory.create()
      const stepped = yield* PhysicsWorldFactory.step(world, 0.016, 0)
      expect(stepped.state.totalTime).toBeGreaterThan(0)
    })
  )

  const activeBodiesArb = fc.integer({ min: 0, max: 5_000 })

  it.effect.prop(
    'steps handle active body counts',
    [activeBodiesArb],
    ([activeBodies]) =>
      Effect.gen(function* () {
        const world = yield* PhysicsWorldFactory.create()
        const stepped = yield* PhysicsWorldFactory.step(world, 0.016, activeBodies)
        expect(stepped.state.activeBodies).toBe(activeBodies)
        expect(stepped.state.totalTime).toBeGreaterThan(0)
      })
  )
})
