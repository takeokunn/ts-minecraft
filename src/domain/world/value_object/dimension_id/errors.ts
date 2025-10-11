/**
 * @fileoverview Dimension ID Errors
 * DimensionId関連のエラー定義
 */

import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { ErrorCauseSchema } from '@/shared/schema/error'

/**
 * DimensionIdエラー
 * 無効な次元IDが指定された場合に発生
 */
export const DimensionIdErrorSchema = Schema.TaggedError('DimensionIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(ErrorCauseSchema),
})

export type DimensionIdError = Schema.Schema.Type<typeof DimensionIdErrorSchema>

export const DimensionIdError = makeErrorFactory(DimensionIdErrorSchema)
