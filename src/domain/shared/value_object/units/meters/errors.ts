/**
 * @fileoverview Meters Errors
 * Meters型のエラー定義
 */

import * as Schema from 'effect/Schema'

/**
 * Meters validation error
 *
 * Meters型のバリデーションエラー
 */
export class MetersError extends Schema.TaggedError<MetersError>()('MetersError', {
  value: Schema.Unknown,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/**
 * Helper to create MetersError
 */
export const makeMetersError = (value: unknown, reason: string, context?: string): MetersError =>
  new MetersError({ value, reason, context })
