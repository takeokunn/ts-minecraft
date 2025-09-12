/**
 * Centralized error handling utilities for ts-minecraft
 *
 * Provides consistent error handling patterns across all layers
 * with Effect-TS integration and structured error recovery.
 */

import * as Effect from 'effect/Effect'
import * as S from '@effect/schema/Schema'
import { pipe } from 'effect/Function'
import { Logger } from '@shared/utils/logging'
import { PerformanceMonitor } from '@shared/utils/monitoring'
// Note: Using local error types definition to avoid domain layer dependency
export type AllGameErrors = Error | ValidationError | SystemError | EntityError

// Local error classes to avoid domain dependency
export class SystemError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SystemError'
  }
}

export class EntityError extends Error {
  constructor(message: string, public readonly entityId?: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'EntityError'
  }
}

export class ValidationError extends Error {
  public readonly context?: {
    field?: string
    component?: string
    operation?: string
    metadata?: Record<string, unknown>
    cause?: unknown
  }

  constructor(options: { message: string; context?: ValidationError['context'] }) {
    super(options.message)
    this.name = 'ValidationError'
    this.context = options.context
  }
}

/**
 * Type guard to check if window has gc function
 */
const hasGarbageCollector = (win: Window): win is Window & { gc: () => void } => {
  return 'gc' in win && typeof (win as any).gc === 'function'
}

// Error handling strategies
export type ErrorHandlingStrategy = 'ignore' | 'log' | 'retry' | 'fallback' | 'terminate' | 'recover'

// Enhanced Schema definitions for error handling validation
const ErrorSchema = S.Union(
  S.InstanceOf(Error),
  S.String,
  S.Struct({
    _tag: S.String,
    message: S.optional(S.String)
  }),
  S.Unknown
)

const MetadataSchema = S.Union(
  S.Record(S.String, S.Unknown),
  S.Null,
  S.Undefined
)

const FallbackValueSchema = S.Unknown
const ErrorArraySchema = S.Array(S.Unknown)
const RecoveryFunctionSchema = S.Function
const ErrorStackSchema = S.optional(S.String)

// Schema for error context validation
const ErrorHandlingContextSchema = S.Struct({
  component: S.optional(S.String),
  operation: S.optional(S.String),
  retryCount: S.optional(S.Number),
  maxRetries: S.optional(S.Number),
  fallbackValue: S.optional(S.Unknown),
  metadata: S.optional(S.Record(S.String, S.Unknown))
})

// Enhanced type guards and validators using Schema.parse
const validateError = (error: unknown): Effect.Effect<Error, never, never> => {
  return pipe(
    S.decodeUnknown(ErrorSchema)(error),
    Effect.match({
      onFailure: () => {
        // If schema validation fails, create error from unknown value
        if (error instanceof Error) return error
        if (typeof error === 'string') return new Error(error)
        if (typeof error === 'object' && error !== null && '_tag' in error) {
          const taggedError = error as { _tag: unknown }
          const tag = typeof taggedError._tag === 'string' ? taggedError._tag : String(taggedError._tag)
          return new Error(`Tagged Error: ${tag}`)
        }
        return new Error(String(error))
      },
      onSuccess: (validated) => {
        if (validated instanceof Error) return validated
        if (typeof validated === 'string') return new Error(validated)
        if (typeof validated === 'object' && validated !== null && '_tag' in validated) {
          const message = 'message' in validated && typeof validated.message === 'string' 
            ? validated.message 
            : `Tagged Error: ${validated._tag}`
          return new Error(message)
        }
        return new Error(String(validated))
      }
    }),
    Effect.succeed
  )
}

const validateMetadata = (metadata: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  return pipe(
    S.decodeUnknown(MetadataSchema)(metadata),
    Effect.match({
      onFailure: () => {
        // Fallback validation for invalid schema
        if (metadata == null) return {}
        if (typeof metadata === 'object' && !Array.isArray(metadata)) {
          return metadata as Record<string, unknown>
        }
        return { value: metadata, type: typeof metadata }
      },
      onSuccess: (validated) => {
        if (validated == null) return {}
        return validated as Record<string, unknown>
      }
    }),
    Effect.succeed
  )
}

