import { Effect } from 'effect'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LoggerService } from '../LoggerService'
import { LoggerServiceLive } from '../LoggerServiceLive'

describe('LoggerServiceLive', () => {
  beforeEach(() => {
    // コンソールメソッドをモック化
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should log debug messages when LOG_LEVEL is DEBUG', async () => {
    process.env['LOG_LEVEL'] = 'DEBUG'

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.debug('Test debug message', { key: 'value' })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(console.debug).toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('should log info messages', async () => {
    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.info('Test info message', { data: 'test' })
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(console.info).toHaveBeenCalled()
  })

  it('should log warning messages', async () => {
    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.warn('Test warning message', { warning: true })
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(console.warn).toHaveBeenCalled()
  })

  it('should log error messages with error objects', async () => {
    const testError = new Error('Test error')

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.error('Test error message', testError)
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(console.error).toHaveBeenCalled()
  })

  it('should respect log level filtering', async () => {
    process.env['LOG_LEVEL'] = 'ERROR'

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.debug('Debug message')
      yield* logger.info('Info message')
      yield* logger.warn('Warning message')
      yield* logger.error('Error message')
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(console.debug).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it('should measure performance correctly', async () => {
    // Ensure DEBUG level is set for this test
    process.env['LOG_LEVEL'] = 'DEBUG'

    const slowOperation = Effect.sync(() => {
      // シミュレートされた遅い処理
      const start = Date.now()
      while (Date.now() - start < 10) {
        // 10ms待機
      }
      return 'result'
    })

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      const result = yield* logger.measurePerformance('slowOperation', slowOperation)
      return result
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    expect(result).toBe('result')
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('Starting performance measurement for: slowOperation'),
      ''
    )
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Performance metrics for slowOperation'),
      expect.objectContaining({
        executionTime: expect.any(Number),
        functionName: 'slowOperation',
      })
    )
  })

  it('should use default log level when NODE_ENV is production', async () => {
    const originalNodeEnv = process.env['NODE_ENV']
    const originalLogLevel = process.env['LOG_LEVEL']

    process.env['NODE_ENV'] = 'production'
    delete process.env['LOG_LEVEL']

    const program = Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.debug('Debug in production')
      yield* logger.info('Info in production')
    })

    await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

    // プロダクション環境ではDEBUGは出力されない
    expect(console.debug).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalled()

    // 環境変数を復元
    process.env['NODE_ENV'] = originalNodeEnv
    if (originalLogLevel) {
      process.env['LOG_LEVEL'] = originalLogLevel
    }
  })

  describe('Error Handling', () => {
    it('should handle errors in performance measurement gracefully', async () => {
      const failingOperation = Effect.sync(() => {
        throw new Error('Operation failed')
      })

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        return yield* logger.measurePerformance('failingOperation', failingOperation)
      })

      await expect(Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))).rejects.toThrow(
        'Operation failed'
      )
    })

    it('should log error objects with proper structure', async () => {
      const testError = new Error('Structured error')
      testError.stack = 'Error stack trace'

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.error('Error occurred', testError)
      })

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)))

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred'),
        expect.objectContaining({
          name: 'Error',
          message: 'Structured error',
          stack: 'Error stack trace',
        })
      )
    })
  })
})
