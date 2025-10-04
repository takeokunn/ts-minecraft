import { Effect } from 'effect'
import type { PhysicsWorldId, RigidBody, RigidBodyType, Vector3 } from '../types/core'
import { RigidBodyAggregate } from '../aggregate/rigid_body'
import type { PhysicsError } from '../types/errors'

export interface RigidBodyCreationOptions {
  readonly worldId: PhysicsWorldId
  readonly entityId: string
  readonly bodyType: RigidBodyType
  readonly material: Parameters<typeof RigidBodyAggregate.create>[0]['material']
  readonly mass: unknown
  readonly position: Vector3
  readonly restitution?: unknown
  readonly friction?: unknown
}

export const RigidBodyFactory = {
  create: (options: RigidBodyCreationOptions): Effect.Effect<RigidBody, PhysicsError> =>
    RigidBodyAggregate.create(options),
}
