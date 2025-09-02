import { Effect, Equivalence, Option, Ref } from 'effect'
import { terrainBlockQuery } from '@/domain/queries'
import { EntityId } from '@/domain/entity'
import { RaycastResult, RaycastService } from '@/infrastructure/raycast-three'
import { RaycastResultService, ThreeContextService } from '@/runtime/services'
import { World } from '@/runtime/world'
import { ThreeContext } from '@/infrastructure/types'

const optionEq =
  <A>(eq: Equivalence.Equivalence<A>): Equivalence.Equivalence<Option.Option<A>> =>
  (x, y) => {
    if (Option.isNone(x) && Option.isNone(y)) return true
    if (Option.isSome(x) && Option.isSome(y)) return eq(x.value, y.value)
    return false
  }

export const raycastSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const threeContext = (yield* _(ThreeContextService)) as ThreeContext
  const raycastService = yield* _(RaycastService)
  const raycastResultRef = yield* _(RaycastResultService)

  const { entities, position } = yield* _(world.querySoA(terrainBlockQuery))
  const terrainBlockMap = new Map<string, EntityId>()
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]
    if (entity === undefined) {
      continue
    }
    const key = `${position.x[i]},${position.y[i]},${position.z[i]}`
    terrainBlockMap.set(key, entity)
  }

  const newRaycastResult = yield* _(raycastService.cast(threeContext.scene, terrainBlockMap))
  const oldRaycastResult = yield* _(Ref.get(raycastResultRef))

  const eq = optionEq(Equivalence.strict<RaycastResult>())
  if (!eq(oldRaycastResult, newRaycastResult)) {
    yield* _(Ref.set(raycastResultRef, newRaycastResult))
  }
})
