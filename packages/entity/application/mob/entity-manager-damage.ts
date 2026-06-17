import { HashMap, Option } from 'effect'
import { type EntityId } from '../../domain/mob/entity'
import type { EntityDrop } from '../../domain/mob/drop'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { resolveDamagedManagedEntityState } from './entity-manager-damage-enderman'

export const damageManagedEntity = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  entityId: EntityId,
  amount: number,
): readonly [Option.Option<ReadonlyArray<EntityDrop>>, HashMap.HashMap<EntityId, ManagedEntity>] => {
  if (amount <= 0) {
    return [Option.none(), entities]
  }

  const entity = Option.getOrNull(HashMap.get(entities, entityId))
  if (!entity) {
    return [Option.none(), entities]
  }

  const nextHealth = entity.health - amount
  if (nextHealth <= 0) {
    return [Option.some(entity.drops), HashMap.remove(entities, entityId)]
  }

  const nextState = resolveDamagedManagedEntityState(entity, nextHealth)

  return [
    Option.none(),
    HashMap.set(entities, entityId, {
      ...entity,
      health: nextHealth,
      position: nextState.position,
      isProvoked: nextState.isProvoked,
    }),
  ]
}
