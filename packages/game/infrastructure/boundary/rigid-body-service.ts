import { Effect } from 'effect'
import type { CustomBody, RigidBodyConfig, CustomShape } from '../../domain/physics-body'
import type { Vector3 } from '@ts-minecraft/core'

// Placeholder replaced by addShape during the body creation workflow.
const PLACEHOLDER_SHAPE: CustomShape = { kind: 'box', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }

export class RigidBodyService extends Effect.Service<RigidBodyService>()(
  '@minecraft/infrastructure/physics/RigidBodyService',
  {
    succeed: {
      create: (config: RigidBodyConfig): Effect.Effect<CustomBody, never> =>
        Effect.succeed({
          position: { x: config.position.x, y: config.position.y, z: config.position.z },
          velocity: { x: 0, y: 0, z: 0 },
          mass: config.mass,
          type: config.type ?? ('dynamic' as const),
          shape: PLACEHOLDER_SHAPE,
        }),
      setPosition: (body: CustomBody, position: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.position.x = position.x
          body.position.y = position.y
          body.position.z = position.z
        }),
      setVelocity: (body: CustomBody, velocity: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.velocity.x = velocity.x
          body.velocity.y = velocity.y
          body.velocity.z = velocity.z
        }),
      addShape: (body: CustomBody, shape: CustomShape): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.shape = shape
        }),
    },
  }
) {}
