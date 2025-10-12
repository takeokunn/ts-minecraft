import { Schema } from 'effect'

export const BiomeGenerationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('BiomeGenerationError'),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export type BiomeGenerationError = typeof BiomeGenerationErrorSchema.Type

export const BiomeGenerationError = (message: string, cause?: unknown): BiomeGenerationError => ({
  _tag: 'BiomeGenerationError',
  message,
  cause,
})
