import { Effect, pipe } from 'effect'
import { ReadonlyArray } from 'effect/ReadonlyArray'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import { Collider, Player, Position, Velocity } from '@/domain/entities/components'
import { AABB, createAABB, areAABBsIntersecting } from '@/domain/geometry'
import { queries } from '@/domain/queries'
import { WorldRepository } from '@/domain/ports/world.repository'
import { SpatialGridPort } from '@/domain/ports/spatial-grid.port'
import { toFloat } from '@/domain/value-objects/common'
import { EntityId } from '@/domain/entities'
import { SoAResult } from '@/domain/types'

type CollisionResolutionState = {
  readonly position: Position
  readonly velocity: Velocity
  readonly isGrounded: boolean
}

const resolveAxis = (
  axis: 'x' | 'y' | 'z',
  playerCollider: Collider,
  nearbyAABBs: ReadonlyArray.NonEmptyReadonlyArray<AABB>,
) => (initialState: CollisionResolutionState): CollisionResolutionState => {
  const playerAABB = createAABB(initialState.position, playerCollider)

  return ReadonlyArray.reduce(nearbyAABBs, initialState, (state, blockAABB) => {
    if (!areAABBsIntersecting(playerAABB, blockAABB)) {
      return state
    }

    if (axis === 'y') {
      const newY =
        state.velocity.dy > 0
          ? toFloat(blockAABB.minY - playerCollider.height)
          : state.velocity.dy < 0
          ? toFloat(blockAABB.maxY)
          : state.position.y
      const isGrounded = state.velocity.dy < 0 || state.isGrounded
      return {
        ...state,
        position: new Position({ ...state.position, y: newY }),
        velocity: new Velocity({ ...state.velocity, dy: toFloat(0) }),
        isGrounded,
      }
    } else if (axis === 'x') {
      const newX =
        state.velocity.dx > 0
          ? toFloat(blockAABB.minX - playerCollider.width / 2)
          : state.velocity.dx < 0
          ? toFloat(blockAABB.maxX + playerCollider.width / 2)
          : state.position.x
      return {
        ...state,
        position: new Position({ ...state.position, x: newX }),
        velocity: new Velocity({ ...state.velocity, dx: toFloat(0) }),
      }
    } else {
      const newZ =
        state.velocity.dz > 0
          ? toFloat(blockAABB.minZ - playerCollider.depth / 2)
          : state.velocity.dz < 0
          ? toFloat(blockAABB.maxZ + playerCollider.depth / 2)
          : state.position.z
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
  colliderEntityMap: HashMap.HashMap<EntityId, number>,
  colliderComponents: SoAResult<typeof queries.positionCollider.components>['components'],
) =>
  pipe(
    Array.from(nearbyEntityIds),
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
  playerComponents: SoAResult<typeof queries.playerCollider.components>['components'],
  colliderEntityMap: HashMap.HashMap<EntityId, number>,
  colliderComponents: SoAResult<typeof queries.positionCollider.components>['components'],
) =>
  Effect.gen(function* ($) {
    const spatialGrid = yield* $(SpatialGridPort)
    const world = yield* $(WorldRepository)

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

    const finalState = ReadonlyArray.isNonEmptyReadonlyArray(nearbyAABBs)
      ? pipe(
          initialState,
          resolveAxis('y', collider, nearbyAABBs),
          resolveAxis('x', collider, nearbyAABBs),
          resolveAxis('z', collider, nearbyAABBs),
        )
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
  const world = yield* $(WorldRepository)

  const { entities: playerEntities, components: playerComponents } = yield* $(world.querySoA(queries.playerCollider))
  const { entities: colliderEntities, components: colliderComponents } = yield* $(
    world.querySoA(queries.positionCollider),
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