/**
 * @fileoverview Timestamp Errors
 * Timestamp型のエラー定義
 */

import * as Schema from 'effect/Schema'

/**
 * Timestamp validation error
 *
 * Timestamp型のバリデーションエラー
 */
export class TimestampError extends Schema.TaggedError<TimestampError>()('TimestampError', {
  value: Schema.Unknown,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/**
 * Helper to create TimestampError
 */
export const makeTimestampError = (value: unknown, reason: string, context?: string): TimestampError =>
  new TimestampError({ value, reason, context })
