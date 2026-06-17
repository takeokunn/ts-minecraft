import { Effect } from 'effect'
import type { CustomShape } from '../../domain/physics-body'
import type { BoxShapeConfig, SphereShapeConfig } from '../../domain/physics-shape'

export class ShapeService extends Effect.Service<ShapeService>()(
  '@minecraft/infrastructure/physics/ShapeService',
  {
    succeed: {
      createBox: (config: BoxShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.succeed({ kind: 'box' as const, halfExtents: config.halfExtents }),
      createSphere: (config: SphereShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.succeed({ kind: 'sphere' as const, radius: config.radius }),
      createPlane: (): Effect.Effect<CustomShape, never> =>
        Effect.succeed({ kind: 'plane' as const }),
    },
  }
) {}
