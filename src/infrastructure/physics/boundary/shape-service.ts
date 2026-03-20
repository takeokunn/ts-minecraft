import { Effect, Schema } from 'effect'
import { Vector3Schema } from '@/infrastructure/physics/core'

export type CustomShape =
  | { readonly kind: 'box'; readonly halfExtents: { x: number; y: number; z: number } }
  | { readonly kind: 'sphere'; readonly radius: number }
  | { readonly kind: 'plane' }

export const BoxShapeConfigSchema = Schema.Struct({
  halfExtents: Vector3Schema,
})
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>

export const SphereShapeConfigSchema = Schema.Struct({
  radius: Schema.Number,
})
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>

export class ShapeService extends Effect.Service<ShapeService>()(
  '@minecraft/infrastructure/physics/ShapeService',
  {
    succeed: {
      createBox: (config: BoxShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.sync(() => ({ kind: 'box' as const, halfExtents: config.halfExtents })),
      createSphere: (config: SphereShapeConfig): Effect.Effect<CustomShape, never> =>
        Effect.sync(() => ({ kind: 'sphere' as const, radius: config.radius })),
      createPlane: (): Effect.Effect<CustomShape, never> =>
        Effect.sync(() => ({ kind: 'plane' as const })),
    },
  }
) {}
export const ShapeServiceLive = ShapeService.Default
