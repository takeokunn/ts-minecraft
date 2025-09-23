import { Effect, Layer } from 'effect'
import { LoggerService, LogLevel, LogEntry } from './LoggerService'

// テスト用の LoggerService 実装
export const LoggerServiceTest = Layer.sync(LoggerService, () => {
  const logs: LogEntry[] = []

  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) =>
    Effect.sync(() => {
      // テスト用では簡潔にLogEntryを直接作成
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(context && { context }),
        ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
      }
      logs.push(entry)
    })

  return LoggerService.of({
    debug: (message, context) => log('DEBUG', message, context),
    info: (message, context) => log('INFO', message, context),
    warn: (message, context) => log('WARN', message, context),
    error: (message, error) => log('ERROR', message, undefined, error),

    measurePerformance: <A>(functionName: string, operation: Effect.Effect<A>) =>
      Effect.gen(function* () {
        yield* log('DEBUG', `Mock performance measurement for: ${functionName}`)
        const result = yield* operation
        yield* log('INFO', `Mock performance completed for: ${functionName}`)
        return result
      }),
  })
})
