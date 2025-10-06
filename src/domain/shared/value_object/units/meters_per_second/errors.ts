/**
 * @fileoverview MetersPerSecond Errors
 * MetersPerSecond型のエラー定義
 */

import * as Schema from 'effect/Schema'

/**
 * MetersPerSecond validation error
 *
 * MetersPerSecond型のバリデーションエラー
 */
export class MetersPerSecondError extends Schema.TaggedError<MetersPerSecondError>()('MetersPerSecondError', {
  value: Schema.Unknown,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/**
 * Helper to create MetersPerSecondError
 */
export const makeMetersPerSecondError = (value: unknown, reason: string, context?: string): MetersPerSecondError =>
  new MetersPerSecondError({ value, reason, context })
