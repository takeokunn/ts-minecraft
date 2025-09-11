import { Effect } from 'effect'
import { createAABB } from '@/domain/geometry'
import { queries } from '@/domain/queries'
import { SpatialGrid, World } from '@/runtime/services'

export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const spatialGrid = yield* _(SpatialGrid)

  yield* _(spatialGrid.clear())

  const { entities, components } = yield* _(world.querySoA(queries.positionCollider))
  const { position, collider } = components

  yield* _(
    Effect.forEach(
      entities,
      (entityId, i) => {
        const currentPosition = position[i]
        const currentCollider = collider[i]
        const aabb = createAABB(currentPosition, currentCollider)
        return spatialGrid.add(entityId, aabb)
      },
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})
