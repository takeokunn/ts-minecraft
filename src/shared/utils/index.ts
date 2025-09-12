// Enhanced utility exports with Effect-TS patterns

// Functional programming utilities (Effect-TS based)
export {
  // Array utilities
  chunk, flatten, unique, groupBy,
  safeHead, safeLast, safeGet,
  
  // Control flow
  debounce, throttle, memoize,
  retryWithPolicy, compose, forEachParallel,
  
  // Conditional
  when, unless, tapWhen,
  
  // Measurement & Resource management
  withTiming, withMeasurement, bracket,
  
  // Concurrency
  raceAll, sequence, traverse,
  
  // Error handling
  tryCatch, fromPromise, fromCallback,
  
  // Effects
  filterEffect, foldEffect,
  
  // Math
  safeDivide,
  
  // Complete functional utilities namespace
  Functional,
} from './functional'

// Effect utilities
export {
  withErrorLog,
  withTiming as effectWithTiming,
  retryWithBackoff,
  forEachWithConcurrency,
  cached,
  withCleanup,
  withPerformanceMonitoring,
  withFallback,
  withTimeout,
  batchOperations,
  type CircuitBreakerState,
  type CircuitBreakerConfig,
  createCircuitBreaker,
  memoize as effectMemoize,
} from './effect'

// Error handling utilities (used across layers)
export {
  type ErrorHandlingStrategy,
  type RetryConfig,
  ErrorHandlers,
  withErrorHandling,
  handleError,
  SystemError,
  EntityError,
  ValidationError,
} from './error'

// Logging utilities (used in error handling and monitoring)
export {
  type LogLevel,
  type LogEntry,
  Logger,
} from './logging'

// Math utilities (used in physics)
export {
  Float,
  type FloatType,
  toFloat,
  Int,
  type IntType,
  toInt,
  clamp,
  lerp,
  Vector3,
  type Vector3Type,
  createVector3,
} from './math'

// Monitoring utilities (used in shared utils)
export {
  type PerformanceMetrics,
  PerformanceMonitor,
} from './monitoring'

// Validation utilities (Schema-based)
export {
  type ValidationResult,
  type ValidationContext,
  type ValidatorFn,
  Validators,
  ValidationChain,
  ValidationUtils,
  GameValidators,
  createComponentValidator,
} from './validation'


// Type guards and validation utilities
export {
  type FaceDirection,
  type EntityIdNumber,
  TypeGuards,
  validateBiomeBlockType,
  validateBiomeBlockTypeSync,
  validateComponentNameArraySync,
  isBlockType,
  isFaceDirection,
  isEntityIdNumber,
  isComponentName,
  safeParseBlockType,
  safeParseFaceDirection,
  safeParseEntityIdNumber,
  safeParseComponentName,
  // Common type guards
  isRecord,
  hasProperty,
  isFunction,
  safeBoolean,
  isVector3,
  getSafeNumberProperty,
  isHTMLElement,
  isHTMLInputElement,
  hasFiles,
  hasPerformanceMemory,
  hasPerformanceObserver,
  safeParseNumber,
} from './type-guards'
