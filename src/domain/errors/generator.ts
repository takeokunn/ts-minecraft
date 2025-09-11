import { Effect, Schema } from 'effect'

/**
 * Error recovery strategy types
 */
export type RecoveryStrategy =
  | 'retry' // Retry the operation
  | 'fallback' // Use fallback value/behavior
  | 'ignore' // Log and continue
  | 'terminate' // Stop execution
  | 'user-prompt' // Prompt user for action

/**
 * Structured logging context for errors
 */
export const ErrorContext = Schema.Struct({
  timestamp: Schema.DateFromSelf,
  stackTrace: Schema.String,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  recoveryStrategy: Schema.Literal('retry', 'fallback', 'ignore', 'terminate', 'user-prompt'),
  severity: Schema.Literal('low', 'medium', 'high', 'critical'),
})
export type ErrorContext = Schema.Schema.Type<typeof ErrorContext>

/**
 * Base error interface that all domain errors extend
 */
export const BaseErrorData = Schema.Struct({
  message: Schema.String,
  context: ErrorContext,
})
export type BaseErrorData = Schema.Schema.Type<typeof BaseErrorData>

/**
 * Create error context with defaults
 */
export const createErrorContext = (
  recoveryStrategy: RecoveryStrategy = 'terminate',
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  metadata?: Record<string, unknown>,
): ErrorContext => ({
  timestamp: new Date(),
  stackTrace: new Error().stack || '',
  recoveryStrategy,
  severity,
  metadata,
})

/**
 * Enhanced error logging function - pure functional approach
 */
export const logError = (error: { _tag: string } & BaseErrorData): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const { context } = error
    console.error({
      type: error._tag,
      message: error.message,
      timestamp: context.timestamp.toISOString(),
      stackTrace: context.stackTrace,
      metadata: context.metadata,
      recoveryStrategy: context.recoveryStrategy,
      severity: context.severity,
    })
  })

/**
 * Creates an error recovery handler - functional approach
 */
export const createRecoveryHandler = <T, E extends { _tag: string } & BaseErrorData>(
  strategy: RecoveryStrategy,
  fallbackValue?: T,
): ((error: E) => Effect.Effect<T, E, never>) =>
  (error: E) =>
    Effect.gen(function* () {
      yield* logError(error)

      switch (strategy) {
        case 'ignore':
          if (fallbackValue !== undefined) return fallbackValue
          return yield* Effect.fail(error)

        case 'fallback':
          if (fallbackValue !== undefined) return fallbackValue
          return yield* Effect.fail(error)

        case 'terminate':
          return yield* Effect.die('Process terminated due to critical error')

        case 'retry':
          // Caller should handle retry logic
          return yield* Effect.fail(error)

        case 'user-prompt':
          // Caller should handle user interaction
          return yield* Effect.fail(error)

        default:
          return yield* Effect.fail(error)
      }
    })

/**
 * Create a tagged error using Schema.TaggedError - pure functional approach
 */
export const createTaggedError = <Tag extends string, Data extends BaseErrorData>(
  tag: Tag,
  schema: Schema.Schema<Data, any, never>,
) => Schema.TaggedError(tag)<Data>(schema)

/**
 * Error aggregation state type
 */
export interface ErrorAggregatorState {
  readonly errors: ReadonlyArray<{ _tag: string } & BaseErrorData>
}

/**
 * Functional error aggregation utilities
 */
export const ErrorAggregator = {
  /**
   * Create empty error aggregator state
   */
  empty: (): ErrorAggregatorState => ({
    errors: [],
  }),

  /**
   * Create error aggregator with initial errors
   */
  create: (initialErrors: ReadonlyArray<{ _tag: string } & BaseErrorData> = []): ErrorAggregatorState => ({
    errors: [...initialErrors],
  }),

  /**
   * Add error to aggregator state
   */
  add: (state: ErrorAggregatorState, error: { _tag: string } & BaseErrorData): ErrorAggregatorState => ({
    ...state,
    errors: [...state.errors, error],
  }),

  /**
   * Get all errors from state
   */
  getErrors: (state: ErrorAggregatorState): ReadonlyArray<{ _tag: string } & BaseErrorData> => state.errors,

  /**
   * Check if state has errors
   */
  hasErrors: (state: ErrorAggregatorState): boolean => state.errors.length > 0,

  /**
   * Get errors by type
   */
  getErrorsByType: <T extends { _tag: string } & BaseErrorData>(
    state: ErrorAggregatorState,
    type: string,
  ): readonly T[] => state.errors.filter((error) => error._tag === type) as T[],

  /**
   * Get errors by severity
   */
  getBySeverity: (
    state: ErrorAggregatorState,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ): ReadonlyArray<{ _tag: string } & BaseErrorData> =>
    state.errors.filter((error) => error.context.severity === severity),

  /**
   * Log all errors in state
   */
  logAll: (state: ErrorAggregatorState): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      for (const error of state.errors) {
        yield* logError(error)
      }
    }),

  /**
   * Clear all errors from state
   */
  clear: (): ErrorAggregatorState => ({
    errors: [],
  }),

  /**
   * Generate error report from state
   */
  generateReport: (state: ErrorAggregatorState) => {
    const errorsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    const errorsByType: Record<string, number> = {}
    const criticalErrors: Array<{ _tag: string } & BaseErrorData> = []

    state.errors.forEach((error) => {
      errorsBySeverity[error.context.severity]++
      errorsByType[error._tag] = (errorsByType[error._tag] || 0) + 1

      if (error.context.severity === 'critical') {
        criticalErrors.push(error)
      }
    })

    return {
      totalErrors: state.errors.length,
      errorsBySeverity,
      errorsByType,
      criticalErrors,
    }
  },
}
