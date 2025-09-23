import { Context, Effect, Option, Schema, pipe } from 'effect'

// ログレベル定義
export const LogLevel = Schema.Literal('DEBUG', 'INFO', 'WARN', 'ERROR')
export type LogLevel = Schema.Schema.Type<typeof LogLevel>

// ログレベルの優先度マッピング
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

// ログエントリのスキーマ
export const LogEntry = Schema.Struct({
  timestamp: Schema.String,
  level: LogLevel,
  message: Schema.String,
  context: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.Unknown),
})
export type LogEntry = Schema.Schema.Type<typeof LogEntry>

// パフォーマンス計測用のスキーマ
export const PerformanceMetrics = Schema.Struct({
  executionTime: Schema.Number,
  memoryUsage: Schema.optional(Schema.Number),
  functionName: Schema.String,
})
export type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetrics>

// LoggerService インターフェース
export interface LoggerService {
  readonly debug: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly info: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly warn: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly error: (message: string, error?: Error) => Effect.Effect<void>
  readonly measurePerformance: <A>(functionName: string, operation: Effect.Effect<A>) => Effect.Effect<A>
}

// Context タグ
export const LoggerService = Context.GenericTag<LoggerService>('@app/services/LoggerService')

// 共通ユーティリティ関数

// ログレベル設定の取得
export const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env['LOG_LEVEL']?.toUpperCase() as LogLevel | undefined

  // 環境変数が有効なログレベルの場合はそれを返す
  return pipe(
    Option.fromNullable(envLevel),
    Option.filter((level) => Object.keys(LOG_LEVEL_PRIORITY).includes(level)),
    Option.match({
      onNone: () =>
        // 開発環境ではDEBUG、本番環境ではINFOをデフォルトに
        process.env['NODE_ENV'] === 'production' ? 'INFO' : 'DEBUG',
      onSome: (level) => level,
    })
  )
}

// ログ出力の可否判定
export const shouldLog = (level: LogLevel, currentLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel]
}

// タイムスタンプ生成
export const createTimestamp = (): Effect.Effect<string> =>
  pipe(
    Effect.clockWith((clock) => clock.currentTimeMillis),
    Effect.map((millis) => new Date(millis).toISOString())
  )

// 構造化ログの生成
export const createLogEntry = (
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): Effect.Effect<LogEntry> =>
  pipe(
    createTimestamp(),
    Effect.map((timestamp) => ({
      timestamp,
      level,
      message,
      ...(context && { context }),
      ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
    }))
  )
