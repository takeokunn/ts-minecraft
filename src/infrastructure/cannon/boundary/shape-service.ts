import { Effect, Schema } from 'effect'
import * as CANNON from 'cannon-es'
import { Vector3Schema } from '@/infrastructure/cannon/core'

export const BoxShapeConfigSchema = Schema.Struct({
  halfExtents: Vector3Schema,
})
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>

export const SphereShapeConfigSchema = Schema.Struct({
  radius: Schema.Number,
})
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>

export const CylinderShapeConfigSchema = Schema.Struct({
  radiusTop: Schema.Number,
  radiusBottom: Schema.Number,
  height: Schema.Number,
  numSegments: Schema.optional(Schema.Number),
})
export type CylinderShapeConfig = Schema.Schema.Type<typeof CylinderShapeConfigSchema>

export class ShapeService extends Effect.Service<ShapeService>()(
  '@minecraft/infrastructure/cannon/ShapeService',
  {
    succeed: {
      createBox: (config: BoxShapeConfig): Effect.Effect<CANNON.Box, never> =>
        Effect.sync(() => new CANNON.Box(new CANNON.Vec3(config.halfExtents.x, config.halfExtents.y, config.halfExtents.z))),
      createSphere: (config: SphereShapeConfig): Effect.Effect<CANNON.Sphere, never> =>
        Effect.sync(() => new CANNON.Sphere(config.radius)),
      createCylinder: (config: CylinderShapeConfig): Effect.Effect<CANNON.Cylinder, never> =>
        Effect.sync(() => new CANNON.Cylinder(config.radiusTop, config.radiusBottom, config.height, config.numSegments ?? 8)),
      createPlane: (): Effect.Effect<CANNON.Plane, never> =>
        Effect.sync(() => new CANNON.Plane()),
    },
  }
) {}
export const ShapeServiceLive = ShapeService.Default
