import { Effect, Option, Ref } from 'effect'
import { TimeServicePort } from '../../domain/ports'
import { EntityManager } from './entity-manager'
import type { EntityId } from '../../domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import { MAX_ENTITY_COUNT, MAX_SPAWN_DISTANCE, MIN_SPAWN_DISTANCE, SPAWN_INTERVAL_SECS } from '../../domain/mob/spawner-config'
import { getSpawnPosition, selectMobType } from './mob-spawner-helpers'
import { canSpawnAtPosition } from './mob-spawner-rules'

type SpawnPositionResolver = (
  candidatePosition: Position,
) => Effect.Effect<Option.Option<Position>, never>

export class MobSpawner extends Effect.Service<MobSpawner>()(
  '@minecraft/entity/MobSpawner',
  {
    effect: Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const timeService = yield* TimeServicePort
      // Accumulates real seconds across calls; a spawn is attempted once the
      // accumulator reaches SPAWN_INTERVAL_SECS (frame-rate / load independent).
      const spawnAccumulatorRef = yield* Ref.make(0)
      const spawnCursorRef = yield* Ref.make(0)
      return {
        // deltaSecs is the real elapsed time since the previous call (threaded from
        // the maintenance lane). It defaults to a full interval so callers that don't
        // thread time (tests / ad-hoc use) attempt a spawn on every call.
        trySpawn: (
          playerPosition: Position,
          spawnResolver?: SpawnPositionResolver,
          deltaSecs: number = SPAWN_INTERVAL_SECS,
        ): Effect.Effect<Option.Option<EntityId>, never> =>
          Effect.gen(function* () {
            // Drain one interval when the accumulator crosses the threshold; carry the
            // remainder so sub-interval deltas still sum correctly over time.
            const fires = yield* Ref.modify(spawnAccumulatorRef, (acc): [boolean, number] => {
              const next = acc + deltaSecs
              return next >= SPAWN_INTERVAL_SECS ? [true, next - SPAWN_INTERVAL_SECS] : [false, next]
            })
            if (!fires) {
              return Option.none<EntityId>()
            }

            const count = yield* entityManager.getCount()
            if (count >= MAX_ENTITY_COUNT) {
              return Option.none<EntityId>()
            }

            const isNight = yield* timeService.isNight()
            const cursor = yield* Ref.updateAndGet(spawnCursorRef, (value) => value + 1)

            const candidateSpawnPosition = getSpawnPosition(playerPosition, cursor)
            const spawnPositionOption = yield* (
              spawnResolver != null ? spawnResolver(candidateSpawnPosition) : Effect.succeed(Option.some(candidateSpawnPosition))
            )

            const spawnPosition = Option.getOrNull(spawnPositionOption)
            if (spawnPosition === null) {
              return Option.none<EntityId>()
            }
            if (!canSpawnAtPosition(playerPosition, spawnPosition)) {
              return Option.none<EntityId>()
            }

            const entityId = yield* entityManager.addEntity(
              selectMobType(isNight, cursor),
              spawnPosition,
            )

            return Option.some(entityId)
          }),

        getSpawnBounds: (): Effect.Effect<{ minDistance: number; maxDistance: number }, never> =>
          Effect.succeed({
            minDistance: MIN_SPAWN_DISTANCE,
            maxDistance: MAX_SPAWN_DISTANCE,
          }),

        getMaxPopulation: (): Effect.Effect<number, never> =>
          Effect.succeed(MAX_ENTITY_COUNT),
      }
    }),
  },
) {}
