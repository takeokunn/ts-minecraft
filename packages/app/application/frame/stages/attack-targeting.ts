import { Array as Arr, Option } from 'effect'
import * as THREE from 'three'
import type { EntityId as EntityIdType } from '@ts-minecraft/entity'
import type { Position } from '@ts-minecraft/core'
import { PLAYER_ATTACK_REACH, PLAYER_ATTACK_RADIUS, ENTITY_CENTER_Y_OFFSET } from '@ts-minecraft/app/frame-handler.config'

// Module-scoped scratch for the camera world-direction read. getWorldDirection
// requires a Vector3 to write into; reusing one avoids a per-call allocation.
// The per-entity test below uses pure scalar math (no Vector3 at all).
const scratchCameraDirection = new THREE.Vector3()

export const findAttackableEntity = (
  entities: ReadonlyArray<{ readonly entityId: EntityIdType; readonly position: Position }>,
  camera: THREE.PerspectiveCamera,
  maxDistance: Option.Option<number>,
  maxReach: number = PLAYER_ATTACK_REACH,
): Option.Option<EntityIdType> => {
  camera.getWorldDirection(scratchCameraDirection)
  scratchCameraDirection.normalize()
  const dirX = scratchCameraDirection.x
  const dirY = scratchCameraDirection.y
  const dirZ = scratchCameraDirection.z

  const rayOrigin = camera.position
  const radiusSq = PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS

  const closest = Arr.reduce(
    entities,
    Option.none<{ readonly id: EntityIdType; readonly dist: number }>(),
    (acc, entity) => {
      // Scalar form of (entity - origin) · dir and |entity - origin|² — avoids
      // allocating a THREE.Vector3 per entity (this fires on every attack click).
      const ex = entity.position.x - rayOrigin.x
      const ey = entity.position.y + ENTITY_CENTER_Y_OFFSET - rayOrigin.y
      const ez = entity.position.z - rayOrigin.z
      const alongRay = ex * dirX + ey * dirY + ez * dirZ
      if (alongRay < 0 || alongRay > maxReach) return acc
      /* c8 ignore next */
      if (Option.match(maxDistance, { onNone: () => false, onSome: (d) => alongRay > d })) return acc

      const perpendicularSq = Math.max(0, (ex * ex + ey * ey + ez * ez) - alongRay * alongRay)
      if (perpendicularSq > radiusSq) return acc

      return Option.match(acc, {
        onNone: () => Option.some({ id: entity.entityId, dist: alongRay }),
        onSome: (best) => alongRay < best.dist
          ? Option.some({ id: entity.entityId, dist: alongRay })
          : acc,
      })
    },
  )

  return Option.map(closest, (c) => c.id)
}
