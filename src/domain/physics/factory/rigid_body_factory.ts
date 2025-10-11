import type { PhysicsError, PhysicsWorldId, RigidBody, RigidBodyType, Vector3 } from '@domain/physics/types'
import { Effect } from 'effect'
import { RigidBodyAggregate } from '../aggregate'

export interface RigidBodyCreationOptions {
  readonly worldId: PhysicsWorldId
  readonly entityId: string
  readonly bodyType: RigidBodyType
  readonly material: Parameters<typeof RigidBodyAggregate.create>[0]['material']
  readonly mass: number
  readonly position: Vector3
  readonly restitution?: number
  readonly friction?: number
}

export const RigidBodyFactory = {
  create: (options: RigidBodyCreationOptions): Effect.Effect<RigidBody, PhysicsError> =>
    RigidBodyAggregate.create(options),
}
