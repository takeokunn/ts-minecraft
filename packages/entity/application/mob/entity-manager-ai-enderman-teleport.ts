import type { Vector3 } from '@ts-minecraft/core'
import { EntityType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import {
  computeEndermanTeleportTarget,
  shouldEndermanTeleport,
} from '../../domain/mob/enderman-teleport'
import {
  AIState,
} from '../../domain/mob/state-machine'
import {
  type EntityAIFrame,
  type EntityFrameContext,
} from './entity-manager-ai-frame'
import { makeEndermanTeleportRolls } from './entity-manager-teleport'

export const tryApplyEndermanTeleport = (
  entity: ManagedEntity,
  ctx: EntityFrameContext,
  frame: EntityAIFrame,
): ManagedEntity | null => {
  if (
    entity.type !== EntityType.Enderman
    || frame.nextState !== AIState.Chase
    || !shouldEndermanTeleport(false, entity.stuckTicks, frame.randomWanderRoll)
  ) {
    return null
  }

  const teleportTarget = computeEndermanTeleportTarget(
    entity.position,
    ctx.playerPosition,
    makeEndermanTeleportRolls(frame.hash, ctx.tick),
  )
  if (teleportTarget === null) {
    return null
  }

  const velocity: Vector3 = { x: 0, y: entity.velocity.y, z: 0 }

  return {
    ...entity,
    ...frame.tickedBreeding,
    health: frame.nextHealth,
    position: teleportTarget,
    velocity,
    aiState: frame.nextState,
    isProvoked: frame.isProvoked,
    attackCooldownRemaining: frame.nextAttackCooldown,
    fireSecsRemaining: frame.fireTick.fireSecsRemaining,
    fireDamageAccumulatorSecs: frame.fireTick.fireDamageAccumulatorSecs,
    stuckTicks: 0,
  }
}
