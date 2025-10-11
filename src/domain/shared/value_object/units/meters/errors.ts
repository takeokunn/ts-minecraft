/**
 * @fileoverview Meters Errors
 * Meters型のエラー定義
 */

import * as Schema from 'effect/Schema'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { JsonValueSchema, toJsonValue, type JsonSerializable } from '@shared/schema/json'

/**
 * Meters validation error
 *
 * Meters型のバリデーションエラー
 */
export const MetersErrorSchema = Schema.TaggedError('MetersError', {
  value: JsonValueSchema,
  reason: Schema.String,
  context: Schema.optional(Schema.String),
})

export type MetersError = Schema.Schema.Type<typeof MetersErrorSchema>

export const MetersError = makeErrorFactory(MetersErrorSchema)

/**
 * Helper to create MetersError
 */
export const makeMetersError = (value: JsonSerializable, reason: string, context?: string): MetersError =>
  MetersError.make({ value: toJsonValue(value), reason, context })
