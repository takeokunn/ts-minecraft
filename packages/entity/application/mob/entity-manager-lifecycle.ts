import { Effect, HashMap, Option, Ref } from 'effect'
import type { Entity } from '../../domain/mob/entity'
import type { EntityId } from '../../domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { shouldDespawnEntity } from '../../domain/mob/entity-manager-utils'
import { invalidateEntityCacheAndBumpStructureVersion } from './entity-manager-cache'

export const makeEntityManagerLifecycle = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  despawnFarEntities: (
    playerPosition: Position,
    maxDistance: number,
  ): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const removedCount = yield* Ref.modify(entitiesRef, (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
        let count = 0
        let updatedEntities = entities

        HashMap.forEach(entities, (entity, entityId) => {
          if (!shouldDespawnEntity(entity, playerPosition, maxDistance)) {
            return
          }

          count += 1
          updatedEntities = HashMap.remove(updatedEntities, entityId)
        })

        return [count, count > 0 ? updatedEntities : entities]
      })
      if (removedCount > 0) yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      return removedCount
    }),

  despawnAllEntities: (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const removedCount = yield* Ref.modify(
        entitiesRef,
        (entities): [number, HashMap.HashMap<EntityId, ManagedEntity>] => {
          const count = HashMap.size(entities)
          return [count, count > 0 ? HashMap.empty() : entities]
        },
      )
      if (removedCount > 0) yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      return removedCount
    }),
})
