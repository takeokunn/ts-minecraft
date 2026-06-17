import { Cause, Effect, Option } from 'effect'
import { type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { type EntityId } from '../../domain/mob/entity'
import { DESPAWN_DISTANCE } from '../../domain/mob/spawner-config'
import { makeTerrainAwareSpawnResolver, type ChunkManagerServiceLike } from './mob-maintenance-spawn-resolver'

type MobCleanupService = {
  readonly despawnFarEntities: (playerPosition: Position, maxDistance: number) => Effect.Effect<number, never>
  readonly despawnAllEntities: () => Effect.Effect<number, never>
}

type MobSpawnerLike = {
  readonly trySpawn: (
    playerPosition: Position,
    spawnResolver?: (candidatePosition: Position) => Effect.Effect<Option.Option<Position>, never>,
    deltaSecs?: number,
  ) => Effect.Effect<Option.Option<EntityId>, never>
}

export type MobMaintenanceServices = {
  readonly entityManager: MobCleanupService
  readonly chunkManagerService: ChunkManagerServiceLike
  readonly mobSpawner: MobSpawnerLike
}

export type MobMaintenanceInput = {
  readonly playerPos: Position
  readonly maintenanceDeltaTime: DeltaTimeSecs
  readonly mobsEnabled: boolean
  readonly mobsSpawnEnabled: boolean
  readonly timeOfDay: number
}

export type MobMaintenanceResult = {
  readonly despawnedCount: number
  readonly spawnResult: Option.Option<EntityId>
}

export const runMobMaintenance = (
  services: MobMaintenanceServices,
  input: MobMaintenanceInput,
): Effect.Effect<MobMaintenanceResult, never> =>
  Effect.gen(function* () {
    const { entityManager, chunkManagerService, mobSpawner } = services
    const {
      playerPos,
      maintenanceDeltaTime,
      mobsEnabled,
      mobsSpawnEnabled,
      timeOfDay,
    } = input

    const despawnedCount = mobsEnabled
      ? yield* entityManager.despawnFarEntities(playerPos, DESPAWN_DISTANCE)
      : yield* entityManager.despawnAllEntities()

    // R25: hostile mobs spawn only at night (per selectMobType); gate their spawn
    // surfaces on darkness. `timeOfDay` is fetched once by the frame orchestrator
    // and reused here so the mob package stays focused on spawn/despawn behavior.
    const isNightSpawn = timeOfDay < 0.25 || timeOfDay > 0.75
    const spawnResult = mobsSpawnEnabled
      ? yield* mobSpawner.trySpawn(
          playerPos,
          makeTerrainAwareSpawnResolver(chunkManagerService, isNightSpawn),
          // Real elapsed time gates the spawn cadence (frame-rate / load independent).
          maintenanceDeltaTime,
        ).pipe(
          /* c8 ignore start */
          Effect.catchAllCause((cause) =>
            Effect.gen(function* () {
              yield* Effect.logError(`Mob spawn error: ${Cause.pretty(cause)}`)
              return Option.none()
            }),
          ),
          /* c8 ignore end */
        )
      : Option.none()

    return { despawnedCount, spawnResult }
  })
