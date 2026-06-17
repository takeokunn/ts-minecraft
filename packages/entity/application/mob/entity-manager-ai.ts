import { MutableRef } from 'effect'
import type { EntityId } from '../../domain/mob/entity'
import { EntityType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import {
  prepareEntityAIFrame,
  type EntityFrameContext,
} from './entity-manager-ai-frame'
import { applyEntityAIFrame } from './entity-manager-ai-apply'

export const processEntityAI = (
  entity: ManagedEntity,
  entityId: EntityId,
  ctx: EntityFrameContext,
  dirtyRef: MutableRef.MutableRef<boolean>,
  fireDamageRef: MutableRef.MutableRef<boolean>,
  hasCreeperRef: MutableRef.MutableRef<boolean>,
  hasShearedSheepRef: MutableRef.MutableRef<boolean>,
): ManagedEntity => {
  const frame = prepareEntityAIFrame(entity, entityId, ctx)

  if (entity.type === EntityType.Creeper) MutableRef.set(hasCreeperRef, true)
  if (entity.woolRegrowthTicks > 0) MutableRef.set(hasShearedSheepRef, true)

  if (frame.fireTick.changed || frame.burnDamage > 0) MutableRef.set(dirtyRef, true)
  if (frame.fireTick.damage > 0) MutableRef.set(fireDamageRef, true)

  const next = applyEntityAIFrame(entity, ctx, frame)
  if (next !== entity) MutableRef.set(dirtyRef, true)

  return next
}
