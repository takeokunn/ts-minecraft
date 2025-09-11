/**
 * Domain Errors - Detailed Error Exports
 *
 * This module contains all detailed export statements for the unified error system,
 * including hierarchical error structures and specific error implementations.
 */

// Core error generation system - functional approach
export {
  createErrorContext,
  logError,
  createRecoveryHandler,
  createTaggedError,
  ErrorAggregator,
  type RecoveryStrategy,
  type ErrorContext,
  type BaseErrorData,
  type ErrorAggregatorState,
} from '@domain/errors/generator'

// Base error hierarchy - functional schemas
export {
  GameError,
  createGameError,
  DomainError,
  createDomainError,
  EntityError,
  createEntityError,
  ComponentError,
  createComponentError,
  WorldError,
  createWorldError,
  PhysicsError,
  createPhysicsError,
  SystemError,
  createSystemError,
  ResourceError,
  createResourceError,
  RenderingError,
  createRenderingError,
  NetworkError,
  createNetworkError,
  InputError,
  createInputError,
  ErrorChain,
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

// Physics subsystem errors - functional schemas
export {
  CollisionDetectionError,
  createCollisionDetectionError,
  PhysicsSimulationError,
  createPhysicsSimulationError,
  RigidBodyError,
  createRigidBodyError,
  GravityError,
  createGravityError,
  ConstraintViolationError,
  createConstraintViolationError,
  RaycastError,
  createRaycastError,
  PhysicsMaterialError,
  createPhysicsMaterialError,
} from '@domain/errors/physics-errors'

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