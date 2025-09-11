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

// Import types for AllGameErrors definition
import type { BaseErrorData, RecoveryStrategy } from './generator'

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
import {
  EntityNotFoundError,
  EntityAlreadyExistsError,
  InvalidEntityStateError,
  EntityCreationError,
  EntityDestructionError,
  EntityArchetypeMismatchError,
  StaleEntityReferenceError,
  EntityLimitExceededError,
} from './entity-errors'

export {
  EntityNotFoundError,
  EntityAlreadyExistsError,
  InvalidEntityStateError,
  EntityCreationError,
  EntityDestructionError,
  EntityArchetypeMismatchError,
  StaleEntityReferenceError,
  EntityLimitExceededError,
}

// Component subsystem errors
import {
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
}

// World subsystem errors
import {
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
}

// Physics subsystem errors
import {
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
}

// System execution errors
import {
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
}

// Worker-related errors
import {
  WorkerCommunicationError,
  WorkerTaskFailedError,
  WorkerInitializationError,
  WorkerPoolExhaustedError,
  WorkerTerminatedError,
  WorkerDataTransferError,
  WorkerTimeoutError,
} from './worker-errors'

export {
  WorkerCommunicationError,
  WorkerTaskFailedError,
  WorkerInitializationError,
  WorkerPoolExhaustedError,
  WorkerTerminatedError,
  WorkerDataTransferError,
  WorkerTimeoutError,
}

// Rendering subsystem errors
import {
  TextureNotFoundError,
  MaterialNotFoundError,
  ShaderCompilationError,
  BufferAllocationError,
  RenderTargetError,
  MeshDataError,
  GraphicsContextError,
} from './rendering-errors'

export {
  TextureNotFoundError,
  MaterialNotFoundError,
  ShaderCompilationError,
  BufferAllocationError,
  RenderTargetError,
  MeshDataError,
  GraphicsContextError,
}

// Resource and input errors
import {
  ResourceNotFoundError,
  ResourceLoadError,
  ValidationError,
  ResourceCacheError,
  UnsupportedFormatError,
  InputNotAvailableError,
  AssetBundleError,
  ResourcePermissionError,
} from './resource-errors'

export {
  ResourceNotFoundError,
  ResourceLoadError,
  ValidationError,
  ResourceCacheError,
  UnsupportedFormatError,
  InputNotAvailableError,
  AssetBundleError,
  ResourcePermissionError,
}

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

// Import ErrorAggregator locally to avoid circular dependency
import { ErrorAggregator as _ErrorAggregator } from './generator'

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