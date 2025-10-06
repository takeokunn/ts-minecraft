import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// DomainEntityId エラー定義
// -----------------------------------------------------------------------------

/**
 * DomainEntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export class DomainEntityIdError extends Schema.TaggedError<DomainEntityIdError>()('DomainEntityIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
