import { describe, it, expect } from 'vitest'
import { Effect, Layer, Context } from 'effect'
import * as fc from 'fast-check'
import { LoggerServiceTest } from '../LoggerServiceTest'
import { LoggerService, LogLevel, createLogEntry } from '../LoggerService'

describe('LoggerServiceTest', () => {
  describe('Layer creation', () => {
    it('creates a valid LoggerService Layer', () => {
      expect(LoggerServiceTest).toBeDefined()
      expect(typeof LoggerServiceTest).toBe('object')
    })

    it('provides LoggerService implementation', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        expect(logger).toBeDefined()
        expect(typeof logger.debug).toBe('function')
        expect(typeof logger.info).toBe('function')
        expect(typeof logger.warn).toBe('function')
        expect(typeof logger.error).toBe('function')
        expect(typeof logger.measurePerformance).toBe('function')
        return logger
      })

      Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
    })
  })

  describe('Logging operations', () => {
    const messageArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    const contextArbitrary = fc.record({
      userId: fc.string(),
      action: fc.string(),
      timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
    })

    it('logs debug messages', () => {
      fc.assert(
        fc.property(messageArbitrary, contextArbitrary, (message, context) => {
          const logProgram = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.debug(message, context)
            return 'success'
          })

          const result = Effect.runSync(logProgram.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs info messages', () => {
      fc.assert(
        fc.property(messageArbitrary, contextArbitrary, (message, context) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.info(message, context)
            return 'success'
          })

          const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs warn messages', () => {
      fc.assert(
        fc.property(messageArbitrary, contextArbitrary, (message, context) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.warn(message, context)
            return 'success'
          })

          const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs error messages', () => {
      const errorArbitrary = fc.string().map((msg) => new Error(msg))

      fc.assert(
        fc.property(messageArbitrary, errorArbitrary, (message, error) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.error(message, error)
            return 'success'
          })

          const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('Performance measurement', () => {
    it('measures performance of Effect operations', () => {
      const functionNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
      const valueArbitrary = fc.integer({ min: 1, max: 1000 })

      fc.assert(
        fc.property(functionNameArbitrary, valueArbitrary, (functionName, value) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService

            const operation = Effect.sync(() => value * 2)
            const result = yield* logger.measurePerformance(functionName, operation)

            return result
          })

          const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe(value * 2)
        }),
        { numRuns: 50 }
      )
    })

    it('measures performance of sync operations that appear async', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const syncOperation = Effect.gen(function* () {
          // Simulate work without actual async delay
          return 'sync-result'
        })

        const result = yield* logger.measurePerformance('sync-test', syncOperation)
        return result
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('sync-result')
    })

    it('preserves operation errors during performance measurement', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const failingOperation = Effect.gen(function* () {
          throw new Error('test-error')
        })

        return yield* logger.measurePerformance('failing-test', failingOperation)
      })

      const exit = Effect.runSyncExit(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(exit._tag).toBe('Failure')
    })
  })

  describe('Layer composition', () => {
    it('can be composed with other layers', () => {
      const TestService = Context.GenericTag<{ value: string }>('TestService')
      const TestServiceImpl = { value: 'test' }
      const TestLayer = Layer.succeed(TestService, TestServiceImpl)

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        const testService = yield* TestService

        yield* logger.info('Testing layer composition')

        return {
          loggerAvailable: !!logger,
          testServiceValue: testService.value,
        }
      })

      const combinedLayer = Layer.merge(LoggerServiceTest, TestLayer)
      const result = Effect.runSync(program.pipe(Effect.provide(combinedLayer)))

      expect(result.loggerAvailable).toBe(true)
      expect(result.testServiceValue).toBe('test')
    })
  })

  describe('Error handling', () => {
    it('handles logging operations gracefully', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        // Test with undefined context
        yield* logger.debug('debug message', undefined)
        yield* logger.info('info message', undefined)
        yield* logger.warn('warn message', undefined)

        // Test with undefined error
        yield* logger.error('error message', undefined)

        return 'success'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('success')
    })

    it('handles empty messages', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        yield* logger.debug('')
        yield* logger.info('')
        yield* logger.warn('')
        yield* logger.error('')

        return 'success'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('success')
    })
  })

  describe('Message format consistency', () => {
    it('maintains consistent log entry format', () => {
      const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']

      for (const level of levels) {
        const entry = Effect.runSync(createLogEntry(level, 'test message', { key: 'value' }))

        expect(entry.level).toBe(level)
        expect(entry.message).toBe('test message')
        expect(entry.context).toEqual({ key: 'value' })
        expect(entry.timestamp).toBeTypeOf('string')
        expect(entry.timestamp.length).toBeGreaterThan(0)
      }
    })

    it('handles errors in log entries', () => {
      const error = new Error('test error')
      const entry = Effect.runSync(createLogEntry('ERROR', 'error occurred', undefined, error))

      expect(entry.level).toBe('ERROR')
      expect(entry.message).toBe('error occurred')
      expect(entry.error).toEqual({
        name: 'Error',
        message: 'test error',
        stack: error.stack,
      })
      expect(entry.context).toBeUndefined()
    })
  })

  describe('Integration scenarios', () => {
    it('supports rapid sequential logging', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        // Log many messages in sequence
        for (let i = 0; i < 100; i++) {
          yield* logger.info(`Message ${i}`)
        }

        return 'completed'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('completed')
    })

    it('supports concurrent logging operations', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const operations = Array.from({ length: 10 }, (_, i) => logger.info(`Concurrent message ${i}`))

        yield* Effect.all(operations, { concurrency: 'unbounded' })

        return 'completed'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('completed')
    })
  })
})
