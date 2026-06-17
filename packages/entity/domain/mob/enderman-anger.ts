import type { Position, Vector3 } from '@ts-minecraft/core'

export const ENDERMAN_LOOK_PROVOKE_RADIUS = 0.65

const ENDERMAN_PROVOKE_TARGET_HEIGHT = 2.1
const ENDERMAN_SIGHT_SAMPLE_STEP = 0.25

const magnitudeSq = (v: Vector3): number => v.x * v.x + v.y * v.y + v.z * v.z

export type EndermanSightBlocker = (position: Position) => boolean

export type EndermanLookContext = {
  readonly playerPosition: Position
  readonly playerLookDirection: Vector3
  readonly endermanPosition: Position
  readonly detectionRange: number
  readonly isSightBlocked?: EndermanSightBlocker
}

export const isEndermanProvokedByLook = ({
  playerPosition,
  playerLookDirection,
  endermanPosition,
  detectionRange,
  isSightBlocked,
}: EndermanLookContext): boolean => {
  const lookLenSq = magnitudeSq(playerLookDirection)
  if (lookLenSq <= 0) return false

  const targetX = endermanPosition.x - playerPosition.x
  const targetY = endermanPosition.y + ENDERMAN_PROVOKE_TARGET_HEIGHT - playerPosition.y
  const targetZ = endermanPosition.z - playerPosition.z
  const targetDistSq = targetX * targetX + targetY * targetY + targetZ * targetZ
  if (targetDistSq <= 0 || targetDistSq > detectionRange * detectionRange) return false

  const invLookLen = 1 / Math.sqrt(lookLenSq)
  const lookX = playerLookDirection.x * invLookLen
  const lookY = playerLookDirection.y * invLookLen
  const lookZ = playerLookDirection.z * invLookLen
  const forwardDistance = targetX * lookX + targetY * lookY + targetZ * lookZ
  if (forwardDistance <= 0) return false

  const rayMissDistSq = Math.max(0, targetDistSq - forwardDistance * forwardDistance)
  if (rayMissDistSq > ENDERMAN_LOOK_PROVOKE_RADIUS * ENDERMAN_LOOK_PROVOKE_RADIUS) return false
  if (isSightBlocked === undefined) return true

  const targetDistance = Math.sqrt(targetDistSq)
  const steps = Math.max(1, Math.ceil(targetDistance / ENDERMAN_SIGHT_SAMPLE_STEP))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (isSightBlocked({
      x: playerPosition.x + targetX * t,
      y: playerPosition.y + targetY * t,
      z: playerPosition.z + targetZ * t,
    })) return false
  }

  return true
}
