import { Schema } from '@effect/schema'
import { Data } from 'effect'

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

export interface InitError extends Schema.Schema.Type<typeof InitErrorSchema> {}

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

export interface ConfigError extends Schema.Schema.Type<typeof ConfigErrorSchema> {}

export const ConfigError = (params: Omit<ConfigError, '_tag'>): ConfigError => ({
  _tag: 'ConfigError' as const,
  ...params,
})

/**
 * すべてのアプリケーションエラーのユニオン型
 */
export const AppErrorUnion = Schema.Union(InitErrorSchema, ConfigErrorSchema)

export type AnyAppError = Schema.Schema.Type<typeof AppErrorUnion>

/**
 * エラー型ガード
 * 軽量な_tagチェックのみで判定
 */
export const isInitError = (error: unknown): error is InitError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InitError'

export const isConfigError = (error: unknown): error is ConfigError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'ConfigError'

/**
 * AppError名前空間
 * エラー処理のユーティリティ
 */
export namespace AppError {
  /**
   * エラーを分類
   */
  export const categorize = (error: AnyAppError): 'initialization' | 'configuration' => {
    switch (error._tag) {
      case 'InitError':
        return 'initialization'
      case 'ConfigError':
        return 'configuration'
    }
  }

  /**
   * エラーメッセージの取得
   */
  export const getMessage = (error: AnyAppError): string => error.message

  /**
   * 詳細なエラー情報を取得
   */
  export const getDetails = (error: AnyAppError): Record<string, unknown> => {
    if (isInitError(error)) {
      return {
        type: 'initialization',
        cause: error.cause,
      }
    }
    if (isConfigError(error)) {
      return {
        type: 'configuration',
        path: error.path,
      }
    }
    return {}
  }
}