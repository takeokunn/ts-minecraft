import { describe, it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import {
  LogLevel,
  LOG_LEVEL_PRIORITY,
  LoggerService,
  getCurrentLogLevel,
  shouldLog,
  createTimestamp,
  createLogEntry,
} from '../LoggerService'
import { LoggerServiceTest } from '../LoggerServiceTest'

describe('LoggerService - Core Types and Utilities', () => {
  describe('LogLevel Schema', () => {
    it.effect('should define correct log levels', () =>
      Effect.gen(function* () {
        const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
        levels.forEach((level) => {
          expect(Object.keys(LOG_LEVEL_PRIORITY)).toContain(level)
        })
      })
    )

    it.effect('should have correct priority ordering', () =>
      Effect.gen(function* () {
        expect(LOG_LEVEL_PRIORITY.DEBUG).toBe(0)
        expect(LOG_LEVEL_PRIORITY.INFO).toBe(1)
        expect(LOG_LEVEL_PRIORITY.WARN).toBe(2)
        expect(LOG_LEVEL_PRIORITY.ERROR).toBe(3)
      })
    )
  })

  describe('getCurrentLogLevel', () => {
    it.effect('should return DEBUG for development environment by default', () =>
      Effect.gen(function* () {
        const originalNodeEnv = process.env['NODE_ENV']
        const originalLogLevel = process.env['LOG_LEVEL']

        process.env['NODE_ENV'] = 'development'
        delete process.env['LOG_LEVEL']

        const level = getCurrentLogLevel()
        expect(level).toBe('DEBUG')

        // 環境変数を復元
        process.env['NODE_ENV'] = originalNodeEnv
        yield* pipe(
          Option.fromNullable(originalLogLevel),
          Option.match({
            onNone: () => Effect.sync(() => {}),
            onSome: (value) =>
              Effect.sync(() => {
                process.env['LOG_LEVEL'] = value
              }),
          })
        )
      })
    )

    it.effect('should return INFO for production environment by default', () =>
      Effect.gen(function* () {
        const originalNodeEnv = process.env['NODE_ENV']
        const originalLogLevel = process.env['LOG_LEVEL']

        process.env['NODE_ENV'] = 'production'
        delete process.env['LOG_LEVEL']

        const level = getCurrentLogLevel()
        expect(level).toBe('INFO')

        // 環境変数を復元
        process.env['NODE_ENV'] = originalNodeEnv
        yield* pipe(
          Option.fromNullable(originalLogLevel),
          Option.match({
            onNone: () => Effect.sync(() => {}),
            onSome: (value) =>
              Effect.sync(() => {
                process.env['LOG_LEVEL'] = value
              }),
          })
        )
      })
    )

    it.effect('should respect LOG_LEVEL environment variable', () =>
      Effect.gen(function* () {
        const originalLogLevel = process.env['LOG_LEVEL']

        process.env['LOG_LEVEL'] = 'ERROR'
        const level = getCurrentLogLevel()
        expect(level).toBe('ERROR')

        // 環境変数を復元
        yield* pipe(
          Option.fromNullable(originalLogLevel),
          Option.match({
            onNone: () =>
              Effect.sync(() => {
                delete process.env['LOG_LEVEL']
              }),
            onSome: (value) =>
              Effect.sync(() => {
                process.env['LOG_LEVEL'] = value
              }),
          })
        )
      })
    )
  })

  describe('shouldLog', () => {
    it.effect('should allow logging at same or higher priority levels', () =>
      Effect.gen(function* () {
        expect(shouldLog('ERROR', 'DEBUG')).toBe(true)
        expect(shouldLog('WARN', 'DEBUG')).toBe(true)
        expect(shouldLog('INFO', 'DEBUG')).toBe(true)
        expect(shouldLog('DEBUG', 'DEBUG')).toBe(true)

        expect(shouldLog('ERROR', 'INFO')).toBe(true)
        expect(shouldLog('WARN', 'INFO')).toBe(true)
        expect(shouldLog('INFO', 'INFO')).toBe(true)
        expect(shouldLog('DEBUG', 'INFO')).toBe(false)
      })
    )
  })

  describe('createTimestamp', () => {
    it.effect('should return ISO timestamp string', () =>
      Effect.gen(function* () {
        const timestamp = yield* createTimestamp()
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      })
    )
  })

  describe('createLogEntry', () => {
    it.effect('should create log entry with required fields', () =>
      Effect.gen(function* () {
        const entry = yield* createLogEntry('INFO', 'Test message')
        expect(entry.level).toBe('INFO')
        expect(entry.message).toBe('Test message')
        expect(entry.timestamp).toBeDefined()
      })
    )

    it.effect('should include context when provided', () =>
      Effect.gen(function* () {
        const context = { key: 'value' }
        const entry = yield* createLogEntry('INFO', 'Test message', context)
        expect(entry.context).toEqual(context)
      })
    )

    it.effect('should include structured error when provided', () =>
      Effect.gen(function* () {
        const error = new Error('Test error')
        error.stack = 'Error stack trace'
        const entry = yield* createLogEntry('ERROR', 'Error occurred', undefined, error)

        expect(entry.error).toEqual({
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace',
        })
      })
    )
  })

  describe('Test Implementation Integration', () => {
    it.effect('should provide silent test implementation for LoggerServiceTest', () =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.info('Test log message')
        const result = yield* logger.measurePerformance('testFunction', Effect.succeed('result'))
        expect(result).toBe('result')
        return result
      }).pipe(Effect.provide(LoggerServiceTest))
    )
  })
})
