import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Context, Schema } from 'effect'
import { LoggerServiceTest } from '../LoggerServiceTest'
import { LoggerService, LogLevel, createLogEntry } from '../LoggerService'

describe('LoggerServiceTest', () => {
  describe('Layer creation', () => {
  it.effect('creates a valid LoggerService Layer', () => Effect.gen(function* () {
    expect(LoggerServiceTest).toBeDefined()
    expect(typeof LoggerServiceTest).toBe('object')
}) {
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
  const MessageSchema = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))
  const ContextSchema = Schema.Struct({
  userId: Schema.String,
  action: Schema.String,
  timestamp: Schema.Int.pipe(Schema.between(1000000000, 2000000000)),
})

    it.prop('logs debug messages', [MessageSchema, ContextSchema], ({ string: message, struct: context })

      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.debug(message, context)
        const result = 'success'
        expect(result).toBe('success')
      }).pipe(Effect.provide(LoggerServiceTest))
    )

    it.prop('logs info messages', [MessageSchema, ContextSchema], ({ string: message, struct: context })

      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.info(message, context)
        const result = 'success'
        expect(result).toBe('success')
      }).pipe(Effect.provide(LoggerServiceTest))
    )

    it.prop('logs warn messages', [MessageSchema, ContextSchema], ({ string: message, struct: context })

      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.warn(message, context)
        const result = 'success'
        expect(result).toBe('success')
      }).pipe(Effect.provide(LoggerServiceTest))
    )

    it.prop('logs error messages', [MessageSchema, Schema.String.pipe(Schema.transform(Schema.Unknown, { decode: (s: string) => new Error(s), encode: (e: unknown) => String(e)})], ({ string: message, unknown: error })

      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.error(message, error)
        const result = 'success'
        expect(result).toBe('success')
      }).pipe(Effect.provide(LoggerServiceTest))
    )
  })

  describe('Performance measurement', () => {
  it.prop('measures performance of Effect operations', [
  Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  Schema.Int.pipe(Schema.between(1, 1000))
  ], ({ string: functionName, number: value
})

      Effect.gen(function* () {
        const logger = yield* LoggerService

        const operation = Effect.sync(() => value * 2)
        const result = yield* logger.measurePerformance(functionName, operation)

        expect(result).toBe(value * 2)
        return result
      }).pipe(Effect.provide(LoggerServiceTest))
    )

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

      const exit = await Effect.runPromiseExit.effect(program.pipe(Effect.provide(LoggerServiceTest)))
      expect(exit._tag).toBe('Failure')
    })
  })

  describe('Layer composition', () => Effect.gen(function* () {
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
  })
)
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
  it('maintains consistent log entry format', async () => {
  const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
  for (
  const entry = await Effect.runPromise(createLogEntry(level, 'test message', { key: 'value' ) {$2
})

        expect(entry.level).toBe(level)
        expect(entry.message).toBe('test message')
        expect(entry.context).toEqual({ key: 'value' })
        expect(entry.timestamp).toBeTypeOf('string')
        expect(entry.timestamp.length).toBeGreaterThan(0)
      }
    })

    it('handles errors in log entries', async () => {
      const error = new Error('test error')
      const entry = await Effect.runPromise(createLogEntry('ERROR', 'error occurred', undefined, error))

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
