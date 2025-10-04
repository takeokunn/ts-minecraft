import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { describe, expect } from 'vitest'
import { PhysicsWorldRepository, PhysicsWorldRepositoryLive } from '../physics-world-repository'
import { PhysicsWorldFactory } from '../../factory/physics-world-factory'
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

  it.effect('stores multiple worlds', () =>
    provideLayers(
      Effect.gen(function* () {
        const repository = yield* PhysicsWorldRepository
        const first = yield* PhysicsWorldFactory.create()
        const second = yield* PhysicsWorldFactory.create()

        yield* repository.save(first)
        yield* repository.save(second)

        const loadedFirst = yield* repository.find(first.id)
        const loadedSecond = yield* repository.find(second.id)

        expect(Option.isSome(loadedFirst)).toBe(true)
        expect(Option.isSome(loadedSecond)).toBe(true)

        if (Option.isSome(loadedFirst) && Option.isSome(loadedSecond)) {
          expect(loadedFirst.value.id).toBe(first.id)
          expect(loadedSecond.value.id).toBe(second.id)
          expect(loadedFirst.value.id).not.toBe(loadedSecond.value.id)
        }
      }),
      layer
    )
  )
})
