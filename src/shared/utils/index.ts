// Error handling utilities
export {
  type ErrorHandlingStrategy,
  type ErrorHandlingContext,
  type RetryConfig,
  type ErrorHandler,
  ErrorHandlers,
  ErrorRecovery,
  PerformanceAwareErrorHandling,
  ErrorReporting,
  createComponentErrorHandler,
  withErrorHandling,
  handleError,
  recoverFromError,
  reportErrors
} from './error-handling'

// Logging utilities
export {
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
  Logger,
  createComponentLogger,
  DevLogger
} from './logging'

// Monitoring utilities
export {
  type PerformanceMetrics,
  type HealthCheck,
  type SystemStatus,
  type MonitoringConfig,
  registerHealthCheck,
  PerformanceMonitor,
  HealthMonitor,
  withMonitoring,
  createComponentMonitor
} from './monitoring'

// Validation utilities
export {
  type ValidationResult,
  type ValidationContext,
  type ValidatorFn,
  type ValidationRule,
  Validators,
  ValidationChain,
  ValidationUtils,
  GameValidators,
  createComponentValidator
} from './validation'

// Common utilities
export {
  isNotNull,
  isNotUndefined,
  isNotNullish,
  safeArrayAccess,
  deepClone,
  debounce,
  throttle,
  range,
  memoize,
  groupBy,
  unique,
  chunk,
  flatten,
  generateId,
  formatBytes,
  sleep,
  retry
} from './common'

// Effect utilities
export {
  withErrorLog,
  withTiming,
  retryWithBackoff,
  forEachWithConcurrency,
  cached,
  withCleanup,
  withPerformanceMonitoring,
  withFallback,
  withTimeout,
  batchOperations,
  createCircuitBreaker,
  memoize,
  type CircuitBreakerState,
  type CircuitBreakerConfig
} from './effect'

// Math utilities
export {
  Float,
  type Float as FloatType,
  toFloat,
  Int,
  type Int as IntType,
  toInt,
  clamp,
  lerp,
  smoothstep,
  inverseLerp,
  Vector2,
  type Vector2 as Vector2Type,
  createVector2,
  Vector3,
  type Vector3 as Vector3Type,
  createVector3,
  VectorOps
} from './math'
