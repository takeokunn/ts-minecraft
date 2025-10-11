import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { ErrorCauseSchema } from '@/shared/schema/error'

// -----------------------------------------------------------------------------
// ECSEntityId エラー定義
// -----------------------------------------------------------------------------

/**
 * ECSEntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export const ECSEntityIdErrorSchema = Schema.TaggedError('ECSEntityIdError', {
  message: Schema.String,
  value: Schema.Number,
  cause: Schema.optional(ErrorCauseSchema),
})
export type ECSEntityIdError = Schema.Schema.Type<typeof ECSEntityIdErrorSchema>
export const ECSEntityIdError = makeErrorFactory(ECSEntityIdErrorSchema)
