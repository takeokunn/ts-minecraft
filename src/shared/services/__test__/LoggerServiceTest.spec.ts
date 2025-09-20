import { Effect } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { LoggerService } from '../LoggerService'
import { LoggerServiceTest } from '../LoggerServiceTest'

describe('LoggerServiceTest', () => {
  it('should capture logs in test mode without console output', async () => {
    const consoleSpy = vi.spyOn(console, 'info')

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.info('Test log message')
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))

    // テストモードではコンソールに出力されない
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('should mock performance measurement in test mode', async () => {
    const operation = Effect.succeed('test-result')

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      const result = yield* logger.measurePerformance('testFunction', operation)
      return result
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))

    expect(result).toBe('test-result')
  })

  it('should handle all log levels in test mode', async () => {
    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.debug('Debug message', { debug: true })
      yield* logger.info('Info message', { info: true })
      yield* logger.warn('Warning message', { warn: true })
      yield* logger.error('Error message', new Error('Test error'))
    })

    // テストモードでは例外が発生しない
    await expect(Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))).resolves.toBeUndefined()
  })

  it('should handle performance measurement with errors in test mode', async () => {
    const failingOperation = Effect.sync(() => {
      throw new Error('Test failure')
    })

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      return yield* logger.measurePerformance('failingTestFunction', failingOperation)
    })

    await expect(Effect.runPromise(program.pipe(Effect.provide(LoggerServiceTest)))).rejects.toThrow('Test failure')
  })
})
