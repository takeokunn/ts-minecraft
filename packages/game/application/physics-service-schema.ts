import { Schema } from 'effect'
import { PositionSchema, Vector3Schema } from '@ts-minecraft/core'

const ShapeParamsSchema = Schema.Struct({
  halfExtents: Schema.optional(Vector3Schema),
  radius: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.positive())),
})

export const AddBodyConfigSchema = Schema.Struct({
  mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  position: PositionSchema,
  shape: Schema.Literal('box', 'sphere', 'plane'),
  shapeParams: Schema.optional(ShapeParamsSchema),
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
})

export type AddBodyConfig = Schema.Schema.Type<typeof AddBodyConfigSchema>
