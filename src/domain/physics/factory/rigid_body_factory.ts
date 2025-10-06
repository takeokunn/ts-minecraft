import { Effect } from 'effect'
import { RigidBodyAggregate } from '../aggregate'
import type { PhysicsWorldId, RigidBody, RigidBodyType, Vector3 } from '@domain/physics/types'
import type { PhysicsError } from '@domain/physics/types'

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