const validateFallbackValue = <T>(value: unknown): Effect.Effect<T, never, never> => {
  return pipe(
    S.decodeUnknown(FallbackValueSchema)(value),
    Effect.match({
      onFailure: () => value as T,
      onSuccess: (validated) => validated as T
    }),
    Effect.succeed
  )
}

const validateErrorArray = (errors: unknown[]): Effect.Effect<Array<{ error: Error; originalValue: unknown }>, never, never> => {
  return pipe(
    S.decodeUnknown(ErrorArraySchema)(errors),
    Effect.match({
      onFailure: () => {
        // Fallback: treat as array of unknown values
        return Array.isArray(errors) ? errors : [errors]
      },
      onSuccess: (validated) => validated
    }),
    Effect.flatMap((errorArray) => 
      Effect.gen(function* () {
        const validatedErrors: Array<{ error: Error; originalValue: unknown }> = []
        for (const error of errorArray) {
          const validatedError = yield* validateError(error)
          validatedErrors.push({ error: validatedError, originalValue: error })
        }
        return validatedErrors
      })
    )
  )
}

const shouldRetryValidator = (fn: unknown): ((error: unknown) => boolean) => {
  return pipe(
    S.decodeUnknown(RecoveryFunctionSchema)(fn),
    Effect.match({
      onFailure: () => () => true, // Default: retry all errors
      onSuccess: (validatedFn) => (error: unknown) => {
        try {
          return Boolean(validatedFn(error))
        } catch {
          return false // If function throws, don't retry
        }
      }
    }),
    Effect.runSync
  )
}

// Error context for better reporting with validated metadata
export interface ErrorHandlingContext {
  component?: string
  operation?: string
  retryCount?: number
  maxRetries?: number
  fallbackValue?: unknown
  metadata?: Record<string, unknown>
}

// Retry configuration with validated shouldRetry function
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

// Error handler interface with unknown validation
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

  // Log errors and continue with validation
  log: <E>(component?: string): ErrorHandler<E, void> => ({
    handle: (error, context) =>
      Effect.gen(function* () {
        const validatedError = yield* validateError(error)
        const validatedMetadata = context?.metadata ? yield* validateMetadata(context.metadata) : undefined
        const validatedContext = context ? { ...context, metadata: validatedMetadata } : undefined
        return yield* Logger.error('Error handled by log handler', component || context?.component, validatedError, { ...validatedContext, strategy: 'log' }, ['error-handler'])
      }),
    canHandle: (): error is E => true,
  }),

  // Provide fallback value with validation
  fallback: <E, T>(value: T): ErrorHandler<E, T> => ({
    handle: (error, context) =>
      Effect.gen(function* () {
        const validatedFallback = yield* validateFallbackValue<T>(value)
        const validatedError = yield* validateError(error)
        yield* Logger.warn('Error handled with fallback value', context?.component, { error: validatedError.message, fallback: String(validatedFallback) }, [
          'error-handler',
          'fallback',
        ])
        return validatedFallback
      }),
    canHandle: (): error is E => true,
  }),

  // Terminate on critical errors with validation
  terminate: <E>(message?: string): ErrorHandler<E, never> => ({
    handle: (error, context) =>
      Effect.gen(function* () {
        const validatedError = yield* validateError(error)
        const validatedMetadata = context?.metadata ? yield* validateMetadata(context.metadata) : undefined
        const validatedContext = context ? { ...context, metadata: validatedMetadata } : undefined
        yield* Logger.critical(message || 'Critical error - terminating', context?.component, validatedError, validatedContext, ['error-handler', 'terminate'])
        return yield* Effect.dieMessage('Application terminated due to critical error')
      }),
    canHandle: (): error is E => true,
  }),

  // Custom recovery function with validation
  recover: <E, T>(recoveryFn: (error: E, context?: ErrorHandlingContext) => T): ErrorHandler<E, T> => ({
    handle: (error, context) =>
      Effect.gen(function* () {
        const validatedError = yield* validateError(error)
        const validatedMetadata = context?.metadata ? yield* validateMetadata(context.metadata) : undefined
        const validatedContext = context ? { ...context, metadata: validatedMetadata } : undefined

        try {
          const result = recoveryFn(error, validatedContext)
          return yield* validateFallbackValue<T>(result)
        } catch (recoveryError) {
          const validatedRecoveryError = yield* validateError(recoveryError)
          yield* Logger.error('Recovery function failed', context?.component, validatedRecoveryError, { originalError: validatedError.message, context: validatedContext }, [
            'error-handler',
            'recovery-failed',
          ])
          return yield* Effect.die(recoveryError)
        }
      }),
    canHandle: (): error is E => true,
  }),
}

