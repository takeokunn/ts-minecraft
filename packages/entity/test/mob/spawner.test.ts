import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { TimeServicePort } from '../../domain/time-service-port'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager';
import { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner';
import { type EntityId } from '@ts-minecraft/entity/domain/mob/entity';
import { HOSTILE_MOBS, PASSIVE_MOBS } from '@ts-minecraft/entity/domain/mob/mob-categories';
import { SPAWN_INTERVAL_SECS } from '@ts-minecraft/entity/domain/mob/spawner-config';
import { expectSome } from './test-utils'

const makeTimeLayer = (night: boolean) =>
  Layer.succeed(TimeServicePort, TimeServicePort.of({
    _tag: '@minecraft/entity/domain/TimeServicePort' as const,
    isNight: () => Effect.succeed(night),
  }))

const makeSpawnerLayer = (night: boolean) =>
  Layer.mergeAll(
    EntityManager.Default,
    MobSpawner.Default.pipe(
      Layer.provide(EntityManager.Default),
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

      expectSome(state.found)

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

      expectSome(state.found)

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

      expectSome(state.found)

      const entities = yield* entityManager.getEntities()
      expect(entities).toHaveLength(1)
      expect(entities[0]?.position.y).toBe(12.5)
    }).pipe(Effect.provide(makeSpawnerLayer(false)))
  )

  it.effect('rejects a resolved spawn that lands beyond the 3D despawn radius (would instantly despawn)', () =>
    Effect.gen(function* () {
      const spawner = yield* MobSpawner
      const entityManager = yield* EntityManager

      // Resolve every candidate to 70 blocks below the player. Even the closest spawn-ring
      // candidate (XZ 16) is then sqrt(16² + 70²) ≈ 71.8 blocks away in 3D — past DESPAWN_DISTANCE
      // (64) — so it must never spawn (a mob there would vanish the next tick).
      yield* Effect.forEach(
        Arr.makeBy(60, () => undefined),
        () => spawner.trySpawn(
          { x: 0, y: 64, z: 0 },
          (candidatePosition) => Effect.succeed(Option.some({ x: candidatePosition.x, y: 64 - 70, z: candidatePosition.z })),
        ),
        { concurrency: 1, discard: true },
      )

      expect(yield* entityManager.getCount()).toBe(0)
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

  it.effect('spawn rate tracks elapsed time, not call count (frame-rate independent)', () =>
    Effect.gen(function* () {
      const TOTAL = 6 * SPAWN_INTERVAL_SECS // 1.8s of simulated wall-clock

      // Runs `calls` spawn attempts, each advancing the clock by `deltaSecs`, in a
      // fresh spawner instance, and returns how many mobs actually spawned.
      const countSpawns = (calls: number, deltaSecs: number) =>
        Effect.gen(function* () {
          const spawner = yield* MobSpawner
          const entityManager = yield* EntityManager
          yield* Effect.forEach(
            Arr.makeBy(calls, () => undefined),
            () => spawner.trySpawn({ x: 0, y: 64, z: 0 }, undefined, deltaSecs),
            { concurrency: 1, discard: true },
          )
          return yield* entityManager.getCount()
        }).pipe(Effect.provide(makeSpawnerLayer(false)))

      // Same TOTAL elapsed time, split coarsely (low fps) vs finely (high fps).
      // The old frame-count gate would have spawned 3x more in the high-fps run.
      const highFps = yield* countSpawns(18, TOTAL / 18) // 0.1s steps
      const lowFps = yield* countSpawns(6, TOTAL / 6) // 0.3s steps

      expect(lowFps).toBe(6)
      expect(highFps).toBe(6)
      expect(highFps).toBe(lowFps)
    })
  )
})
