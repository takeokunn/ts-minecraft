import { Schema } from '@effect/schema'

/**
 * 初期化エラー
 * アプリケーション初期化時の問題
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

export const InitError = (params: Omit<InitError, '_tag'>): InitError => ({
  _tag: 'InitError' as const,
  ...params,
})

/**
 * 設定エラー
 * 設定ファイルの読み込みや解析の問題
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

export const ConfigError = (params: Omit<ConfigError, '_tag'>): ConfigError => ({
  _tag: 'ConfigError' as const,
  ...params,
})

/**
 * すべてのアプリケーションエラーのユニオン型
 */
export const AppErrorUnion = Schema.Union(
  InitErrorSchema,
  ConfigErrorSchema
)

export type AnyAppError = Schema.Schema.Type<typeof AppErrorUnion>

/**
 * Schemaベースのデコード関数
 */
export const decodeInitError = Schema.decodeUnknown(InitErrorSchema)
export const decodeConfigError = Schema.decodeUnknown(ConfigErrorSchema)
export const decodeAppError = Schema.decodeUnknown(AppErrorUnion)

/**
 * 旧式の型ガード関数（互換性のため保持）
 * 新しいコードでは上記のdecode関数を使用してください
 */
export const isInitError = (error: unknown): error is InitError =>
  Schema.is(InitErrorSchema)(error)

export const isConfigError = (error: unknown): error is ConfigError =>
  Schema.is(ConfigErrorSchema)(error)
