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

    it('provides LoggerService implementation', async () => {
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

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
    })
  })

  describe('Logging operations', () => {
    const messageArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    const contextArbitrary = fc.record({
      userId: fc.string(),
      action: fc.string(),
      timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
    })

    it('logs debug messages', async () => {
      await fc.assert(
        fc.asyncProperty(messageArbitrary, contextArbitrary, async (message, context) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.debug(message, context)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs info messages', async () => {
      await fc.assert(
        fc.asyncProperty(messageArbitrary, contextArbitrary, async (message, context) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.info(message, context)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs warn messages', async () => {
      await fc.assert(
        fc.asyncProperty(messageArbitrary, contextArbitrary, async (message, context) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.warn(message, context)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })

    it('logs error messages', async () => {
      const errorArbitrary = fc.string().map((msg) => new Error(msg))

      await fc.assert(
        fc.asyncProperty(messageArbitrary, errorArbitrary, async (message, error) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService
            yield* logger.error(message, error)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe('success')
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('Performance measurement', () => {
    it('measures performance of Effect operations', async () => {
      const functionNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
      const valueArbitrary = fc.integer({ min: 1, max: 1000 })

      await fc.assert(
        fc.asyncProperty(functionNameArbitrary, valueArbitrary, async (functionName, value) => {
          const program = Effect.gen(function* () {
            const logger = yield* LoggerService

            const operation = Effect.sync(() => value * 2)
            const result = yield* logger.measurePerformance(functionName, operation)

            return result
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
          expect(result).toBe(value * 2)
        }),
        { numRuns: 50 }
      )
    })

    it('measures performance of async operations', async () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const asyncOperation = Effect.gen(function* () {
          // Simulate async work
          yield* Effect.sleep('10 millis')
          return 'async-result'
        })

        const result = yield* logger.measurePerformance('async-test', asyncOperation)
        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('async-result')
    })

    it('preserves operation errors during performance measurement', async () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const failingOperation = Effect.gen(function* () {
          throw new Error('test-error')
        })

        return yield* logger.measurePerformance('failing-test', failingOperation)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(exit._tag).toBe('Failure')
    })
  })

  describe('Layer composition', () => {
    it('can be composed with other layers', async () => {
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
      const result = await Effect.runPromise(program.pipe(Effect.provide(combinedLayer)))

      expect(result.loggerAvailable).toBe(true)
      expect(result.testServiceValue).toBe('test')
    })
  })

  describe('Error handling', () => {
    it('handles logging operations gracefully', async () => {
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

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('success')
    })

    it('handles empty messages', async () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        yield* logger.debug('')
        yield* logger.info('')
        yield* logger.warn('')
        yield* logger.error('')

        return 'success'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('success')
    })
  })

  describe('Message format consistency', () => {
    it('maintains consistent log entry format', () => {
      const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']

      levels.forEach((level) => {
        const entry = createLogEntry(level, 'test message', { key: 'value' })

        expect(entry.level).toBe(level)
        expect(entry.message).toBe('test message')
        expect(entry.context).toEqual({ key: 'value' })
        expect(entry.timestamp).toBeTypeOf('string')
        expect(entry.timestamp.length).toBeGreaterThan(0)
      })
    })

    it('handles errors in log entries', () => {
      const error = new Error('test error')
      const entry = createLogEntry('ERROR', 'error occurred', undefined, error)

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
    it('supports rapid sequential logging', async () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        // Log many messages in sequence
        for (let i = 0; i < 100; i++) {
          yield* logger.info(`Message ${i}`)
        }

        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('completed')
    })

    it('supports concurrent logging operations', async () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService

        const operations = Array.from({ length: 10 }, (_, i) => logger.info(`Concurrent message ${i}`))

        yield* Effect.all(operations, { concurrency: 'unbounded' })

        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(result).toBe('completed')
    })
  })
})
