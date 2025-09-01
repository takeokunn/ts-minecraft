import { Effect } from 'effect'
import { createAABB } from '@/domain/geometry'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGrid, SpatialGridLive } from '@/infrastructure/spatial-grid'
import { SpatialGridService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

/**
 * Rebuilds the spatial grid for broadphase collision detection.
 * This system should run after physics updates positions, but before collision resolution.
 */
export const updatePhysicsWorldSystem: System = Effect.gen(function* () {
  const world = yield* World
  const spatialGridService = yield* SpatialGridService
  const collidableEntities = yield* world.query(positionColliderQuery)

  yield* spatialGridService.clear()
  yield* Effect.forEach(
    collidableEntities,
    (entity) => {
      const { entityId, position, collider } = entity
      const aabb = createAABB(position, collider)
      return spatialGridService.register(entityId, aabb)
    },
    { discard: true },
  )
})
