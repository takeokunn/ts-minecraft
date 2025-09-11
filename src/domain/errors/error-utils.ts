/**
 * Error utilities and helper functions
 */

import type { BaseErrorData, RecoveryStrategy } from '@domain/errors/generator'

// Import ErrorAggregator locally to avoid circular dependency
import { ErrorAggregator as _ErrorAggregator } from '@domain/errors/generator'

// Base type for our error interface
type TaggedError<Tag extends string, Value> = {
  readonly _tag: Tag
} & Value

// Comprehensive type union for all errors in the system
export type AllGameErrors = TaggedError<string, BaseErrorData> & {
  getRecoveryStrategy(): RecoveryStrategy
  getSeverity(): import('./generator').ErrorContext['severity']
  createRecoveryHandler<T>(fallbackValue?: T): (error: TaggedError<string, BaseErrorData>) => T | never
  log(): void
}

/**
 * Global error aggregator instance
 * Use this for collecting and reporting errors across the application
 */
export const globalErrorAggregator = new _ErrorAggregator()

/**
 * Utility function to determine if an error is recoverable
 */
export function isRecoverableError(error: AllGameErrors): boolean {
  return error.getRecoveryStrategy() !== 'terminate'
}

/**
 * Utility function to get error severity level
 */
export function getErrorSeverity(error: AllGameErrors): import('./generator').ErrorContext['severity'] {
  return error.getSeverity()
}

/**
 * Utility function to check if error is critical
 */
export function isCriticalError(error: AllGameErrors): boolean {
  return error.getSeverity() === 'critical'
}

/**
 * Create a typed error handler for specific error types
 */
export function createTypedErrorHandler<T extends AllGameErrors>(errorType: string, handler: (error: T) => void) {
  return (error: AllGameErrors) => {
    if (error._tag === errorType) {
      handler(error as T)
    }
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
  const report = globalErrorAggregator.generateReport()
  const errors = globalErrorAggregator.getErrors()

  const recoverabilityStats = {
    recoverable: errors.filter((e: any) => isRecoverableError(e)).length,
    nonRecoverable: errors.filter((e: any) => !isRecoverableError(e)).length,
  }

  const criticalErrors = report.criticalErrors.map((error: any) => ({
    type: error._tag,
    message: JSON.stringify(error),
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