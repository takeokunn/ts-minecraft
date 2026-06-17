import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, type Entity, type EntityId as EntityIdType, type EntityType } from '../../domain/mob/entity'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import type { Position } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { createSpawnedManagedEntity } from './entity-manager-spawn'
import { invalidateEntityCacheAndBumpStructureVersion } from './entity-manager-cache'

export const updateManagedEntity = <A>(
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  entityId: EntityId,
  onMissing: A,
  f: (entity: ManagedEntity) => readonly [A, ManagedEntity | null],
): readonly [A, HashMap.HashMap<EntityId, ManagedEntity>] => {
  const entity = Option.getOrNull(HashMap.get(entities, entityId))
  if (!entity) return [onMissing, entities]

  const [result, nextEntity] = f(entity)
  if (nextEntity === null) return [result, entities]

  return [result, HashMap.set(entities, entityId, nextEntity)]
}

export const makeEntityManagerMutations = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  nextEntityNumberRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  addEntity: (
    type: EntityType,
    position: Position,
    ageTicks: number = BABY_GROW_TICKS,
  ): Effect.Effect<EntityIdType, never> =>
    Effect.gen(function* () {
      const entityId = yield* Ref.modify(nextEntityNumberRef, (next): [EntityIdType, number] => [
        EntityId.make(`entity-${next}`),
        next + 1,
      ])
      const managedEntity = createSpawnedManagedEntity(entityId, type, position, ageTicks)

      yield* Ref.update(entitiesRef, (entities) => HashMap.set(entities, entityId, managedEntity))
      yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)

      return entityId
    }),

  removeEntity: (entityId: EntityIdType): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const removed = yield* Ref.modify(
        entitiesRef,
        (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
          const entity = Option.getOrNull(HashMap.get(entities, entityId))
          return entity === null ? [false, entities] : [true, HashMap.remove(entities, entityId)]
        },
      )
      if (removed) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      }
      return removed
    }),
})
