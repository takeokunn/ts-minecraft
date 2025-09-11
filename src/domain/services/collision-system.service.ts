import { Effect, pipe } from 'effect'
import { ReadonlyArray } from 'effect/ReadonlyArray'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import { Collider, Player, Position, Velocity } from '@domain/entities/components'
import { AABB, createAABB, areAABBsIntersecting } from '@domain/value-objects/physics/aabb.vo'
import { WorldRepositoryPortPort } from '@domain/ports/world-repository.port'
import { SpatialGridPort } from '@domain/ports/spatial-grid.port'
import { toFloat } from '@domain/value-objects/common'
import { EntityId } from '@domain/entities'
import { SoAResult } from '@domain/types'

type CollisionResolutionState = {
  readonly position: Position
  readonly velocity: Velocity
  readonly isGrounded: boolean
}

const resolveAxis =
  (axis: 'x' | 'y' | 'z', playerCollider: Collider, nearbyAABBs: ReadonlyArray.NonEmptyReadonlyArray<AABB>) =>
  (initialState: CollisionResolutionState): CollisionResolutionState => {
    const playerAABB = createAABB(initialState.position, playerCollider)

    return ReadonlyArray.reduce(nearbyAABBs, initialState, (state, blockAABB) => {
      if (!areAABBsIntersecting(playerAABB, blockAABB)) {
        return state
      }

      if (axis === 'y') {
        const newY = state.velocity.dy > 0 ? toFloat(blockAABB.minY - playerCollider.height) : state.velocity.dy < 0 ? toFloat(blockAABB.maxY) : state.position.y
        const isGrounded = state.velocity.dy < 0 || state.isGrounded
        return {
          ...state,
          position: new Position({ ...state.position, y: newY }),
          velocity: new Velocity({ ...state.velocity, dy: toFloat(0) }),
          isGrounded,
        }
      } else if (axis === 'x') {
        const newX =
          state.velocity.dx > 0 ? toFloat(blockAABB.minX - playerCollider.width / 2) : state.velocity.dx < 0 ? toFloat(blockAABB.maxX + playerCollider.width / 2) : state.position.x
        return {
          ...state,
          position: new Position({ ...state.position, x: newX }),
          velocity: new Velocity({ ...state.velocity, dx: toFloat(0) }),
        }
      } else {
        const newZ =
          state.velocity.dz > 0 ? toFloat(blockAABB.minZ - playerCollider.depth / 2) : state.velocity.dz < 0 ? toFloat(blockAABB.maxZ + playerCollider.depth / 2) : state.position.z
        return {
          ...state,
          position: new Position({ ...state.position, z: newZ }),
          velocity: new Velocity({ ...state.velocity, dz: toFloat(0) }),
        }
      }
    })
  }

const getNearbyAABBs = (
  entityId: EntityId,
  nearbyEntityIds: ReadonlySet<EntityId>,
  world: any // Simplified - would need proper typing
) =>
  Effect.gen(function* () {
    const aabbs: AABB[] = []
    
    for (const nearbyEntityId of nearbyEntityIds) {
      if (nearbyEntityId === entityId) continue
      
      const position = yield* world.getComponent(nearbyEntityId, 'position')
      const collider = yield* world.getComponent(nearbyEntityId, 'collider')
      
      if (Option.isSome(position) && Option.isSome(collider)) {
        aabbs.push(createAABB(position.value, collider.value))
      }
    }
    
    return aabbs
  })

const resolveCollisionsForPlayer = (
  entityId: EntityId,
  player: Player,
  position: Position,
  velocity: Velocity,
  collider: Collider
) =>
  Effect.gen(function* ($) {
    const spatialGrid = yield* $(SpatialGridPort)
    const world = yield* $(WorldRepositoryPortPort)

    const broadphaseAABB = createAABB(position, collider)
    const nearbyEntityIds = yield* $(spatialGrid.query(broadphaseAABB))

    const nearbyAABBs = yield* $(getNearbyAABBs(entityId, nearbyEntityIds, world))

    const initialState: CollisionResolutionState = {
      position,
      velocity,
      isGrounded: player.isGrounded,
    }

    const finalState = ReadonlyArray.isNonEmptyReadonlyArray(nearbyAABBs)
      ? pipe(initialState, resolveAxis('y', collider, nearbyAABBs), resolveAxis('x', collider, nearbyAABBs), resolveAxis('z', collider, nearbyAABBs))
      : initialState

    yield* $(
      Effect.all(
        [
          world.updateComponent(entityId, 'position', finalState.position),
          world.updateComponent(entityId, 'velocity', finalState.velocity),
          world.updateComponent(entityId, 'player', new Player({ isGrounded: finalState.isGrounded })),
        ],
        { discard: true },
      ),
    )
  })

export const collisionSystem = Effect.gen(function* ($) {
  const world = yield* $(WorldRepositoryPortPort)

  // Query for players with collision components
  const playerQuery = yield* $(world.query(['player', 'position', 'velocity', 'collider']))
  
  yield* $(
    Effect.forEach(
      playerQuery.entities, 
      (entityId) => Effect.gen(function* () {
        const player = playerQuery.getComponent<Player>(entityId, 'player')
        const position = playerQuery.getComponent<Position>(entityId, 'position')
        const velocity = playerQuery.getComponent<Velocity>(entityId, 'velocity')
        const collider = playerQuery.getComponent<Collider>(entityId, 'collider')
        
        if (Option.isSome(player) && Option.isSome(position) && Option.isSome(velocity) && Option.isSome(collider)) {
          yield* $(resolveCollisionsForPlayer(entityId, player.value, position.value, velocity.value, collider.value))
        }
      }), 
      {
        concurrency: 'inherit',
        discard: true,
      }
    )
  )
})
