import { Schema } from 'effect'
import { Vector3Schema } from '@ts-minecraft/core'

export const BoxShapeConfigSchema = Schema.Struct({
  halfExtents: Vector3Schema,
})
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>

export const SphereShapeConfigSchema = Schema.Struct({
  radius: Schema.Number.pipe(Schema.finite(), Schema.positive()),
})
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>
