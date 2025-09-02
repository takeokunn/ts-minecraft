import { Effect } from 'effect'
import { Position, Velocity, Player } from '@/domain/components'
import { EntityId } from '@/domain/entity'
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import * as World from '@/domain/world'
import { QueryResult } from '@/domain/world'
import { SpatialGridService } from '@/runtime/services'

type PlayerQueryResult = QueryResult<typeof playerColliderQuery.components>
type ColliderQueryResult = QueryResult<typeof positionColliderQuery.components>

type CollisionResult = {
  readonly newPosition: Position
  readonly newVelocity: Velocity
  readonly isGrounded: boolean
}

// Helper function for collision resolution
const resolveCollisions = (player: PlayerQueryResult, nearbyAABBs: readonly AABB[]): CollisionResult => {
  const { position, velocity, collider } = player
  let newPosition: Position = {
    x: position.x + velocity.dx,
    y: position.y + velocity.dy,
    z: position.z + velocity.dz,
  }
  let newVelocity: Velocity = { ...velocity }
  let isGrounded = false

  if (nearbyAABBs.length === 0) {
    return { newPosition, newVelocity, isGrounded }
  }

  // Y-axis
  let playerAABB_Y = createAABB({ x: position.x, y: newPosition.y, z: position.z }, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB_Y, blockAABB)) {
      if (velocity.dy > 0) {
        newPosition = { ...newPosition, y: blockAABB.minY - collider.height }
      } else if (velocity.dy < 0) {
        newPosition = { ...newPosition, y: blockAABB.maxY }
        isGrounded = true
      }
      newVelocity = { ...newVelocity, dy: 0 }
      playerAABB_Y = createAABB({ x: position.x, y: newPosition.y, z: position.z }, collider)
    }
  }

  // X-axis
  let playerAABB_X = createAABB({ x: newPosition.x, y: newPosition.y, z: position.z }, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB_X, blockAABB)) {
      if (velocity.dx > 0) {
        newPosition = { ...newPosition, x: blockAABB.minX - collider.width / 2 }
      } else if (velocity.dx < 0) {
        newPosition = { ...newPosition, x: blockAABB.maxX + collider.width / 2 }
      }
      newVelocity = { ...newVelocity, dx: 0 }
      playerAABB_X = createAABB({ x: newPosition.x, y: newPosition.y, z: position.z }, collider)
    }
  }

  // Z-axis
  let playerAABB_Z = createAABB({ x: newPosition.x, y: newPosition.y, z: newPosition.z }, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB_Z, blockAABB)) {
      if (velocity.dz > 0) {
        newPosition = { ...newPosition, z: blockAABB.minZ - collider.depth / 2 }
      } else if (velocity.dz < 0) {
        newPosition = { ...newPosition, z: blockAABB.maxZ + collider.depth / 2 }
      }
      newVelocity = { ...newVelocity, dz: 0 }
    }
  }

  return { newPosition, newVelocity, isGrounded }
}

const processPlayerCollision = (player: PlayerQueryResult, colliderMap: ReadonlyMap<EntityId, ColliderQueryResult>) =>
  Effect.gen(function* ($) {
    const spatialGrid = yield* $(SpatialGridService)
    const { entityId, position, velocity, collider } = player

    // Broad-phase
    const broadphaseAABB = createAABB(
      { x: position.x + velocity.dx / 2, y: position.y + velocity.dy / 2, z: position.z + velocity.dz / 2 },
      { width: collider.width + Math.abs(velocity.dx), height: collider.height + Math.abs(velocity.dy), depth: collider.depth + Math.abs(velocity.dz) },
    )
    const nearbyEntityIds = yield* $(spatialGrid.query(broadphaseAABB))

    const nearbyAABBs: AABB[] = []
    for (const nearbyId of nearbyEntityIds) {
      if (nearbyId !== entityId) {
        const c = colliderMap.get(nearbyId)
        if (c) {
          nearbyAABBs.push(createAABB(c.position, c.collider))
        }
      }
    }

    // Narrow-phase
    const { newPosition, newVelocity, isGrounded } = resolveCollisions(player, nearbyAABBs)

    // Get the current player component to avoid overwriting other properties
    const currentPlayer = yield* $(World.getComponent(entityId, 'player'))
    const newPlayer: Player = { ...currentPlayer, isGrounded }

    // Write results
    yield* $(
      Effect.all(
        [
          World.updateComponent(entityId, 'position', newPosition),
          World.updateComponent(entityId, 'velocity', newVelocity),
          World.updateComponent(entityId, 'player', newPlayer),
        ],
        { discard: true },
      ),
    )
  })

export const collisionSystem = Effect.gen(function* ($) {
  const players = yield* $(World.query(playerColliderQuery))
  const colliders = yield* $(World.query(positionColliderQuery))

  if (players.length === 0) {
    return
  }

  const colliderMap = colliders.reduce((map, collider) => {
    map.set(collider.entityId, collider)
    return map
  }, new Map<EntityId, ColliderQueryResult>())

  yield* $(
    Effect.forEach(players, (player) => processPlayerCollision(player, colliderMap), { discard: true, concurrency: 'unbounded' }),
    Effect.catchAllCause((cause) => Effect.logError('An error occurred in collisionSystem', cause)),
  )
})