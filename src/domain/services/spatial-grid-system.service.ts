import { Effect } from 'effect'
import { createAABB } from '/value-objects/physics/aabb.vo'
import { queryConfigs } from '/queries'
import { SpatialGridPort } from '/ports/spatial-grid.port'
import { WorldRepository } from '/ports/world.repository'

export const spatialGridSystem = Effect.gen(function* (_) {
  const world = yield* _(WorldRepository)
  const spatialGrid = yield* _(SpatialGridPort)

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
        return spatialGrid.insert(entityId, aabb)
      },
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})
