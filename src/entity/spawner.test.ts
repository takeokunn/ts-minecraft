import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { TimeService } from '@/application/time/time-service'
import { EntityType, type EntityId } from '@/entity/entity'
import { EntityManager, EntityManagerLive } from '@/entity/entityManager'
import { MobSpawner, MobSpawnerLive } from '@/entity/spawner'

const makeTimeLayer = (night: boolean) =>
  Layer.succeed(TimeService, {
    advanceTick: () => Effect.void,
    getTimeOfDay: () => Effect.succeed(night ? 0 : 0.5),
    isNight: () => Effect.succeed(night),
    getDayLength: () => Effect.succeed(400),
    setDayLength: () => Effect.void,
    setTimeOfDay: () => Effect.void,
  } as unknown as TimeService)

const makeSpawnerLayer = (night: boolean) =>
  Layer.mergeAll(
    EntityManagerLive,
    MobSpawnerLive.pipe(
      Layer.provide(EntityManagerLive),
      Layer.provide(makeTimeLayer(night)),
    ),
  )

describe('entity/spawner', () => {
  it.effect('spawns hostile mobs at night', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      const state = yield* Effect.iterate(
        { found: Option.none<EntityId>(), i: 0 },
        {
          while: (s) => Option.isNone(s.found) && s.i < 60,
          body: (s) => spawner.trySpawn({ x: 0, y: 64, z: 0 }).pipe(Effect.map(found => ({ found, i: s.i + 1 }))),
        }
      )

      expect(Option.isSome(state.found)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      expect(entities[0]?.type).toBe(EntityType.Zombie)
    }).pipe(Effect.provide(makeSpawnerLayer(true)))
  )

  it.effect('spawns passive mobs during the day', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      const state = yield* Effect.iterate(
        { found: Option.none<EntityId>(), i: 0 },
        {
          while: (s) => Option.isNone(s.found) && s.i < 60,
          body: (s) => spawner.trySpawn({ x: 0, y: 64, z: 0 }).pipe(Effect.map(found => ({ found, i: s.i + 1 }))),
        }
      )

      expect(Option.isSome(state.found)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      expect(entities[0]?.type).not.toBe(EntityType.Zombie)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )

  it.effect('does not exceed configured population cap', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager
      const maxPopulation = yield* spawner.getMaxPopulation()

      yield* Effect.forEach(Arr.makeBy(maxPopulation * 40, () => undefined), () => spawner.trySpawn({ x: 0, y: 64, z: 0 }), { concurrency: 1, discard: true })

      const count = yield* entityManager.getCount()
      expect(count).toBeLessThanOrEqual(maxPopulation)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )
})
