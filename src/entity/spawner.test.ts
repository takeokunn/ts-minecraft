import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option } from 'effect'
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
  it('spawns hostile mobs at night', () => {
    const program = Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      let spawned: Option.Option<EntityId> = Option.none()
      for (let i = 0; i < 60; i++) {
        spawned = yield* spawner.trySpawn({ x: 0, y: 64, z: 0 })
        if (Option.isSome(spawned)) {
          break
        }
      }

      expect(Option.isSome(spawned)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      expect(entities[0]?.type).toBe(EntityType.Zombie)
    }).pipe(Effect.provide(makeSpawnerLayer(true)))

    Effect.runSync(program)
  })

  it('spawns passive mobs during the day', () => {
    const program = Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      let spawned: Option.Option<EntityId> = Option.none()
      for (let i = 0; i < 60; i++) {
        spawned = yield* spawner.trySpawn({ x: 0, y: 64, z: 0 })
        if (Option.isSome(spawned)) {
          break
        }
      }

      expect(Option.isSome(spawned)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      expect(entities[0]?.type).not.toBe(EntityType.Zombie)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))

    Effect.runSync(program)
  })

  it('does not exceed configured population cap', () => {
    const program = Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager
      const maxPopulation = yield* spawner.getMaxPopulation()

      for (let i = 0; i < maxPopulation * 40; i++) {
        yield* spawner.trySpawn({ x: 0, y: 64, z: 0 })
      }

      const count = yield* entityManager.getCount()
      expect(count).toBeLessThanOrEqual(maxPopulation)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))

    Effect.runSync(program)
  })
})
