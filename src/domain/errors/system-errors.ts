import { defineError } from '@domain/errors/generator'
import { SystemError } from '@domain/errors/base-errors'
import * as S from '@effect/schema/Schema'
import * as Effect from 'effect/Effect'

// Schema definitions for unknown type validation
const ErrorSchema = S.Union(S.InstanceOf(Error), S.String, S.Unknown)
const ConfigurationSchema = S.Record(S.String, S.Unknown)
const InvalidResultsSchema = S.Array(S.Unknown)

// Validation utilities for system errors
export const SystemErrorValidation = {
  validateError: (error: unknown): Effect.Effect<{ message: string; stack?: string; type: string }, never, never> => {
    if (error instanceof Error) {
      return Effect.succeed({ message: error.message, stack: error.stack, type: error.constructor.name })
    }
    if (typeof error === 'string') {
      return Effect.succeed({ message: error, type: 'string' })
    }
    if (typeof error === 'object' && error !== null && '_tag' in error) {
      return Effect.succeed({ message: `Tagged Error: ${(error as any)._tag}`, type: (error as any)._tag })
    }
    return Effect.succeed({ message: String(error), type: typeof error })
  },

  validateConfiguration: (config: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
    if (config == null) return Effect.succeed({})
    if (typeof config === 'object' && !Array.isArray(config)) {
      return Effect.succeed(config as Record<string, unknown>)
    }
    return Effect.succeed({ value: config, type: typeof config })
  },

  validateInvalidResults: (results: unknown[]): Effect.Effect<Array<{ value: unknown; type: string; isValid: boolean }>, never, never> => {
    return Effect.succeed(
      results.map((result) => ({
        value: result,
        type: typeof result,
        isValid: false,
      })),
    )
  },
}

/**
 * ECS system execution failed
 * Recovery: Skip system execution or retry with fallback
 */
export const SystemExecutionError = defineError<{
  readonly systemName: string
  readonly executionStage: 'initialization' | 'update' | 'cleanup'
  readonly error: unknown
  readonly entityCount?: number
}>('SystemExecutionError', SystemError, 'retry', 'high')

// Enhanced constructor with validation
export const createSystemExecutionError = (systemName: string, executionStage: 'initialization' | 'update' | 'cleanup', error: unknown, entityCount?: number) =>
  Effect.gen(function* () {
    const validatedError = yield* SystemErrorValidation.validateError(error)
    return SystemExecutionError({
      systemName,
      executionStage,
      error: validatedError,
      entityCount,
    })
  })

/**
 * System is in invalid state
 * Recovery: Reset system state or disable system
 */
export const InvalidSystemStateError = defineError<{
  readonly systemName: string
  readonly reason: string
  readonly expectedState?: string
  readonly currentState?: string
}>('InvalidSystemStateError', SystemError, 'fallback', 'medium')

/**
 * System initialization failed
 * Recovery: Use default configuration or disable system
 */
export const SystemInitializationError = defineError<{
  readonly systemName: string
  readonly reason: string
  readonly configuration?: Record<string, unknown>
  readonly dependencies?: string[]
}>('SystemInitializationError', SystemError, 'fallback', 'high')

// Enhanced constructor with validation
export const createSystemInitializationError = (systemName: string, reason: string, configuration?: unknown, dependencies?: string[]) =>
  Effect.gen(function* () {
    const validatedConfig = configuration ? yield* SystemErrorValidation.validateConfiguration(configuration) : undefined
    return SystemInitializationError({
      systemName,
      reason,
      configuration: validatedConfig,
      dependencies,
    })
  })

/**
 * System dependency not satisfied
 * Recovery: Load missing dependency or disable dependent system
 */
export const SystemDependencyError = defineError<{
  readonly systemName: string
  readonly missingDependencies: string[]
  readonly availableSystems: string[]
}>('SystemDependencyError', SystemError, 'fallback', 'high')

/**
 * System performance degradation detected
 * Recovery: Optimize system or reduce processing frequency
 */
export const SystemPerformanceError = defineError<{
  readonly systemName: string
  readonly executionTime: number
  readonly maxAllowedTime: number
  readonly entityCount: number
}>('SystemPerformanceError', SystemError, 'ignore', 'medium')

/**
 * Query execution failed
 * Recovery: Return empty result or use cached result
 */
export const QueryExecutionError = defineError<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly error: unknown
  readonly entityCount?: number
}>('QueryExecutionError', SystemError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createQueryExecutionError = (queryName: string, components: ReadonlyArray<string>, error: unknown, entityCount?: number) =>
  Effect.gen(function* () {
    const validatedError = yield* SystemErrorValidation.validateError(error)
    return QueryExecutionError({
      queryName,
      components,
      error: validatedError,
      entityCount,
    })
  })

/**
 * Query returned no results when results were expected
 * Recovery: Use fallback entities or skip operation
 */
export const EmptyQueryResultError = defineError<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly expectedMinResults?: number
  readonly actualResults: 0
}>('EmptyQueryResultError', SystemError, 'fallback', 'low')

/**
 * Query result validation failed
 * Recovery: Filter invalid results or use default entities
 */
export const QueryValidationError = defineError<{
  readonly queryName: string
  readonly invalidResults: unknown[]
  readonly validationRules: string[]
  readonly totalResults: number
}>('QueryValidationError', SystemError, 'fallback', 'medium')

// Enhanced constructor with validation
export const createQueryValidationError = (queryName: string, invalidResults: unknown[], validationRules: string[], totalResults: number) =>
  Effect.gen(function* () {
    const validatedResults = yield* SystemErrorValidation.validateInvalidResults(invalidResults)
    return QueryValidationError({
      queryName,
      invalidResults: validatedResults,
      validationRules,
      totalResults,
    })
  })

/**
 * System scheduler error
 * Recovery: Use alternative scheduling or disable scheduling
 */
export const SystemSchedulerError = defineError<{
  readonly schedulerType: 'parallel' | 'sequential' | 'priority'
  readonly affectedSystems: string[]
  readonly reason: string
}>('SystemSchedulerError', SystemError, 'fallback', 'high')
