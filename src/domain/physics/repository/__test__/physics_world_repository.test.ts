import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { PhysicsWorldRepository, PhysicsWorldRepositoryLive } from '../physics_world_repository'
import { PhysicsWorldFactory } from '../../factory/physics_world_factory'
import { provideLayers } from '../../../../testing/effect'

describe('PhysicsWorldRepository', () => {
  const layer = PhysicsWorldRepositoryLive

  it.effect('saves and finds worlds', () =>
    provideLayers(
      Effect.gen(function* () {
      const repository = yield* PhysicsWorldRepository
      const world = yield* PhysicsWorldFactory.create()
      yield* repository.save(world)
      const loaded = yield* repository.find(world.id)
      expect(Option.isSome(loaded)).toBe(true)
      }),
      layer
    )
  )

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('stores multiple worlds', () => Effect.unit)
})
