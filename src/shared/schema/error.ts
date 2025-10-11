import { Schema } from 'effect'

import { JsonValueSchema } from './json'

/**
 * エラー原因を表すSchema
 *
 * - `Error` インスタンス
 * - JSON互換なメタデータ
 * - `message` フィールドのみを持つシリアライズ済みエラーレコード
 */
export const ErrorCauseSchema = Schema.Union(
  Schema.instanceOf(Error),
  JsonValueSchema,
  Schema.Struct({
    message: Schema.String,
  })
)

export type ErrorCause = Schema.Schema.Type<typeof ErrorCauseSchema>

/**
 * エラー投下時の詳細情報を持つ可変レコード
 */
export const ErrorDetailSchema = Schema.Record({ key: Schema.String, value: JsonValueSchema })
export type ErrorDetail = Schema.Schema.Type<typeof ErrorDetailSchema>

/**
 * 任意値を ErrorCause へ正規化するユーティリティ
 */
export const toErrorCause = (value: unknown): ErrorCause | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  if (value instanceof Error) {
    return value
  }

  if (Schema.is(JsonValueSchema)(value)) {
    return value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in (value as Record<string, unknown>) &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    return { message: (value as { message: string }).message }
  }

  return { message: String(value) }
}
