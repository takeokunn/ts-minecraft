import { Schema } from 'effect'
import { PlayerIdSchema, PositionSchema } from '@ts-minecraft/core'
import { Vector3Schema, QuaternionSchema } from '@ts-minecraft/core'

export const PlayerStateSchema = Schema.Struct({
  id: PlayerIdSchema,
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>
