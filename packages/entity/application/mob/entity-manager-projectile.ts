import type { Position } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

export type ProjectileBlocker = (position: Position) => boolean

export const SKELETON_SHOT_SOURCE_EYE_HEIGHT = 1.6
export const SKELETON_SHOT_TARGET_HEIGHT = 1.0
export const PROJECTILE_PATH_SAMPLE_STEP = 0.25

export const makeSkeletonShotSourcePosition = (entity: ManagedEntity): Position => ({
  x: entity.position.x,
  y: entity.position.y + SKELETON_SHOT_SOURCE_EYE_HEIGHT,
  z: entity.position.z,
})

export const makeSkeletonShotTargetPosition = (playerPosition: Position): Position => ({
  x: playerPosition.x,
  y: playerPosition.y + SKELETON_SHOT_TARGET_HEIGHT,
  z: playerPosition.z,
})

export const isShotPathBlocked = (
  from: Position,
  to: Position,
  isProjectileBlocked?: ProjectileBlocker,
  sampleStep: number = PROJECTILE_PATH_SAMPLE_STEP,
): boolean => {
  if (!isProjectileBlocked) return false

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const length = Math.hypot(dx, dy, dz)
  if (length === 0) return false

  const steps = Math.max(1, Math.ceil(length / sampleStep))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (isProjectileBlocked({
      x: from.x + dx * t,
      y: from.y + dy * t,
      z: from.z + dz * t,
    })) {
      return true
    }
  }

  return false
}
