import { Schema } from 'effect'

/**
 * ChunkIdエラー
 *
 * ChunkId生成・検証・変換時のエラー
 */
export class ChunkIdError extends Schema.TaggedError<ChunkIdError>()('ChunkIdError', {
  message: Schema.String,
  value: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}
