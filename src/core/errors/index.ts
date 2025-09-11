/**
 * Unified error system for ts-minecraft
 * 
 * Features:
 * - Hierarchical error structure with Data.TaggedError base
 * - Automatic error generation with defineError function
 * - Built-in recovery strategies and structured logging
 * - Error aggregation and reporting capabilities
 * - Full Effect-TS integration
 */

// Core error generation system
export {
  defineError,
  createRecoveryHandler,
  logError,
  ErrorAggregator,
  type RecoveryStrategy,
  type ErrorContext,
  type BaseErrorData,
  type ErrorConstructor,
  type ParentErrorClass,
} from './generator'

// Base error hierarchy
export {
  GameError,
  DomainError,
  EntityError,
  ComponentError,
  WorldError,
  PhysicsError,
  SystemError,
  ResourceError,
  RenderingError,
  NetworkError,
  InputError,
  createErrorChain,
  validateErrorHierarchy,
  getErrorAncestry,
} from './base-errors'

// Entity subsystem errors
export {
  EntityNotFoundError,
  EntityAlreadyExistsError,
  InvalidEntityStateError,
  EntityCreationError,
  EntityDestructionError,
  EntityArchetypeMismatchError,
  StaleEntityReferenceError,
  EntityLimitExceededError,
} from './entity-errors'

// Component subsystem errors
export {
  ComponentNotFoundError,
  InvalidComponentDataError,
  ComponentAlreadyExistsError,
  ComponentSerializationError,
  ComponentDeserializationError,
  ComponentTypeMismatchError,
  ComponentDependencyError,
  ComponentLifecycleError,
  ComponentCapacityError,
} from './component-errors'

// World subsystem errors
export {
  ChunkNotLoadedError,
  InvalidPositionError,
  BlockNotFoundError,
  InvalidBlockTypeError,
  WorldStateError,
  ArchetypeNotFoundError,
  QuerySingleResultNotFoundError,
  ComponentDecodeError,
  ChunkGenerationError,
  WorldSaveError,
  WorldLoadError,
  BlockPlacementError,
  WorldTickError,
} from './world-errors'

// Physics subsystem errors
export {
  CollisionDetectionError,
  PhysicsSimulationError,
  RigidBodyError,
  GravityError,
  VelocityLimitError,
  ConstraintViolationError,
  RaycastError,
  PhysicsEngineError,
  CollisionShapeError,
  PhysicsMaterialError,
} from './physics-errors'

// System execution errors
export {
  SystemExecutionError,
  InvalidSystemStateError,
  SystemInitializationError,
  SystemDependencyError,
  SystemPerformanceError,
  QueryExecutionError,
  EmptyQueryResultError,
  QueryValidationError,
  SystemSchedulerError,
} from './system-errors'

// Worker-related errors
export {
  WorkerCommunicationError,
  WorkerTaskFailedError,
  WorkerInitializationError,
  WorkerPoolExhaustedError,
  WorkerTerminatedError,
  WorkerDataTransferError,
  WorkerTimeoutError,
} from './worker-errors'

// Rendering subsystem errors
export {
  RenderingError,
  TextureNotFoundError,
  MaterialNotFoundError,
  ShaderCompilationError,
  BufferAllocationError,
  RenderTargetError,
  MeshDataError,
  GraphicsContextError,
} from './rendering-errors'

// Resource and input errors
export {
  ResourceNotFoundError,
  ResourceLoadError,
  ValidationError,
  ResourceCacheError,
  UnsupportedFormatError,
  InputNotAvailableError,
  NetworkError,
  AssetBundleError,
  ResourcePermissionError,
} from './resource-errors'

