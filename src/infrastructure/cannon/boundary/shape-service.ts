import { Effect } from 'effect'
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
export { ShapeService as ShapeServiceLive }
