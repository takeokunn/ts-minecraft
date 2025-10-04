import { Context, Effect, Layer, Match, pipe } from 'effect'
import type { AABB, PhysicsWorldId, Vector3 } from '../types/core'
import { vector3 } from '../types/core'
import { CollisionService } from '../domain_service/collision_service'
import type { PhysicsError } from '../types/errors'

export interface BlockPlacementContext {
  readonly worldId: PhysicsWorldId
  readonly shape: AABB
  readonly position: Vector3
  readonly sample: (query: AABB) => ReadonlyArray<AABB>
}

export interface MovementContext {
  readonly worldId: PhysicsWorldId
  readonly shape: AABB
  readonly position: Vector3
  readonly velocity: Vector3
  readonly deltaTime: number
  readonly sample: (query: AABB) => ReadonlyArray<AABB>
}

export interface WorldCollisionApplicationService {
  readonly canPlaceBlock: (context: BlockPlacementContext) => Effect.Effect<boolean, PhysicsError>
  readonly simulateMovement: (
    context: MovementContext
  ) => Effect.Effect<{ readonly position: Vector3; readonly grounded: boolean }, PhysicsError>
}

export const WorldCollisionApplicationService = Context.Tag<WorldCollisionApplicationService>(
  '@minecraft/physics/WorldCollisionApplicationService'
)

export const WorldCollisionApplicationServiceLive = Layer.effect(
  WorldCollisionApplicationService,
  Effect.gen(function* () {
    const collision = yield* CollisionService

    const canPlaceBlock: WorldCollisionApplicationService['canPlaceBlock'] = (context) =>
      Effect.map(
        collision.detect({
          worldId: context.worldId,
          body: context.shape,
          position: context.position,
          velocity: vector3({ x: 0, y: 0, z: 0 }),
          deltaTime: 0.01,
          sample: context.sample,
        }),
        (result) => !result.collidedAxes.x && !result.collidedAxes.y && !result.collidedAxes.z
      )

    const simulateMovement: WorldCollisionApplicationService['simulateMovement'] = (context) =>
      Effect.map(
        collision.detect({
          worldId: context.worldId,
          body: context.shape,
          position: context.position,
          velocity: context.velocity,
          deltaTime: context.deltaTime,
          sample: context.sample,
        }),
        (result) => ({
          position: result.position,
          grounded: result.collidedAxes.y,
        })
      )

    return {
      canPlaceBlock,
      simulateMovement,
    }
  })
)
