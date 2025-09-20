import { Schema } from 'effect'

export const Config = Schema.Struct({
  debug: Schema.Boolean,
  fps: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(120)),
  memoryLimit: Schema.Number.pipe(
    Schema.positive(),
    Schema.lessThanOrEqualTo(2048) // MB
  ),
})

export type Config = typeof Config.Type
