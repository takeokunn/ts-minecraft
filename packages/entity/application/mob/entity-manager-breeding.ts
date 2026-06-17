import { HashMap, Option } from 'effect'
import type { EntityId as EntityIdType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { afterBreedingParentState } from '../../domain/mob/breeding'

export const resetBreedingParentState = (
  entities: HashMap.HashMap<EntityIdType, ManagedEntity>,
  parentId: EntityIdType,
): HashMap.HashMap<EntityIdType, ManagedEntity> => {
  const parent = Option.getOrNull(HashMap.get(entities, parentId))
  return parent === null ? entities : HashMap.set(entities, parentId, { ...parent, ...afterBreedingParentState() })
}
