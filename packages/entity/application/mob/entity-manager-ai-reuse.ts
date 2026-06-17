import { AIState } from '../../domain/mob/state-machine'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import type { EntityAIFrame } from './entity-manager-ai-frame'

export const shouldReuseEntityAIFrame = (
  entity: ManagedEntity,
  frame: EntityAIFrame,
): boolean =>
  !frame.burning
  && !frame.fireTick.changed
  && frame.burnDamage === 0
  && frame.nextState === entity.aiState
  && (frame.nextState === AIState.Idle || frame.nextState === AIState.Attack)
  && entity.velocity.x === 0
  && entity.velocity.z === 0
  && frame.nextAttackCooldown === entity.attackCooldownRemaining
  && !frame.breedingChanged
  && frame.isProvoked === entity.isProvoked
