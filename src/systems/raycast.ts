import { Effect, Equivalence, Option } from 'effect'
import { terrainBlockQuery } from '@/domain/queries'
import { EntityId } from '@/domain/entity'
import { RaycastResult } from '@/infrastructure/raycast-three'
import { RaycastResultService, System, ThreeContextService } from '@/runtime/loop'
import { World } from '@/runtime/world'
import { RaycastService } from '@/infrastructure/raycast-three'

const optionEq = <A>(eq: Equivalence.Equivalence<A>): Equivalence.Equivalence<Option.Option<A>> => (x, y) => {
  if (Option.isNone(x) && Option.isNone(y)) return true
  if (Option.isSome(x) && Option.isSome(y)) return eq(x.value, y.value)
  return false
}

export const raycastSystem: System = Effect.gen(function* () {
  const world = yield* World
  const threeContext = yield* ThreeContextService
  const raycastService = yield* RaycastService
  const raycastResultRef = yield* RaycastResultService

  const terrainEntities = yield* world.query(terrainBlockQuery)
  const terrainBlockMap = new Map<string, EntityId>(
    terrainEntities.map((e) => [`${e.position.x},${e.position.y},${e.position.z}`, e.entityId]),
  )

  const newRaycastResult = yield* raycastService.cast(threeContext.scene, terrainBlockMap)
  const oldRaycastResult = yield* raycastResultRef.get

  const eq = optionEq(Equivalence.strict<RaycastResult>())
  if (!eq(oldRaycastResult, newRaycastResult)) {
    yield* raycastResultRef.set(newRaycastResult)
  }
})