import { Effect } from 'effect'
import { createAABB } from '@domain/value-objects/physics/aabb.vo'
import { SpatialGridPort } from '@domain/ports/spatial-grid.port'
import { WorldRepositoryPortPort } from '@domain/ports/world-repository.port'

export const spatialGridSystem = Effect.gen(function* (_) {
  const world = yield* _(WorldRepositoryPortPort)
  const spatialGrid = yield* _(SpatialGridPort)

  yield* _(spatialGrid.clear())

  // Query entities with position and collider components for spatial grid
  const queryResult = yield* _(world.query(['position', 'collider']))
  const entities = queryResult.entities

  yield* _(
    Effect.forEach(
      entities,
      (entityId) => {
        // Get components for this entity
        const position = queryResult.getComponent(entityId, 'position')
        const collider = queryResult.getComponent(entityId, 'collider')

        if (position && collider) {
          const aabb = createAABB(position, collider)
          return spatialGrid.insert(entityId, aabb)
        }
        return Effect.void
      },
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})
