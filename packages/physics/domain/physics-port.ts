import { Effect, Schema } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import { QuaternionSchema, type Quaternion, Vector3Schema, type Vector3 } from '@ts-minecraft/kernel'

export type { Quaternion }

export const CustomShapeSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('box'), halfExtents: Vector3Schema }),
  Schema.Struct({ kind: Schema.Literal('sphere'), radius: Schema.Number.pipe(Schema.finite(), Schema.positive()) }),
  Schema.Struct({ kind: Schema.Literal('plane') }),
)
export type CustomShape = Schema.Schema.Type<typeof CustomShapeSchema>

export const CustomBodySchema = Schema.mutable(Schema.Struct({
  position: Schema.mutable(Vector3Schema),
  velocity: Schema.mutable(Vector3Schema),
  mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  type: Schema.Literal('dynamic', 'static', 'kinematic'),
  shape: CustomShapeSchema,
  fixedRotation: Schema.Boolean,
  angularDamping: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  allowSleep: Schema.Boolean,
}))
export type CustomBody = Schema.Schema.Type<typeof CustomBodySchema>

export const CustomWorldSchema = Schema.mutable(
  Schema.Struct({
    gravity: Vector3Schema,
    bodies: Schema.mutable(Schema.Array(CustomBodySchema)),
  }),
)
export type CustomWorld = Schema.Schema.Type<typeof CustomWorldSchema>

export const WorldConfigSchema = Schema.Struct({
  gravity: Vector3Schema,
  broadphase: Schema.Literal('naive', 'sap'),
})
export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>

export const RigidBodyConfigSchema = Schema.Struct({
  mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  position: Vector3Schema,
  quaternion: QuaternionSchema,
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
})
export type RigidBodyConfig = Schema.Schema.Type<typeof RigidBodyConfigSchema>

export const BoxShapeConfigSchema = Schema.Struct({
  halfExtents: Vector3Schema,
})
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>

export const SphereShapeConfigSchema = Schema.Struct({
  radius: Schema.Number.pipe(Schema.finite(), Schema.positive()),
})
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>

export class PhysicsWorldPort extends Effect.Service<PhysicsWorldPort>()(
  '@minecraft/application/physics/PhysicsWorldPort',
  {
    succeed: {
      /* c8 ignore next 2 */
      create: (_config: WorldConfig): Effect.Effect<CustomWorld, never> =>
        Effect.die('PhysicsWorldPort.create not provided'),
      /* c8 ignore next 2 */
      addBody: (_world: CustomWorld, _body: CustomBody): Effect.Effect<void, never> =>
        Effect.die('PhysicsWorldPort.addBody not provided'),
      /* c8 ignore next 2 */
      removeBody: (_world: CustomWorld, _body: CustomBody): Effect.Effect<void, never> =>
        Effect.die('PhysicsWorldPort.removeBody not provided'),
      /* c8 ignore next 2 */
      step: (_world: CustomWorld, _deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.die('PhysicsWorldPort.step not provided'),
    },
  }
) {}

export class RigidBodyPort extends Effect.Service<RigidBodyPort>()(
  '@minecraft/application/physics/RigidBodyPort',
  {
    succeed: {
      /* c8 ignore next 2 */
      create: (_config: RigidBodyConfig): Effect.Effect<CustomBody, never> =>
        Effect.die('RigidBodyPort.create not provided'),
      /* c8 ignore next 2 */
      setPosition: (_body: CustomBody, _position: Vector3): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.setPosition not provided'),
      /* c8 ignore next 2 */
      setQuaternion: (_body: CustomBody, _quaternion: Quaternion): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.setQuaternion not provided'),
      /* c8 ignore next 2 */
      setVelocity: (_body: CustomBody, _velocity: Vector3): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.setVelocity not provided'),
      /* c8 ignore next 2 */
      setAngularVelocity: (_body: CustomBody, _angularVelocity: Vector3): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.setAngularVelocity not provided'),
      /* c8 ignore next 2 */
      addShape: (_body: CustomBody, _shape: CustomShape): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.addShape not provided'),
      /* c8 ignore next 2 */
      updateMassProperties: (_body: CustomBody): Effect.Effect<void, never> =>
        Effect.die('RigidBodyPort.updateMassProperties not provided'),
    },
  }
) {}

export class ShapePort extends Effect.Service<ShapePort>()(
  '@minecraft/application/physics/ShapePort',
  {
    succeed: {
      /* c8 ignore next 2 */
      createBox: (_config: BoxShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.die('ShapePort.createBox not provided'),
      /* c8 ignore next 2 */
      createSphere: (_config: SphereShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.die('ShapePort.createSphere not provided'),
      /* c8 ignore next 2 */
      createPlane: (): Effect.Effect<CustomShape, never> =>
        Effect.die('ShapePort.createPlane not provided'),
    },
  }
) {}
