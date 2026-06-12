import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { TimeServicePort } from '../../domain/ports'
import { HOSTILE_MOBS, PASSIVE_MOBS, type EntityId, EntityManager, EntityManagerLive, MobSpawner, MobSpawnerLive } from '@ts-minecraft/entity'

const makeTimeLayer = (night: boolean) =>
  Layer.succeed(TimeServicePort, TimeServicePort.of({
    _tag: '@minecraft/entity/domain/TimeServicePort' as const,
    isNight: () => Effect.succeed(night),
  }))

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
          body: (s) => Effect.gen(function* () {
            const found = yield* spawner.trySpawn({ x: 0, y: 64, z: 0 })
            return { found, i: s.i + 1 }
          }),
        }
      )

      expect(Option.isSome(state.found)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      // Any hostile mob (Zombie, Creeper, or Skeleton) may spawn at night via rotation
      expect(HOSTILE_MOBS).toContain(entities[0]?.type)
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
          body: (s) => Effect.gen(function* () {
            const found = yield* spawner.trySpawn({ x: 0, y: 64, z: 0 })
            return { found, i: s.i + 1 }
          }),
        }
      )

      expect(Option.isSome(state.found)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities.length).toBe(1)
      // Only passive mobs spawn during the day
      expect(PASSIVE_MOBS).toContain(entities[0]?.type)
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

  it.effect('getSpawnBounds returns valid min and max spawn distances', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const bounds = yield* spawner.getSpawnBounds()
      expect(bounds.minDistance).toBeGreaterThan(0)
      expect(bounds.maxDistance).toBeGreaterThan(bounds.minDistance)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )

  it.effect('uses an optional spawn resolver to override the final spawn height', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      const state = yield* Effect.iterate(
        { found: Option.none<EntityId>(), i: 0 },
        {
          while: (current) => Option.isNone(current.found) && current.i < 60,
          body: (current) => Effect.gen(function* () {
            const found = yield* spawner.trySpawn(
              { x: 0, y: 64, z: 0 },
              (candidatePosition) => Effect.succeed(Option.some({
                x: candidatePosition.x,
                y: 12.5,
                z: candidatePosition.z,
              })),
            )
            return { found, i: current.i + 1 }
          }),
        },
      )

      expect(Option.isSome(state.found)).toBe(true)

      const entities = yield* entityManager.getEntities()
      expect(entities).toHaveLength(1)
      expect(entities[0]?.position.y).toBe(12.5)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )

  it.effect('rejects a spawn attempt when the optional spawn resolver returns none', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      yield* Effect.forEach(
        Arr.makeBy(60, () => undefined),
        () => spawner.trySpawn({ x: 0, y: 64, z: 0 }, () => Effect.succeed(Option.none())),
        { concurrency: 1, discard: true },
      )

      const count = yield* entityManager.getCount()
      expect(count).toBe(0)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )
})
