import { Effect, Layer } from 'effect'
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

// LoggerService の Live 実装
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
