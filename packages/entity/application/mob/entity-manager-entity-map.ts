import { Effect, HashMap, Ref } from 'effect'
import type { EntityId } from '../../domain/mob/entity'

export const mapManagedEntities = <T>(
  entities: HashMap.HashMap<EntityId, T>,
  f: (entity: T, id: EntityId) => T,
): HashMap.HashMap<EntityId, T> => {
  let result = entities
  for (const [id, entity] of entities) {
    const next = f(entity, id)
    if (next !== entity) result = HashMap.set(result, id, next)
  }
  return result
}

export const updateManagedEntities = <T>(
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, T>>,
  f: (entity: T, id: EntityId) => T,
): Effect.Effect<void, never> =>
  Ref.update(entitiesRef, (entities) => mapManagedEntities(entities, f))
