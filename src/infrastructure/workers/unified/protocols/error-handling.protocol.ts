import * as S from 'effect/Schema'

/**
 * Unified Error Handling Protocol
 * Standardized error types and handling across all worker types
 */

// ============================================
// Base Error Types
// ============================================

/**
 * Error severity levels
 */
export const ErrorSeverity = S.Union(S.Literal('low'), S.Literal('medium'), S.Literal('high'), S.Literal('critical')).pipe(S.identifier('ErrorSeverity'))
export type ErrorSeverity = S.Schema.Type<typeof ErrorSeverity>

/**
 * Error category enumeration
 */
export const ErrorCategory = S.Union(
  S.Literal('validation'),
  S.Literal('computation'),
  S.Literal('memory'),
  S.Literal('timeout'),
  S.Literal('network'),
  S.Literal('resource'),
  S.Literal('configuration'),
  S.Literal('system'),
  S.Literal('user'),
  S.Literal('unknown'),
).pipe(S.identifier('ErrorCategory'))
export type ErrorCategory = S.Schema.Type<typeof ErrorCategory>

/**
 * Error recovery strategy
 */
export const RecoveryStrategy = S.Union(S.Literal('retry'), S.Literal('fallback'), S.Literal('ignore'), S.Literal('abort'), S.Literal('escalate'), S.Literal('manual')).pipe(
  S.identifier('RecoveryStrategy'),
)
export type RecoveryStrategy = S.Schema.Type<typeof RecoveryStrategy>

/**
 * Base worker error structure
 */
