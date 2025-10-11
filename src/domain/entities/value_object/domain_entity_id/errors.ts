import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

import { ErrorCauseSchema } from '@/shared/schema/error'

// -----------------------------------------------------------------------------
// DomainEntityId エラー定義
// -----------------------------------------------------------------------------

/**
 * DomainEntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export const DomainEntityIdErrorSchema = Schema.TaggedError('DomainEntityIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(ErrorCauseSchema),
})

export type DomainEntityIdError = Schema.Schema.Type<typeof DomainEntityIdErrorSchema>

export const DomainEntityIdError = makeErrorFactory(DomainEntityIdErrorSchema)
