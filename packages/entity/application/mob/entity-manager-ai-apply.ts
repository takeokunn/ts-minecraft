import type { Vector3 } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { makeWanderDirectionFromHash } from '../../domain/mob/entity-utils'
import { WANDER_REDIRECT_PROBABILITY } from '../../domain/mob/entity-manager-utils'
import {
  AIState,
  computeStateVelocityInto,
} from '../../domain/mob/state-machine'
import {
  type EntityAIFrame,
  type EntityFrameContext,
} from './entity-manager-ai-frame'
import { shouldReuseEntityAIFrame } from './entity-manager-ai-reuse'
import { tryApplyEndermanTeleport } from './entity-manager-ai-enderman-teleport'

const _stateVel = { x: 0, y: 0, z: 0 }

export const applyEntityAIFrame = (
  entity: ManagedEntity,
  ctx: EntityFrameContext,
  frame: EntityAIFrame,
): ManagedEntity => {
  const { tick, playerPosition } = ctx

  if (entity.knockbackSecsRemaining > 0) {
    return {
      ...entity,
      ...frame.tickedBreeding,
      health: frame.nextHealth,
      isProvoked: frame.isProvoked,
      attackCooldownRemaining: frame.nextAttackCooldown,
      fireSecsRemaining: frame.fireTick.fireSecsRemaining,
      fireDamageAccumulatorSecs: frame.fireTick.fireDamageAccumulatorSecs,
      knockbackSecsRemaining: Math.max(0, entity.knockbackSecsRemaining - ctx.deltaTime),
    }
  }

  if (shouldReuseEntityAIFrame(entity, frame)) {
    if (frame.nextAttackCooldown === entity.attackCooldownRemaining && !frame.breedingChanged && frame.isProvoked === entity.isProvoked) {
      return entity
    }
    return {
      ...entity,
      ...frame.tickedBreeding,
      health: frame.nextHealth,
      isProvoked: frame.isProvoked,
      attackCooldownRemaining: frame.nextAttackCooldown,
      fireSecsRemaining: frame.fireTick.fireSecsRemaining,
      fireDamageAccumulatorSecs: frame.fireTick.fireDamageAccumulatorSecs,
    }
  }

  const teleportedEntity = tryApplyEndermanTeleport(entity, ctx, frame)
  if (teleportedEntity !== null) {
    return teleportedEntity
  }

  const wanderDirection =
    frame.nextState === AIState.Wander
    && (entity.aiState !== AIState.Wander || frame.randomWanderRoll < WANDER_REDIRECT_PROBABILITY)
      ? makeWanderDirectionFromHash(frame.hash, tick)
      : entity.wanderDirection

  computeStateVelocityInto(
    _stateVel,
    frame.nextState,
    entity.position.x, entity.position.z,
    playerPosition.x, playerPosition.z,
    entity.speed,
    wanderDirection.x, wanderDirection.y, wanderDirection.z,
  )
  const velocity: Vector3 = {
    x: _stateVel.x,
    y: entity.velocity.y,
    z: _stateVel.z,
  }

  return {
    ...entity,
    ...frame.tickedBreeding,
    health: frame.nextHealth,
    aiState: frame.nextState,
    isProvoked: frame.isProvoked,
    velocity,
    wanderDirection,
    attackCooldownRemaining: frame.nextAttackCooldown,
    fireSecsRemaining: frame.fireTick.fireSecsRemaining,
    fireDamageAccumulatorSecs: frame.fireTick.fireDamageAccumulatorSecs,
    stuckTicks: frame.nextState === AIState.Chase ? entity.stuckTicks : 0,
  }
}
