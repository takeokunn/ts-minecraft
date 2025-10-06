import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// ECSEntityId エラー定義
// -----------------------------------------------------------------------------

/**
 * ECSEntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export class ECSEntityIdError extends Schema.TaggedError<ECSEntityIdError>()('ECSEntityIdError', {
  message: Schema.String,
  value: Schema.Number,
  cause: Schema.optional(Schema.Unknown),
}) {}
