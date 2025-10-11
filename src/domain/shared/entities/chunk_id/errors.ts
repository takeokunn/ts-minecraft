import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { ErrorCauseSchema } from '@/shared/schema/error'
import { JsonValueSchema } from '@/shared/schema/json'

/**
 * ChunkIdエラー
 *
 * ChunkId生成・検証・変換時のエラー
 */
export const ChunkIdErrorSchema = Schema.TaggedError('ChunkIdError', {
  message: Schema.String,
  value: Schema.optional(JsonValueSchema),
  cause: Schema.optional(ErrorCauseSchema),
})

export type ChunkIdError = Schema.Schema.Type<typeof ChunkIdErrorSchema>

export const ChunkIdError = makeErrorFactory(ChunkIdErrorSchema)
