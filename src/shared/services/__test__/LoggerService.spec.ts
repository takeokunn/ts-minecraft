import { describe, it, expect } from 'vitest'
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

describe('LoggerService - Core Types and Utilities', () => {
  describe('LogLevel Schema', () => {
    it('should define correct log levels', () => {
      const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
      levels.forEach((level) => {
        expect(Object.keys(LOG_LEVEL_PRIORITY)).toContain(level)
      })
    })

    it('should have correct priority ordering', () => {
      expect(LOG_LEVEL_PRIORITY.DEBUG).toBe(0)
      expect(LOG_LEVEL_PRIORITY.INFO).toBe(1)
      expect(LOG_LEVEL_PRIORITY.WARN).toBe(2)
      expect(LOG_LEVEL_PRIORITY.ERROR).toBe(3)
    })
  })

  describe('getCurrentLogLevel', () => {
    it('should return DEBUG for development environment by default', () => {
      const originalNodeEnv = process.env['NODE_ENV']
      const originalLogLevel = process.env['LOG_LEVEL']

      process.env['NODE_ENV'] = 'development'
      delete process.env['LOG_LEVEL']

      const level = getCurrentLogLevel()
      expect(level).toBe('DEBUG')

      // 環境変数を復元
      process.env['NODE_ENV'] = originalNodeEnv
      if (originalLogLevel) {
        process.env['LOG_LEVEL'] = originalLogLevel
      }
    })

    it('should return INFO for production environment by default', () => {
      const originalNodeEnv = process.env['NODE_ENV']
      const originalLogLevel = process.env['LOG_LEVEL']

      process.env['NODE_ENV'] = 'production'
      delete process.env['LOG_LEVEL']

      const level = getCurrentLogLevel()
      expect(level).toBe('INFO')

      // 環境変数を復元
      process.env['NODE_ENV'] = originalNodeEnv
      if (originalLogLevel) {
        process.env['LOG_LEVEL'] = originalLogLevel
      }
    })

    it('should respect LOG_LEVEL environment variable', () => {
      const originalLogLevel = process.env['LOG_LEVEL']

      process.env['LOG_LEVEL'] = 'ERROR'
      const level = getCurrentLogLevel()
      expect(level).toBe('ERROR')

      // 環境変数を復元
      if (originalLogLevel) {
        process.env['LOG_LEVEL'] = originalLogLevel
      } else {
        delete process.env['LOG_LEVEL']
      }
    })
  })

  describe('shouldLog', () => {
    it('should allow logging at same or higher priority levels', () => {
      expect(shouldLog('ERROR', 'DEBUG')).toBe(true)
      expect(shouldLog('WARN', 'DEBUG')).toBe(true)
      expect(shouldLog('INFO', 'DEBUG')).toBe(true)
      expect(shouldLog('DEBUG', 'DEBUG')).toBe(true)

      expect(shouldLog('ERROR', 'INFO')).toBe(true)
      expect(shouldLog('WARN', 'INFO')).toBe(true)
      expect(shouldLog('INFO', 'INFO')).toBe(true)
      expect(shouldLog('DEBUG', 'INFO')).toBe(false)
    })
  })

  describe('createTimestamp', () => {
    it('should return ISO timestamp string', () => {
      const timestamp = createTimestamp()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })
  })

  describe('createLogEntry', () => {
    it('should create log entry with required fields', () => {
      const entry = createLogEntry('INFO', 'Test message')
      expect(entry.level).toBe('INFO')
      expect(entry.message).toBe('Test message')
      expect(entry.timestamp).toBeDefined()
    })

    it('should include context when provided', () => {
      const context = { key: 'value' }
      const entry = createLogEntry('INFO', 'Test message', context)
      expect(entry.context).toEqual(context)
    })

    it('should include structured error when provided', () => {
      const error = new Error('Test error')
      error.stack = 'Error stack trace'
      const entry = createLogEntry('ERROR', 'Error occurred', undefined, error)

      expect(entry.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: 'Error stack trace',
      })
    })
  })

  describe('Test Implementation Integration', () => {
    it('should provide silent test implementation for LoggerServiceTest', async () => {
      const { LoggerServiceTest } = await import('../LoggerServiceTest')
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.info('Test log message')
        const result = yield* logger.measurePerformance('testFunction', Effect.succeed('result'))
        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('result')
    })
  })
})
