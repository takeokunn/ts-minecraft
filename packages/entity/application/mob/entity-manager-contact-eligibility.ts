import type { Position } from '@ts-minecraft/core'
import { EntityType } from '../../domain/mob/entity'
import { type ManagedEntity } from '../../domain/mob/entity-internal'
import { distanceToPlayerSq } from '../../domain/mob/state-machine'

export const canHostileContactDamagePlayer = (
  entity: ManagedEntity,
  playerPosition: Position,
): boolean => {
  if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return false
  if (entity.type === EntityType.Skeleton) return false
  if (entity.type === EntityType.Enderman && !entity.isProvoked) return false
  if (entity.attackCooldownRemaining > 0) return false

  const distSq = distanceToPlayerSq(entity.position, playerPosition)
  return distSq <= entity.attackRange * entity.attackRange
}
