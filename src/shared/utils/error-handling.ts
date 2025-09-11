/**
 * Centralized error handling utilities for ts-minecraft
 * 
 * Provides consistent error handling patterns across all layers
 * with Effect-TS integration and structured error recovery.
 */

import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import { Logger } from './logging'
import { PerformanceMonitor } from './monitoring'
import type { AllGameErrors } from '@domain/errors'

// Error handling strategies
export type ErrorHandlingStrategy = 
  | 'ignore' 
  | 'log' 
  | 'retry' 
  | 'fallback' 
  | 'terminate' 
  | 'recover'

// Error context for better reporting
export interface ErrorHandlingContext {
  component?: string
  operation?: string
  retryCount?: number
  maxRetries?: number
  fallbackValue?: unknown
  metadata?: Record<string, unknown>
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number
  delay: number
  backoffMultiplier: number
  maxDelay: number
  shouldRetry?: (error: unknown) => boolean
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delay: 100,
  backoffMultiplier: 2,
  maxDelay: 5000,
}

// Error handler interface
export interface ErrorHandler<E, R> {
  handle: (error: E, context?: ErrorHandlingContext) => Effect.Effect<R, never, never>
  canHandle: (error: unknown) => error is E
}

// Built-in error handlers
export const ErrorHandlers = {
  // Ignore errors (useful for non-critical operations)
  ignore: <E>(): ErrorHandler<E, void> => ({
    handle: () => Effect.void,
    canHandle: (): error is E => true,
  }),

  // Log errors and continue
  log: <E>(component?: string): ErrorHandler<E, void> => ({
    handle: (error, context) =>
      Logger.error(
        'Error handled by log handler',
        component || context?.component,
        error instanceof Error ? error : new Error(String(error)),
        { ...context, strategy: 'log' },
        ['error-handler']
      ),
    canHandle: (): error is E => true,
  }),

  // Provide fallback value
  fallback: <E, T>(value: T): ErrorHandler<E, T> => ({
    handle: (error, context) =>
      pipe(
        Logger.warn(
          'Error handled with fallback value',
          context?.component,
          { error: String(error), fallback: value },
          ['error-handler', 'fallback']
        ),
        Effect.map(() => value)
      ),
    canHandle: (): error is E => true,
  }),

  // Terminate on critical errors
  terminate: <E>(message?: string): ErrorHandler<E, never> => ({
    handle: (error, context) =>
      pipe(
        Logger.critical(
          message || 'Critical error - terminating',
          context?.component,
          error instanceof Error ? error : new Error(String(error)),
          context,
          ['error-handler', 'terminate']
        ),
        Effect.flatMap(() => Effect.dieMessage('Application terminated due to critical error'))
      ),
    canHandle: (): error is E => true,
  }),

  // Custom recovery function
  recover: <E, T>(recoveryFn: (error: E, context?: ErrorHandlingContext) => T): ErrorHandler<E, T> => ({
    handle: (error, context) =>
      pipe(
        Effect.try(() => recoveryFn(error, context)),
        Effect.catchAll(recoveryError =>
          pipe(
            Logger.error(
              'Recovery function failed',
              context?.component,
              recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)),
              { originalError: String(error), context },
              ['error-handler', 'recovery-failed']
            ),
            Effect.flatMap(() => Effect.die(recoveryError))
          )
        )
      ),
    canHandle: (): error is E => true,
  }),
}

