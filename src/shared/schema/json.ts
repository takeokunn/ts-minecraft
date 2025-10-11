import { Schema } from 'effect'

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
export const toJsonValue = (value: JsonSerializable): JsonValue => {
  if (Schema.is(JsonValueSchema)(value)) {
    return value
  }

  if (value instanceof Error) {
    return { message: value.message }
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item))
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)] as const)
    return Object.fromEntries(entries) as JsonValue
  }

  return value
}

/**
 * 任意値を JSON 互換値へ正規化（undefined の場合は undefined を返す）
 */
export const toJsonValueOption = (value: JsonSerializable | undefined): JsonValue | undefined => {
  if (value === undefined) {
    return undefined
  }

  return toJsonValue(value)
}

/**
 * JsonSerializable への型ガード
 */
export const isJsonSerializable = (value: unknown): value is JsonSerializable => {
  if (value === null) {
    return true
  }

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return true
  }

  if (value instanceof Error) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isJsonSerializable)
  }

  if (valueType === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonSerializable)
  }

  return false
}
