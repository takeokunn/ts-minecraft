/**
 * Unified Errors - Comprehensive Error System for Effect-TS
 *
 * This module provides a unified error handling system using Effect-TS tagged errors.
 * All domain operations should use these error types for consistent error handling.
 */

import { Schema } from 'effect'

// ===== BASE ERROR HIERARCHY USING SCHEMA.TAGGEDERROR =====

/**
 * Base game error schema
 */
export const GameError = Schema.TaggedError('GameError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface GameError extends Schema.Schema.Type<typeof GameError> {}

/**
 * Domain-level errors for business logic violations
 */
export const DomainError = Schema.TaggedError('DomainError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface DomainError extends Schema.Schema.Type<typeof DomainError> {}

/**
 * Infrastructure-level errors for external system failures
 */
export const InfrastructureError = Schema.TaggedError('InfrastructureError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface InfrastructureError extends Schema.Schema.Type<typeof InfrastructureError> {}

/**
 * Application-level errors for use case failures
 */
export const ApplicationError = Schema.TaggedError('ApplicationError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ApplicationError extends Schema.Schema.Type<typeof ApplicationError> {}

// ===== ENTITY SUBSYSTEM ERRORS =====

export const EntityNotFoundError = Schema.TaggedError('EntityNotFoundError')({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface EntityNotFoundError extends Schema.Schema.Type<typeof EntityNotFoundError> {}

export const EntityAlreadyExistsError = Schema.TaggedError('EntityAlreadyExistsError')({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface EntityAlreadyExistsError extends Schema.Schema.Type<typeof EntityAlreadyExistsError> {}

export const EntityCreationError = Schema.TaggedError('EntityCreationError')({
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface EntityCreationError extends Schema.Schema.Type<typeof EntityCreationError> {}

export const EntityDestructionError = Schema.TaggedError('EntityDestructionError')({
  message: Schema.String,
  entityId: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface EntityDestructionError extends Schema.Schema.Type<typeof EntityDestructionError> {}

export const EntityLimitExceededError = Schema.TaggedError('EntityLimitExceededError')({
  message: Schema.String,
  limit: Schema.Number,
  current: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface EntityLimitExceededError extends Schema.Schema.Type<typeof EntityLimitExceededError> {}

export const InvalidEntityStateError = Schema.TaggedError('InvalidEntityStateError')({
  message: Schema.String,
  entityId: Schema.String,
  state: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface InvalidEntityStateError extends Schema.Schema.Type<typeof InvalidEntityStateError> {}

// ===== COMPONENT SUBSYSTEM ERRORS =====

export const ComponentNotFoundError = Schema.TaggedError('ComponentNotFoundError')({
  message: Schema.String,
  entityId: Schema.String,
  componentName: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ComponentNotFoundError extends Schema.Schema.Type<typeof ComponentNotFoundError> {}

export const ComponentAlreadyExistsError = Schema.TaggedError('ComponentAlreadyExistsError')({
  message: Schema.String,
  entityId: Schema.String,
  componentName: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ComponentAlreadyExistsError extends Schema.Schema.Type<typeof ComponentAlreadyExistsError> {}

export const InvalidComponentDataError = Schema.TaggedError('InvalidComponentDataError')({
  message: Schema.String,
  componentName: Schema.String,
  validationErrors: Schema.Array(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface InvalidComponentDataError extends Schema.Schema.Type<typeof InvalidComponentDataError> {}

export const ComponentTypeMismatchError = Schema.TaggedError('ComponentTypeMismatchError')({
  message: Schema.String,
  componentName: Schema.String,
  expectedType: Schema.String,
  actualType: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ComponentTypeMismatchError extends Schema.Schema.Type<typeof ComponentTypeMismatchError> {}

// ===== WORLD SUBSYSTEM ERRORS =====

export const ChunkNotLoadedError = Schema.TaggedError('ChunkNotLoadedError')({
  message: Schema.String,
  chunkX: Schema.Number,
  chunkZ: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ChunkNotLoadedError extends Schema.Schema.Type<typeof ChunkNotLoadedError> {}

export const ChunkGenerationError = Schema.TaggedError('ChunkGenerationError')({
  message: Schema.String,
  chunkX: Schema.Number,
  chunkZ: Schema.Number,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ChunkGenerationError extends Schema.Schema.Type<typeof ChunkGenerationError> {}

export const InvalidPositionError = Schema.TaggedError('InvalidPositionError')({
  message: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface InvalidPositionError extends Schema.Schema.Type<typeof InvalidPositionError> {}

export const BlockNotFoundError = Schema.TaggedError('BlockNotFoundError')({
  message: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface BlockNotFoundError extends Schema.Schema.Type<typeof BlockNotFoundError> {}

export const WorldStateError = Schema.TaggedError('WorldStateError')({
  message: Schema.String,
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface WorldStateError extends Schema.Schema.Type<typeof WorldStateError> {}

// ===== PHYSICS SUBSYSTEM ERRORS =====

export const CollisionDetectionError = Schema.TaggedError('CollisionDetectionError')({
  message: Schema.String,
  entityId: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface CollisionDetectionError extends Schema.Schema.Type<typeof CollisionDetectionError> {}

export const PhysicsSimulationError = Schema.TaggedError('PhysicsSimulationError')({
  message: Schema.String,
  step: Schema.optional(Schema.Number),
  reason: Schema.String,
  deltaTime: Schema.optional(Schema.Number),
  timeScale: Schema.optional(Schema.Number),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface PhysicsSimulationError extends Schema.Schema.Type<typeof PhysicsSimulationError> {}

export const RaycastError = Schema.TaggedError('RaycastError')({
  message: Schema.String,
  reason: Schema.String,
  ray: Schema.optional(
    Schema.Struct({
      origin: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
      direction: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    }),
  ),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface RaycastError extends Schema.Schema.Type<typeof RaycastError> {}

export const RigidBodyError = Schema.TaggedError('RigidBodyError')({
  message: Schema.String,
  entityId: Schema.optional(Schema.String),
  bodyId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface RigidBodyError extends Schema.Schema.Type<typeof RigidBodyError> {}

export const GravityError = Schema.TaggedError('GravityError')({
  message: Schema.String,
  gravityVector: Schema.optional(Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface GravityError extends Schema.Schema.Type<typeof GravityError> {}

export const ConstraintViolationError = Schema.TaggedError('ConstraintViolationError')({
  message: Schema.String,
  constraintId: Schema.String,
  entityIds: Schema.Array(Schema.String),
  constraintType: Schema.String,
  violation: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ConstraintViolationError extends Schema.Schema.Type<typeof ConstraintViolationError> {}

export const PhysicsMaterialError = Schema.TaggedError('PhysicsMaterialError')({
  message: Schema.String,
  materialName: Schema.optional(Schema.String),
  entityId: Schema.optional(Schema.String),
  materialId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface PhysicsMaterialError extends Schema.Schema.Type<typeof PhysicsMaterialError> {}

export const VelocityLimitError = Schema.TaggedError('VelocityLimitError')({
  message: Schema.String,
  entityId: Schema.String,
  currentVelocity: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  maxVelocity: Schema.Number,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface VelocityLimitError extends Schema.Schema.Type<typeof VelocityLimitError> {}

export const CollisionShapeError = Schema.TaggedError('CollisionShapeError')({
  message: Schema.String,
  entityId: Schema.String,
  shapeType: Schema.String,
  reason: Schema.String,
  shapeData: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface CollisionShapeError extends Schema.Schema.Type<typeof CollisionShapeError> {}

export const PhysicsEngineError = Schema.TaggedError('PhysicsEngineError')({
  message: Schema.String,
  engineName: Schema.String,
  initializationStep: Schema.String,
  reason: Schema.String,
  configuration: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface PhysicsEngineError extends Schema.Schema.Type<typeof PhysicsEngineError> {}

// ===== SYSTEM ERRORS =====

export const SystemExecutionError = Schema.TaggedError('SystemExecutionError')({
  message: Schema.String,
  systemName: Schema.String,
  reason: Schema.String,
  entityId: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface SystemExecutionError extends Schema.Schema.Type<typeof SystemExecutionError> {}

export const QueryExecutionError = Schema.TaggedError('QueryExecutionError')({
  message: Schema.String,
  queryType: Schema.String,
  reason: Schema.String,
  components: Schema.optional(Schema.Array(Schema.String)),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface QueryExecutionError extends Schema.Schema.Type<typeof QueryExecutionError> {}

export const SystemInitializationError = Schema.TaggedError('SystemInitializationError')({
  message: Schema.String,
  systemName: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface SystemInitializationError extends Schema.Schema.Type<typeof SystemInitializationError> {}

// ===== RESOURCE ERRORS =====

export const ResourceNotFoundError = Schema.TaggedError('ResourceNotFoundError')({
  message: Schema.String,
  resourceId: Schema.String,
  resourceType: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ResourceNotFoundError extends Schema.Schema.Type<typeof ResourceNotFoundError> {}

export const ResourceLoadError = Schema.TaggedError('ResourceLoadError')({
  message: Schema.String,
  resourceId: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ResourceLoadError extends Schema.Schema.Type<typeof ResourceLoadError> {}

// ===== VALIDATION ERRORS =====

export const ValidationError = Schema.TaggedError('ValidationError')({
  message: Schema.String,
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ValidationError extends Schema.Schema.Type<typeof ValidationError> {}

// ===== ADAPTER ERRORS =====

export const MeshGenerationError = Schema.TaggedError('MeshGenerationError')({
  message: Schema.String,
  chunkId: Schema.optional(Schema.String),
  algorithm: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface MeshGenerationError extends Schema.Schema.Type<typeof MeshGenerationError> {}

export const MeshOptimizationError = Schema.TaggedError('MeshOptimizationError')({
  message: Schema.String,
  meshId: Schema.optional(Schema.String),
  optimizationType: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface MeshOptimizationError extends Schema.Schema.Type<typeof MeshOptimizationError> {}

export const TerrainGenerationError = Schema.TaggedError('TerrainGenerationError')({
  message: Schema.String,
  coordinates: Schema.optional(Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  })),
  biome: Schema.optional(Schema.String),
  seed: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface TerrainGenerationError extends Schema.Schema.Type<typeof TerrainGenerationError> {}

export const NoiseGenerationError = Schema.TaggedError('NoiseGenerationError')({
  message: Schema.String,
  coordinates: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  })),
  seed: Schema.optional(Schema.Number),
  noiseType: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface NoiseGenerationError extends Schema.Schema.Type<typeof NoiseGenerationError> {}

export const AdapterInitializationError = Schema.TaggedError('AdapterInitializationError')({
  message: Schema.String,
  adapterName: Schema.String,
  reason: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface AdapterInitializationError extends Schema.Schema.Type<typeof AdapterInitializationError> {}

export const ExternalLibraryError = Schema.TaggedError('ExternalLibraryError')({
  message: Schema.String,
  libraryName: Schema.String,
  operation: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export interface ExternalLibraryError extends Schema.Schema.Type<typeof ExternalLibraryError> {}

// ===== ERROR UTILITIES =====

/**
 * Union type of all domain errors for comprehensive error handling
 */
export type DomainErrors =
  | Schema.Schema.Type<typeof EntityNotFoundError>
  | Schema.Schema.Type<typeof EntityAlreadyExistsError>
  | Schema.Schema.Type<typeof EntityCreationError>
  | Schema.Schema.Type<typeof EntityDestructionError>
  | Schema.Schema.Type<typeof EntityLimitExceededError>
  | Schema.Schema.Type<typeof InvalidEntityStateError>
  | Schema.Schema.Type<typeof ComponentNotFoundError>
  | Schema.Schema.Type<typeof ComponentAlreadyExistsError>
  | Schema.Schema.Type<typeof InvalidComponentDataError>
  | Schema.Schema.Type<typeof ComponentTypeMismatchError>
  | Schema.Schema.Type<typeof ChunkNotLoadedError>
  | Schema.Schema.Type<typeof ChunkGenerationError>
  | Schema.Schema.Type<typeof InvalidPositionError>
  | Schema.Schema.Type<typeof BlockNotFoundError>
  | Schema.Schema.Type<typeof WorldStateError>
  | Schema.Schema.Type<typeof CollisionDetectionError>
  | Schema.Schema.Type<typeof PhysicsSimulationError>
  | Schema.Schema.Type<typeof RaycastError>
  | Schema.Schema.Type<typeof RigidBodyError>
  | Schema.Schema.Type<typeof GravityError>
  | Schema.Schema.Type<typeof ConstraintViolationError>
  | Schema.Schema.Type<typeof PhysicsMaterialError>
  | Schema.Schema.Type<typeof VelocityLimitError>
  | Schema.Schema.Type<typeof CollisionShapeError>
  | Schema.Schema.Type<typeof SystemExecutionError>
  | Schema.Schema.Type<typeof QueryExecutionError>
  | Schema.Schema.Type<typeof SystemInitializationError>
  | Schema.Schema.Type<typeof ValidationError>

/**
 * Union type of all infrastructure errors
 */
export type InfrastructureErrors = 
  | Schema.Schema.Type<typeof ResourceNotFoundError> 
  | Schema.Schema.Type<typeof ResourceLoadError> 
  | Schema.Schema.Type<typeof PhysicsEngineError>
  | Schema.Schema.Type<typeof MeshGenerationError>
  | Schema.Schema.Type<typeof MeshOptimizationError>
  | Schema.Schema.Type<typeof TerrainGenerationError>
  | Schema.Schema.Type<typeof NoiseGenerationError>
  | Schema.Schema.Type<typeof AdapterInitializationError>
  | Schema.Schema.Type<typeof ExternalLibraryError>

/**
 * Union type of all application errors
 */
export type ApplicationErrors = Schema.Schema.Type<typeof SystemExecutionError> | Schema.Schema.Type<typeof SystemInitializationError>

/**
 * Union type of all possible game errors
 */
export type AllGameErrors = DomainErrors | InfrastructureErrors | ApplicationErrors

/**
 * Error categorization utility
 */
export const ErrorCategories = {
  Entity: ['EntityNotFoundError', 'EntityAlreadyExistsError', 'EntityCreationError', 'EntityDestructionError', 'EntityLimitExceededError', 'InvalidEntityStateError'] as const,
  Component: ['ComponentNotFoundError', 'ComponentAlreadyExistsError', 'InvalidComponentDataError', 'ComponentTypeMismatchError'] as const,
  World: ['ChunkNotLoadedError', 'ChunkGenerationError', 'InvalidPositionError', 'BlockNotFoundError', 'WorldStateError'] as const,
  Physics: [
    'CollisionDetectionError',
    'PhysicsSimulationError',
    'RaycastError',
    'RigidBodyError',
    'GravityError',
    'ConstraintViolationError',
    'PhysicsMaterialError',
    'VelocityLimitError',
    'CollisionShapeError',
  ] as const,
  System: ['SystemExecutionError', 'QueryExecutionError', 'SystemInitializationError'] as const,
  Resource: ['ResourceNotFoundError', 'ResourceLoadError'] as const,
  Validation: ['ValidationError'] as const,
  Adapter: ['MeshGenerationError', 'MeshOptimizationError', 'TerrainGenerationError', 'NoiseGenerationError', 'AdapterInitializationError', 'ExternalLibraryError'] as const,
} as const

/**
 * Type guard utilities for error classification
 */
export const isEntityError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof EntityNotFoundError>
  | Schema.Schema.Type<typeof EntityAlreadyExistsError>
  | Schema.Schema.Type<typeof EntityCreationError>
  | Schema.Schema.Type<typeof EntityDestructionError>
  | Schema.Schema.Type<typeof EntityLimitExceededError>
  | Schema.Schema.Type<typeof InvalidEntityStateError> => ErrorCategories.Entity.includes(error._tag as (typeof ErrorCategories.Entity)[number])

export const isComponentError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof ComponentNotFoundError>
  | Schema.Schema.Type<typeof ComponentAlreadyExistsError>
  | Schema.Schema.Type<typeof InvalidComponentDataError>
  | Schema.Schema.Type<typeof ComponentTypeMismatchError> => ErrorCategories.Component.includes(error._tag as (typeof ErrorCategories.Component)[number])

export const isWorldError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof ChunkNotLoadedError>
  | Schema.Schema.Type<typeof ChunkGenerationError>
  | Schema.Schema.Type<typeof InvalidPositionError>
  | Schema.Schema.Type<typeof BlockNotFoundError>
  | Schema.Schema.Type<typeof WorldStateError> => ErrorCategories.World.includes(error._tag as (typeof ErrorCategories.World)[number])

export const isPhysicsError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof CollisionDetectionError>
  | Schema.Schema.Type<typeof PhysicsSimulationError>
  | Schema.Schema.Type<typeof RaycastError>
  | Schema.Schema.Type<typeof RigidBodyError>
  | Schema.Schema.Type<typeof GravityError>
  | Schema.Schema.Type<typeof ConstraintViolationError>
  | Schema.Schema.Type<typeof PhysicsMaterialError>
  | Schema.Schema.Type<typeof VelocityLimitError>
  | Schema.Schema.Type<typeof CollisionShapeError> => ErrorCategories.Physics.includes(error._tag as (typeof ErrorCategories.Physics)[number])

export const isSystemError = (
  error: AllGameErrors,
): error is Schema.Schema.Type<typeof SystemExecutionError> | Schema.Schema.Type<typeof QueryExecutionError> | Schema.Schema.Type<typeof SystemInitializationError> =>
  ErrorCategories.System.includes(error._tag as (typeof ErrorCategories.System)[number])

export const isResourceError = (error: AllGameErrors): error is Schema.Schema.Type<typeof ResourceNotFoundError> | Schema.Schema.Type<typeof ResourceLoadError> =>
  ErrorCategories.Resource.includes(error._tag as (typeof ErrorCategories.Resource)[number])

export const isAdapterError = (error: AllGameErrors): error is 
  | Schema.Schema.Type<typeof MeshGenerationError>
  | Schema.Schema.Type<typeof MeshOptimizationError>
  | Schema.Schema.Type<typeof TerrainGenerationError>
  | Schema.Schema.Type<typeof NoiseGenerationError>
  | Schema.Schema.Type<typeof AdapterInitializationError>
  | Schema.Schema.Type<typeof ExternalLibraryError> =>
  ErrorCategories.Adapter.includes(error._tag as (typeof ErrorCategories.Adapter)[number])

/**
 * Error severity classification
 */
export const getErrorSeverity = (error: AllGameErrors): 'low' | 'medium' | 'high' | 'critical' => {
  switch (error._tag) {
    case 'EntityNotFoundError':
    case 'ComponentNotFoundError':
    case 'BlockNotFoundError':
    case 'ResourceNotFoundError':
    case 'CollisionDetectionError':
    case 'RaycastError':
    case 'GravityError':
    case 'PhysicsMaterialError':
    case 'VelocityLimitError':
    case 'NoiseGenerationError':
      return 'medium'

    case 'EntityCreationError':
    case 'EntityDestructionError':
    case 'ChunkGenerationError':
    case 'PhysicsSimulationError':
    case 'SystemExecutionError':
    case 'RigidBodyError':
    case 'ConstraintViolationError':
    case 'CollisionShapeError':
    case 'MeshGenerationError':
    case 'MeshOptimizationError':
    case 'TerrainGenerationError':
    case 'ExternalLibraryError':
      return 'high'

    case 'EntityLimitExceededError':
    case 'SystemInitializationError':
    case 'WorldStateError':
    case 'PhysicsEngineError':
    case 'AdapterInitializationError':
      return 'critical'

    default:
      return 'low'
  }
}

/**
 * Error recovery suggestions
 */
export const getRecoveryStrategy = (error: AllGameErrors): string => {
  switch (error._tag) {
    case 'EntityNotFoundError':
      return 'Create the entity or verify the entity ID is correct'
    case 'ComponentNotFoundError':
      return 'Add the component to the entity or check the component name'
    case 'ChunkNotLoadedError':
      return 'Load the chunk before accessing it'
    case 'EntityLimitExceededError':
      return 'Remove unused entities or increase entity limit'
    case 'ValidationError':
      return 'Fix the validation error and retry'
    case 'CollisionDetectionError':
      return 'Verify entity positions and collision shapes, use fallback collision detection'
    case 'PhysicsSimulationError':
      return 'Check physics timestep and entity states, consider resetting physics world'
    case 'RaycastError':
      return 'Verify ray parameters and retry with different ray configuration'
    case 'RigidBodyError':
      return 'Verify rigid body configuration and recreate if necessary'
    case 'GravityError':
      return 'Reset gravity to default values or disable gravity temporarily'
    case 'ConstraintViolationError':
      return 'Adjust constraint parameters or remove constraint temporarily'
    case 'PhysicsMaterialError':
      return 'Use default material properties or verify material configuration'
    case 'VelocityLimitError':
      return 'Cap entity velocity to safe limits and check physics timestep'
    case 'CollisionShapeError':
      return 'Use simplified collision shape or regenerate collision geometry'
    case 'PhysicsEngineError':
      return 'Restart physics engine or use fallback physics implementation'
    case 'MeshGenerationError':
      return 'Retry with simpler mesh algorithm or fallback to cached mesh data'
    case 'MeshOptimizationError':
      return 'Skip mesh optimization and use unoptimized mesh'
    case 'TerrainGenerationError':
      return 'Use fallback terrain data or retry with different generation parameters'
    case 'NoiseGenerationError':
      return 'Use simpler noise algorithm or predefined noise patterns'
    case 'AdapterInitializationError':
      return 'Restart adapter or use fallback adapter implementation'
    case 'ExternalLibraryError':
      return 'Use fallback implementation or update external library version'
    default:
      return 'Check logs for more details and retry the operation'
  }
}

// ===== ERROR FACTORY FUNCTIONS =====

/**
 * Factory functions for creating error instances with default values and validation
 * All factory functions follow Effect-TS best practices for functional error creation
 */

// Base error factories
export const createGameError = (message: string, context?: Record<string, unknown>): GameError =>
  GameError({ message, timestamp: Date.now(), context })

export const createDomainError = (message: string, context?: Record<string, unknown>): DomainError =>
  DomainError({ message, timestamp: Date.now(), context })

export const createInfrastructureError = (message: string, context?: Record<string, unknown>): InfrastructureError =>
  InfrastructureError({ message, timestamp: Date.now(), context })

export const createApplicationError = (message: string, context?: Record<string, unknown>): ApplicationError =>
  ApplicationError({ message, timestamp: Date.now(), context })

// Entity error factories
export const createEntityNotFoundError = (message: string, entityId: string, context?: Record<string, unknown>): EntityNotFoundError =>
  EntityNotFoundError({ message, entityId, timestamp: Date.now(), context })

export const createEntityAlreadyExistsError = (message: string, entityId: string, context?: Record<string, unknown>): EntityAlreadyExistsError =>
  EntityAlreadyExistsError({ message, entityId, timestamp: Date.now(), context })

export const createEntityCreationError = (message: string, cause?: unknown, context?: Record<string, unknown>): EntityCreationError =>
  EntityCreationError({ message, cause, timestamp: Date.now(), context })

export const createEntityDestructionError = (message: string, entityId: string, cause?: unknown, context?: Record<string, unknown>): EntityDestructionError =>
  EntityDestructionError({ message, entityId, cause, timestamp: Date.now(), context })

export const createEntityLimitExceededError = (message: string, limit: number, current: number, context?: Record<string, unknown>): EntityLimitExceededError =>
  EntityLimitExceededError({ message, limit, current, timestamp: Date.now(), context })

export const createInvalidEntityStateError = (message: string, entityId: string, state: string, context?: Record<string, unknown>): InvalidEntityStateError =>
  InvalidEntityStateError({ message, entityId, state, timestamp: Date.now(), context })

// Component error factories
export const createComponentNotFoundError = (message: string, entityId: string, componentName: string, context?: Record<string, unknown>): ComponentNotFoundError =>
  ComponentNotFoundError({ message, entityId, componentName, timestamp: Date.now(), context })

export const createComponentAlreadyExistsError = (message: string, entityId: string, componentName: string, context?: Record<string, unknown>): ComponentAlreadyExistsError =>
  ComponentAlreadyExistsError({ message, entityId, componentName, timestamp: Date.now(), context })

export const createInvalidComponentDataError = (message: string, componentName: string, validationErrors: string[], context?: Record<string, unknown>): InvalidComponentDataError =>
  InvalidComponentDataError({ message, componentName, validationErrors, timestamp: Date.now(), context })

export const createComponentTypeMismatchError = (message: string, componentName: string, expectedType: string, actualType: string, context?: Record<string, unknown>): ComponentTypeMismatchError =>
  ComponentTypeMismatchError({ message, componentName, expectedType, actualType, timestamp: Date.now(), context })

// World error factories
export const createChunkNotLoadedError = (message: string, chunkX: number, chunkZ: number, context?: Record<string, unknown>): ChunkNotLoadedError =>
  ChunkNotLoadedError({ message, chunkX, chunkZ, timestamp: Date.now(), context })

export const createChunkGenerationError = (message: string, chunkX: number, chunkZ: number, reason: string, context?: Record<string, unknown>): ChunkGenerationError =>
  ChunkGenerationError({ message, chunkX, chunkZ, reason, timestamp: Date.now(), context })

export const createInvalidPositionError = (message: string, x: number, y: number, z: number, reason?: string, context?: Record<string, unknown>): InvalidPositionError =>
  InvalidPositionError({ message, x, y, z, reason, timestamp: Date.now(), context })

export const createBlockNotFoundError = (message: string, x: number, y: number, z: number, context?: Record<string, unknown>): BlockNotFoundError =>
  BlockNotFoundError({ message, x, y, z, timestamp: Date.now(), context })

export const createWorldStateError = (message: string, operation: string, reason: string, context?: Record<string, unknown>): WorldStateError =>
  WorldStateError({ message, operation, reason, timestamp: Date.now(), context })

// Physics error factories
export const createCollisionDetectionError = (message: string, entityId: string, reason: string, context?: Record<string, unknown>): CollisionDetectionError =>
  CollisionDetectionError({ message, entityId, reason, timestamp: Date.now(), context })

export const createPhysicsSimulationError = (message: string, reason: string, step?: number, deltaTime?: number, timeScale?: number, context?: Record<string, unknown>): PhysicsSimulationError =>
  PhysicsSimulationError({ message, step, reason, deltaTime, timeScale, timestamp: Date.now(), context })

export const createRaycastError = (message: string, reason: string, ray?: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }, cause?: unknown, context?: Record<string, unknown>): RaycastError =>
  RaycastError({ message, reason, ray, cause, timestamp: Date.now(), context })

export const createRigidBodyError = (message: string, entityId?: string, bodyId?: string, cause?: unknown, context?: Record<string, unknown>): RigidBodyError =>
  RigidBodyError({ message, entityId, bodyId, cause, timestamp: Date.now(), context })

export const createGravityError = (message: string, gravityVector?: { x: number; y: number; z: number }, cause?: unknown, context?: Record<string, unknown>): GravityError =>
  GravityError({ message, gravityVector, cause, timestamp: Date.now(), context })

// System error factories  
export const createSystemExecutionError = (message: string, systemName: string, reason: string, entityId?: string, context?: Record<string, unknown>): SystemExecutionError =>
  SystemExecutionError({ message, systemName, reason, entityId, timestamp: Date.now(), context })

export const createQueryExecutionError = (message: string, queryType: string, reason: string, components?: string[], context?: Record<string, unknown>): QueryExecutionError =>
  QueryExecutionError({ message, queryType, reason, components, timestamp: Date.now(), context })

export const createSystemInitializationError = (message: string, systemName: string, reason: string, context?: Record<string, unknown>): SystemInitializationError =>
  SystemInitializationError({ message, systemName, reason, timestamp: Date.now(), context })

// Resource error factories
export const createResourceNotFoundError = (message: string, resourceId: string, resourceType: string, context?: Record<string, unknown>): ResourceNotFoundError =>
  ResourceNotFoundError({ message, resourceId, resourceType, timestamp: Date.now(), context })

export const createResourceLoadError = (message: string, resourceId: string, reason: string, context?: Record<string, unknown>): ResourceLoadError =>
  ResourceLoadError({ message, resourceId, reason, timestamp: Date.now(), context })

// Validation error factories
export const createValidationError = (message: string, field: string, value: unknown, constraint: string, context?: Record<string, unknown>): ValidationError =>
  ValidationError({ message, field, value, constraint, timestamp: Date.now(), context })

// Adapter error factories
export const createMeshGenerationError = (message: string, chunkId?: string, algorithm?: string, cause?: unknown, context?: Record<string, unknown>): MeshGenerationError =>
  MeshGenerationError({ message, chunkId, algorithm, cause, timestamp: Date.now(), context })

export const createMeshOptimizationError = (message: string, meshId?: string, optimizationType?: string, cause?: unknown, context?: Record<string, unknown>): MeshOptimizationError =>
  MeshOptimizationError({ message, meshId, optimizationType, cause, timestamp: Date.now(), context })

export const createTerrainGenerationError = (message: string, coordinates?: { x: number; z: number }, biome?: string, seed?: number, cause?: unknown, context?: Record<string, unknown>): TerrainGenerationError =>
  TerrainGenerationError({ message, coordinates, biome, seed, cause, timestamp: Date.now(), context })

export const createNoiseGenerationError = (message: string, coordinates?: { x: number; y: number; z: number }, seed?: number, noiseType?: string, cause?: unknown, context?: Record<string, unknown>): NoiseGenerationError =>
  NoiseGenerationError({ message, coordinates, seed, noiseType, cause, timestamp: Date.now(), context })

export const createAdapterInitializationError = (message: string, adapterName: string, reason: string, cause?: unknown, context?: Record<string, unknown>): AdapterInitializationError =>
  AdapterInitializationError({ message, adapterName, reason, cause, timestamp: Date.now(), context })

export const createExternalLibraryError = (message: string, libraryName: string, operation: string, cause?: unknown, context?: Record<string, unknown>): ExternalLibraryError =>
  ExternalLibraryError({ message, libraryName, operation, cause, timestamp: Date.now(), context })
