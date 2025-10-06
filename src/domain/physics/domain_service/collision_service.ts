import type { AABB, PhysicsError, PhysicsWorldId, Vector3 } from '@domain/physics/types'
import { Context, Effect, Layer } from 'effect'
import { CollisionResult } from '../value_object'

export interface CollisionQuery {
  readonly worldId: PhysicsWorldId
  readonly body: AABB
  readonly position: Vector3
  readonly velocity: Vector3
  readonly deltaTime: number
  readonly sample: (query: AABB) => ReadonlyArray<AABB>
}

export interface CollisionService {
  readonly detect: (query: CollisionQuery) => Effect.Effect<CollisionResult, PhysicsError>
}

export const CollisionService = Context.GenericTag<CollisionService>('@minecraft/physics/CollisionService')

export const CollisionServiceLive = Layer.succeed(CollisionService, {
  detect: (query) =>
    CollisionResult.detect({
      position: query.position,
      velocity: query.velocity,
      deltaTime: query.deltaTime,
      body: query.body,
      sample: query.sample,
    }),
})
