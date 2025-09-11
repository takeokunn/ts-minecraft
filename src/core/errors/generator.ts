import { Data } from 'effect'

/**
 * Error recovery strategy types
 */
export type RecoveryStrategy = 
  | 'retry'           // Retry the operation
  | 'fallback'        // Use fallback value/behavior
  | 'ignore'          // Log and continue
  | 'terminate'       // Stop execution
  | 'user-prompt'     // Prompt user for action

/**
 * Structured logging context for errors
 */
export interface ErrorContext {
  readonly timestamp: Date
  readonly stackTrace?: string
  readonly metadata?: Record<string, unknown>
  readonly recoveryStrategy: RecoveryStrategy
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Base error interface that all generated errors implement
 */
export interface BaseErrorData {
  readonly context: ErrorContext
}

/**
 * Error class constructor type
 */
export type ErrorConstructor<TData extends BaseErrorData> = new (
  data: Omit<TData, 'context'>,
  options?: Partial<Pick<ErrorContext, 'recoveryStrategy' | 'severity' | 'metadata'>>
) => Data.TaggedError<string, TData>

/**
 * Parent error class type constraint
 */
export type ParentErrorClass = new (...args: any[]) => Data.TaggedError<string, any>

/**
 * Enhanced error logging function
 */
export function logError(error: Data.TaggedError<string, BaseErrorData>): void {
  const { context } = error
  console.error({
    type: error._tag,
    message: JSON.stringify(error),
    timestamp: context.timestamp.toISOString(),
    stackTrace: context.stackTrace || new Error().stack,
    metadata: context.metadata,
    recoveryStrategy: context.recoveryStrategy,
    severity: context.severity,
  })
}

/**
 * Creates an error recovery handler
 */
export function createRecoveryHandler<T>(
  strategy: RecoveryStrategy,
  fallbackValue?: T
): (error: Data.TaggedError<string, BaseErrorData>) => T | never {
  return (error) => {
    logError(error)
    
    switch (strategy) {
      case 'ignore':
        if (fallbackValue !== undefined) return fallbackValue
        throw new Error('Fallback value required for ignore strategy')
      
      case 'fallback':
        if (fallbackValue !== undefined) return fallbackValue
        throw new Error('Fallback value required for fallback strategy')
      
      case 'terminate':
        process.exit(1)
      
      case 'retry':
        // Caller should handle retry logic
        throw error
      
      case 'user-prompt':
        // Caller should handle user interaction
        throw error
      
      default:
        throw error
    }
  }
}

/**
 * Define a new error class with automatic context injection and hierarchy support
 */
export function defineError<TData extends Record<string, unknown>>(
  name: string,
  ParentClass?: ParentErrorClass,
  defaultRecoveryStrategy: RecoveryStrategy = 'terminate',
  defaultSeverity: ErrorContext['severity'] = 'medium'
): ErrorConstructor<TData & BaseErrorData> {
  class GeneratedError extends Data.TaggedError(name)<TData & BaseErrorData> {
    constructor(
      data: TData,
      options: Partial<Pick<ErrorContext, 'recoveryStrategy' | 'severity' | 'metadata'>> = {}
    ) {
      const context: ErrorContext = {
        timestamp: new Date(),
        stackTrace: new Error().stack,
        recoveryStrategy: options.recoveryStrategy || defaultRecoveryStrategy,
        severity: options.severity || defaultSeverity,
        metadata: options.metadata
      }

      super({ ...data, context } as TData & BaseErrorData)
    }

    /**
     * Get recovery strategy for this error
     */
    getRecoveryStrategy(): RecoveryStrategy {
      return this.context.recoveryStrategy
    }

    /**
     * Get severity level
     */
    getSeverity(): ErrorContext['severity'] {
      return this.context.severity
    }

    /**
     * Create a recovery handler for this error
     */
    createRecoveryHandler<T>(fallbackValue?: T) {
      return createRecoveryHandler(this.getRecoveryStrategy(), fallbackValue)
    }

    /**
     * Log this error with structured format
     */
    log(): void {
      logError(this)
    }
  }

  // If parent class provided, set up inheritance
  if (ParentClass) {
    Object.setPrototypeOf(GeneratedError.prototype, ParentClass.prototype)
  }

  return GeneratedError as ErrorConstructor<TData & BaseErrorData>
}

/**
 * Error aggregation for batch error handling
 */
export class ErrorAggregator {
  private errors: Array<Data.TaggedError<string, BaseErrorData>> = []

  add(error: Data.TaggedError<string, BaseErrorData>): void {
    this.errors.push(error)
  }

  getErrors(): ReadonlyArray<Data.TaggedError<string, BaseErrorData>> {
    return this.errors
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  getErrorsByType<T extends Data.TaggedError<string, BaseErrorData>>(
    type: string
  ): T[] {
    return this.errors.filter(error => error._tag === type) as T[]
  }

  getBySeverity(severity: ErrorContext['severity']): Array<Data.TaggedError<string, BaseErrorData>> {
    return this.errors.filter(error => error.context.severity === severity)
  }

  logAll(): void {
    this.errors.forEach(logError)
  }

  clear(): void {
    this.errors = []
  }

  /**
   * Generate error report
   */
  generateReport(): {
    totalErrors: number
    errorsBySeverity: Record<ErrorContext['severity'], number>
    errorsByType: Record<string, number>
    criticalErrors: Array<Data.TaggedError<string, BaseErrorData>>
  } {
    const errorsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    const errorsByType: Record<string, number> = {}
    const criticalErrors: Array<Data.TaggedError<string, BaseErrorData>> = []

    this.errors.forEach(error => {
      errorsBySeverity[error.context.severity]++
      errorsByType[error._tag] = (errorsByType[error._tag] || 0) + 1
      
      if (error.context.severity === 'critical') {
        criticalErrors.push(error)
      }
    })

    return {
      totalErrors: this.errors.length,
      errorsBySeverity,
      errorsByType,
      criticalErrors
    }
  }
}