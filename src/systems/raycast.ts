import { Effect, Option, Ref } from 'effect'
import { terrainBlockQuery } from '@/domain/queries'
import { EntityId } from '@/domain/entity'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { RaycastResultService, ThreeContextService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

export const areRaycastResultsEqual = (a: RaycastResult, b: RaycastResult): boolean => {
  // Note: This is a shallow comparison. For deep equality on intersection, more checks are needed.
  return a.entityId === b.entityId && a.face.x === b.face.x && a.face.y === b.face.y && a.face.z === b.face.z && a.intersection.distance === b.intersection.distance
}

export const raycastSystem = Effect.gen(function* ($) {
  const threeContext = yield* $(ThreeContextService)
  const raycastService = yield* $(RaycastService)
  const raycastResultRef = yield* $(RaycastResultService)

  const terrainBlocks = yield* $(World.query(terrainBlockQuery))

  const terrainBlockMap = terrainBlocks.reduce((map, { entityId, position }) => {
    const key = `${position.x},${position.y},${position.z}`
    map.set(key, entityId)
    return map
  }, new Map<string, EntityId>())

  const newRaycastResult = yield* $(raycastService.cast(threeContext.scene, terrainBlockMap))
  const oldRaycastResult = yield* $(Ref.get(raycastResultRef))

  const areEqual = Option.zip(oldRaycastResult, newRaycastResult).pipe(
    Option.map(([oldResult, newResult]) => areRaycastResultsEqual(oldResult, newResult)),
    Option.getOrElse(() => oldRaycastResult === newRaycastResult),
  )

  if (!areEqual) {
    yield* $(Ref.set(raycastResultRef, newRaycastResult))
  }
})
