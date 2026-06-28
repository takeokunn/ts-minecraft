import { HashMap, Option } from 'effect'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { EntityDrop } from '../../domain/mob/drop'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { DragonPhase } from '../../domain/mob/ender-dragon/dragon-phase'
import { resolveDamagedManagedEntityState } from './entity-manager-damage-enderman'

// The Ender Dragon is NOT removed when its health reaches 0. Instead it enters the death
// sequence: health is clamped to 0 and dragonDeathProgress starts at 0, so the per-tick
// update plays out the death animation and emits the egg/portal/XP events. The dragon is
// removed only on the death sequence's Complete event (see entity-manager-dragon.ts).
const beginDragonDeath = (entity: ManagedEntity): ManagedEntity => ({
  ...entity,
  health: 0,
  velocity: { x: 0, y: 0, z: 0 },
  dragonDeathProgress: 0,
  dragonPhase: entity.dragonPhase === null ? null : { ...entity.dragonPhase, phase: DragonPhase.DeathSequence },
})

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
    // EnderDragon already mid-death-sequence: ignore further damage (don't restart it).
    if (entity.type === EntityType.EnderDragon && entity.dragonDeathProgress !== null) {
      return [Option.none(), entities]
    }
    if (entity.type === EntityType.EnderDragon) {
      return [Option.none(), HashMap.set(entities, entityId, beginDragonDeath(entity))]
    }
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
