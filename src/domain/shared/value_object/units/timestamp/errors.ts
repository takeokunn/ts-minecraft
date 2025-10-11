/**
 * @fileoverview Timestamp Errors
 * Timestamp型のエラー定義
 */

import * as Schema from 'effect/Schema'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { JsonValueSchema } from '@/shared/schema/json'

/**
 * Timestamp validation error
 *
 * Timestamp型のバリデーションエラー
 */
export const TimestampErrorSchema = Schema.TaggedError('TimestampError', {
  value: JsonValueSchema,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
})

export type TimestampError = Schema.Schema.Type<typeof TimestampErrorSchema>

export const TimestampError = makeErrorFactory(TimestampErrorSchema)

/**
 * Helper to create TimestampError
 */
export const makeTimestampError = (value: unknown, reason: string, context?: string): TimestampError =>
  TimestampError.make({ value, reason, context })
