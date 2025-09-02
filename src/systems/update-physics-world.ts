import { Effect } from 'effect'
import { createAABB } from '@/domain/geometry'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGridService } from '@/runtime/services'
import { World } from '@/runtime/world'

/**
 * Rebuilds the spatial grid for broadphase collision detection.
 * This system should run after physics updates positions, but before collision resolution.
 */
export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const spatialGridService = yield* _(SpatialGridService)
  const colliders = yield* _(world.query(positionColliderQuery))

  yield* _(spatialGridService.clear)

  const registrationEffects = colliders.map((c) => {
    const aabb = createAABB(c.position, c.collider)
    return spatialGridService.register(c.entityId, aabb)
  })

  yield* _(Effect.all(registrationEffects, { discard: true }))
})
