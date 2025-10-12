import { Match, Schema, pipe } from 'effect'

export type JsonPrimitive = string | number | boolean | null

export type JsonValueRecord = { readonly [key: string]: JsonValue }

/**
 * JSON互換値を表すSchema
 */
export const JsonValueSchema = Schema.suspend(() =>
  Schema.Union(
    Schema.Null,
    Schema.Boolean,
    Schema.Number,
    Schema.String,
    Schema.Array(JsonValueSchema),
    Schema.Record({ key: Schema.String, value: JsonValueSchema })
  )
)
export type JsonValue = Schema.Schema.Type<typeof JsonValueSchema>

export type JsonValueArray = ReadonlyArray<JsonValue>

/**
 * JSON互換なレコードを表すSchema
 */
export const JsonRecordSchema = Schema.Record({ key: Schema.String, value: JsonValueSchema })
export type JsonRecord = Schema.Schema.Type<typeof JsonRecordSchema>

/**
 * JSON互換値へ正規化可能な入力型
 *
 * - 既にJSON互換な値
 * - JSON互換な配列 / レコード
 * - プリミティブ値
 * - Error (messageを抽出)
 */
export type JsonSerializable =
  | JsonValue
  | readonly JsonSerializable[]
  | { readonly [key: string]: JsonSerializable }
  | JsonPrimitive
  | Error

const isPlainObject = (value: JsonSerializable): value is { readonly [key: string]: JsonSerializable } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Error)

/**
 * 任意値を JSON 互換値へ正規化
 */
export const toJsonValue = (value: JsonSerializable): JsonValue =>
  pipe(
    Match.value(value),
    Match.when(Schema.is(JsonValueSchema), (json) => json as JsonValue),
    Match.when(
      (candidate): candidate is Error => candidate instanceof Error,
      (error) => ({ message: error.message })
    ),
    Match.when(Array.isArray, (array) => array.map(toJsonValue) as JsonValue),
    Match.when(isPlainObject, (record) => {
      const entries = Object.entries(record).map(([key, entry]) => [key, toJsonValue(entry)] as const)
      return Object.fromEntries(entries) as JsonValue
    }),
    Match.orElse(() => value as JsonValue)
  )

/**
 * 任意値を JSON 互換値へ正規化（undefined の場合は undefined を返す）
 */
export const toJsonValueOption = (value: JsonSerializable | undefined): JsonValue | undefined =>
  pipe(
    Match.value(value),
    Match.when(
      (candidate): candidate is JsonSerializable => candidate !== undefined,
      (candidate) => toJsonValue(candidate)
    ),
    Match.orElse(() => undefined)
  )

/**
 * JsonSerializable への型ガード
 */
export const isJsonSerializable = (value: unknown): value is JsonSerializable =>
  pipe(
    Match.value(value),
    Match.when(
      (candidate): candidate is null => candidate === null,
      () => true
    ),
    Match.when(
      (candidate): candidate is string | number | boolean => {
        const typeOfCandidate = typeof candidate
        return typeOfCandidate === 'string' || typeOfCandidate === 'number' || typeOfCandidate === 'boolean'
      },
      () => true
    ),
    Match.when(
      (candidate): candidate is Error => candidate instanceof Error,
      () => true
    ),
    Match.when(Array.isArray, (array) => array.every(isJsonSerializable)),
    Match.when(
      (candidate): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null,
      (record) => Object.values(record).every(isJsonSerializable)
    ),
    Match.orElse(() => false)
  )
