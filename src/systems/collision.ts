import { Effect, pipe, Array as A } from 'effect'
import { Player, Position, Velocity, Collider } from '@/domain/components'
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry'
import { playerColliderQuery } from '@/domain/queries'
import * as World from '@/domain/world'
import { QueryResult } from '@/domain/world'
import { SpatialGridService } from '@/runtime/services'

type PlayerQueryResult = QueryResult<typeof playerColliderQuery.components>

type CollisionResolutionState = {
  position: { x: number; y: number; z: number }
  velocity: { dx: number; dy: number; dz: number }
  isGrounded: boolean
}

const resolveYAxis = (
  initialState: CollisionResolutionState,
  playerCollider: Collider,
  nearbyAABBs: readonly AABB[],
): CollisionResolutionState => {
  const state = { ...initialState }
  let playerAABB = createAABB({ x: state.position.x, y: state.position.y, z: state.position.z }, playerCollider)

  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (state.velocity.dy > 0) {
        state.position.y = blockAABB.minY - playerCollider.height
      } else if (state.velocity.dy < 0) {
        state.position.y = blockAABB.maxY
        state.isGrounded = true
      }
      state.velocity.dy = 0
      playerAABB = createAABB({ x: state.position.x, y: state.position.y, z: state.position.z }, playerCollider)
    }
  }
  return state
}

const resolveXAxis = (
  initialState: CollisionResolutionState,
  playerCollider: Collider,
  nearbyAABBs: readonly AABB[],
): CollisionResolutionState => {
  const state = { ...initialState }
  let playerAABB = createAABB({ x: state.position.x, y: state.position.y, z: state.position.z }, playerCollider)

  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (state.velocity.dx > 0) {
        state.position.x = blockAABB.minX - playerCollider.width / 2
      } else if (state.velocity.dx < 0) {
        state.position.x = blockAABB.maxX + playerCollider.width / 2
      }
      state.velocity.dx = 0
      playerAABB = createAABB({ x: state.position.x, y: state.position.y, z: state.position.z }, playerCollider)
    }
  }
  return state
}

const resolveZAxis = (
  initialState: CollisionResolutionState,
  playerCollider: Collider,
  nearbyAABBs: readonly AABB[],
): CollisionResolutionState => {
  const state = { ...initialState }
  const playerAABB = createAABB({ x: state.position.x, y: state.position.y, z: state.position.z }, playerCollider)

  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (state.velocity.dz > 0) {
        state.position.z = blockAABB.minZ - playerCollider.depth / 2
      } else if (state.velocity.dz < 0) {
        state.position.z = blockAABB.maxZ + playerCollider.depth / 2
      }
      state.velocity.dz = 0
    }
  }
  return state
}

const processPlayerCollision = (player: PlayerQueryResult) =>
  Effect.gen(function* ($) {
    const spatialGrid = yield* $(SpatialGridService)
    const { entityId, position, velocity, collider } = player

    const broadphaseAABB = createAABB(
      { x: position.x + velocity.dx / 2, y: position.y + velocity.dy / 2, z: position.z + velocity.dz / 2 },
      {
        width: collider.width + Math.abs(velocity.dx),
        height: collider.height + Math.abs(velocity.dy),
        depth: collider.depth + Math.abs(velocity.dz),
      },
    )
    const nearbyEntityIds = yield* $(spatialGrid.query(broadphaseAABB))

    const nearbyColliders = yield* $(
      pipe(
        A.fromIterable(nearbyEntityIds),
        A.filter((id) => id !== entityId),
        (ids) =>
          Effect.all(
            ids.map((id) =>
              Effect.all({
                position: World.getComponent(id, 'position'),
                collider: World.getComponent(id, 'collider'),
              }),
            ),
          ),
      ),
    )
    const nearbyAABBs = nearbyColliders.map((c) => createAABB(c.position, c.collider))

    const initialState: CollisionResolutionState = {
      position: {
        x: position.x + velocity.dx,
        y: position.y + velocity.dy,
        z: position.z + velocity.dz,
      },
      velocity: { ...velocity },
      isGrounded: false,
    }

    const stateAfterY = resolveYAxis(initialState, collider, nearbyAABBs)
    const stateAfterX = resolveXAxis(stateAfterY, collider, nearbyAABBs)
    const finalState = resolveZAxis(stateAfterX, collider, nearbyAABBs)

    const newPlayer: Player = new Player({ ...player.player, isGrounded: finalState.isGrounded })

    yield* $(
      Effect.all(
        [
          World.updateComponent(entityId, 'position', new Position(finalState.position)),
          World.updateComponent(entityId, 'velocity', new Velocity(finalState.velocity)),
          World.updateComponent(entityId, 'player', newPlayer),
        ],
        { discard: true },
      ),
    )
  })

export const collisionSystem = Effect.gen(function* ($) {
  const players = yield* $(World.query(playerColliderQuery))

  if (players.length === 0) {
    return
  }

  yield* $(
    Effect.forEach(players, processPlayerCollision, { discard: true, concurrency: 'unbounded' }),
    Effect.catchAllCause((cause) => Effect.logError('An error occurred in collisionSystem', cause)),
  )
})
