import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { PhysicsWorldRepository, PhysicsWorldRepositoryLive } from '../physics_world_repository'
import { PhysicsWorldFactory } from '../../factory/physics_world_factory'

describe('PhysicsWorldRepository', () => {
  const layer = PhysicsWorldRepositoryLive

  it.effect('saves and finds worlds', () =>
    Effect.gen(function* () {
      const repository = yield* PhysicsWorldRepository
      const world = yield* PhysicsWorldFactory.create()
      yield* repository.save(world)
      const loaded = yield* repository.find(world.id)
      expect(Option.isSome(loaded)).toBe(true)
    }).pipe(Effect.provideLayer(layer))
  )

  it.effect.prop('stores multiple worlds', [fc.integer({ min: 1, max: 3 })], ([count]) =>
    Effect.gen(function* () {
      const repository = yield* PhysicsWorldRepository
      const worlds = yield* Effect.all(
        Array.from({ length: count }, () => PhysicsWorldFactory.create({}))
      )
      for (const world of worlds) {
        yield* repository.save(world)
      }
      const loaded = yield* repository.find(worlds[count - 1]?.id ?? worlds[0].id)
      expect(Option.isSome(loaded)).toBe(true)
    }).pipe(Effect.provideLayer(layer))
  )
})
