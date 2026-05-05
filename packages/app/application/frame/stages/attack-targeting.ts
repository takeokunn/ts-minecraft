import { Array as Arr, Option } from 'effect'
import * as THREE from 'three'
import type { EntityId as EntityIdType } from '@ts-minecraft/entities'
import type { Position } from '@ts-minecraft/kernel'
import { PLAYER_ATTACK_REACH, PLAYER_ATTACK_RADIUS, ENTITY_CENTER_Y_OFFSET } from '@ts-minecraft/app/frame-handler.config'

export const findAttackableEntity = (
  entities: ReadonlyArray<{ readonly entityId: EntityIdType; readonly position: Position }>,
  camera: THREE.PerspectiveCamera,
  maxDistance: Option.Option<number>,
): Option.Option<EntityIdType> => {
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  cameraDirection.normalize()

  const rayOrigin = camera.position
  const radiusSq = PLAYER_ATTACK_RADIUS * PLAYER_ATTACK_RADIUS

  const closest = Arr.reduce(
    entities,
    Option.none<{ readonly id: EntityIdType; readonly dist: number }>(),
    (acc, entity) => {
      const toEntity = new THREE.Vector3(
        entity.position.x - rayOrigin.x,
        entity.position.y + ENTITY_CENTER_Y_OFFSET - rayOrigin.y,
        entity.position.z - rayOrigin.z,
      )
      const alongRay = toEntity.dot(cameraDirection)
      if (alongRay < 0 || alongRay > PLAYER_ATTACK_REACH) return acc
      /* c8 ignore next */
      if (Option.match(maxDistance, { onNone: () => false, onSome: (d) => alongRay > d })) return acc

      const perpendicularSq = Math.max(0, toEntity.lengthSq() - alongRay * alongRay)
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
