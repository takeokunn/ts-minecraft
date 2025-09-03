import { Effect, ReadonlyArray, HashMap, Option, pipe } from 'effect'
import { Collider, Player, Position, Velocity } from '@/domain/components'
import { AABB, createAABB } from '@/domain/geometry'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import { SpatialGrid, World } from '@/runtime/services'
import { Float } from '@/domain/common'
import { EntityId } from '@/domain/entity'
import { SoA } from '@/domain/world'

type CollisionResolutionState = {
  readonly position: Position
  readonly velocity: Velocity
  readonly isGrounded: boolean
}

const resolveAxis = (
  axis: 'x' | 'y' | 'z',
  playerCollider: Collider,
  nearbyAABBs: ReadonlyArray<AABB>,
) => (initialState: CollisionResolutionState): CollisionResolutionState => {
  const playerAABB = createAABB(initialState.position, playerCollider)

  return ReadonlyArray.reduce(nearbyAABBs, initialState, (state, blockAABB) => {
    if (!AABB.intersects(playerAABB, blockAABB)) {
      return state
    }

    if (axis === 'y') {
      const newY =
        state.velocity.dy > 0
          ? Float(blockAABB.minY - playerCollider.height)
          : state.velocity.dy < 0
          ? Float(blockAABB.maxY)
          : state.position.y
      const isGrounded = state.velocity.dy < 0 || state.isGrounded
      return {
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
      return {
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
      return {
        ...state,
        position: new Position({ ...state.position, z: newZ }),
        velocity: new Velocity({ ...state.velocity, dz: Float(0) }),
      }
    }
  })
}

const getNearbyAABBs = (
  entityId: EntityId,
  nearbyEntityIds: ReadonlySet<EntityId>,
  colliderEntityMap: HashMap.HashMap<EntityId, number>,
  colliderComponents: SoA<typeof positionColliderQuery>['components'],
) =>
  ReadonlyArray.fromIterable(nearbyEntityIds).pipe(
    ReadonlyArray.filterMap((nearbyEntityId) => {
      if (nearbyEntityId === entityId) {
        return Option.none()
      }
      return HashMap.get(colliderEntityMap, nearbyEntityId).pipe(
        Option.map((index) => {
          const nearbyPosition = colliderComponents.position[index]
          const nearbyCollider = colliderComponents.collider[index]
          return createAABB(nearbyPosition, nearbyCollider)
        }),
      )
    }),
  )

const resolveCollisionsForPlayer = (
  entityId: EntityId,
  i: number,
  playerComponents: SoA<typeof playerColliderQuery>['components'],
  colliderEntityMap: HashMap.HashMap<EntityId, number>,
  colliderComponents: SoA<typeof positionColliderQuery>['components'],
) =>
  Effect.gen(function* ($) {
    const spatialGrid = yield* $(SpatialGrid)
    const world = yield* $(World)

    const player = playerComponents.player[i]
    const position = playerComponents.position[i]
    const velocity = playerComponents.velocity[i]
    const collider = playerComponents.collider[i]

    const broadphaseAABB = createAABB(position, collider)
    const nearbyEntityIds = yield* $(spatialGrid.query(broadphaseAABB))

    const nearbyAABBs = getNearbyAABBs(entityId, nearbyEntityIds, colliderEntityMap, colliderComponents)

    const initialState: CollisionResolutionState = {
      position,
      velocity,
      isGrounded: player.isGrounded,
    }

    const finalState = pipe(
      initialState,
      resolveAxis('y', collider, nearbyAABBs),
      resolveAxis('x', collider, nearbyAABBs),
      resolveAxis('z', collider, nearbyAABBs),
    )

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
  const world = yield* $(World)

  const { entities: playerEntities, components: playerComponents } = yield* $(world.querySoA(playerColliderQuery))
  const { entities: colliderEntities, components: colliderComponents } = yield* $(
    world.querySoA(positionColliderQuery),
  )

  const colliderEntityMap = HashMap.fromIterable(colliderEntities.map((id, i) => [id, i] as const))

  yield* $(
    Effect.forEach(
      playerEntities,
      (entityId, i) =>
        resolveCollisionsForPlayer(entityId, i, playerComponents, colliderEntityMap, colliderComponents),
      { concurrency: 'inherit', discard: true },
    ),
  )
})
