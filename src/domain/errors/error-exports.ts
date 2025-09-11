/**
 * Domain Errors - Detailed Error Exports
 *
 * This module contains all detailed export statements for the unified error system,
 * including hierarchical error structures and specific error implementations.
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
} from '@domain/errors/generator'

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
} from '@domain/errors/base-errors'

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
} from '@domain/errors/entity-errors'

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
} from '@domain/errors/component-errors'

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
} from '@domain/errors/world-errors'

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
} from '@domain/errors/physics-errors'

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
} from '@domain/errors/system-errors'

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
} from '@domain/errors/worker-errors'

export { WorkerCommunicationError, WorkerTaskFailedError, WorkerInitializationError, WorkerPoolExhaustedError, WorkerTerminatedError, WorkerDataTransferError, WorkerTimeoutError }

// Rendering subsystem errors
import {
  TextureNotFoundError,
  MaterialNotFoundError,
  ShaderCompilationError,
  BufferAllocationError,
  RenderTargetError,
  MeshDataError,
  GraphicsContextError,
} from '@domain/errors/rendering-errors'

export { TextureNotFoundError, MaterialNotFoundError, ShaderCompilationError, BufferAllocationError, RenderTargetError, MeshDataError, GraphicsContextError }

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
} from '@domain/errors/resource-errors'

export { ResourceNotFoundError, ResourceLoadError, ValidationError, ResourceCacheError, UnsupportedFormatError, InputNotAvailableError, AssetBundleError, ResourcePermissionError }