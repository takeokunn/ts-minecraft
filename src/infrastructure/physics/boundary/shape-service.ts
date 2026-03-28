import { Effect, Schema } from 'effect'
import { Vector3Schema } from '@/infrastructure/physics/core'

export const CustomShapeSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('box'), halfExtents: Vector3Schema }),
  Schema.Struct({ kind: Schema.Literal('sphere'), radius: Schema.Number.pipe(Schema.finite(), Schema.positive()) }),
  Schema.Struct({ kind: Schema.Literal('plane') }),
)
export type CustomShape = Schema.Schema.Type<typeof CustomShapeSchema>

export const BoxShapeConfigSchema = Schema.Struct({
  halfExtents: Vector3Schema,
})
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>

export const SphereShapeConfigSchema = Schema.Struct({
  radius: Schema.Number.pipe(Schema.finite(), Schema.positive()),
})
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>

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
export const ShapeServiceLive = ShapeService.Default
