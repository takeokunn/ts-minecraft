import { Effect, Option, Ref } from 'effect'
import { terrainBlockQuery } from '@/domain/queries'
import { EntityId } from '@/domain/entity'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { RaycastResultService, ThreeContextService } from '@/runtime/services'
import { World } from '@/runtime/world'
import { ThreeContext } from '@/infrastructure/types'

export const areRaycastResultsEqual = (a: RaycastResult, b: RaycastResult): boolean => {
  return a.entityId === b.entityId && a.face.x === b.face.x && a.face.y === b.face.y && a.face.z === b.face.z && a.intersection.distance === b.intersection.distance
}

export const raycastSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const threeContext = (yield* _(ThreeContextService)) as ThreeContext
  const raycastService = yield* _(RaycastService)
  const raycastResultRef = yield* _(RaycastResultService)

  const terrainBlocks = yield* _(world.query(terrainBlockQuery))
  const terrainBlockMap = new Map<string, EntityId>()
  for (const block of terrainBlocks) {
    const { entityId, position } = block
    const key = `${position.x},${position.y},${position.z}`
    terrainBlockMap.set(key, entityId)
  }

  const newRaycastResult = yield* _(raycastService.cast(threeContext.scene, terrainBlockMap))
  const oldRaycastResult = yield* _(Ref.get(raycastResultRef))

  const areEqual = Option.match(oldRaycastResult, {
    onNone: () => Option.isNone(newRaycastResult),
    onSome: (oldResult) =>
      Option.match(newRaycastResult, {
        onNone: () => false,
        onSome: (newResult) => areRaycastResultsEqual(oldResult, newResult),
      }),
  })

  if (!areEqual) {
    yield* _(Ref.set(raycastResultRef, newRaycastResult))
  }
})
