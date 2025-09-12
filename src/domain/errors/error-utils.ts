/**
 * Error utilities and helper functions for functional error handling
 * Updated to support Schema.TaggedError approach with Effect-TS
 */

import type { BaseErrorData, RecoveryStrategy } from '@domain/errors/generator'
import { Schema } from 'effect'
import * as Effect from 'effect/Effect'

// Import ErrorAggregator locally to avoid circular dependency
import { ErrorAggregator as _ErrorAggregator } from '@domain/errors/generator'
import { getErrorSeverity as _getErrorSeverity } from '@domain/errors/unified-errors'

// Schema-based error type that's compatible with the new functional approach
export type SchemaTaggedError<Tag extends string, Data> = Schema.Schema.Type<Schema.Schema<{ readonly _tag: Tag } & Data, { readonly _tag: Tag } & Data, never>>

// Updated comprehensive type union for all errors using Schema.TaggedError
export type AllGameErrors = 
  | import('@domain/errors/unified-errors').EntityNotFoundError
  | import('@domain/errors/unified-errors').EntityAlreadyExistsError
  | import('@domain/errors/unified-errors').EntityCreationError
  | import('@domain/errors/unified-errors').EntityDestructionError
  | import('@domain/errors/unified-errors').EntityLimitExceededError
  | import('@domain/errors/unified-errors').InvalidEntityStateError
  | import('@domain/errors/unified-errors').ComponentNotFoundError
  | import('@domain/errors/unified-errors').ComponentAlreadyExistsError
  | import('@domain/errors/unified-errors').InvalidComponentDataError
  | import('@domain/errors/unified-errors').ComponentTypeMismatchError
  | import('@domain/errors/unified-errors').ChunkNotLoadedError
  | import('@domain/errors/unified-errors').ChunkGenerationError
  | import('@domain/errors/unified-errors').InvalidPositionError
  | import('@domain/errors/unified-errors').BlockNotFoundError
  | import('@domain/errors/unified-errors').WorldStateError
  | import('@domain/errors/unified-errors').CollisionDetectionError
  | import('@domain/errors/unified-errors').PhysicsSimulationError
  | import('@domain/errors/unified-errors').RaycastError
  | import('@domain/errors/unified-errors').RigidBodyError
  | import('@domain/errors/unified-errors').GravityError
  | import('@domain/errors/unified-errors').ConstraintViolationError
  | import('@domain/errors/unified-errors').PhysicsMaterialError
  | import('@domain/errors/unified-errors').VelocityLimitError
  | import('@domain/errors/unified-errors').CollisionShapeError
  | import('@domain/errors/unified-errors').PhysicsEngineError
  | import('@domain/errors/unified-errors').SystemExecutionError
  | import('@domain/errors/unified-errors').QueryExecutionError
  | import('@domain/errors/unified-errors').SystemInitializationError
  | import('@domain/errors/unified-errors').ResourceNotFoundError
  | import('@domain/errors/unified-errors').ResourceLoadError
  | import('@domain/errors/unified-errors').ValidationError
  | import('@domain/errors/unified-errors').MeshGenerationError
  | import('@domain/errors/unified-errors').MeshOptimizationError
  | import('@domain/errors/unified-errors').TerrainGenerationError
  | import('@domain/errors/unified-errors').NoiseGenerationError
  | import('@domain/errors/unified-errors').AdapterInitializationError
  | import('@domain/errors/unified-errors').ExternalLibraryError

/**
 * Global error aggregator state - functional approach
 * Use this for collecting and reporting errors across the application
 */
export const globalErrorAggregator = _ErrorAggregator.empty()

/**
 * Utility function to determine if an error is recoverable based on error tag
 */
export function isRecoverableError(error: AllGameErrors): boolean {
  // Use the imported getErrorSeverity function to determine recoverability
  const severity = _getErrorSeverity(error)
  return severity !== 'critical'
}

/**
 * Utility function to get error severity level using the unified error system
 */
export function getErrorSeverity(error: AllGameErrors): 'low' | 'medium' | 'high' | 'critical' {
  return _getErrorSeverity(error)
}

/**
 * Utility function to check if error is critical
 */
export function isCriticalError(error: AllGameErrors): boolean {
  return getErrorSeverity(error) === 'critical'
}

/**
 * Create a typed error handler for specific error types using type guards
 * Updated for Schema.TaggedError approach
 */
export function createTypedErrorHandler<T extends AllGameErrors>(
  errorType: string, 
  handler: (error: T) => Effect.Effect<void, never>,
  isErrorType: (error: AllGameErrors) => error is T
): (error: AllGameErrors) => Effect.Effect<void, never> {
  return (error: AllGameErrors) => {
    // Use type guard instead of type assertion
    if (error._tag === errorType && isErrorType(error)) {
      return handler(error)
    }
    return Effect.void
  }
}

/**
 * Enhanced error reporting with structured output
 */
export function generateDetailedErrorReport(): {
  timestamp: string
  totalErrors: number
  errorBreakdown: Record<string, number>
  severityBreakdown: Record<string, number>
  recoverabilityStats: {
    recoverable: number
    nonRecoverable: number
  }
  criticalErrors: Array<{
    type: string
    message: string
    timestamp: string
  }>
} {
  const report = _ErrorAggregator.generateReport(globalErrorAggregator)
  const errors = _ErrorAggregator.getErrors(globalErrorAggregator)

  const recoverabilityStats = {
    recoverable: errors.filter((e) => {
      if ('_tag' in e && typeof e._tag === 'string') {
        return isRecoverableError(e as AllGameErrors)
      }
      return false
    }).length,
    nonRecoverable: errors.filter((e) => {
      if ('_tag' in e && typeof e._tag === 'string') {
        return !isRecoverableError(e as AllGameErrors)
      }
      return true
    }).length,
  }

  const criticalErrors = report.criticalErrors.map((error) => ({
    type: error._tag,
    message: error.message,
    timestamp: error.context.timestamp.toISOString(),
  }))

  return {
    timestamp: new Date().toISOString(),
    totalErrors: report.totalErrors,
    errorBreakdown: report.errorsByType,
    severityBreakdown: report.errorsBySeverity,
    recoverabilityStats,
    criticalErrors,
  }
}

// Export additional types for external use
export type ErrorPatternMatcher = (error: AllGameErrors) => boolean
export type ErrorRecoveryStrategy = (error: AllGameErrors) => Effect.Effect<unknown, never>
export type ErrorAnalysisResult = ReturnType<typeof generateDetailedErrorReport>
export type ErrorReport = ErrorAnalysisResult
export type ValidationResult<T> = Effect.Effect<T, AllGameErrors, never>
