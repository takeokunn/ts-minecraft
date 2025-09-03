import { Effect } from 'effect'
import { Box3 } from 'three'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGrid, World } from '@/runtime/services'

export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const spatialGrid = yield* _(SpatialGrid)

  yield* _(spatialGrid.clear())

  const { entities, components } = yield* _(world.querySoA(positionColliderQuery))
  const { position, collider } = components

  yield* _(
    Effect.forEach(
      entities,
      (entityId, i) => {
        const currentPosition = position[i]
        const currentCollider = collider[i]

        const minX = currentPosition.x - currentCollider.width / 2
        const minY = currentPosition.y
        const minZ = currentPosition.z - currentCollider.depth / 2
        const maxX = currentPosition.x + currentCollider.width / 2
        const maxY = currentPosition.y + currentCollider.height
        const maxZ = currentPosition.z + currentCollider.depth / 2

        const aabb = new Box3(new Box3().min.set(minX, minY, minZ), new Box3().max.set(maxX, maxY, maxZ))

        return spatialGrid.add(entityId, aabb)
      },
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})
