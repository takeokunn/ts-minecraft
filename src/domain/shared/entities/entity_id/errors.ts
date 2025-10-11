import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

import { ErrorCauseSchema } from '@/shared/schema/error'

/**
 * EntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export const EntityIdErrorSchema = Schema.TaggedError('EntityIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(ErrorCauseSchema),
})

export type EntityIdError = Schema.Schema.Type<typeof EntityIdErrorSchema>

export const EntityIdError = makeErrorFactory(EntityIdErrorSchema)