// Error recovery utilities
export const ErrorRecovery = {
  // Retry with exponential backoff and validation
  withRetry: <T, E>(effect: Effect.Effect<T, E, never>, config: Partial<RetryConfig> = {}, context?: ErrorHandlingContext): Effect.Effect<T, E, never> => {
    const retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      shouldRetry: config.shouldRetry ? shouldRetryValidator(config.shouldRetry) : undefined,
    }

    const retry = (attempt: number, lastError: E): Effect.Effect<T, E, never> => {
      if (attempt >= retryConfig.maxAttempts) {
        return Effect.gen(function* () {
          const validatedError = yield* validateError(lastError)
          const validatedMetadata = context?.metadata ? yield* validateMetadata(context.metadata) : undefined
          const validatedContext = context ? { ...context, metadata: validatedMetadata } : undefined
          yield* Logger.error(
            `Operation failed after ${attempt} attempts`,
            context?.component,
            validatedError,
            { ...validatedContext, attempts: attempt, strategy: 'retry-exhausted' },
            ['error-handler', 'retry-failed'],
          )
          return yield* Effect.fail(lastError)
        })
      }

      const delay = Math.min(retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt), retryConfig.maxDelay)

      return pipe(
        Effect.sleep(delay),
        Effect.flatMap(() =>
          pipe(
            effect,
            Effect.catchAll((error) => {
              if (retryConfig.shouldRetry && !retryConfig.shouldRetry(error)) {
                return Effect.fail(error)
              }

              return Effect.gen(function* () {
                const validatedError = yield* validateError(error)
                yield* Logger.warn(`Retry attempt ${attempt + 1}/${retryConfig.maxAttempts}`, context?.component, { error: validatedError.message, delay, attempt: attempt + 1 }, [
                  'error-handler',
                  'retry',
                ])
                return yield* retry(attempt + 1, error)
              })
            }),
          ),
        ),
      )
    }

    return pipe(
      effect,
      Effect.catchAll((error) => retry(0, error)),
    )
  },

  // Circuit breaker pattern
  withCircuitBreaker: <T, E>(
    effect: Effect.Effect<T, E, never>,
    threshold: number = 5,
    timeout: number = 60000, // 1 minute
    context?: ErrorHandlingContext,
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
          Effect.catchAll((error) => {
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
                  isOpen: failureCount >= threshold,
                },
                ['error-handler', 'circuit-breaker'],
              ),
              Effect.flatMap(() => Effect.fail(error)),
            )
          }),
        ),
      ),
    )
  },

  // Timeout handling
  withTimeout: <T, E>(effect: Effect.Effect<T, E, never>, timeoutMs: number, context?: ErrorHandlingContext): Effect.Effect<T, E | Error, never> => {
    return pipe(
      effect,
      Effect.race(
        pipe(
          Effect.sleep(timeoutMs),
          Effect.flatMap(() =>
            pipe(
              Logger.warn(`Operation timed out after ${timeoutMs}ms`, context?.component, { timeout: timeoutMs, operation: context?.operation }, ['error-handler', 'timeout']),
              Effect.flatMap(() => Effect.fail(new Error(`Operation timed out after ${timeoutMs}ms`))),
            ),
          ),
        ),
      ),
    )
  },

  // Graceful degradation
  withGracefulDegradation: <T, E>(
    primaryEffect: Effect.Effect<T, E, never>,
    fallbackEffect: Effect.Effect<T, never, never>,
    context?: ErrorHandlingContext,
  ): Effect.Effect<T, never, never> => {
    return pipe(
      primaryEffect,
      Effect.catchAll((error) =>
        pipe(
          Logger.warn('Primary operation failed, using fallback', context?.component, { error: String(error), strategy: 'graceful-degradation' }, ['error-handler', 'degradation']),
          Effect.flatMap(() => fallbackEffect),
        ),
      ),
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
    context?: ErrorHandlingContext,
  ): Effect.Effect<T, E, never> => {
    return pipe(
      PerformanceMonitor.measureUpdate(effect),
      Effect.tap((result) => {
        // This would need to be implemented with proper timing measurement
        const duration = 0 // Placeholder - would get actual duration

        if (duration > thresholdMs) {
          return Logger.warn(`Slow operation detected: ${operation}`, context?.component, { duration, threshold: thresholdMs, operation, result }, [
            'performance',
            'slow-operation',
          ])
        }

        return Effect.void
      }),
    )
  },

  // Handle memory pressure
  withMemoryPressureHandling: <T, E>(effect: Effect.Effect<T, E, never>, context?: ErrorHandlingContext): Effect.Effect<T, E, never> => {
    return pipe(
      PerformanceMonitor.updateMemoryMetrics(),
      Effect.flatMap(() => PerformanceMonitor.getMetrics()),
      Effect.flatMap((metrics) => {
        if (metrics.memory.percentage > 90) {
          return pipe(
            Logger.warn('High memory usage detected', context?.component, { memoryUsage: metrics.memory.percentage }, ['performance', 'memory-pressure']),
            Effect.flatMap(() =>
              // Force garbage collection if available
              Effect.sync(() => {
                if (typeof window !== 'undefined' && hasGarbageCollector(window)) {
                  window.gc()
                }
              }),
            ),
            Effect.flatMap(() => effect),
          )
        }
        return effect
      }),
    )
  },
}