export const WorkerError = S.Struct({
  // Error identification
  code: S.String,
  message: S.String,
  category: ErrorCategory,
  severity: ErrorSeverity,

  // Context information
  workerId: S.optional(S.String),
  workerType: S.optional(S.String),
  requestId: S.optional(S.String),
  timestamp: S.Number.pipe(S.positive),

  // Error details
  details: S.optional(
    S.Record({
      key: S.String,
      value: S.Union(S.String, S.Number, S.Boolean, S.Unknown),
    }),
  ),

  // Stack trace and debugging
  stackTrace: S.optional(S.String),
  innerError: S.optional(S.Unknown), // Nested error

  // Recovery information
  recoveryStrategy: S.optional(RecoveryStrategy),
  retryable: S.Boolean,
  maxRetries: S.optional(S.Number.pipe(S.int(), S.nonNegative)),

  // Metrics
  occurredAt: S.Number.pipe(S.positive),
  processingTime: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('WorkerError'))
export type WorkerError = S.Schema.Type<typeof WorkerError>

// ============================================
// Specific Error Types
// ============================================

/**
 * Validation errors for input/output data
 */
export const ValidationError = S.Struct({
  ...WorkerError.fields,
  category: S.Literal('validation'),
  validationErrors: S.Array(
    S.Struct({
      field: S.String,
      expected: S.String,
      actual: S.String,
      message: S.String,
    }),
  ),
}).pipe(S.identifier('ValidationError'))
export type ValidationError = S.Schema.Type<typeof ValidationError>

/**
 * Computation errors during processing
 */
export const ComputationError = S.Struct({
  ...WorkerError.fields,
  category: S.Literal('computation'),
  algorithm: S.optional(S.String),
  stage: S.optional(S.String),
  progress: S.optional(S.Number.pipe(S.between(0, 100))),
  partialResults: S.optional(S.Unknown),
}).pipe(S.identifier('ComputationError'))
export type ComputationError = S.Schema.Type<typeof ComputationError>

/**
 * Memory-related errors
 */
export const MemoryError = S.Struct({
  ...WorkerError.fields,
  category: S.Literal('memory'),
  allocatedMemory: S.optional(S.Number.pipe(S.positive)),
  requestedMemory: S.optional(S.Number.pipe(S.positive)),
  availableMemory: S.optional(S.Number.pipe(S.positive)),
  memoryType: S.optional(S.Union(S.Literal('heap'), S.Literal('stack'), S.Literal('gpu'), S.Literal('shared'))),
}).pipe(S.identifier('MemoryError'))
export type MemoryError = S.Schema.Type<typeof MemoryError>

/**
 * Timeout errors
 */
export const TimeoutError = S.Struct({
  ...WorkerError.fields,
  category: S.Literal('timeout'),
  timeoutDuration: S.Number.pipe(S.positive),
  elapsedTime: S.Number.pipe(S.positive),
  operation: S.optional(S.String),
}).pipe(S.identifier('TimeoutError'))
export type TimeoutError = S.Schema.Type<typeof TimeoutError>

/**
 * Resource access errors
 */
export const ResourceError = S.Struct({
  ...WorkerError.fields,
  category: S.Literal('resource'),
  resourceType: S.Union(S.Literal('file'), S.Literal('network'), S.Literal('gpu'), S.Literal('cpu'), S.Literal('disk')),
  resourceId: S.optional(S.String),
  resourcePath: S.optional(S.String),
}).pipe(S.identifier('ResourceError'))
export type ResourceError = S.Schema.Type<typeof ResourceError>

// ============================================
// Error Context and Metadata
// ============================================

/**
 * Error context for better debugging
 */
export const ErrorContext = S.Struct({
  // Worker context
  workerId: S.String,
  workerType: S.String,
  workerVersion: S.optional(S.String),

  // Request context
  requestId: S.String,
  requestType: S.String,
  requestData: S.optional(S.Unknown),

  // System context
  platform: S.optional(S.String),
  userAgent: S.optional(S.String),
  memoryUsage: S.optional(S.Number.pipe(S.positive)),
  cpuUsage: S.optional(S.Number.pipe(S.between(0, 100))),

  // Performance context
  startTime: S.Number.pipe(S.positive),
  duration: S.optional(S.Number.pipe(S.positive)),

  // Additional metadata
  tags: S.optional(S.Array(S.String)),
  custom: S.optional(
    S.Record({
      key: S.String,
      value: S.Union(S.String, S.Number, S.Boolean),
    }),
  ),
}).pipe(S.identifier('ErrorContext'))
export type ErrorContext = S.Schema.Type<typeof ErrorContext>

/**
 * Error metrics for monitoring
 */
export const ErrorMetrics = S.Struct({
  errorCount: S.Number.pipe(S.int(), S.nonNegative),
  errorRate: S.Number.pipe(S.between(0, 1)),
  averageRecoveryTime: S.optional(S.Number.pipe(S.positive)),
  successfulRetries: S.Number.pipe(S.int(), S.nonNegative),
  failedRetries: S.Number.pipe(S.int(), S.nonNegative),

  // Error distribution
  errorsByCategory: S.Record({
    key: ErrorCategory,
    value: S.Number.pipe(S.int(), S.nonNegative),
  }),
  errorsBySeverity: S.Record({
    key: ErrorSeverity,
    value: S.Number.pipe(S.int(), S.nonNegative),
  }),

  // Time-based metrics
  firstOccurrence: S.Number.pipe(S.positive),
  lastOccurrence: S.Number.pipe(S.positive),

  // Resolution metrics
  resolvedErrors: S.Number.pipe(S.int(), S.nonNegative),
  unresolvedErrors: S.Number.pipe(S.int(), S.nonNegative),
}).pipe(S.identifier('ErrorMetrics'))
export type ErrorMetrics = S.Schema.Type<typeof ErrorMetrics>

// ============================================
// Error Handling Strategies
// ============================================

/**
 * Retry configuration
 */
export const RetryConfig = S.Struct({
  maxRetries: S.Number.pipe(S.int(), S.positive),
  initialDelay: S.Number.pipe(S.positive),
  maxDelay: S.Number.pipe(S.positive),
  backoffStrategy: S.Union(S.Literal('linear'), S.Literal('exponential'), S.Literal('fixed')),
  backoffFactor: S.optional(S.Number.pipe(S.positive)),
  jitter: S.optional(S.Boolean),
}).pipe(S.identifier('RetryConfig'))
export type RetryConfig = S.Schema.Type<typeof RetryConfig>

/**
 * Fallback configuration
 */
export const FallbackConfig = S.Struct({
  fallbackType: S.Union(S.Literal('cached_result'), S.Literal('default_value'), S.Literal('alternative_worker'), S.Literal('simplified_computation')),
  fallbackValue: S.optional(S.Unknown),
  fallbackWorkerId: S.optional(S.String),
  timeout: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('FallbackConfig'))
export type FallbackConfig = S.Schema.Type<typeof FallbackConfig>

/**
 * Circuit breaker configuration
 */
export const CircuitBreakerConfig = S.Struct({
  failureThreshold: S.Number.pipe(S.int(), S.positive),
  timeWindow: S.Number.pipe(S.positive),
  openTimeWindow: S.Number.pipe(S.positive),
  halfOpenMaxCalls: S.Number.pipe(S.int(), S.positive),
}).pipe(S.identifier('CircuitBreakerConfig'))
export type CircuitBreakerConfig = S.Schema.Type<typeof CircuitBreakerConfig>

/**
 * Complete error handling configuration
 */
export const ErrorHandlingConfig = S.Struct({
  enableLogging: S.Boolean,
  enableMetrics: S.Boolean,
  enableNotifications: S.Boolean,

  // Strategy configurations
  retryConfig: S.optional(RetryConfig),
  fallbackConfig: S.optional(FallbackConfig),
  circuitBreakerConfig: S.optional(CircuitBreakerConfig),

  // Escalation rules
  escalationThreshold: S.optional(S.Number.pipe(S.int(), S.positive)),
  escalationTarget: S.optional(S.String), // Email, webhook, etc.

  // Filtering
  ignoredErrors: S.optional(S.Array(S.String)), // Error codes to ignore
  criticalErrors: S.optional(S.Array(S.String)), // Error codes requiring immediate attention
}).pipe(S.identifier('ErrorHandlingConfig'))
export type ErrorHandlingConfig = S.Schema.Type<typeof ErrorHandlingConfig>

// ============================================
// Error Response Types
// ============================================

/**
 * Error response for worker requests
 */
export const WorkerErrorResponse = S.Struct({
  error: WorkerError,
  context: ErrorContext,
  timestamp: S.Number.pipe(S.positive),

  // Recovery information
  canRetry: S.Boolean,
  retryAfter: S.optional(S.Number.pipe(S.positive)),
  suggestedAction: S.optional(S.String),

  // Debugging aids
  troubleshootingGuide: S.optional(S.String),
  relatedErrors: S.optional(S.Array(S.String)), // Related error IDs
}).pipe(S.identifier('WorkerErrorResponse'))
export type WorkerErrorResponse = S.Schema.Type<typeof WorkerErrorResponse>

/**
 * Batch error response for multiple failures
 */
export const BatchErrorResponse = S.Struct({
  errors: S.Array(WorkerErrorResponse),
  summary: S.Struct({
    totalErrors: S.Number.pipe(S.int(), S.nonNegative),
    errorsByCategory: S.Record({
      key: ErrorCategory,
      value: S.Number.pipe(S.int(), S.nonNegative),
    }),
    retryableErrors: S.Number.pipe(S.int(), S.nonNegative),
    criticalErrors: S.Number.pipe(S.int(), S.nonNegative),
  }),
  recommendedAction: S.optional(S.String),
}).pipe(S.identifier('BatchErrorResponse'))
export type BatchErrorResponse = S.Schema.Type<typeof BatchErrorResponse>

// ============================================
// Utility Functions
// ============================================

/**
 * Create a standard worker error
 */
export const createWorkerError = (
  code: string,
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity = 'medium',
  options?: {
    workerId?: string
    workerType?: string
    requestId?: string
    retryable?: boolean
    details?: Record<string, any>
  },
): WorkerError => ({
  code,
  message,
  category,
  severity,
  workerId: options?.workerId,
  workerType: options?.workerType,
  requestId: options?.requestId,
  timestamp: Date.now(),
  retryable: options?.retryable ?? false,
  occurredAt: Date.now(),
  details: options?.details,
})

/**
 * Create a validation error
 */
export const createValidationError = (
  message: string,
  validationErrors: ValidationError['validationErrors'],
  options?: { workerId?: string; requestId?: string },
): ValidationError => ({
  code: 'VALIDATION_FAILED',
  message,
  category: 'validation',
  severity: 'medium',
  workerId: options?.workerId,
  requestId: options?.requestId,
  timestamp: Date.now(),
  retryable: false,
  occurredAt: Date.now(),
  validationErrors,
})

/**
 * Create a timeout error
 */
export const createTimeoutError = (operation: string, timeoutDuration: number, elapsedTime: number, options?: { workerId?: string; requestId?: string }): TimeoutError => ({
  code: 'TIMEOUT',
  message: `Operation '${operation}' timed out after ${elapsedTime}ms (limit: ${timeoutDuration}ms)`,
  category: 'timeout',
  severity: 'high',
  workerId: options?.workerId,
  requestId: options?.requestId,
  timestamp: Date.now(),
  retryable: true,
  maxRetries: 3,
  occurredAt: Date.now(),
  timeoutDuration,
  elapsedTime,
  operation,
  recoveryStrategy: 'retry',
})

/**
 * Create a memory error
 */
export const createMemoryError = (
  message: string,
  memoryType: MemoryError['memoryType'],
  options?: {
    workerId?: string
    requestId?: string
    allocatedMemory?: number
    requestedMemory?: number
    availableMemory?: number
  },
): MemoryError => ({
  code: 'MEMORY_ERROR',
  message,
  category: 'memory',
  severity: 'high',
  workerId: options?.workerId,
  requestId: options?.requestId,
  timestamp: Date.now(),
  retryable: false,
  occurredAt: Date.now(),
  memoryType,
  allocatedMemory: options?.allocatedMemory,
  requestedMemory: options?.requestedMemory,
  availableMemory: options?.availableMemory,
  recoveryStrategy: 'fallback',
})

/**
 * Create default retry configuration
 */
export const createDefaultRetryConfig = (): RetryConfig => ({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffStrategy: 'exponential',
  backoffFactor: 2.0,
  jitter: true,
})

/**
 * Create default error handling configuration
 */
export const createDefaultErrorHandlingConfig = (): ErrorHandlingConfig => ({
  enableLogging: true,
  enableMetrics: true,
  enableNotifications: false,
  retryConfig: createDefaultRetryConfig(),
  escalationThreshold: 10,
})

/**
 * Check if error is retryable
 */
export const isRetryableError = (error: WorkerError): boolean => {
  return error.retryable && error.category !== 'validation' && error.severity !== 'critical'
}

/**
 * Get retry delay based on configuration
 */
export const calculateRetryDelay = (retryAttempt: number, config: RetryConfig): number => {
  let delay: number

  switch (config.backoffStrategy) {
    case 'linear':
      delay = config.initialDelay + retryAttempt * config.initialDelay
      break
    case 'exponential':
      delay = config.initialDelay * Math.pow(config.backoffFactor || 2, retryAttempt)
      break
    case 'fixed':
    default:
      delay = config.initialDelay
      break
  }

  // Apply jitter if enabled
  if (config.jitter) {
    delay += Math.random() * delay * 0.1 // ±10% jitter
  }

  return Math.min(delay, config.maxDelay)
}

/**
 * Categorize error based on error message and code
 */
export const categorizeError = (error: Error | string): ErrorCategory => {
  const message = typeof error === 'string' ? error : error.message
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'validation'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('time out')) {
    return 'timeout'
  }
  if (lowerMessage.includes('memory') || lowerMessage.includes('heap')) {
    return 'memory'
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return 'network'
  }
  if (lowerMessage.includes('resource') || lowerMessage.includes('file not found')) {
    return 'resource'
  }
  if (lowerMessage.includes('config') || lowerMessage.includes('setting')) {
    return 'configuration'
  }
  if (lowerMessage.includes('system') || lowerMessage.includes('os')) {
    return 'system'
  }

  return 'unknown'
}

/**
 * Validate error handling protocol request
 */
export const validateWorkerError = (error: unknown) => S.decodeUnknown(WorkerError)(error)

/**
 * Validate error response
 */
export const validateWorkerErrorResponse = (response: unknown) => S.decodeUnknown(WorkerErrorResponse)(response)
