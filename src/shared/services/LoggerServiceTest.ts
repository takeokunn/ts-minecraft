import { Effect, Layer } from 'effect'
import { LoggerService, LogLevel, LogEntry, createLogEntry } from './LoggerService'

// テスト用の LoggerService 実装
export const LoggerServiceTest = Layer.sync(LoggerService, () => {
  const logs: LogEntry[] = []

  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) =>
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
