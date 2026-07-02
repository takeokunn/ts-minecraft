import { Effect, type HashMap, Option, type Ref } from 'effect'
import type { DeltaTimeSecs, Vector3 } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import type { Entity, EntityId, EntityType } from '../../domain/mob/entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import type { DragonDeathEvent } from '../../domain/mob/ender-dragon/dragon-death'
import { makeEntityManagerUpdate } from './entity-manager-internal-update'
import { runBreedingUpdate } from './entity-manager-breeding-update'

export const makeEntityManagerUpdateWithBreeding = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  updateTickRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
  burnAccumulatorRef: Ref.Ref<number>,
  birthsRef: Ref.Ref<number>,
  dragonEventsRef: Ref.Ref<ReadonlyArray<DragonDeathEvent>>,
  addEntity: (type: EntityType, position: Position, ageTicks?: number) => Effect.Effect<EntityId, never>,
) => {
  const updateModule = makeEntityManagerUpdate(
    entitiesRef,
    updateTickRef,
    cachedEntitiesRef,
    structureVersionRef,
    burnAccumulatorRef,
    dragonEventsRef,
  )

  return {
    applyPhysics: updateModule.applyPhysics,
    update: (
      deltaTime: DeltaTimeSecs,
      playerPosition: Position,
      isNight = true,
      playerLookDirection?: Vector3,
      playerLookOrigin: Position = playerPosition,
      playerLookBlocked?: (position: Position) => boolean,
      daylightBurnProtected: boolean = false,
      remotePlayerPositions: ReadonlyArray<Position> = [],
    ) =>
      Effect.gen(function* () {
        yield* updateModule.update(
          deltaTime,
          playerPosition,
          isNight,
          playerLookDirection,
          playerLookOrigin,
          playerLookBlocked,
          daylightBurnProtected,
          remotePlayerPositions,
        )
        yield* runBreedingUpdate(entitiesRef, birthsRef, cachedEntitiesRef, addEntity)
      }),
  }
}
