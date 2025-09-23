/**
 * Schema Performance Optimization Utilities
 *
 * Provides optimized Schema validation strategies for different runtime contexts
 * to maintain 60FPS performance while preserving type safety
 */

import { Effect, pipe } from 'effect'
import { Schema } from '@effect/schema'

/**
 * Performance optimization strategies for Schema validation
 */
export type ValidationStrategy =
  | 'strict'      // Full validation always
  | 'development' // Full validation only in development
  | 'boundary'    // Only at system boundaries
  | 'disabled'    // Type-level only, no runtime validation

/**
 * Performance-aware Schema validation utilities
 */
export const SchemaOptimization = {
  /**
   * Create a performance-optimized validator based on context
   */
  createOptimizedValidator: <A, I>(
    schema: Schema.Schema<A, I>,
    strategy: ValidationStrategy = 'development'
  ) => {
    const validator = (input: unknown): Effect.Effect<A, Schema.ParseError> => {
      switch (strategy) {
        case 'strict':
          return Schema.decodeUnknown(schema)(input)

        case 'development':
          return process.env.NODE_ENV === 'development'
            ? Schema.decodeUnknown(schema)(input)
            : Effect.succeed(input as A)

        case 'boundary':
          // Only validate at service boundaries (externally facing APIs)
          return Effect.succeed(input as A)

        case 'disabled':
          // Trust TypeScript types completely
          return Effect.succeed(input as A)

        default:
          return Schema.decodeUnknown(schema)(input)
      }
    }

    return {
      validate: validator,

      /**
       * Validate with timeout for performance-critical paths
       */
      validateWithTimeout: (input: unknown, timeoutMs: number = 16): Effect.Effect<A, Schema.ParseError | 'timeout'> =>
        pipe(
          validator(input),
          Effect.timeout(`${timeoutMs} millis`),
          Effect.mapError((error) => error === 'timeout' ? 'timeout' : error)
        ),

      /**
       * Batch validation for multiple items
       */
      validateBatch: (inputs: unknown[], concurrency: number = 10): Effect.Effect<A[], Schema.ParseError[]> =>
        pipe(
          inputs,
          Effect.forEach(validator, { concurrency, batching: true }),
          Effect.mapError((errors) => Array.isArray(errors) ? errors : [errors])
        ),

      /**
       * Safe validation that never throws
       */
      validateSafe: (input: unknown): Effect.Effect<A | null, never> =>
        pipe(
          validator(input),
          Effect.map((result) => result),
          Effect.catchAll(() => Effect.succeed(null))
        )
    }
  },

  /**
   * Game loop optimized validation (16ms budget)
   */
  createGameLoopValidator: <A, I>(schema: Schema.Schema<A, I>) => {
    const validator = SchemaOptimization.createOptimizedValidator(schema, 'development')

    return {
      /**
       * Validate with strict 16ms timeout for 60FPS
       */
      validateInGameLoop: (input: unknown): Effect.Effect<A, 'timeout' | 'validation_error'> =>
        pipe(
          validator.validateWithTimeout(input, 16),
          Effect.mapError((error) => error === 'timeout' ? 'timeout' : 'validation_error')
        ),

      /**
       * Pre-validated cache for hot paths
       */
      createValidationCache: () => {
        const cache = new Map<string, A>()

        return {
          get: (key: string, input: unknown): Effect.Effect<A, 'cache_miss' | 'validation_error'> => {
            const cached = cache.get(key)
            if (cached !== undefined) {
              return Effect.succeed(cached)
            }

            return pipe(
              validator.validateSafe(input),
              Effect.flatMap((result) =>
                result !== null
                  ? Effect.sync(() => {
                      cache.set(key, result)
                      return result
                    })
                  : Effect.fail('validation_error' as const)
              ),
              Effect.catchAll(() => Effect.fail('cache_miss' as const))
            )
          },

          clear: (): Effect.Effect<void, never> => Effect.sync(() => cache.clear()),

          size: (): Effect.Effect<number, never> => Effect.sync(() => cache.size)
        }
      }
    }
  },

  /**
   * Boundary validation for service interfaces
   */
  createBoundaryValidator: <A, I>(schema: Schema.Schema<A, I>) => {
    const validator = SchemaOptimization.createOptimizedValidator(schema, 'strict')

    return {
      /**
       * Validate input at service boundary with detailed error reporting
       */
      validateInput: (input: unknown, context: string): Effect.Effect<A, { context: string; error: Schema.ParseError }> =>
        pipe(
          validator.validate(input),
          Effect.mapError((error) => ({ context, error }))
        ),

      /**
       * Validate output at service boundary (development only)
       */
      validateOutput: (output: A, context: string): Effect.Effect<A, { context: string; error: Schema.ParseError }> =>
        process.env.NODE_ENV === 'development'
          ? pipe(
              validator.validate(output),
              Effect.mapError((error) => ({ context, error }))
            )
          : Effect.succeed(output)
    }
  },

  /**
   * Performance monitoring for Schema validation
   */
  createPerformanceMonitor: () => {
    const metrics = {
      validationCount: 0,
      totalTime: 0,
      timeouts: 0,
      errors: 0
    }

    return {
      /**
       * Wrap validator with performance monitoring
       */
      monitor: <A, I>(
        schema: Schema.Schema<A, I>,
        name: string
      ) => {
        const validator = SchemaOptimization.createOptimizedValidator(schema)

        return {
          validate: (input: unknown): Effect.Effect<A, Schema.ParseError> =>
            pipe(
              Effect.sync(() => performance.now()),
              Effect.flatMap((start) =>
                pipe(
                  validator.validate(input),
                  Effect.tap(() =>
                    Effect.sync(() => {
                      const end = performance.now()
                      metrics.validationCount++
                      metrics.totalTime += (end - start)
                    })
                  ),
                  Effect.tapError(() =>
                    Effect.sync(() => {
                      metrics.errors++
                    })
                  )
                )
              )
            ),

          getMetrics: (): Effect.Effect<{
            name: string
            validationCount: number
            averageTime: number
            totalTime: number
            timeouts: number
            errors: number
            errorRate: number
          }, never> =>
            Effect.sync(() => ({
              name,
              validationCount: metrics.validationCount,
              averageTime: metrics.validationCount > 0 ? metrics.totalTime / metrics.validationCount : 0,
              totalTime: metrics.totalTime,
              timeouts: metrics.timeouts,
              errors: metrics.errors,
              errorRate: metrics.validationCount > 0 ? metrics.errors / metrics.validationCount : 0
            })),

          resetMetrics: (): Effect.Effect<void, never> =>
            Effect.sync(() => {
              metrics.validationCount = 0
              metrics.totalTime = 0
              metrics.timeouts = 0
              metrics.errors = 0
            })
        }
      }
    }
  },

  /**
   * Selective validation based on data freshness
   */
  createCacheAwareValidator: <A, I>(schema: Schema.Schema<A, I>) => {
    const cache = new Map<string, { data: A; timestamp: number; ttl: number }>()
    const validator = SchemaOptimization.createOptimizedValidator(schema)

    return {
      /**
       * Validate with caching based on TTL
       */
      validateWithCache: (
        input: unknown,
        cacheKey: string,
        ttlMs: number = 5000
      ): Effect.Effect<A, Schema.ParseError> => {
        const now = Date.now()
        const cached = cache.get(cacheKey)

        if (cached && (now - cached.timestamp) < cached.ttl) {
          return Effect.succeed(cached.data)
        }

        return pipe(
          validator.validate(input),
          Effect.tap((result) =>
            Effect.sync(() => {
              cache.set(cacheKey, {
                data: result,
                timestamp: now,
                ttl: ttlMs
              })
            })
          )
        )
      },

      /**
       * Force revalidation and update cache
       */
      revalidate: (
        input: unknown,
        cacheKey: string,
        ttlMs: number = 5000
      ): Effect.Effect<A, Schema.ParseError> =>
        pipe(
          validator.validate(input),
          Effect.tap((result) =>
            Effect.sync(() => {
              cache.set(cacheKey, {
                data: result,
                timestamp: Date.now(),
                ttl: ttlMs
              })
            })
          )
        ),

      /**
       * Clear expired cache entries
       */
      cleanupCache: (): Effect.Effect<number, never> =>
        Effect.sync(() => {
          const now = Date.now()
          let cleaned = 0

          for (const [key, value] of cache.entries()) {
            if ((now - value.timestamp) >= value.ttl) {
              cache.delete(key)
              cleaned++
            }
          }

          return cleaned
        })
    }
  }
}

/**
 * Pre-configured optimizers for common scenarios
 */
export const OptimizedValidators = {
  /**
   * For game entities (high frequency, performance critical)
   */
  gameEntity: <A, I>(schema: Schema.Schema<A, I>) =>
    SchemaOptimization.createGameLoopValidator(schema),

  /**
   * For service boundaries (strict validation)
   */
  serviceBoundary: <A, I>(schema: Schema.Schema<A, I>) =>
    SchemaOptimization.createBoundaryValidator(schema),

  /**
   * For configuration (validate once, cache indefinitely)
   */
  configuration: <A, I>(schema: Schema.Schema<A, I>) =>
    SchemaOptimization.createCacheAwareValidator(schema),

  /**
   * For user input (strict with detailed errors)
   */
  userInput: <A, I>(schema: Schema.Schema<A, I>) =>
    SchemaOptimization.createOptimizedValidator(schema, 'strict'),

  /**
   * For internal data (development validation only)
   */
  internal: <A, I>(schema: Schema.Schema<A, I>) =>
    SchemaOptimization.createOptimizedValidator(schema, 'development')
}