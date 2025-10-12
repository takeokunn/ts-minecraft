import { Match, Schema, pipe } from 'effect'

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
export const toErrorCause = (value: unknown): ErrorCause | undefined =>
  pipe(
    Match.value(value),
    Match.when(
      (candidate) => candidate === undefined || candidate === null,
      () => undefined
    ),
    Match.when(
      (candidate): candidate is Error => candidate instanceof Error,
      (error) => error
    ),
    Match.when(Schema.is(JsonValueSchema), (json) => json as ErrorCause),
    Match.when(
      (candidate): candidate is { readonly message: string } =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'message' in candidate &&
        typeof (candidate as { message: unknown }).message === 'string',
      (record) => ({ message: (record as { message: string }).message })
    ),
    Match.orElse((candidate) => ({ message: String(candidate) }))
  )
