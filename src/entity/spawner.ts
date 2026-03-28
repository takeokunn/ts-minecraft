import { Array as Arr, Effect, Option, Ref } from 'effect'
import { TimeService } from '@/application/time/time-service'
import { EntityManager } from '@/entity/entityManager'
import { EntityType, type EntityId } from '@/entity/entity'
import type { Position } from '@/shared/kernel'

const MIN_SPAWN_DISTANCE = 16
const MAX_SPAWN_DISTANCE = 40
const MAX_ENTITY_COUNT = 24
const SPAWN_INTERVAL_FRAMES = 6

const PASSIVE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
]

const distance2D = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

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
    return EntityType.Zombie
  }

  return Option.getOrElse(Arr.get(PASSIVE_MOBS, cursor % PASSIVE_MOBS.length), () => EntityType.Cow)
}

export class MobSpawner extends Effect.Service<MobSpawner>()(
  '@minecraft/entity/MobSpawner',
  {
    effect: Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const timeService = yield* TimeService

      const spawnFrameRef = yield* Ref.make(0)
      const spawnCursorRef = yield* Ref.make(0)

      return {
        trySpawn: (playerPosition: Position): Effect.Effect<Option.Option<EntityId>, never> =>
          Effect.gen(function* () {
            const frame = yield* Ref.updateAndGet(spawnFrameRef, (value) => value + 1)
            if (frame % SPAWN_INTERVAL_FRAMES !== 0) {
              return Option.none<EntityId>()
            }

            const count = yield* entityManager.getCount()
            if (count >= MAX_ENTITY_COUNT) {
              return Option.none<EntityId>()
            }

            const [isNight, cursor] = yield* Effect.all(
              [timeService.isNight(), Ref.updateAndGet(spawnCursorRef, (value) => value + 1)],
              { concurrency: 'unbounded' },
            )
            const spawnPosition = getSpawnPosition(playerPosition, cursor)
            const spawnDistance = distance2D(spawnPosition, playerPosition)

            if (spawnDistance < MIN_SPAWN_DISTANCE || spawnDistance > MAX_SPAWN_DISTANCE) {
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
