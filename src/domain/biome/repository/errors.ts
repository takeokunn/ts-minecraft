import { Schema } from 'effect'

export const BiomeRepositoryErrorSchema = Schema.Struct({
  _tag: Schema.Literal('BiomeRepositoryError', 'BiomeCacheError'),
  message: Schema.String,
  operation: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type BiomeRepositoryError = typeof BiomeRepositoryErrorSchema.Type

export const createRepositoryError = (message: string, operation?: string, cause?: unknown): BiomeRepositoryError => ({
  _tag: 'BiomeRepositoryError',
  message,
  operation,
  cause,
})

export const createCacheError = (message: string, operation?: string, cause?: unknown): BiomeRepositoryError => ({
  _tag: 'BiomeCacheError',
  message,
  operation,
  cause,
})
