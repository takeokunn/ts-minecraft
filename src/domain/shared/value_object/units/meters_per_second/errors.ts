/**
 * @fileoverview MetersPerSecond Errors
 * MetersPerSecond型のエラー定義
 */

import * as Schema from 'effect/Schema'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { JsonValueSchema } from '@/shared/schema/json'

/**
 * MetersPerSecond validation error
 *
 * MetersPerSecond型のバリデーションエラー
 */
export const MetersPerSecondErrorSchema = Schema.TaggedError('MetersPerSecondError', {
  value: JsonValueSchema,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
})

export type MetersPerSecondError = Schema.Schema.Type<typeof MetersPerSecondErrorSchema>

export const MetersPerSecondError = makeErrorFactory(MetersPerSecondErrorSchema)

/**
 * Helper to create MetersPerSecondError
 */
export const makeMetersPerSecondError = (
  value: unknown,
  reason: string,
  context?: string
): MetersPerSecondError => MetersPerSecondError.make({ value, reason, context })
