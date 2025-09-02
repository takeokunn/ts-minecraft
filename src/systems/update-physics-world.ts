import { Effect } from 'effect'
import { createAABB } from '@/domain/geometry'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGridService } from '@/runtime/services'
import * as World from '@/domain/world'

/**
 * Rebuilds the spatial grid for broadphase collision detection.
 * This system should run after physics updates positions, but before collision resolution.
 */
export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const spatialGridService = yield* _(SpatialGridService)
  const colliders = yield* _(World.query(positionColliderQuery))

  yield* _(spatialGridService.clear)

  yield* _(
    Effect.forEach(
      colliders,
      (c) => {
        const aabb = createAABB(c.position, c.collider)
        return spatialGridService.register(c.entityId, aabb)
      },
      { discard: true },
    ),
  )
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in updatePhysicsWorldSystem', cause)))