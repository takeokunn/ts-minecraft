import { Effect, Option } from 'effect'
// Target types are used as plain objects, not constructors
import { DomainQueryService } from '@domain/queries/domain-queries'
import { WorldRepositoryPort } from '@domain/ports/world-repository.port'
import { RaycastPort } from '@domain/ports/raycast.port'
import { Int, Vector3Int } from '@domain/value-objects/common'
import { EntityId } from '@domain/entities'

const getTarget = (hit: import('@domain/ports/raycast.port').RaycastHit) => {
  const targetEntityId = hit.entityId
  const position = hit.point
  const face = hit.normal

  const faceInt: Vector3Int = [Int(Math.round(face.x)), Int(Math.round(face.y)), Int(Math.round(face.z))]

  return {
    _tag: 'block' as const,
    entityId: targetEntityId,
    face: faceInt,
    position: { x: position.x, y: position.y, z: position.z },
  }
}

export const targetingSystem = Effect.gen(function* ($) {
  const world = yield* $(WorldRepositoryPort)
  const raycast = yield* $(RaycastPort)
  const ray = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } }
  const intersectionOpt = yield* $(raycast.cast(ray))

  const newTarget = Option.match(intersectionOpt, {
    onNone: () => ({ _tag: 'none' as const }),
    onSome: getTarget,
  })

  const domainQuery = yield* $(DomainQueryService)
  const { entities } = yield* $(domainQuery.executePlayerTargetQuery())

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
