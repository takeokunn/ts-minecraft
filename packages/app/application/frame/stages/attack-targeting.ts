import { Option } from 'effect'
import * as THREE from 'three'
import type { EntityId as EntityIdType } from '@ts-minecraft/entity/domain/mob/entity'
import type { Position } from '@ts-minecraft/core'
import { PLAYER_ATTACK_REACH, PLAYER_ATTACK_RADIUS, ENTITY_CENTER_Y_OFFSET } from '@ts-minecraft/app/frame-handler.config'

// Module-scoped scratch for the camera world-direction read. getWorldDirection
// requires a Vector3 to write into; reusing one avoids a per-call allocation.
// The per-entity test below uses pure scalar math (no Vector3 at all).
const scratchCameraDirection = new THREE.Vector3()

export const findAttackableEntity = (
  entities: ReadonlyArray<{ readonly entityId: EntityIdType; readonly position: Position }>,
  camera: THREE.PerspectiveCamera,
  maxDistance: number | null,
  maxReach: number = PLAYER_ATTACK_REACH,
): Option.Option<EntityIdType> => {
  camera.getWorldDirection(scratchCameraDirection)
  scratchCameraDirection.normalize()
  const dirX = scratchCameraDirection.x
  const dirY = scratchCameraDirection.y
  const dirZ = scratchCameraDirection.z

  const rayOrigin = camera.position
  const radiusSq = PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS

  let closestId: EntityIdType | null = null
  let closestDist = Number.POSITIVE_INFINITY
  for (const entity of entities) {
    // Scalar form of (entity - origin) dot dir and |entity - origin|^2 avoids
    // allocating a THREE.Vector3 per entity (this fires on every attack click).
    const ex = entity.position.x - rayOrigin.x
    const ey = entity.position.y + ENTITY_CENTER_Y_OFFSET - rayOrigin.y
    const ez = entity.position.z - rayOrigin.z
    const alongRay = ex * dirX + ey * dirY + ez * dirZ
    if (alongRay < 0 || alongRay > maxReach) continue
    if (maxDistance !== null && alongRay > maxDistance) continue

    const perpendicularSq = Math.max(0, (ex * ex + ey * ey + ez * ez) - alongRay * alongRay)
    if (perpendicularSq > radiusSq) continue

    if (alongRay < closestDist) {
      closestId = entity.entityId
      closestDist = alongRay
    }
  }

  return closestId === null ? Option.none() : Option.some(closestId)
}
