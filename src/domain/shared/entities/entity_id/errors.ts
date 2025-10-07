import { Schema } from 'effect'

/**
 * EntityId関連のエラー
 * 無効なフォーマット、バリデーション失敗時に使用
 */
export class EntityIdError extends Schema.TaggedError<EntityIdError>()('EntityIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
