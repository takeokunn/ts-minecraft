import { Schema } from 'effect'

export const PositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})
export type Position = Schema.Schema.Type<typeof PositionSchema>
