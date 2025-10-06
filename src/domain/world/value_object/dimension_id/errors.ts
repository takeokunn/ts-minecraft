/**
 * @fileoverview Dimension ID Errors
 * DimensionId関連のエラー定義
 */

import { Schema } from 'effect'

/**
 * DimensionIdエラー
 * 無効な次元IDが指定された場合に発生
 */
export class DimensionIdError extends Schema.TaggedError<DimensionIdError>()('DimensionIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
