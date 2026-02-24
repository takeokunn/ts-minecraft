import { Schema } from 'effect'

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>

export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>

export const PositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Position = Schema.Schema.Type<typeof PositionSchema>
