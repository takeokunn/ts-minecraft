/**
 * Unified Errors - Comprehensive Error System for Effect-TS
 *
 * This module provides a unified error handling system using Effect-TS tagged errors.
 * All domain operations should use these error types for consistent error handling.
 */

import { Data, Schema } from 'effect'
import { EntityId } from '@domain/entities'
import { ComponentName } from '@domain/entities/components'

// ===== BASE ERROR HIERARCHY USING SCHEMA.TAGGEDERROR =====

/**
 * Base game error schema
 */
export const GameError = Schema.TaggedError('GameError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

/**
 * Domain-level errors for business logic violations
 */
export const DomainError = Schema.TaggedError('DomainError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

/**
 * Infrastructure-level errors for external system failures
 */
export const InfrastructureError = Schema.TaggedError('InfrastructureError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

/**
 * Application-level errors for use case failures
 */
export const ApplicationError = Schema.TaggedError('ApplicationError')({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== ENTITY SUBSYSTEM ERRORS =====

export const EntityNotFoundError = Schema.TaggedError('EntityNotFoundError')({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const EntityAlreadyExistsError = Schema.TaggedError('EntityAlreadyExistsError')({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const EntityCreationError = Schema.TaggedError('EntityCreationError')({
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const EntityDestructionError = Schema.TaggedError('EntityDestructionError')({
  message: Schema.String,
  entityId: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const EntityLimitExceededError = Schema.TaggedError('EntityLimitExceededError')({
  message: Schema.String,
  limit: Schema.Number,
  current: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const InvalidEntityStateError = Schema.TaggedError('InvalidEntityStateError')({
  message: Schema.String,
  entityId: Schema.String,
  state: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== COMPONENT SUBSYSTEM ERRORS =====

export const ComponentNotFoundError = Schema.TaggedError('ComponentNotFoundError')({
  message: Schema.String,
  entityId: Schema.String,
  componentName: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ComponentAlreadyExistsError = Schema.TaggedError('ComponentAlreadyExistsError')({
  message: Schema.String,
  entityId: Schema.String,
  componentName: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const InvalidComponentDataError = Schema.TaggedError('InvalidComponentDataError')({
  message: Schema.String,
  componentName: Schema.String,
  validationErrors: Schema.Array(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ComponentTypeMismatchError = Schema.TaggedError('ComponentTypeMismatchError')({
  message: Schema.String,
  componentName: Schema.String,
  expectedType: Schema.String,
  actualType: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== WORLD SUBSYSTEM ERRORS =====

export const ChunkNotLoadedError = Schema.TaggedError('ChunkNotLoadedError')({
  message: Schema.String,
  chunkX: Schema.Number,
  chunkZ: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ChunkGenerationError = Schema.TaggedError('ChunkGenerationError')({
  message: Schema.String,
  chunkX: Schema.Number,
  chunkZ: Schema.Number,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const InvalidPositionError = Schema.TaggedError('InvalidPositionError')({
  message: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const BlockNotFoundError = Schema.TaggedError('BlockNotFoundError')({
  message: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const WorldStateError = Schema.TaggedError('WorldStateError')({
  message: Schema.String,
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== PHYSICS SUBSYSTEM ERRORS =====

export const CollisionDetectionError = Schema.TaggedError('CollisionDetectionError')({
  message: Schema.String,
  entityId: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const PhysicsSimulationError = Schema.TaggedError('PhysicsSimulationError')({
  message: Schema.String,
  step: Schema.optional(Schema.Number),
  reason: Schema.String,
  deltaTime: Schema.optional(Schema.Number),
  timeScale: Schema.optional(Schema.Number),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

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

export const RigidBodyError = Schema.TaggedError('RigidBodyError')({
  message: Schema.String,
  entityId: Schema.optional(Schema.String),
  bodyId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const GravityError = Schema.TaggedError('GravityError')({
  message: Schema.String,
  gravityVector: Schema.optional(Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ConstraintViolationError = Schema.TaggedError('ConstraintViolationError')({
  message: Schema.String,
  constraintId: Schema.String,
  entityIds: Schema.Array(Schema.String),
  constraintType: Schema.String,
  violation: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const PhysicsMaterialError = Schema.TaggedError('PhysicsMaterialError')({
  message: Schema.String,
  materialName: Schema.optional(Schema.String),
  entityId: Schema.optional(Schema.String),
  materialId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const VelocityLimitError = Schema.TaggedError('VelocityLimitError')({
  message: Schema.String,
  entityId: Schema.String,
  currentVelocity: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  maxVelocity: Schema.Number,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const CollisionShapeError = Schema.TaggedError('CollisionShapeError')({
  message: Schema.String,
  entityId: Schema.String,
  shapeType: Schema.String,
  reason: Schema.String,
  shapeData: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const PhysicsEngineError = Schema.TaggedError('PhysicsEngineError')({
  message: Schema.String,
  engineName: Schema.String,
  initializationStep: Schema.String,
  reason: Schema.String,
  configuration: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== SYSTEM ERRORS =====

export const SystemExecutionError = Schema.TaggedError('SystemExecutionError')({
  message: Schema.String,
  systemName: Schema.String,
  reason: Schema.String,
  entityId: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const QueryExecutionError = Schema.TaggedError('QueryExecutionError')({
  message: Schema.String,
  queryType: Schema.String,
  reason: Schema.String,
  components: Schema.optional(Schema.Array(Schema.String)),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const SystemInitializationError = Schema.TaggedError('SystemInitializationError')({
  message: Schema.String,
  systemName: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== RESOURCE ERRORS =====

export const ResourceNotFoundError = Schema.TaggedError('ResourceNotFoundError')({
  message: Schema.String,
  resourceId: Schema.String,
  resourceType: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ResourceLoadError = Schema.TaggedError('ResourceLoadError')({
  message: Schema.String,
  resourceId: Schema.String,
  reason: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

// ===== VALIDATION ERRORS =====

export const ValidationError = Schema.TaggedError('ValidationError')({
  message: Schema.String,
  field: Schema.String,
  value: Schema.Unknown,
  constraint: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

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
export type InfrastructureErrors = Schema.Schema.Type<typeof ResourceNotFoundError> | Schema.Schema.Type<typeof ResourceLoadError> | Schema.Schema.Type<typeof PhysicsEngineError>

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
  | Schema.Schema.Type<typeof InvalidEntityStateError> => ErrorCategories.Entity.includes(error._tag as any)

export const isComponentError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof ComponentNotFoundError>
  | Schema.Schema.Type<typeof ComponentAlreadyExistsError>
  | Schema.Schema.Type<typeof InvalidComponentDataError>
  | Schema.Schema.Type<typeof ComponentTypeMismatchError> => ErrorCategories.Component.includes(error._tag as any)

export const isWorldError = (
  error: AllGameErrors,
): error is
  | Schema.Schema.Type<typeof ChunkNotLoadedError>
  | Schema.Schema.Type<typeof ChunkGenerationError>
  | Schema.Schema.Type<typeof InvalidPositionError>
  | Schema.Schema.Type<typeof BlockNotFoundError>
  | Schema.Schema.Type<typeof WorldStateError> => ErrorCategories.World.includes(error._tag as any)

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
  | Schema.Schema.Type<typeof CollisionShapeError> => ErrorCategories.Physics.includes(error._tag as any)

export const isSystemError = (
  error: AllGameErrors,
): error is Schema.Schema.Type<typeof SystemExecutionError> | Schema.Schema.Type<typeof QueryExecutionError> | Schema.Schema.Type<typeof SystemInitializationError> =>
  ErrorCategories.System.includes(error._tag as any)

export const isResourceError = (error: AllGameErrors): error is Schema.Schema.Type<typeof ResourceNotFoundError> | Schema.Schema.Type<typeof ResourceLoadError> =>
  ErrorCategories.Resource.includes(error._tag as any)

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
      return 'medium'

    case 'EntityCreationError':
    case 'EntityDestructionError':
    case 'ChunkGenerationError':
    case 'PhysicsSimulationError':
    case 'SystemExecutionError':
    case 'RigidBodyError':
    case 'ConstraintViolationError':
    case 'CollisionShapeError':
      return 'high'

    case 'EntityLimitExceededError':
    case 'SystemInitializationError':
    case 'WorldStateError':
    case 'PhysicsEngineError':
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
    default:
      return 'Check logs for more details and retry the operation'
  }
}