// Error aggregation and reporting
export const ErrorReporting = {
  // Collect errors for batch reporting
  collectErrors: <T, E>(effects: Effect.Effect<T, E, never>[], context?: ErrorHandlingContext): Effect.Effect<Array<{ result?: T; error?: E; index: number }>, never, never> => {
    return pipe(
      Effect.all(
        effects.map((effect, index) =>
          pipe(
            effect,
            Effect.map((result) => ({ result, index })),
            Effect.catchAll((error) => Effect.succeed({ error, index })),
          ),
        ),
      ),
    )
  },

  // Generate comprehensive error report with validation
  generateErrorReport: (
    errors: unknown[],
    context?: ErrorHandlingContext,
  ): Effect.Effect<
    {
      timestamp: string
      totalErrors: number
      errorTypes: Record<string, number>
      context?: ErrorHandlingContext
      errors: Array<{
        type: string
        message: string
        stack?: string
        metadata?: Record<string, unknown>
      }>
    },
    never,
    never
  > => {
    return Effect.gen(function* () {
      const validatedErrors = yield* validateErrorArray(errors)
      const validatedMetadata = context?.metadata ? yield* validateMetadata(context.metadata) : undefined
      const validatedContext = context ? { ...context, metadata: validatedMetadata } : undefined

      const errorTypes: Record<string, number> = {}
      const processedErrors = validatedErrors.map(({ error, originalValue }) => {
        const errorType =
          error instanceof Error
            ? error.constructor.name
            : typeof originalValue === 'object' && originalValue && '_tag' in originalValue
              ? (() => {
                  const taggedValue = originalValue as { _tag: unknown }
                  return typeof taggedValue._tag === 'string' ? taggedValue._tag : String(taggedValue._tag)
                })()
              : typeof originalValue

        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1

        return {
          type: errorType,
          message: error.message,
          stack: error.stack,
          metadata:
            error instanceof Error
              ? undefined
              : typeof originalValue === 'object' && originalValue !== null
                ? (originalValue as Record<string, unknown>)
                : { value: originalValue, type: typeof originalValue },
        }
      })

      return {
        timestamp: new Date().toISOString(),
        totalErrors: errors.length,
        errorTypes,
        context: validatedContext,
        errors: processedErrors,
      }
    })
  },
}

// Enhanced validation for error handling context
const validateErrorHandlingContext = (context: unknown): Effect.Effect<ErrorHandlingContext, never, never> => {
  return pipe(
    S.decodeUnknown(ErrorHandlingContextSchema)(context),
    Effect.match({
      onFailure: () => {
        // Provide sensible defaults for invalid context
        if (context == null) return {}
        if (typeof context === 'object' && !Array.isArray(context)) {
          return context as ErrorHandlingContext
        }
        return { metadata: { value: context, type: typeof context } }
      },
      onSuccess: (validated) => validated
    }),
    Effect.succeed
  )
}

// Schema validation for retry configuration
const RetryConfigSchema = S.Struct({
  maxAttempts: S.Number,
  delay: S.Number, 
  backoffMultiplier: S.Number,
  maxDelay: S.Number,
  shouldRetry: S.optional(S.Function)
})

