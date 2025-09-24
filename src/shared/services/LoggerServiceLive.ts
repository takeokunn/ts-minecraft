import { Effect, Layer, Match, pipe } from 'effect'
import {
  LoggerService,
  LogLevel,
  LogEntry,
  PerformanceMetrics,
  getCurrentLogLevel,
  shouldLog,
  createLogEntry,
} from './LoggerService'

// コンソール出力の実装
const outputToConsole = (entry: LogEntry): void => {
  const { timestamp, level, message, context, error } = entry
  const logMessage = `[${timestamp}] ${level}: ${message}`

  Match.value(level).pipe(
    Match.when('DEBUG', () => console.debug(logMessage, context || '')),
    Match.when('INFO', () => console.info(logMessage, context || '')),
    Match.when('WARN', () => console.warn(logMessage, context || '')),
    Match.when('ERROR', () => console.error(logMessage, error || context || '')),
    Match.exhaustive
  )
}

// LoggerService の Live 実装
export const LoggerServiceLive = Layer.sync(LoggerService, () => {
  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) =>
    Effect.sync(() => {
      // 実行時に動的にログレベルを取得 - テスト中の環境変数変更に対応
      const currentLogLevel = getCurrentLogLevel()
      const canLog = shouldLog(level, currentLogLevel)

      // ログ出力の実行
      return pipe(
        canLog,
        Match.value,
        Match.when(false, () => undefined),
        Match.when(true, () => {
          // Effect<LogEntry>をEffect.runSyncで実行してLogEntryを取得
          const entry = Effect.runSync(createLogEntry(level, message, context, error))
          outputToConsole(entry)
          return undefined
        }),
        Match.exhaustive
      )
    })

  return LoggerService.of({
    debug: (message, context) => log('DEBUG', message, context),
    info: (message, context) => log('INFO', message, context),
    warn: (message, context) => log('WARN', message, context),
    error: (message, error) => log('ERROR', message, undefined, error),

    measurePerformance: <A>(functionName: string, operation: Effect.Effect<A>) =>
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