// Error recovery utilities
export const ErrorRecovery = {
  // Retry with exponential backoff
  withRetry: <T, E>(
    effect: Effect.Effect<T, E, never>,
    config: Partial<RetryConfig> = {},
    context?: ErrorHandlingContext
  ): Effect.Effect<T, E, never> => {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
    
    const retry = (attempt: number, lastError: E): Effect.Effect<T, E, never> => {
      if (attempt >= retryConfig.maxAttempts) {
        return pipe(
          Logger.error(
            `Operation failed after ${attempt} attempts`,
            context?.component,
            lastError instanceof Error ? lastError : new Error(String(lastError)),
            { ...context, attempts: attempt, strategy: 'retry-exhausted' },
            ['error-handler', 'retry-failed']
          ),
          Effect.flatMap(() => Effect.fail(lastError))
        )
      }

      const delay = Math.min(
        retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelay
      )

      return pipe(
        Effect.sleep(delay),
        Effect.flatMap(() =>
          pipe(
            effect,
            Effect.catchAll(error => {
              if (retryConfig.shouldRetry && !retryConfig.shouldRetry(error)) {
                return Effect.fail(error)
              }

              return pipe(
                Logger.warn(
                  `Retry attempt ${attempt + 1}/${retryConfig.maxAttempts}`,
                  context?.component,
                  { error: String(error), delay, attempt: attempt + 1 },
                  ['error-handler', 'retry']
                ),
                Effect.flatMap(() => retry(attempt + 1, error))
              )
            })
          )
        )
      )
    }

    return pipe(
      effect,
      Effect.catchAll(error => retry(0, error))
    )
  },

  // Circuit breaker pattern
  withCircuitBreaker: <T, E>(
    effect: Effect.Effect<T, E, never>,
    threshold: number = 5,
    timeout: number = 60000, // 1 minute
    context?: ErrorHandlingContext
  ): Effect.Effect<T, E | Error, never> => {
    // Note: This is a simplified circuit breaker
    // In a real implementation, you'd want to maintain state across calls
    let failureCount = 0
    let lastFailureTime = 0

    return pipe(
      Effect.sync(() => {
        const now = Date.now()
        if (failureCount >= threshold && now - lastFailureTime < timeout) {
          throw new Error('Circuit breaker is open')
        }
      }),
      Effect.flatMap(() =>
        pipe(
          effect,
          Effect.tap(() => {
            failureCount = 0 // Reset on success
          }),
          Effect.catchAll(error => {
            failureCount++
            lastFailureTime = Date.now()

            return pipe(
              Logger.warn(
                'Circuit breaker failure recorded',
                context?.component,
                { 
                  error: String(error), 
                  failureCount, 
                  threshold,
                  isOpen: failureCount >= threshold 
                },
                ['error-handler', 'circuit-breaker']
              ),
              Effect.flatMap(() => Effect.fail(error))
            )
          })
        )
      )
    )
  },

  // Timeout handling
  withTimeout: <T, E>(
    effect: Effect.Effect<T, E, never>,
    timeoutMs: number,
    context?: ErrorHandlingContext
  ): Effect.Effect<T, E | Error, never> => {
    return pipe(
      effect,
      Effect.race(
        pipe(
          Effect.sleep(timeoutMs),
          Effect.flatMap(() =>
            pipe(
              Logger.warn(
                `Operation timed out after ${timeoutMs}ms`,
                context?.component,
                { timeout: timeoutMs, operation: context?.operation },
                ['error-handler', 'timeout']
              ),
              Effect.flatMap(() => Effect.fail(new Error(`Operation timed out after ${timeoutMs}ms`)))
            )
          )
        )
      )
    )
  },

  // Graceful degradation
  withGracefulDegradation: <T, E>(
    primaryEffect: Effect.Effect<T, E, never>,
    fallbackEffect: Effect.Effect<T, never, never>,
    context?: ErrorHandlingContext
  ): Effect.Effect<T, never, never> => {
    return pipe(
      primaryEffect,
      Effect.catchAll(error =>
        pipe(
          Logger.warn(
            'Primary operation failed, using fallback',
            context?.component,
            { error: String(error), strategy: 'graceful-degradation' },
            ['error-handler', 'degradation']
          ),
          Effect.flatMap(() => fallbackEffect)
        )
      )
    )
  },
}

// Performance-aware error handling
export const PerformanceAwareErrorHandling = {
  // Monitor slow operations and handle timeouts
  withPerformanceMonitoring: <T, E>(
    operation: string,
    effect: Effect.Effect<T, E, never>,
    thresholdMs: number = 100,
    context?: ErrorHandlingContext
  ): Effect.Effect<T, E, never> => {
    return pipe(
      PerformanceMonitor.measureUpdate(effect),
      Effect.tap(result => {
        // This would need to be implemented with proper timing measurement
        const duration = 0 // Placeholder - would get actual duration
        
        if (duration > thresholdMs) {
          return Logger.warn(
            `Slow operation detected: ${operation}`,
            context?.component,
            { duration, threshold: thresholdMs, operation, result },
            ['performance', 'slow-operation']
          )
        }
        
        return Effect.void
      })
    )
  },

  // Handle memory pressure
  withMemoryPressureHandling: <T, E>(
    effect: Effect.Effect<T, E, never>,
    context?: ErrorHandlingContext
  ): Effect.Effect<T, E, never> => {
    return pipe(
      PerformanceMonitor.updateMemoryMetrics(),
      Effect.flatMap(() => PerformanceMonitor.getMetrics()),
      Effect.flatMap(metrics => {
        if (metrics.memory.percentage > 90) {
          return pipe(
            Logger.warn(
              'High memory usage detected',
              context?.component,
              { memoryUsage: metrics.memory.percentage },
              ['performance', 'memory-pressure']
            ),
            Effect.flatMap(() => 
              // Force garbage collection if available
              Effect.sync(() => {
                if (typeof window !== 'undefined' && (window as any).gc) {
                  (window as any).gc()
                }
              })
            ),
            Effect.flatMap(() => effect)
          )
        }
        return effect
      })
    )
  },
}