const validateRetryConfig = (config: unknown): Effect.Effect<RetryConfig, never, never> => {
  return pipe(
    S.decodeUnknown(S.partial(RetryConfigSchema))(config),
    Effect.match({
      onFailure: () => DEFAULT_RETRY_CONFIG,
      onSuccess: (validated) => ({ ...DEFAULT_RETRY_CONFIG, ...validated })
    }),
    Effect.succeed
  )
}

// Export validation utilities
export const ErrorValidation = {
  validateError,
  validateMetadata,
  validateFallbackValue,
  validateErrorArray,
  validateErrorHandlingContext,
  validateRetryConfig,
  shouldRetryValidator,
  // Schema exports for external use
  ErrorSchema,
  MetadataSchema,
  ErrorHandlingContextSchema,
  RetryConfigSchema,
}

// Component-specific error handling with validation
export const createComponentErrorHandler = (component: string) => ({
  // Handle errors with component context and validation
  handle: <T, E>(effect: Effect.Effect<T, E, never>, strategy: ErrorHandlingStrategy = 'log', fallbackValue?: T): Effect.Effect<T, never, never> => {
    const context: ErrorHandlingContext = { component }

    switch (strategy) {
      case 'ignore':
        return pipe(
          effect,
          Effect.catchAll(() => Effect.void as Effect.Effect<T, never, never>),
        )

      case 'log':
        return pipe(
          effect,
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* ErrorHandlers.log(component).handle(error, context)
              if (fallbackValue !== undefined) {
                return yield* validateFallbackValue<T>(fallbackValue)
              }
              return yield* Effect.die('No fallback value provided for log strategy')
            }),
          ),
        )

      case 'retry':
        return ErrorRecovery.withRetry(effect, undefined, context) as Effect.Effect<T, never, never>

      case 'fallback':
        if (fallbackValue !== undefined) {
          return pipe(
            effect,
            Effect.catchAll(() => validateFallbackValue<T>(fallbackValue)),
          )
        }
        return pipe(
          effect,
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* ErrorHandlers.log(component).handle(error, context)
              return yield* Effect.die('No fallback value provided for fallback strategy')
            }),
          ),
        )

      case 'terminate':
        return pipe(
          effect,
          Effect.catchAll((error) => ErrorHandlers.terminate(component).handle(error, context)),
        )

      case 'recover':
        return pipe(
          effect,
          Effect.catchAll((error) => {
            // Default recovery: log and use fallback if available
            if (fallbackValue !== undefined) {
              return Effect.gen(function* () {
                yield* ErrorHandlers.log(component).handle(error, context)
                return yield* validateFallbackValue<T>(fallbackValue)
              })
            }
            return ErrorHandlers.terminate(component).handle(error, context)
          }),
        )

      default:
        return pipe(
          effect,
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* ErrorHandlers.log(component).handle(error, context)
              if (fallbackValue !== undefined) {
                return yield* validateFallbackValue<T>(fallbackValue)
              }
              return yield* Effect.die('No fallback value provided for default strategy')
            }),
          ),
        )
    }
  },

  // Specialized handlers for common scenarios
  withRetry: <T, E>(effect: Effect.Effect<T, E, never>, config?: Partial<RetryConfig>) => ErrorRecovery.withRetry(effect, config, { component }),

  withTimeout: <T, E>(effect: Effect.Effect<T, E, never>, timeoutMs: number) => ErrorRecovery.withTimeout(effect, timeoutMs, { component }),

  withFallback: <T, E>(primaryEffect: Effect.Effect<T, E, never>, fallbackEffect: Effect.Effect<T, never, never>) =>
    ErrorRecovery.withGracefulDegradation(primaryEffect, fallbackEffect, { component }),

  // Performance monitoring
  withPerformanceMonitoring: <T, E>(operation: string, effect: Effect.Effect<T, E, never>, thresholdMs?: number) =>
    PerformanceAwareErrorHandling.withPerformanceMonitoring(operation, effect, thresholdMs, { component, operation }),

  // Logging shorthand
  log: Logger.withComponent(component),
})

// Export commonly used patterns
export const withErrorHandling = createComponentErrorHandler
export const handleError = ErrorHandlers
export const recoverFromError = ErrorRecovery
export const reportErrors = ErrorReporting
