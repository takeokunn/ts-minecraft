/**
 * @fileoverview Milliseconds Errors
 * Milliseconds型のエラー定義
 */

import * as Schema from 'effect/Schema'

/**
 * Milliseconds validation error
 *
 * Milliseconds型のバリデーションエラー
 */
export class MillisecondsError extends Schema.TaggedError<MillisecondsError>()('MillisecondsError', {
  value: Schema.Unknown,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/**
 * Helper to create MillisecondsError
 */
export const makeMillisecondsError = (value: unknown, reason: string, context?: string): MillisecondsError =>
  new MillisecondsError({ value, reason, context })
