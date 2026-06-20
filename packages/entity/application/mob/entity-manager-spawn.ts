import { zero, type Position } from '@ts-minecraft/core'
import { createEntity as createEntityModel, type EntityId, type EntityType } from '../../domain/mob/entity'
import type { EntityDrop } from '../../domain/mob/drop'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import { getMobDefinition } from '../../domain/mob/mobs/get-mob-definition'
import { AIState } from '../../domain/mob/state-machine'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

export const createSpawnedManagedEntity = (
  entityId: EntityId,
  type: EntityType,
  position: Position,
  ageTicks: number = BABY_GROW_TICKS,
): ManagedEntity => {
  const definition = getMobDefinition(type)

  return {
    ...createEntityModel({
      entityId,
      position,
      type,
      health: definition.maxHealth,
    }),
    behavior: definition.behavior,
    maxHealth: definition.maxHealth,
    attackDamage: definition.attackDamage,
    speed: definition.speed,
    detectionRange: definition.detectionRange,
    attackRange: definition.attackRange,
    fleeHealthThreshold: definition.fleeHealthThreshold,
    drops: definition.drops as ReadonlyArray<EntityDrop>,
    aiState: AIState.Idle,
    wanderDirection: zero,
    attackCooldownRemaining: 0,
    isProvoked: false,
    isGrounded: false,
    knockbackSecsRemaining: 0,
    fireSecsRemaining: 0,
    fireDamageAccumulatorSecs: 0,
    stuckTicks: 0,
    fuseSecs: 0,
    loveTicksRemaining: 0,
    breedCooldownRemaining: 0,
    ageTicks,
    woolRegrowthTicks: 0,
  }
}
