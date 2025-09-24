import { Effect, Either, Option, pipe } from 'effect'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { LoggerService, getCurrentLogLevel, shouldLog, createLogEntry } from '../LoggerService'
import { LoggerServiceLive } from '../LoggerServiceLive'

describe('LoggerServiceLive', () => {
  describe('Core Functionality', () => {
    it('should provide logger service implementation', () => {
      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        // サービスが正常に提供されることを確認
        expect(typeof logger.debug).toBe('function')
        expect(typeof logger.info).toBe('function')
        expect(typeof logger.warn).toBe('function')
        expect(typeof logger.error).toBe('function')
        expect(typeof logger.measurePerformance).toBe('function')
      })

      Effect.runSync(program.pipe(Effect.provide(LoggerServiceLive)))
    })

    it('should execute logging operations without errors', () => {
      process.env['LOG_LEVEL'] = 'DEBUG'

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        // 各ログレベルでエラーが発生しないことを確認
        yield* logger.debug('Debug message', { data: 'test' })
        yield* logger.info('Info message', { data: 'test' })
        yield* logger.warn('Warn message', { data: 'test' })
        yield* logger.error('Error message', new Error('test'))
      })

      // ログ処理でエラーが発生しないことを確認
      expect(() => {
        Effect.runSync(program.pipe(Effect.provide(LoggerServiceLive)))
      }).not.toThrow()
    })

    it('should handle performance measurement operations', () => {
      process.env['LOG_LEVEL'] = 'DEBUG'

      const testOperation = Effect.succeed('test-result')

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        return yield* logger.measurePerformance('testOperation', testOperation)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(LoggerServiceLive)))
      expect(result).toBe('test-result')
    })

    it('should handle errors in performance measurement gracefully', () => {
      process.env['LOG_LEVEL'] = 'DEBUG'

      const failingOperation = Effect.fail(new Error('Operation failed'))

      const program = Effect.gen(function* () {
        const logger = yield* LoggerService
        return yield* logger.measurePerformance(
          'failingOperation',
          failingOperation as Effect.Effect<never, never, never>
        )
      })

      const result = Effect.runSync(Effect.either(program.pipe(Effect.provide(LoggerServiceLive))))
      expect(result._tag).toBe('Left')

      pipe(
        result,
        Either.match({
          onLeft: (error) => {
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toBe('Operation failed')
          },
          onRight: () => {
            throw new Error('Expected Left')
          },
        })
      )
    })
  })

  describe('Log Level Utilities', () => {
    it.effect('should correctly determine current log level from environment', () =>
      Effect.gen(function* () {
        // 明示的なログレベル設定のテスト
        process.env['LOG_LEVEL'] = 'WARN'
        expect(getCurrentLogLevel()).toBe('WARN')

        process.env['LOG_LEVEL'] = 'ERROR'
        expect(getCurrentLogLevel()).toBe('ERROR')

        // プロダクション環境でのデフォルト値テスト
        const originalEnv = { NODE_ENV: process.env['NODE_ENV'], LOG_LEVEL: process.env['LOG_LEVEL'] }

        process.env['NODE_ENV'] = 'production'
        delete process.env['LOG_LEVEL']
        expect(getCurrentLogLevel()).toBe('INFO')

        // 開発環境でのデフォルト値テスト
        process.env['NODE_ENV'] = 'development'
        delete process.env['LOG_LEVEL']
        expect(getCurrentLogLevel()).toBe('DEBUG')

        // 環境変数復元
        Object.entries(originalEnv).forEach(([key, value]) => {
          pipe(
            Option.fromNullable(value),
            Option.match({
              onNone: () => {
                delete process.env[key]
              },
              onSome: (val) => {
                process.env[key] = val
              },
            })
          )
        })
      })
    )

    it.effect('should correctly filter log levels', () =>
      Effect.gen(function* () {
        // ログレベルフィルタリングのテスト
        expect(shouldLog('DEBUG', 'DEBUG')).toBe(true)
        expect(shouldLog('INFO', 'DEBUG')).toBe(true)
        expect(shouldLog('WARN', 'DEBUG')).toBe(true)
        expect(shouldLog('ERROR', 'DEBUG')).toBe(true)

        expect(shouldLog('DEBUG', 'INFO')).toBe(false)
        expect(shouldLog('INFO', 'INFO')).toBe(true)
        expect(shouldLog('WARN', 'INFO')).toBe(true)
        expect(shouldLog('ERROR', 'INFO')).toBe(true)

        expect(shouldLog('DEBUG', 'WARN')).toBe(false)
        expect(shouldLog('INFO', 'WARN')).toBe(false)
        expect(shouldLog('WARN', 'WARN')).toBe(true)
        expect(shouldLog('ERROR', 'WARN')).toBe(true)

        expect(shouldLog('DEBUG', 'ERROR')).toBe(false)
        expect(shouldLog('INFO', 'ERROR')).toBe(false)
        expect(shouldLog('WARN', 'ERROR')).toBe(false)
        expect(shouldLog('ERROR', 'ERROR')).toBe(true)
      })
    )

    it.effect('should create properly structured log entries', () =>
      Effect.gen(function* () {
        // ログエントリ作成のテスト
        const basicEntry = Effect.runSync(createLogEntry('INFO', 'Test message'))
        expect(basicEntry.level).toBe('INFO')
        expect(basicEntry.message).toBe('Test message')
        expect(basicEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        expect(basicEntry.context).toBeUndefined()
        expect(basicEntry.error).toBeUndefined()

        // コンテキスト付きログエントリ
        const contextEntry = Effect.runSync(createLogEntry('DEBUG', 'Debug message', { key: 'value' }))
        expect(contextEntry.context).toEqual({ key: 'value' })

        // エラー付きログエントリ
        const testError = new Error('Test error')
        testError.stack = 'Error stack trace'
        const errorEntry = Effect.runSync(createLogEntry('ERROR', 'Error message', undefined, testError))
        expect(errorEntry.error).toEqual({
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace',
        })

        // コンテキストとエラー両方付きログエントリ
        const fullEntry = Effect.runSync(createLogEntry('WARN', 'Full message', { context: 'data' }, testError))
        expect(fullEntry.context).toEqual({ context: 'data' })
        expect(fullEntry.error).toEqual({
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace',
        })
      })
    )
  })

  describe('Integration Tests', () => {
    it('should complete logging workflow end-to-end', () => {
      // 統合テスト: ログ処理の全体的なワークフローが完了すること
      process.env['LOG_LEVEL'] = 'INFO'

      const workflow = Effect.gen(function* () {
        const logger = yield* LoggerService

        // 複数のログレベルでログを出力
        yield* logger.info('Workflow started', { step: 1 })
        yield* logger.warn('Potential issue detected', { step: 2 })

        // パフォーマンス測定付きの処理
        const result = yield* logger.measurePerformance(
          'data-processing',
          Effect.sync(() => {
            return { processed: true, count: 100 }
          })
        )

        yield* logger.info('Workflow completed', { step: 3, result })

        return result
      })

      const result = Effect.runSync(workflow.pipe(Effect.provide(LoggerServiceLive)))
      expect(result).toEqual({ processed: true, count: 100 })
    })

    it('should handle complex error scenarios gracefully', () => {
      process.env['LOG_LEVEL'] = 'ERROR'

      const errorWorkflow = Effect.gen(function* () {
        const logger = yield* LoggerService

        // 複数のエラーハンドリングシナリオ
        const result = yield* Effect.either(
          logger.measurePerformance(
            'failing-task',
            Effect.fail(new Error('Task failed')) as Effect.Effect<never, never, never>
          )
        )

        yield* pipe(
          result,
          Either.match({
            onLeft: (error) =>
              Effect.gen(function* () {
                yield* logger.error('Performance measurement failed', error as Error)
                return yield* Effect.fail(error)
              }),
            onRight: (value) => Effect.succeed(value),
          })
        )
      })

      const result = Effect.runSync(Effect.either(errorWorkflow.pipe(Effect.provide(LoggerServiceLive))))
      expect(result._tag).toBe('Left')
      pipe(
        result,
        Either.match({
          onLeft: (error) => {
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toBe('Task failed')
          },
          onRight: () => {},
        })
      )
    })
  })
})
