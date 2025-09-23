import { Schema } from '@effect/schema'

export const Config = Schema.Struct({
  debug: Schema.Boolean,
  fps: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(120)),
  memoryLimit: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.lessThanOrEqualTo(2048) // MB
  ),
})

export type Config = Schema.Schema.Type<typeof Config>
