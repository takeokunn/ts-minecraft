import { Schema } from 'effect'

/**
 * PlayerIdエラー
 *
 * PlayerId生成・検証時のエラー
 */
export class PlayerIdError extends Schema.TaggedError<PlayerIdError>()('PlayerIdError', {
  message: Schema.String,
  value: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}
