import { Effect, Schema } from 'effect'
import type { CustomShape } from './shape-service'
import { Vector3Schema, QuaternionSchema } from '@/infrastructure/physics/core'

export type CustomBody = {
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  mass: number
  type: 'dynamic' | 'static' | 'kinematic'
  shape: CustomShape
  fixedRotation: boolean
  angularDamping: number
  allowSleep: boolean
}

export const RigidBodyConfigSchema = Schema.Struct({
  mass: Schema.Number,
  position: Vector3Schema,
  quaternion: QuaternionSchema,
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
})
export type RigidBodyConfig = Schema.Schema.Type<typeof RigidBodyConfigSchema>

export class RigidBodyService extends Effect.Service<RigidBodyService>()(
  '@minecraft/infrastructure/physics/RigidBodyService',
  {
    succeed: {
      create: (config: RigidBodyConfig): Effect.Effect<CustomBody, never> =>
        Effect.sync(() => ({
          position: { x: config.position.x, y: config.position.y, z: config.position.z },
          velocity: { x: 0, y: 0, z: 0 },
          mass: config.mass,
          type: config.type ?? 'dynamic',
          shape: { kind: 'box' as const, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }, // placeholder, replaced by addShape
          fixedRotation: false,
          angularDamping: 0,
          allowSleep: true,
        })),
      setPosition: (body: CustomBody, position: { x: number; y: number; z: number }): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.position.x = position.x
          body.position.y = position.y
          body.position.z = position.z
        }),
      setQuaternion: (_body: CustomBody, _quaternion: { x: number; y: number; z: number; w: number }): Effect.Effect<void, never> =>
        Effect.void, // Custom engine does not track rotation
      setVelocity: (body: CustomBody, velocity: { x: number; y: number; z: number }): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.velocity.x = velocity.x
          body.velocity.y = velocity.y
          body.velocity.z = velocity.z
        }),
      setAngularVelocity: (_body: CustomBody, _angularVelocity: { x: number; y: number; z: number }): Effect.Effect<void, never> =>
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