// Error aggregation and reporting
export const ErrorReporting = {
  // Collect errors for batch reporting
  collectErrors: <T, E>(
    effects: Effect.Effect<T, E, never>[],
    context?: ErrorHandlingContext
  ): Effect.Effect<Array<{ result?: T; error?: E; index: number }>, never, never> => {
    return pipe(
      Effect.all(
        effects.map((effect, index) =>
          pipe(
            effect,
            Effect.map(result => ({ result, index })),
            Effect.catchAll(error => Effect.succeed({ error, index }))
          )
        )
      )
    )
  },

  // Generate comprehensive error report
  generateErrorReport: (
    errors: unknown[],
    context?: ErrorHandlingContext
  ): Effect.Effect<{
    timestamp: string
    totalErrors: number
    errorTypes: Record<string, number>
    context?: ErrorHandlingContext
    errors: Array<{
      type: string
      message: string
      stack?: string
      metadata?: unknown
    }>
  }, never, never> => {
    return Effect.sync(() => {
      const errorTypes: Record<string, number> = {}
      const processedErrors = errors.map(error => {
        const errorType = error instanceof Error 
          ? error.constructor.name 
          : typeof error === 'object' && error && '_tag' in error
            ? (error as any)._tag
            : typeof error

        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1

        return {
          type: errorType,
          message: error instanceof Error 
            ? error.message 
            : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          metadata: error instanceof Error ? undefined : error,
        }
      })

      return {
        timestamp: new Date().toISOString(),
        totalErrors: errors.length,
        errorTypes,
        context,
        errors: processedErrors,
      }
    })
  },
}

// Component-specific error handling
export const createComponentErrorHandler = (component: string) => ({
  // Handle errors with component context
  handle: <T, E>(
    effect: Effect.Effect<T, E, never>,
    strategy: ErrorHandlingStrategy = 'log',
    fallbackValue?: T
  ): Effect.Effect<T, never, never> => {
    const context: ErrorHandlingContext = { component }

    switch (strategy) {
      case 'ignore':
        return pipe(
          effect,
          Effect.catchAll(() => Effect.void as Effect.Effect<T, never, never>)
        )

      case 'log':
        return pipe(
          effect,
          Effect.catchAll(error =>
            pipe(
              ErrorHandlers.log(component).handle(error, context),
              Effect.map(() => fallbackValue as T)
            )
          )
        )

      case 'retry':
        return ErrorRecovery.withRetry(effect, undefined, context) as Effect.Effect<T, never, never>

      case 'fallback':
        if (fallbackValue !== undefined) {
          return pipe(
            effect,
            Effect.catchAll(() => Effect.succeed(fallbackValue))
          )
        }
        return pipe(
          effect,
          Effect.catchAll(error =>
            pipe(
              ErrorHandlers.log(component).handle(error, context),
              Effect.die
            )
          )
        )

      case 'terminate':
        return pipe(
          effect,
          Effect.catchAll(error =>
            ErrorHandlers.terminate(component).handle(error, context)
          )
        )

      case 'recover':
        return pipe(
          effect,
          Effect.catchAll(error => {
            // Default recovery: log and use fallback if available
            if (fallbackValue !== undefined) {
              return pipe(
                ErrorHandlers.log(component).handle(error, context),
                Effect.map(() => fallbackValue)
              )
            }
            return ErrorHandlers.terminate(component).handle(error, context)
          })
        )

      default:
        return pipe(
          effect,
          Effect.catchAll(error =>
            ErrorHandlers.log(component).handle(error, context) as Effect.Effect<T, never, never>
          )
        )
    }
  },

  // Specialized handlers for common scenarios
  withRetry: <T, E>(effect: Effect.Effect<T, E, never>, config?: Partial<RetryConfig>) =>
    ErrorRecovery.withRetry(effect, config, { component }),

  withTimeout: <T, E>(effect: Effect.Effect<T, E, never>, timeoutMs: number) =>
    ErrorRecovery.withTimeout(effect, timeoutMs, { component }),

  withFallback: <T, E>(
    primaryEffect: Effect.Effect<T, E, never>,
    fallbackEffect: Effect.Effect<T, never, never>
  ) =>
    ErrorRecovery.withGracefulDegradation(
      primaryEffect,
      fallbackEffect,
      { component }
    ),

  // Performance monitoring
  withPerformanceMonitoring: <T, E>(
    operation: string,
    effect: Effect.Effect<T, E, never>,
    thresholdMs?: number
  ) =>
    PerformanceAwareErrorHandling.withPerformanceMonitoring(
      operation,
      effect,
      thresholdMs,
      { component, operation }
    ),

  // Logging shorthand
  log: Logger.withComponent(component),
})

// Export commonly used patterns
export const withErrorHandling = createComponentErrorHandler
export const handleError = ErrorHandlers
export const recoverFromError = ErrorRecovery
export const reportErrors = ErrorReporting