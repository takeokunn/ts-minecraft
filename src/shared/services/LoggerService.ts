import { Context, Effect, Layer, Schema } from 'effect'

// ログレベル定義
export const LogLevel = Schema.Literal('DEBUG', 'INFO', 'WARN', 'ERROR')
export type LogLevel = Schema.Schema.Type<typeof LogLevel>

// ログレベルの優先度マッピング
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
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
  readonly debug: (message: string, context?: any) => Effect.Effect<void>
  readonly info: (message: string, context?: any) => Effect.Effect<void>
  readonly warn: (message: string, context?: any) => Effect.Effect<void>
  readonly error: (message: string, error?: Error) => Effect.Effect<void>
  readonly measurePerformance: <A>(
    functionName: string,
    operation: Effect.Effect<A>
  ) => Effect.Effect<A>
}

// Context タグ
export const LoggerService = Context.GenericTag<LoggerService>('@app/services/LoggerService')

// ログレベル設定の取得
const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env['LOG_LEVEL']?.toUpperCase() as LogLevel | undefined
  if (envLevel && Object.keys(LOG_LEVEL_PRIORITY).includes(envLevel)) {
    return envLevel
  }
  // 開発環境ではDEBUG、本番環境ではINFOをデフォルトに
  return process.env['NODE_ENV'] === 'production' ? 'INFO' : 'DEBUG'
}

// ログ出力の可否判定
const shouldLog = (level: LogLevel, currentLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel]
}

// タイムスタンプ生成
const createTimestamp = (): string => new Date().toISOString()

// 構造化ログの生成
const createLogEntry = (level: LogLevel, message: string, context?: any, error?: Error): LogEntry => ({
  timestamp: createTimestamp(),
  level,
  message,
  ...(context && { context }),
  ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
})

// コンソール出力の実装
const outputToConsole = (entry: LogEntry): void => {
  const { timestamp, level, message, context, error } = entry
  const logMessage = `[${timestamp}] ${level}: ${message}`

  switch (level) {
    case 'DEBUG':
      console.debug(logMessage, context || '')
      break
    case 'INFO':
      console.info(logMessage, context || '')
      break
    case 'WARN':
      console.warn(logMessage, context || '')
      break
    case 'ERROR':
      console.error(logMessage, error || context || '')
      break
  }
}

// LoggerService の実装
export const LoggerServiceLive = Layer.sync(LoggerService, () => {
  const currentLogLevel = getCurrentLogLevel()

  const log = (level: LogLevel, message: string, context?: any, error?: Error) =>
    Effect.sync(() => {
      if (!shouldLog(level, currentLogLevel)) {
        return
      }

      const entry = createLogEntry(level, message, context, error)
      outputToConsole(entry)
    })

  return LoggerService.of({
    debug: (message, context) => log('DEBUG', message, context),
    info: (message, context) => log('INFO', message, context),
    warn: (message, context) => log('WARN', message, context),
    error: (message, error) => log('ERROR', message, undefined, error),

    measurePerformance: (functionName, operation) =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const startMemory = (performance as any).memory?.usedJSHeapSize

        yield* log('DEBUG', `Starting performance measurement for: ${functionName}`)

        const result = yield* operation

        const endTime = performance.now()
        const endMemory = (performance as any).memory?.usedJSHeapSize
        const executionTime = endTime - startTime
        const memoryUsage = endMemory && startMemory ? endMemory - startMemory : undefined

        const metrics: PerformanceMetrics = {
          executionTime,
          memoryUsage,
          functionName,
        }

        yield* log('INFO', `Performance metrics for ${functionName}`, metrics)

        return result
      }),
  })
})

// テスト用の LoggerService 実装
export const LoggerServiceTest = Layer.sync(LoggerService, () => {
  const logs: LogEntry[] = []

  const log = (level: LogLevel, message: string, context?: any, error?: Error) =>
    Effect.sync(() => {
      const entry = createLogEntry(level, message, context, error)
      logs.push(entry)
    })

  return LoggerService.of({
    debug: (message, context) => log('DEBUG', message, context),
    info: (message, context) => log('INFO', message, context),
    warn: (message, context) => log('WARN', message, context),
    error: (message, error) => log('ERROR', message, undefined, error),

    measurePerformance: (functionName, operation) =>
      Effect.gen(function* () {
        yield* log('DEBUG', `Mock performance measurement for: ${functionName}`)
        const result = yield* operation
        yield* log('INFO', `Mock performance completed for: ${functionName}`)
        return result
      }),
  })
})