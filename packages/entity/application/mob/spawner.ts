import { Array as Arr, Effect, Option, Ref } from 'effect'
import { TimeServicePort } from '../../domain/ports'
import { EntityManager } from './entity-manager'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import { MIN_SPAWN_DISTANCE, MAX_SPAWN_DISTANCE, DESPAWN_DISTANCE, MAX_ENTITY_COUNT, SPAWN_INTERVAL_FRAMES } from '../../domain/mob/spawner-config'
import { PASSIVE_MOBS, HOSTILE_MOBS } from '../../domain/mob/mob-categories'


const getSpawnPosition = (playerPosition: Position, cursor: number): Position => {
  const angle = ((cursor % 16) / 16) * Math.PI * 2
  const distance = MIN_SPAWN_DISTANCE + (cursor % 4) * 8

  return {
    x: playerPosition.x + Math.cos(angle) * distance,
    y: playerPosition.y,
    z: playerPosition.z + Math.sin(angle) * distance,
  }
}

const selectMobType = (isNight: boolean, cursor: number): EntityType => {
  if (isNight) {
    return Option.getOrElse(Arr.get(HOSTILE_MOBS, cursor % HOSTILE_MOBS.length), () => EntityType.Zombie)
  }

  return Option.getOrElse(Arr.get(PASSIVE_MOBS, cursor % PASSIVE_MOBS.length), () => EntityType.Cow)
}

type SpawnPositionResolver = (
  candidatePosition: Position,
) => Effect.Effect<Option.Option<Position>, never>

export class MobSpawner extends Effect.Service<MobSpawner>()(
  '@minecraft/entity/MobSpawner',
  {
    effect: Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const timeService = yield* TimeServicePort
      const spawnFrameRef = yield* Ref.make(0)
      const spawnCursorRef = yield* Ref.make(0)
      return {
        trySpawn: (
          playerPosition: Position,
          spawnResolver?: SpawnPositionResolver,
        ): Effect.Effect<Option.Option<EntityId>, never> =>
          Effect.gen(function* () {
            const frame = yield* Ref.updateAndGet(spawnFrameRef, (value) => value + 1)
            if (frame % SPAWN_INTERVAL_FRAMES !== 0) {
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
            const sdx = spawnPosition.x - playerPosition.x
            const sdz = spawnPosition.z - playerPosition.z
            const spawnDistanceSqXZ = sdx * sdx + sdz * sdz

            // Spawn RING is an XZ band (mobs appear around the player at 16-40 blocks).
            if (spawnDistanceSqXZ < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE || spawnDistanceSqXZ > MAX_SPAWN_DISTANCE * MAX_SPAWN_DISTANCE) {
              return Option.none<EntityId>()
            }

            // Despawn is measured in 3D (shouldDespawnEntity), so a spawn resolver that drops
            // the mob to a surface far above/below the player could place it beyond the despawn
            // radius — spawning a mob that vanishes the very next tick. Reject such spawns so the
            // spawn gate is consistent with the despawn gate's 3D metric.
            const sdy = spawnPosition.y - playerPosition.y
            if (spawnDistanceSqXZ + sdy * sdy >= DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
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

export const MobSpawnerLive = MobSpawner.Default
