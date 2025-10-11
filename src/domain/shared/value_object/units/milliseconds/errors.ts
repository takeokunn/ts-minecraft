/**
 * @fileoverview Milliseconds Errors
 * Milliseconds型のエラー定義
 */

import * as Schema from 'effect/Schema'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { JsonValueSchema } from '@/shared/schema/json'

/**
 * Milliseconds validation error
 *
 * Milliseconds型のバリデーションエラー
 */
export const MillisecondsErrorSchema = Schema.TaggedError('MillisecondsError', {
  value: JsonValueSchema,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
})

export type MillisecondsError = Schema.Schema.Type<typeof MillisecondsErrorSchema>

export const MillisecondsError = makeErrorFactory(MillisecondsErrorSchema)

/**
 * Helper to create MillisecondsError
 */
export const makeMillisecondsError = (value: unknown, reason: string, context?: string): MillisecondsError =>
  MillisecondsError.make({ value, reason, context })
