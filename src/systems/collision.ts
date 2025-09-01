import { Effect, Option, pipe } from 'effect'
import { Collider, Position, setPlayerGrounded, setVelocity, Velocity } from '@/domain/components'
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry'
import { playerColliderQuery } from '@/domain/queries'
import { SpatialGridService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

type CollisionResult = {
  readonly newPosition: Position
  readonly newVelocity: Velocity
  readonly isGrounded: boolean
}

export const resolveCollisions = (position: Position, velocity: Velocity, collider: Collider, nearbyAABBs: ReadonlyArray<AABB>): CollisionResult => {
  let newPos: Position = { ...position }
  let newVel: Velocity = { ...velocity }
  let isGrounded = false

  // Y-axis
  newPos = { ...newPos, y: newPos.y + newVel.dy }
  let playerAABB = createAABB(newPos, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dy > 0) {
        newPos = { ...newPos, y: blockAABB.minY - collider.height }
      } else {
        newPos = { ...newPos, y: blockAABB.maxY }
        isGrounded = true
      }
      newVel = setVelocity(newVel, { dy: 0 })
      playerAABB = createAABB(newPos, collider)
    }
  }

  // X-axis
  newPos = { ...newPos, x: newPos.x + newVel.dx }
  playerAABB = createAABB(newPos, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dx > 0) {
        newPos = { ...newPos, x: blockAABB.minX - collider.width / 2 }
      } else {
        newPos = { ...newPos, x: blockAABB.maxX + collider.width / 2 }
      }
      newVel = setVelocity(newVel, { dx: 0 })
      playerAABB = createAABB(newPos, collider)
    }
  }

  // Z-axis
  newPos = { ...newPos, z: newPos.z + newVel.dz }
  playerAABB = createAABB(newPos, collider)
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dz > 0) {
        newPos = { ...newPos, z: blockAABB.minZ - collider.depth / 2 }
      } else {
        newPos = { ...newPos, z: blockAABB.maxZ - collider.depth / 2 }
      }
      newVel = setVelocity(newVel, { dz: 0 })
    }
  }

  return { newPosition: newPos, newVelocity: newVel, isGrounded }
}

export const collisionSystem: System = Effect.gen(function* () {
  const world = yield* World
  const spatialGrid = yield* SpatialGridService
  const players = yield* world.query(playerColliderQuery)

  yield* Effect.forEach(
    players,
    (entity) =>
      Effect.gen(function* () {
        const { entityId, position, velocity, collider, player } = entity
        const broadphaseAABB = createAABB(
          {
            x: position.x + velocity.dx / 2,
            y: position.y + velocity.dy / 2,
            z: position.z + velocity.dz / 2,
          },
          {
            width: collider.width + Math.abs(velocity.dx),
            height: collider.height + Math.abs(velocity.dy),
            depth: collider.depth + Math.abs(velocity.dz),
          },
        )
        const nearbyEntityIds = yield* spatialGrid.query(broadphaseAABB)

        const nearbyAABBs = yield* pipe(
          nearbyEntityIds,
          Effect.reduce([] as AABB[], (acc, nearbyId) =>
            Effect.gen(function* () {
              if (nearbyId === entityId) return acc
              const components = yield* Effect.all({
                pos: world.getComponent(nearbyId, 'position'),
                col: world.getComponent(nearbyId, 'collider'),
              })
              return pipe(
                Option.all(components),
                Option.map(({ pos, col }) => [...acc, createAABB(pos, col)]),
                Option.getOrElse(() => acc),
              )
            }),
          ),
        )

        const { newPosition, newVelocity, isGrounded } = resolveCollisions(position, velocity, collider, nearbyAABBs)

        yield* world.updateComponent(entityId, 'position', newPosition)
        yield* world.updateComponent(entityId, 'velocity', newVelocity)
        const newPlayerState = setPlayerGrounded(player, isGrounded)
        yield* world.updateComponent(entityId, 'player', newPlayerState)
      }),
    { discard: true },
  )
})
