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
  const soa = yield* _(World.querySoA(positionColliderQuery))

  yield* _(spatialGridService.clear)

  const registrationEffects = []
  for (let i = 0; i < soa.entities.length; i++) {
    const position = {
      x: soa.position.x[i]!,
      y: soa.position.y[i]!,
      z: soa.position.z[i]!,
    }
    const collider = {
      width: soa.collider.width[i]!,
      height: soa.collider.height[i]!,
      depth: soa.collider.depth[i]!,
    }
    const aabb = createAABB(position, collider)
    registrationEffects.push(spatialGridService.register(soa.entities[i]!, aabb))
  }

  yield* _(Effect.all(registrationEffects, { discard: true, concurrency: 'unbounded' }))
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in updatePhysicsWorldSystem', cause)))