// Comprehensive type union for all errors in the system
export type AllGameErrors =
  // Entity errors
  | ReturnType<typeof EntityNotFoundError>
  | ReturnType<typeof EntityAlreadyExistsError>
  | ReturnType<typeof InvalidEntityStateError>
  | ReturnType<typeof EntityCreationError>
  | ReturnType<typeof EntityDestructionError>
  | ReturnType<typeof EntityArchetypeMismatchError>
  | ReturnType<typeof StaleEntityReferenceError>
  | ReturnType<typeof EntityLimitExceededError>
  
  // Component errors
  | ReturnType<typeof ComponentNotFoundError>
  | ReturnType<typeof InvalidComponentDataError>
  | ReturnType<typeof ComponentAlreadyExistsError>
  | ReturnType<typeof ComponentSerializationError>
  | ReturnType<typeof ComponentDeserializationError>
  | ReturnType<typeof ComponentTypeMismatchError>
  | ReturnType<typeof ComponentDependencyError>
  | ReturnType<typeof ComponentLifecycleError>
  | ReturnType<typeof ComponentCapacityError>
  
  // World errors
  | ReturnType<typeof ChunkNotLoadedError>
  | ReturnType<typeof InvalidPositionError>
  | ReturnType<typeof BlockNotFoundError>
  | ReturnType<typeof InvalidBlockTypeError>
  | ReturnType<typeof WorldStateError>
  | ReturnType<typeof ArchetypeNotFoundError>
  | ReturnType<typeof QuerySingleResultNotFoundError>
  | ReturnType<typeof ComponentDecodeError>
  | ReturnType<typeof ChunkGenerationError>
  | ReturnType<typeof WorldSaveError>
  | ReturnType<typeof WorldLoadError>
  | ReturnType<typeof BlockPlacementError>
  | ReturnType<typeof WorldTickError>
  
  // Physics errors
  | ReturnType<typeof CollisionDetectionError>
  | ReturnType<typeof PhysicsSimulationError>
  | ReturnType<typeof RigidBodyError>
  | ReturnType<typeof GravityError>
  | ReturnType<typeof VelocityLimitError>
  | ReturnType<typeof ConstraintViolationError>
  | ReturnType<typeof RaycastError>
  | ReturnType<typeof PhysicsEngineError>
  | ReturnType<typeof CollisionShapeError>
  | ReturnType<typeof PhysicsMaterialError>
  
  // System errors
  | ReturnType<typeof SystemExecutionError>
  | ReturnType<typeof InvalidSystemStateError>
  | ReturnType<typeof SystemInitializationError>
  | ReturnType<typeof SystemDependencyError>
  | ReturnType<typeof SystemPerformanceError>
  | ReturnType<typeof QueryExecutionError>
  | ReturnType<typeof EmptyQueryResultError>
  | ReturnType<typeof QueryValidationError>
  | ReturnType<typeof SystemSchedulerError>
  
  // Worker errors
  | ReturnType<typeof WorkerCommunicationError>
  | ReturnType<typeof WorkerTaskFailedError>
  | ReturnType<typeof WorkerInitializationError>
  | ReturnType<typeof WorkerPoolExhaustedError>
  | ReturnType<typeof WorkerTerminatedError>
  | ReturnType<typeof WorkerDataTransferError>
  | ReturnType<typeof WorkerTimeoutError>
  
  // Rendering errors
  | ReturnType<typeof RenderingError>
  | ReturnType<typeof TextureNotFoundError>
  | ReturnType<typeof MaterialNotFoundError>
  | ReturnType<typeof ShaderCompilationError>
  | ReturnType<typeof BufferAllocationError>
  | ReturnType<typeof RenderTargetError>
  | ReturnType<typeof MeshDataError>
  | ReturnType<typeof GraphicsContextError>
  
  // Resource and input errors
  | ReturnType<typeof ResourceNotFoundError>
  | ReturnType<typeof ResourceLoadError>
  | ReturnType<typeof ValidationError>
  | ReturnType<typeof ResourceCacheError>
  | ReturnType<typeof UnsupportedFormatError>
  | ReturnType<typeof InputNotAvailableError>
  | ReturnType<typeof NetworkError>
  | ReturnType<typeof AssetBundleError>
  | ReturnType<typeof ResourcePermissionError>

/**
 * Global error aggregator instance
 * Use this for collecting and reporting errors across the application
 */
export const globalErrorAggregator = new ErrorAggregator()

/**
 * Utility function to determine if an error is recoverable
 */
export function isRecoverableError(error: AllGameErrors): boolean {
  return error.getRecoveryStrategy() !== 'terminate'
}

/**
 * Utility function to get error severity level
 */
export function getErrorSeverity(error: AllGameErrors): ErrorContext['severity'] {
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
export function createTypedErrorHandler<T extends AllGameErrors>(
  errorType: string,
  handler: (error: T) => void
) {
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
    recoverable: errors.filter(isRecoverableError).length,
    nonRecoverable: errors.filter(e => !isRecoverableError(e)).length,
  }
  
  const criticalErrors = report.criticalErrors.map(error => ({
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