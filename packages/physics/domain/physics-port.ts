import { Context, Effect } from 'effect'
import type { DeltaTimeSecs, Vector3 } from '@ts-minecraft/kernel'
import type { WorldConfig, CustomWorld } from './physics-world'
import type { CustomBody, CustomShape, RigidBodyConfig } from './physics-body'
import type { BoxShapeConfig, SphereShapeConfig } from './physics-shape'

export interface PhysicsWorldPort {
  readonly create: (config: WorldConfig) => Effect.Effect<CustomWorld>
  readonly addBody: (world: CustomWorld, body: CustomBody) => Effect.Effect<void>
  readonly removeBody: (world: CustomWorld, body: CustomBody) => Effect.Effect<void>
  readonly step: (world: CustomWorld, dt: DeltaTimeSecs) => Effect.Effect<void>
}
export const PhysicsWorldPort = Context.GenericTag<PhysicsWorldPort>('@minecraft/application/physics/PhysicsWorldPort')

export interface RigidBodyPort {
  readonly create: (config: RigidBodyConfig) => Effect.Effect<CustomBody>
  readonly setPosition: (body: CustomBody, position: Vector3) => Effect.Effect<void>
  readonly setVelocity: (body: CustomBody, velocity: Vector3) => Effect.Effect<void>
  readonly addShape: (body: CustomBody, shape: CustomShape) => Effect.Effect<void>
}
export const RigidBodyPort = Context.GenericTag<RigidBodyPort>('@minecraft/application/physics/RigidBodyPort')

export interface ShapePort {
  readonly createBox: (config: BoxShapeConfig) => Effect.Effect<CustomShape>
  readonly createSphere: (config: SphereShapeConfig) => Effect.Effect<CustomShape>
  readonly createPlane: () => Effect.Effect<CustomShape>
}
export const ShapePort = Context.GenericTag<ShapePort>('@minecraft/application/physics/ShapePort')
