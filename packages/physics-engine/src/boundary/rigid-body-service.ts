import { Effect, Option } from 'effect'
import type { CustomBody, RigidBodyConfig, CustomShape } from '../physics-port'
import type { Quaternion } from '../core'
import type { Vector3 } from '../core'

export class RigidBodyService extends Effect.Service<RigidBodyService>()(
  '@minecraft/infrastructure/physics/RigidBodyService',
  {
    succeed: {
      create: (config: RigidBodyConfig): Effect.Effect<CustomBody, never> =>
        Effect.succeed({
          position: { x: config.position.x, y: config.position.y, z: config.position.z },
          velocity: { x: 0, y: 0, z: 0 },
          mass: config.mass,
          type: Option.getOrElse(Option.fromNullable(config.type), () => 'dynamic' as const),
          shape: { kind: 'box' as const, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }, // placeholder, replaced by addShape
          fixedRotation: false,
          angularDamping: 0,
          allowSleep: true,
        }),
      setPosition: (body: CustomBody, position: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.position.x = position.x
          body.position.y = position.y
          body.position.z = position.z
        }),
      setQuaternion: (_body: CustomBody, _quaternion: Quaternion): Effect.Effect<void, never> =>
        Effect.void, // Custom engine does not track rotation
      setVelocity: (body: CustomBody, velocity: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.velocity.x = velocity.x
          body.velocity.y = velocity.y
          body.velocity.z = velocity.z
        }),
      setAngularVelocity: (_body: CustomBody, _angularVelocity: Vector3): Effect.Effect<void, never> =>
        Effect.void, // Custom engine does not track angular velocity
      addShape: (body: CustomBody, shape: CustomShape): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.shape = shape
        }),
      updateMassProperties: (_body: CustomBody): Effect.Effect<void, never> =>
        Effect.void, // No-op in custom engine (mass is stored directly)
    },
  }
) {}
export const RigidBodyServiceLive = RigidBodyService.Default
