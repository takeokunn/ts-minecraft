import type { Position } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { distanceToPlayerSq } from '../../domain/mob/state-machine'
import {
  isShotPathBlocked,
  makeSkeletonShotSourcePosition,
  makeSkeletonShotTargetPosition,
  type ProjectileBlocker,
} from './entity-manager-projectile'

const SKELETON_SHOT_SAMPLE_STEP = 0.75

export const canSkeletonShootPlayer = (
  entity: ManagedEntity,
  playerPosition: Position,
  isProjectileBlocked?: ProjectileBlocker,
): boolean => {
  const distSq = distanceToPlayerSq(entity.position, playerPosition)
  if (distSq > entity.attackRange * entity.attackRange) return false

  return !isShotPathBlocked(
    makeSkeletonShotSourcePosition(entity),
    makeSkeletonShotTargetPosition(playerPosition),
    isProjectileBlocked,
    SKELETON_SHOT_SAMPLE_STEP,
  )
}
