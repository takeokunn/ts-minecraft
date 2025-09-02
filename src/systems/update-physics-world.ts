import { Effect } from 'effect'
import { Collider, Position } from '@/domain/components'
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
  const { entities, position, collider } = yield* _(world.querySoA(positionColliderQuery))

  yield* _(spatialGridService.clear)

  const registrationEffects = []
  for (let i = 0; i < entities.length; i++) {
    const posX = position.x[i]
    const posY = position.y[i]
    const posZ = position.z[i]
    const colW = collider.width[i]
    const colH = collider.height[i]
    const colD = collider.depth[i]
    const entity = entities[i]

    if (
      posX === undefined ||
      posY === undefined ||
      posZ === undefined ||
      colW === undefined ||
      colH === undefined ||
      colD === undefined ||
      entity === undefined
    ) {
      continue
    }

    const pos = new Position({ x: posX, y: posY, z: posZ })
    const col = new Collider({ width: colW, height: colH, depth: colD })
    const aabb = createAABB(pos, col)
    registrationEffects.push(spatialGridService.register(entity, aabb))
  }

  yield* _(Effect.all(registrationEffects, { discard: true }))
})
