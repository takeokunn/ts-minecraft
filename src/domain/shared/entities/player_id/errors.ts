import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'

import { ErrorCauseSchema } from '@shared/schema/error'
import { JsonValueSchema } from '@shared/schema/json'

/**
 * PlayerIdエラー
 *
 * PlayerId生成・検証時のエラー
 */
export const PlayerIdErrorSchema = Schema.TaggedError('PlayerIdError', {
  message: Schema.String,
  value: Schema.optional(JsonValueSchema),
  cause: Schema.optional(ErrorCauseSchema),
})

export type PlayerIdError = Schema.Schema.Type<typeof PlayerIdErrorSchema>

export const PlayerIdError = makeErrorFactory(PlayerIdErrorSchema)
