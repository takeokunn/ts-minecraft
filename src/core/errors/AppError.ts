import { Schema } from '@effect/schema'
import { Data } from 'effect'

/**
 * 初期化エラー
 * アプリケーション初期化時の問題
 * Data.Errorを継承してinstanceof Errorに対応
 */
export const InitErrorSchema = Schema.Struct({
  _tag: Schema.Literal('InitError'),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'InitError',
    description: 'Error during application initialization',
  })
)

export type InitError = Schema.Schema.Type<typeof InitErrorSchema>

export const InitError = (params: Omit<InitError, '_tag'>): InitError =>
  Data.struct({
    _tag: 'InitError' as const,
    ...params,
  })

/**
 * 設定エラー
 * 設定ファイルの読み込みや解析の問題
 * Data.Errorを継承してinstanceof Errorに対応
 */
export const ConfigErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ConfigError'),
  message: Schema.String,
  path: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'ConfigError',
    description: 'Error in configuration loading or parsing',
  })
)

export type ConfigError = Schema.Schema.Type<typeof ConfigErrorSchema>

export const ConfigError = (params: Omit<ConfigError, '_tag'>): ConfigError =>
  Data.struct({
    _tag: 'ConfigError' as const,
    ...params,
  })

/**
 * すべてのアプリケーションエラーのユニオン型
 */
export const AppErrorUnion = Schema.Union(InitErrorSchema, ConfigErrorSchema)

export type AnyAppError = Schema.Schema.Type<typeof AppErrorUnion>

/**
 * Schemaベースのデコード関数
 */
export const decodeInitError = Schema.decodeUnknown(InitErrorSchema)
export const decodeConfigError = Schema.decodeUnknown(ConfigErrorSchema)
export const decodeAppError = Schema.decodeUnknown(AppErrorUnion)

/**
 * 型ガード関数（_tagによる判定、messageプロパティ不要）
 * _tagだけで判定可能に修正
 */
export const isInitError = (error: unknown): error is InitError => {
  return typeof error === 'object' &&
         error !== null &&
         '_tag' in error &&
         error._tag === 'InitError'
}

export const isConfigError = (error: unknown): error is ConfigError => {
  return typeof error === 'object' &&
         error !== null &&
         '_tag' in error &&
         error._tag === 'ConfigError'
}