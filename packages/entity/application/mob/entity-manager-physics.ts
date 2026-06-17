import { MutableRef } from 'effect'
import { type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import {
  type EntityPhysicsFrameContext,
  prepareEntityPhysicsFrame,
} from './entity-manager-physics-frame'
import { shouldReuseEntityPhysicsFrame } from './entity-manager-physics-reuse'

export const processEntityPhysics = (
  entity: ManagedEntity,
  entityId: EntityId,
  ctx: EntityPhysicsFrameContext,
  dirtyRef: MutableRef.MutableRef<boolean>,
): ManagedEntity => {
  const frame = prepareEntityPhysicsFrame(entity, entityId, ctx)

  /* c8 ignore start -- early-return when entity state is identical after physics; requires exact position/velocity match */
  if (shouldReuseEntityPhysicsFrame(entity, frame)) {
    return entity
  }
  /* c8 ignore end */

  MutableRef.set(dirtyRef, true)
  return {
    ...entity,
    position: frame.position,
    velocity: frame.velocity,
    wanderDirection: frame.wanderDirection,
    isGrounded: frame.isGrounded,
    stuckTicks: frame.stuckTicks,
  }
}
