import { Effect, Context, Layer } from 'effect'
import * as CANNON from 'cannon-es'
import type { Vector3 } from '@/infrastructure/cannon/core'

export type BoxShapeConfig = {
  readonly halfExtents: Vector3
}

export type SphereShapeConfig = {
  readonly radius: number
}

export type CylinderShapeConfig = {
  readonly radiusTop: number
  readonly radiusBottom: number
  readonly height: number
  readonly numSegments?: number
}

export interface ShapeService {
  readonly createBox: (config: BoxShapeConfig) => Effect.Effect<CANNON.Box, never>
  readonly createSphere: (config: SphereShapeConfig) => Effect.Effect<CANNON.Sphere, never>
  readonly createCylinder: (config: CylinderShapeConfig) => Effect.Effect<CANNON.Cylinder, never>
  readonly createPlane: () => Effect.Effect<CANNON.Plane, never>
}

export const ShapeService = Context.GenericTag<ShapeService>(
  '@minecraft/infrastructure/cannon/ShapeService',
)

export const ShapeServiceLive = Layer.succeed(
  ShapeService,
  ShapeService.of({
    createBox: (config) =>
      Effect.sync(() => new CANNON.Box(new CANNON.Vec3(config.halfExtents.x, config.halfExtents.y, config.halfExtents.z))),
    createSphere: (config) =>
      Effect.sync(() => new CANNON.Sphere(config.radius)),
    createCylinder: (config) =>
      Effect.sync(() => new CANNON.Cylinder(config.radiusTop, config.radiusBottom, config.height, config.numSegments ?? 8)),
    createPlane: () =>
      Effect.sync(() => new CANNON.Plane()),
  }),
)
