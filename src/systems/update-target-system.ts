import { Effect, Option } from 'effect'
import { TargetBlock, TargetNone } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { Raycast, World } from '@/runtime/services'
import { Int, Vector3Int } from '@/domain/common'
import * as THREE from 'three'
import { EntityId } from '@/domain/entity'

const getTarget = (intersection: THREE.Intersection) => {
  // This is a simplification. We need a robust way to get the entityId from the intersection.
  // For now, we'll assume the intersected object's name is the entityId.
  const targetEntityId = EntityId(intersection.object.name)
  const position = intersection.point
  const face = intersection.face!.normal

  const faceInt: Vector3Int = [Int(Math.round(face.x)), Int(Math.round(face.y)), Int(Math.round(face.z))]

  return new TargetBlock({
    _tag: 'block',
    entityId: targetEntityId,
    face: faceInt,
    position: { x: position.x, y: position.y, z: position.z },
  })
}

export const updateTargetSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const raycast = yield* $(Raycast)
  const intersectionOpt = yield* $(raycast.raycast())

  const newTarget = Option.match(intersectionOpt, {
    onNone: () => new TargetNone(),
    onSome: getTarget,
  })

  const { entities } = yield* $(world.querySoA(playerQuery))

  yield* $(
    Effect.forEach(
      entities,
      (entityId) => {
        return world.updateComponent(entityId, 'target', newTarget)
      },
      { concurrency: 'inherit', discard: true },
    ),
  )
})
