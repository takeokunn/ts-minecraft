import * as THREE from 'three'
import type { FrameHandlerDeps } from '@ts-minecraft/app/frame/types'
import type { Position } from '@ts-minecraft/core'
import { ENTITY_CENTER_Y_OFFSET, PLAYER_ATTACK_RADIUS, PLAYER_ATTACK_REACH } from '@ts-minecraft/app/frame-handler.config'

const scratchCameraDirection = new THREE.Vector3()

export const hasAttackableTargetInCombatRange = (
  entities: ReadonlyArray<{ readonly position: Position }>,
  camera: FrameHandlerDeps['camera'],
  targetHitDistance: number | null,
): boolean => {
  camera.getWorldDirection(scratchCameraDirection)
  scratchCameraDirection.normalize()
  const dirX = scratchCameraDirection.x
  const dirY = scratchCameraDirection.y
  const dirZ = scratchCameraDirection.z

  const rayOrigin = camera.position
  const radiusSq = PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS

  for (const entity of entities) {
    const ex = entity.position.x - rayOrigin.x
    const ey = entity.position.y + ENTITY_CENTER_Y_OFFSET - rayOrigin.y
    const ez = entity.position.z - rayOrigin.z
    const alongRay = ex * dirX + ey * dirY + ez * dirZ
    if (alongRay < 0 || alongRay > PLAYER_ATTACK_REACH) continue
    if (targetHitDistance !== null && alongRay > targetHitDistance) continue

    const perpendicularSq = Math.max(0, (ex * ex + ey * ey + ez * ez) - alongRay * alongRay)
    if (perpendicularSq > radiusSq) continue

    return true
  }

  return false
}
