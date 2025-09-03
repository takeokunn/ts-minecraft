import { Effect } from 'effect'
import { Box3 } from 'three'
import { Collider, Player, Position, Velocity } from '@/domain/components'
import { AABB, createAABB } from '@/domain/geometry'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import { SpatialGrid, World } from '@/runtime/services'
import { Float } from '@/domain/common'
import { EntityId } from '@/domain/entity'

type CollisionResolutionState = {
  readonly position: Position
  readonly velocity: Velocity
  readonly isGrounded: boolean
}

const resolveAxis = (
  axis: 'x' | 'y' | 'z',
  initialState: CollisionResolutionState,
  playerCollider: Collider,
  nearbyAABBs: readonly AABB[],
): CollisionResolutionState => {
  let state = initialState

  const playerAABB = createAABB(state.position, playerCollider)

  for (const blockAABB of nearbyAABBs) {
    if (!AABB.intersects(playerAABB, blockAABB)) {
      continue
    }

    if (axis === 'y') {
      const newY =
        state.velocity.dy > 0
          ? Float(blockAABB.minY - playerCollider.height)
          : state.velocity.dy < 0
          ? Float(blockAABB.maxY)
          : state.position.y
      const isGrounded = state.velocity.dy < 0 || state.isGrounded
      state = {
        ...state,
        position: new Position({ ...state.position, y: newY }),
        velocity: new Velocity({ ...state.velocity, dy: Float(0) }),
        isGrounded,
      }
    } else if (axis === 'x') {
      const newX =
        state.velocity.dx > 0
          ? Float(blockAABB.minX - playerCollider.width / 2)
          : state.velocity.dx < 0
          ? Float(blockAABB.maxX + playerCollider.width / 2)
          : state.position.x
      state = {
        ...state,
        position: new Position({ ...state.position, x: newX }),
        velocity: new Velocity({ ...state.velocity, dx: Float(0) }),
      }
    } else {
      const newZ =
        state.velocity.dz > 0
          ? Float(blockAABB.minZ - playerCollider.depth / 2)
          : state.velocity.dz < 0
          ? Float(blockAABB.maxZ + playerCollider.depth / 2)
          : state.position.z
      state = {
        ...state,
        position: new Position({ ...state.position, z: newZ }),
        velocity: new Velocity({ ...state.velocity, dz: Float(0) }),
      }
    }
  }
  return state
}

export const collisionSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const spatialGrid = yield* $(SpatialGrid)

  const { entities: playerEntities, components: playerComponents } = yield* $(world.querySoA(playerColliderQuery))
  const { entities: colliderEntities, components: colliderComponents } = yield* $(world.querySoA(positionColliderQuery))

  const colliderEntityMap = new Map<EntityId, number>()
  colliderEntities.forEach((id, i) => {
    colliderEntityMap.set(id, i)
  })

  yield* $(
    Effect.forEach(
      playerEntities,
      (entityId, i) =>
        Effect.gen(function* ($) {
          const player = playerComponents.player[i]
          const position = playerComponents.position[i]
          const velocity = playerComponents.velocity[i]
          const collider = playerComponents.collider[i]

          const broadphaseAABB = createAABB(position, collider)

          const nearbyEntityIds = yield* $(spatialGrid.query(broadphaseAABB))
          const nearbyAABBs: AABB[] = []

          for (const nearbyEntityId of nearbyEntityIds) {
            if (nearbyEntityId === entityId) continue
            const index = colliderEntityMap.get(nearbyEntityId)
            if (index === undefined) continue

            const nearbyPosition = colliderComponents.position[index]
            const nearbyCollider = colliderComponents.collider[index]

            nearbyAABBs.push(createAABB(nearbyPosition, nearbyCollider))
          }

          const initialState: CollisionResolutionState = {
            position,
            velocity,
            isGrounded: player.isGrounded,
          }

          const stateAfterY = resolveAxis('y', initialState, collider, nearbyAABBs)
          const stateAfterX = resolveAxis('x', stateAfterY, collider, nearbyAABBs)
          const finalState = resolveAxis('z', stateAfterX, collider, nearbyAABBs)

          yield* $(world.updateComponent(entityId, 'position', finalState.position))
          yield* $(world.updateComponent(entityId, 'velocity', finalState.velocity))
          yield* $(world.updateComponent(entityId, 'player', new Player({ isGrounded: finalState.isGrounded })))
        }),
      { concurrency: 'inherit' },
    ),
  )
})
