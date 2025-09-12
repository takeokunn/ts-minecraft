/**
 * Comprehensive tests for error handling utilities
 * Tests Effect-TS error patterns, validation, retry policies, and error recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Duration from 'effect/Duration'
import * as TestClock from 'effect/TestClock'
import * as Data from 'effect/Data'
import * as Equal from 'effect/Equal'
import { pipe } from 'effect/Function'
import {
  // Error types
  SystemError,
  EntityError, 
  ValidationError,
  ErrorLike,
  ErrorCause,
  AppError,
  AllGameErrors,
  JsonValue,
  // Error handling context and config
  ErrorHandlingContext,
  ErrorHandlingStrategy,
  RetryConfig,
  ErrorHandler,
  // Error handlers
  ErrorHandlers,
  // Error recovery
  ErrorRecovery,
  // Performance-aware error handling
  PerformanceAwareErrorHandling,
  // Error reporting
  ErrorReporting,
  // Error validation
  ErrorValidation,
  // Component error handling
  createComponentErrorHandler,
  withErrorHandling,
  handleError,
  recoverFromError,
  reportErrors
} from '@shared/utils/error'
import { runEffect, runEffectExit, expectEffect } from '../../../setup/shared.setup'

describe('error handling utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Error types', () => {
    describe('SystemError', () => {
      it('should create SystemError with required fields', () => {
        const error = SystemError({
          message: 'System failure',
          code: 'SYS001'
        })

        expect(error._tag).toBe('SystemError')
        expect(error.message).toBe('System failure')
        expect(error.code).toBe('SYS001')
      })

      it('should create SystemError with optional fields', () => {
        const cause = new Error('Root cause')
        const error = SystemError({
          message: 'System failure',
          cause
        })

        expect(error.cause).toBe(cause)
      })

      it('should be a Data.Case with structural equality', () => {
        const error1 = SystemError({ message: 'test' })
        const error2 = SystemError({ message: 'test' })
        const error3 = SystemError({ message: 'different' })

        expect(Equal.equals(error1, error2)).toBe(true)
        expect(Equal.equals(error1, error3)).toBe(false)
      })
    })

    describe('EntityError', () => {
      it('should create EntityError with required fields', () => {
        const error = EntityError({
          message: 'Entity not found',
          entityId: 'player-123',
          operation: 'get'
        })

        expect(error._tag).toBe('EntityError')
        expect(error.message).toBe('Entity not found')
        expect(error.entityId).toBe('player-123')
        expect(error.operation).toBe('get')
      })

      it('should create EntityError with cause', () => {
        const cause = { error: 'Database connection failed' }
        const error = EntityError({
          message: 'Entity operation failed',
          entityId: 'chunk-456',
          operation: 'load',
          cause
        })

        expect(error.cause).toBe(cause)
      })
    })

    describe('ValidationError', () => {
      it('should create ValidationError with all fields', () => {
        const context = { component: 'UserInput', operation: 'validate' }
        const cause = new Error('Schema validation failed')
        
        const error = ValidationError({
          message: 'Invalid input',
          field: 'username',
          value: '',
          context,
          cause
        })

        expect(error._tag).toBe('ValidationError')
        expect(error.message).toBe('Invalid input')
        expect(error.field).toBe('username')
        expect(error.value).toBe('')
        expect(error.context).toBe(context)
        expect(error.cause).toBe(cause)
      })
    })
  })

  describe('Error validation', () => {
    describe('validateError', () => {
      it('should validate Error instances', async () => {
        const originalError = new Error('Test error')
        const result = await runEffect(ErrorValidation.validateError(originalError))
        
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toBe('Test error')
      })

      it('should validate string errors', async () => {
        const result = await runEffect(ErrorValidation.validateError('String error'))
        
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toBe('String error')
      })

      it('should validate tagged errors', async () => {
        const taggedError = { _tag: 'CustomError', message: 'Tagged error' }
        const result = await runEffect(ErrorValidation.validateError(taggedError))
        
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toBe('Tagged error')
      })

      it('should handle non-standard errors', async () => {
        const weirdError = { someProperty: 'value' }
        const result = await runEffect(ErrorValidation.validateError(weirdError))
        
        expect(result).toBeInstanceOf(Error)
        expect(result.message).toContain('Object')
      })
    })

    describe('validateMetadata', () => {
      it('should validate valid metadata', async () => {
        const metadata = { key: 'value', count: 42 }
        const result = await runEffect(ErrorValidation.validateMetadata(metadata))
        
        expect(result).toEqual({ key: 'value', count: 42 })
      })

      it('should handle null metadata', async () => {
        const result = await runEffect(ErrorValidation.validateMetadata(null))
        
        expect(result).toEqual({})
      })

      it('should handle invalid metadata types', async () => {
        const result = await runEffect(ErrorValidation.validateMetadata('invalid'))
        
        expect(result).toEqual({ value: 'invalid', type: 'string' })
      })
    })

    describe('validateErrorArray', () => {
      it('should validate array of errors', async () => {
        const errors = [
          new Error('Error 1'),
          'String error',
          { _tag: 'TaggedError', message: 'Tagged error' }
        ]
        
        const result = await runEffect(ErrorValidation.validateErrorArray(errors))
        
        expect(result).toHaveLength(3)
        expect(result[0].error).toBeInstanceOf(Error)
        expect(result[1].error.message).toBe('String error')
        expect(result[2].error.message).toBe('Tagged error')
      })

      it('should handle non-array input', async () => {
        const result = await runEffect(ErrorValidation.validateErrorArray('not an array'))
        
        expect(result).toHaveLength(1)
        expect(result[0].originalValue).toBe('not an array')
      })
    })

    describe('validateRetryConfig', () => {
      it('should validate valid retry config', async () => {
        const config = {
          maxAttempts: 5,
          delay: 200,
          backoffMultiplier: 1.5,
          maxDelay: 10000
        }
        
        const result = await runEffect(ErrorValidation.validateRetryConfig(config))
        
        expect(result.maxAttempts).toBe(5)
        expect(result.delay).toBe(200)
        expect(result.backoffMultiplier).toBe(1.5)
        expect(result.maxDelay).toBe(10000)
      })

      it('should provide defaults for invalid config', async () => {
        const result = await runEffect(ErrorValidation.validateRetryConfig(null))
        
        expect(result.maxAttempts).toBe(3)
        expect(result.delay).toBe(100)
        expect(result.backoffMultiplier).toBe(2)
        expect(result.maxDelay).toBe(5000)
      })
    })
  })

  describe('Error handlers', () => {
    describe('ignore handler', () => {
      it('should ignore all errors', async () => {
        const handler = ErrorHandlers.ignore<string>()
        const context: ErrorHandlingContext = { component: 'test' }
        
        const result = await runEffect(handler.handle('any error', context))
        
        expect(result).toBeUndefined()
        expect(handler.canHandle('any error')).toBe(true)
      })
    })

    describe('log handler', () => {
      it('should log errors and continue', async () => {
        const handler = ErrorHandlers.log<Error>('TestComponent')
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { 
          component: 'TestComponent',
          operation: 'testOp',
          metadata: { key: 'value' }
        }
        
        const result = await runEffect(handler.handle(error, context))
        
        expect(result).toBeUndefined()
        expect(handler.canHandle(error)).toBe(true)
      })

      it('should handle invalid metadata', async () => {
        const handler = ErrorHandlers.log<Error>()
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { 
          metadata: 'invalid metadata' as any
        }
        
        const result = await runEffect(handler.handle(error, context))
        
        expect(result).toBeUndefined()
      })
    })

    describe('fallback handler', () => {
      it('should provide fallback value', async () => {
        const handler = ErrorHandlers.fallback<Error, string>('default value')
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { component: 'test' }
        
        const result = await runEffect(handler.handle(error, context))
        
        expect(result).toBe('default value')
      })

      it('should validate fallback value', async () => {
        const handler = ErrorHandlers.fallback<Error, number>(42)
        const error = new Error('Test error')
        
        const result = await runEffect(handler.handle(error))
        
        expect(result).toBe(42)
      })
    })

    describe('terminate handler', () => {
      it('should terminate on critical errors', async () => {
        const handler = ErrorHandlers.terminate<Error>('Critical system failure')
        const error = new Error('Fatal error')
        const context: ErrorHandlingContext = { component: 'CriticalSystem' }
        
        await expectEffect.toFail(handler.handle(error, context))
      })
    })

    describe('recover handler', () => {
      it('should recover using provided function', async () => {
        const recoveryFn = (error: Error, context?: ErrorHandlingContext) => {
          return `Recovered from: ${error.message}`
        }
        
        const handler = ErrorHandlers.recover<Error, string>(recoveryFn)
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { component: 'test' }
        
        const result = await runEffect(handler.handle(error, context))
        
        expect(result).toBe('Recovered from: Test error')
      })

      it('should handle recovery function failures', async () => {
        const failingRecoveryFn = () => {
          throw new Error('Recovery failed')
        }
        
        const handler = ErrorHandlers.recover<Error, string>(failingRecoveryFn)
        const error = new Error('Original error')
        
        await expectEffect.toFail(handler.handle(error))
      })
    })
  })

  describe('Error recovery', () => {
    describe('withRetry', () => {
      it('should retry failed operations', async () => {
        let attempts = 0
        const failingEffect = Effect.gen(function* () {
          attempts++
          if (attempts < 3) {
            yield* Effect.fail('Temporary failure')
          }
          return 'success'
        })

        const config: Partial<RetryConfig> = {
          maxAttempts: 5,
          delay: 50,
          backoffMultiplier: 1.5,
          maxDelay: 1000
        }

        const context: ErrorHandlingContext = { 
          component: 'TestComponent',
          operation: 'testOp'
        }

        const result = await runEffect(ErrorRecovery.withRetry(failingEffect, config, context))
        
        expect(result).toBe('success')
        expect(attempts).toBe(3)
      })

      it('should respect maxAttempts limit', async () => {
        let attempts = 0
        const alwaysFailingEffect = Effect.gen(function* () {
          attempts++
          yield* Effect.fail(`Failure ${attempts}`)
        })

        const config: Partial<RetryConfig> = {
          maxAttempts: 2,
          delay: 10
        }

        await expectEffect.toFail(
          ErrorRecovery.withRetry(alwaysFailingEffect, config)
        )
        
        expect(attempts).toBe(2)
      })

      it('should respect shouldRetry predicate', async () => {
        let attempts = 0
        const failingEffect = Effect.gen(function* () {
          attempts++
          yield* Effect.fail(attempts === 1 ? 'retryable' : 'non-retryable')
        })

        const config: Partial<RetryConfig> = {
          maxAttempts: 5,
          delay: 10,
          shouldRetry: (error: ErrorLike) => error === 'retryable'
        }

        await expectEffect.toFailWith(
          ErrorRecovery.withRetry(failingEffect, config),
          'non-retryable'
        )
        
        expect(attempts).toBe(2)
      })
    })

    describe('withCircuitBreaker', () => {
      it('should open circuit after threshold failures', async () => {
        let attempts = 0
        const failingEffect = Effect.gen(function* () {
          attempts++
          yield* Effect.fail(`Failure ${attempts}`)
        })

        const threshold = 3
        const timeout = 1000
        const context: ErrorHandlingContext = { component: 'test' }

        // First 3 failures should reach threshold
        for (let i = 0; i < threshold; i++) {
          await expectEffect.toFail(
            ErrorRecovery.withCircuitBreaker(failingEffect, threshold, timeout, context)
          )
        }

        // Circuit should now be open
        await expectEffect.toFailWith(
          ErrorRecovery.withCircuitBreaker(failingEffect, threshold, timeout, context),
          new Error('Circuit breaker is open')
        )

        expect(attempts).toBe(3) // Should not attempt after circuit opens
      })

      it('should reset circuit after timeout', async () => {
        let attempts = 0
        const originallyFailingEffect = Effect.gen(function* () {
          attempts++
          if (attempts <= 3) {
            yield* Effect.fail('Initial failures')
          }
          return 'success after reset'
        })

        const threshold = 2
        const timeout = 100
        const context: ErrorHandlingContext = { component: 'test' }

        // Trigger circuit opening
        for (let i = 0; i < threshold; i++) {
          await expectEffect.toFail(
            ErrorRecovery.withCircuitBreaker(originallyFailingEffect, threshold, timeout, context)
          )
        }

        // Wait for timeout
        vi.advanceTimersByTime(timeout + 10)

        // Should succeed after reset
        const result = await runEffect(
          ErrorRecovery.withCircuitBreaker(originallyFailingEffect, threshold, timeout, context)
        )

        expect(result).toBe('success after reset')
      })
    })

    describe('withTimeout', () => {
      it('should timeout long-running operations', async () => {
        const slowEffect = Effect.gen(function* () {
          yield* Effect.sleep(200)
          return 'completed'
        })

        const timeoutMs = 100
        const context: ErrorHandlingContext = { component: 'test' }

        await expectEffect.toFail(
          ErrorRecovery.withTimeout(slowEffect, timeoutMs, context)
        )
      })

      it('should complete fast operations normally', async () => {
        const fastEffect = Effect.succeed('quick result')
        const timeoutMs = 1000
        const context: ErrorHandlingContext = { component: 'test' }

        const result = await runEffect(
          ErrorRecovery.withTimeout(fastEffect, timeoutMs, context)
        )

        expect(result).toBe('quick result')
      })
    })

    describe('withGracefulDegradation', () => {
      it('should use fallback on primary failure', async () => {
        const primaryEffect = Effect.fail('Primary failed')
        const fallbackEffect = Effect.succeed('Fallback result')
        const context: ErrorHandlingContext = { component: 'test' }

        const result = await runEffect(
          ErrorRecovery.withGracefulDegradation(primaryEffect, fallbackEffect, context)
        )

        expect(result).toBe('Fallback result')
      })

      it('should use primary result when successful', async () => {
        const primaryEffect = Effect.succeed('Primary result')
        const fallbackEffect = Effect.succeed('Fallback result')
        const context: ErrorHandlingContext = { component: 'test' }

        const result = await runEffect(
          ErrorRecovery.withGracefulDegradation(primaryEffect, fallbackEffect, context)
        )

        expect(result).toBe('Primary result')
      })
    })
  })

  describe('Performance-aware error handling', () => {
    describe('withPerformanceMonitoring', () => {
      it('should monitor operation performance', async () => {
        const operation = 'test-operation'
        const effect = Effect.succeed('result')
        const thresholdMs = 50
        const context: ErrorHandlingContext = { component: 'PerfTest' }

        const result = await runEffect(
          PerformanceAwareErrorHandling.withPerformanceMonitoring(
            operation, 
            effect, 
            thresholdMs, 
            context
          )
        )

        expect(result).toBe('result')
      })

      it('should log slow operations', async () => {
        const operation = 'slow-operation'
        const slowEffect = Effect.gen(function* () {
          // Simulate slow operation
          yield* Effect.sleep(100)
          return 'slow result'
        })
        const thresholdMs = 10 // Very low threshold to trigger warning
        const context: ErrorHandlingContext = { component: 'PerfTest' }

        const result = await runEffect(
          PerformanceAwareErrorHandling.withPerformanceMonitoring(
            operation,
            slowEffect,
            thresholdMs,
            context
          )
        )

        expect(result).toBe('slow result')
      })
    })

    describe('withMemoryPressureHandling', () => {
      it('should handle high memory usage', async () => {
        const effect = Effect.succeed('memory test')
        const context: ErrorHandlingContext = { component: 'MemoryTest' }

        // Mock high memory usage
        const originalMemory = (global.performance as any).memory
        ;(global.performance as any).memory = {
          usedJSHeapSize: 1800000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000
        }

        const result = await runEffect(
          PerformanceAwareErrorHandling.withMemoryPressureHandling(effect, context)
        )

        expect(result).toBe('memory test')

        // Restore original memory
        ;(global.performance as any).memory = originalMemory
      })

      it('should handle normal memory usage', async () => {
        const effect = Effect.succeed('normal memory')
        const context: ErrorHandlingContext = { component: 'MemoryTest' }

        const result = await runEffect(
          PerformanceAwareErrorHandling.withMemoryPressureHandling(effect, context)
        )

        expect(result).toBe('normal memory')
      })
    })
  })

  describe('Error reporting', () => {
    describe('collectErrors', () => {
      it('should collect results from mixed success/failure effects', async () => {
        const effects = [
          Effect.succeed('success 1'),
          Effect.fail('error 1'),
          Effect.succeed('success 2'),
          Effect.fail('error 2')
        ]

        const context: ErrorHandlingContext = { component: 'test' }
        const results = await runEffect(ErrorReporting.collectErrors(effects, context))

        expect(results).toHaveLength(4)
        expect(results[0]).toEqual({ result: 'success 1', index: 0 })
        expect(results[1]).toEqual({ error: 'error 1', index: 1 })
        expect(results[2]).toEqual({ result: 'success 2', index: 2 })
        expect(results[3]).toEqual({ error: 'error 2', index: 3 })
      })
    })

    describe('generateErrorReport', () => {
      it('should generate comprehensive error report', async () => {
        const errors: ErrorLike[] = [
          new Error('Standard error'),
          'String error',
          { _tag: 'CustomError', message: 'Custom error' },
          SystemError({ message: 'System error', code: 'SYS001' })
        ]

        const context: ErrorHandlingContext = {
          component: 'ReportTest',
          operation: 'test',
          metadata: { key: 'value' }
        }

        const report = await runEffect(
          ErrorReporting.generateErrorReport(errors, context)
        )

        expect(report.totalErrors).toBe(4)
        expect(report.context).toEqual(context)
        expect(report.errors).toHaveLength(4)
        expect(report.errorTypes).toHaveProperty('Error')
        expect(report.errorTypes).toHaveProperty('string')
        expect(report.timestamp).toBeDefined()
      })

      it('should handle empty error list', async () => {
        const report = await runEffect(
          ErrorReporting.generateErrorReport([])
        )

        expect(report.totalErrors).toBe(0)
        expect(report.errors).toHaveLength(0)
        expect(report.errorTypes).toEqual({})
      })

      it('should validate context metadata', async () => {
        const errors = [new Error('test')]
        const context: ErrorHandlingContext = {
          metadata: 'invalid metadata' as any
        }

        const report = await runEffect(
          ErrorReporting.generateErrorReport(errors, context)
        )

        expect(report.context?.metadata).toBeDefined()
      })
    })
  })

  describe('Component error handling', () => {
    describe('createComponentErrorHandler', () => {
      it('should create component-specific error handler', () => {
        const handler = createComponentErrorHandler('TestComponent')
        
        expect(typeof handler.handle).toBe('function')
        expect(typeof handler.withRetry).toBe('function')
        expect(typeof handler.withTimeout).toBe('function')
        expect(typeof handler.withFallback).toBe('function')
        expect(typeof handler.withPerformanceMonitoring).toBe('function')
        expect(typeof handler.log).toBe('object')
      })

      describe('handle method', () => {
        it('should handle with ignore strategy', async () => {
          const handler = createComponentErrorHandler('TestComponent')
          const effect = Effect.fail('test error')
          
          await expectEffect.toFail(handler.handle(effect, 'ignore'))
        })

        it('should handle with log strategy and fallback', async () => {
          const handler = createComponentErrorHandler('TestComponent')
          const effect = Effect.fail('test error')
          const fallback = 'fallback value'
          
          const result = await runEffect(handler.handle(effect, 'log', fallback))
          
          expect(result).toBe(fallback)
        })

        it('should handle with retry strategy', async () => {
          let attempts = 0
          const effect = Effect.gen(function* () {
            attempts++
            if (attempts < 2) {
              yield* Effect.fail('retry error')
            }
            return 'success'
          })
          
          const handler = createComponentErrorHandler('TestComponent')
          const result = await runEffect(handler.handle(effect, 'retry'))
          
          expect(result).toBe('success')
        })

        it('should handle with fallback strategy', async () => {
          const handler = createComponentErrorHandler('TestComponent')
          const effect = Effect.fail('test error')
          const fallback = 'fallback value'
          
          const result = await runEffect(handler.handle(effect, 'fallback', fallback))
          
          expect(result).toBe(fallback)
        })

        it('should handle with terminate strategy', async () => {
          const handler = createComponentErrorHandler('TestComponent')
          const effect = Effect.fail('critical error')
          
          await expectEffect.toFail(handler.handle(effect, 'terminate'))
        })

        it('should handle with recover strategy', async () => {
          const handler = createComponentErrorHandler('TestComponent')
          const effect = Effect.fail('test error')
          const fallback = 'recovered value'
          
          const result = await runEffect(handler.handle(effect, 'recover', fallback))
          
          expect(result).toBe(fallback)
        })
      })

      describe('specialized handlers', () => {
        it('should provide retry handler', async () => {
          let attempts = 0
          const effect = Effect.gen(function* () {
            attempts++
            if (attempts < 3) {
              yield* Effect.fail('retry test')
            }
            return 'success'
          })

          const handler = createComponentErrorHandler('TestComponent')
          const config: Partial<RetryConfig> = { maxAttempts: 5, delay: 10 }
          
          const result = await runEffect(handler.withRetry(effect, config))
          
          expect(result).toBe('success')
          expect(attempts).toBe(3)
        })

        it('should provide timeout handler', async () => {
          const slowEffect = Effect.gen(function* () {
            yield* Effect.sleep(200)
            return 'slow result'
          })

          const handler = createComponentErrorHandler('TestComponent')
          
          await expectEffect.toFail(handler.withTimeout(slowEffect, 50))
        })

        it('should provide fallback handler', async () => {
          const primaryEffect = Effect.fail('primary failed')
          const fallbackEffect = Effect.succeed('fallback result')

          const handler = createComponentErrorHandler('TestComponent')
          const result = await runEffect(
            handler.withFallback(primaryEffect, fallbackEffect)
          )

          expect(result).toBe('fallback result')
        })

        it('should provide performance monitoring', async () => {
          const effect = Effect.succeed('monitored result')
          const handler = createComponentErrorHandler('TestComponent')

          const result = await runEffect(
            handler.withPerformanceMonitoring('test-op', effect, 100)
          )

          expect(result).toBe('monitored result')
        })
      })
    })
  })

  describe('Exported utilities', () => {
    it('should export withErrorHandling', () => {
      expect(withErrorHandling).toBe(createComponentErrorHandler)
    })

    it('should export handleError', () => {
      expect(handleError).toBe(ErrorHandlers)
    })

    it('should export recoverFromError', () => {
      expect(recoverFromError).toBe(ErrorRecovery)
    })

    it('should export reportErrors', () => {
      expect(reportErrors).toBe(ErrorReporting)
    })
  })

  describe('Integration tests', () => {
    it('should handle complex error scenarios with multiple recovery strategies', async () => {
      let primaryAttempts = 0
      let fallbackAttempts = 0

      const primaryEffect = Effect.gen(function* () {
        primaryAttempts++
        if (primaryAttempts < 2) {
          yield* Effect.fail('Primary not ready')
        }
        yield* Effect.fail('Primary failed permanently')
      })

      const fallbackEffect = Effect.gen(function* () {
        fallbackAttempts++
        if (fallbackAttempts < 2) {
          yield* Effect.fail('Fallback not ready')
        }
        return 'Fallback success'
      })

      const handler = createComponentErrorHandler('IntegrationTest')
      
      // Use retry with fallback
      const retryConfig: Partial<RetryConfig> = { maxAttempts: 3, delay: 10 }
      
      const result = await runEffect(
        handler.withFallback(
          handler.withRetry(primaryEffect, retryConfig),
          handler.withRetry(fallbackEffect, retryConfig)
        )
      )

      expect(result).toBe('Fallback success')
      expect(primaryAttempts).toBe(2) // Should retry primary
      expect(fallbackAttempts).toBe(2) // Should retry fallback
    })

    it('should generate comprehensive error report from real operation', async () => {
      const operations = [
        Effect.succeed('success 1'),
        Effect.fail(SystemError({ message: 'System error', code: 'SYS001' })),
        Effect.fail(EntityError({ message: 'Entity error', entityId: '123', operation: 'load' })),
        Effect.fail(ValidationError({ message: 'Validation error', field: 'name', value: null })),
        Effect.succeed('success 2')
      ]

      const context: ErrorHandlingContext = {
        component: 'IntegrationTest',
        operation: 'batch-process',
        metadata: { batchId: 'batch-001', totalItems: 5 }
      }

      const results = await runEffect(ErrorReporting.collectErrors(operations, context))
      
      const errors = results
        .filter(r => 'error' in r)
        .map(r => r.error as ErrorLike)

      const report = await runEffect(
        ErrorReporting.generateErrorReport(errors, context)
      )

      expect(report.totalErrors).toBe(3)
      expect(report.errorTypes).toHaveProperty('SystemError')
      expect(report.errorTypes).toHaveProperty('EntityError') 
      expect(report.errorTypes).toHaveProperty('ValidationError')
      expect(report.context?.component).toBe('IntegrationTest')
    })
  })
})