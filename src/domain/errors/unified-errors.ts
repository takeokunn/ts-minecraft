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
export const GameError = Schema.TaggedError("GameError")({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

/**
 * Domain-level errors for business logic violations
 */
export const DomainError = Schema.TaggedError("DomainError")({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

/**
 * Infrastructure-level errors for external system failures
 */
export const InfrastructureError = Schema.TaggedError("InfrastructureError")({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

/**
 * Application-level errors for use case failures
 */
export const ApplicationError = Schema.TaggedError("ApplicationError")({
  message: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

// ===== ENTITY SUBSYSTEM ERRORS =====

export const EntityNotFoundError = Schema.TaggedError("EntityNotFoundError")({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export const EntityAlreadyExistsError = Schema.TaggedError("EntityAlreadyExistsError")({
  message: Schema.String,
  entityId: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export const EntityCreationError = Schema.TaggedError("EntityCreationError")({
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export const EntityDestructionError = Schema.TaggedError("EntityDestructionError")({
  message: Schema.String,
  entityId: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export const EntityLimitExceededError = Schema.TaggedError("EntityLimitExceededError")({
  message: Schema.String,
  limit: Schema.Number,
  current: Schema.Number,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export const InvalidEntityStateError = Schema.TaggedError("InvalidEntityStateError")({
  message: Schema.String,
  entityId: Schema.String,
  state: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

// ===== COMPONENT SUBSYSTEM ERRORS =====

export class ComponentNotFoundError extends DomainError {
  readonly _tag = 'ComponentNotFoundError' as const
  constructor(data: { readonly entityId: EntityId; readonly componentName: ComponentName; readonly message?: string }) {
    super({
      message: data.message || `Component ${data.componentName} not found on entity ${data.entityId}`,
      timestamp: Date.now(),
      context: { entityId: data.entityId, componentName: data.componentName },
    })
  }
}

export class ComponentAlreadyExistsError extends DomainError {
  readonly _tag = 'ComponentAlreadyExistsError' as const
  constructor(data: { readonly entityId: EntityId; readonly componentName: ComponentName; readonly message?: string }) {
    super({
      message: data.message || `Component ${data.componentName} already exists on entity ${data.entityId}`,
      timestamp: Date.now(),
      context: { entityId: data.entityId, componentName: data.componentName },
    })
  }
}

export class InvalidComponentDataError extends DomainError {
  readonly _tag = 'InvalidComponentDataError' as const
  constructor(data: { readonly componentName: ComponentName; readonly validationErrors: readonly string[]; readonly message?: string }) {
    super({
      message: data.message || `Invalid component data for ${data.componentName}: ${data.validationErrors.join(', ')}`,
      timestamp: Date.now(),
      context: { componentName: data.componentName, validationErrors: data.validationErrors },
    })
  }
}

export class ComponentTypeMismatchError extends DomainError {
  readonly _tag = 'ComponentTypeMismatchError' as const
  constructor(data: { readonly componentName: ComponentName; readonly expectedType: string; readonly actualType: string }) {
    super({
      message: `Component type mismatch for ${data.componentName}: expected ${data.expectedType}, got ${data.actualType}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== WORLD SUBSYSTEM ERRORS =====

export class ChunkNotLoadedError extends DomainError {
  readonly _tag = 'ChunkNotLoadedError' as const
  constructor(data: { readonly chunkX: number; readonly chunkZ: number; readonly message?: string }) {
    super({
      message: data.message || `Chunk not loaded: (${data.chunkX}, ${data.chunkZ})`,
      timestamp: Date.now(),
      context: { chunkX: data.chunkX, chunkZ: data.chunkZ },
    })
  }
}

export class ChunkGenerationError extends DomainError {
  readonly _tag = 'ChunkGenerationError' as const
  constructor(data: { readonly chunkX: number; readonly chunkZ: number; readonly reason: string }) {
    super({
      message: `Chunk generation failed for (${data.chunkX}, ${data.chunkZ}): ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class InvalidPositionError extends DomainError {
  readonly _tag = 'InvalidPositionError' as const
  constructor(data: { readonly x: number; readonly y: number; readonly z: number; readonly reason?: string }) {
    super({
      message: `Invalid position (${data.x}, ${data.y}, ${data.z})${data.reason ? ': ' + data.reason : ''}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class BlockNotFoundError extends DomainError {
  readonly _tag = 'BlockNotFoundError' as const
  constructor(data: { readonly x: number; readonly y: number; readonly z: number; readonly message?: string }) {
    super({
      message: data.message || `Block not found at (${data.x}, ${data.y}, ${data.z})`,
      timestamp: Date.now(),
      context: { x: data.x, y: data.y, z: data.z },
    })
  }
}

export class WorldStateError extends DomainError {
  readonly _tag = 'WorldStateError' as const
  constructor(data: { readonly operation: string; readonly reason: string }) {
    super({
      message: `World state error during ${data.operation}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== PHYSICS SUBSYSTEM ERRORS =====

export class CollisionDetectionError extends DomainError {
  readonly _tag = 'CollisionDetectionError' as const
  constructor(data: { readonly entityId: EntityId; readonly reason: string }) {
    super({
      message: `Collision detection failed for entity ${data.entityId}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class PhysicsSimulationError extends DomainError {
  readonly _tag = 'PhysicsSimulationError' as const
  constructor(data: { readonly step?: number; readonly reason: string; readonly deltaTime?: number; readonly timeScale?: number }) {
    super({
      message: `Physics simulation failed${data.step ? ` at step ${data.step}` : ''}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class RaycastError extends DomainError {
  readonly _tag = 'RaycastError' as const
  constructor(data: { readonly reason: string; readonly ray?: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }; readonly cause?: unknown }) {
    super({
      message: `Raycast failed: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class RigidBodyError extends DomainError {
  readonly _tag = 'RigidBodyError' as const
  constructor(data: { readonly message: string; readonly entityId?: EntityId; readonly bodyId?: string; readonly cause?: unknown }) {
    super({
      message: data.message,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class GravityError extends DomainError {
  readonly _tag = 'GravityError' as const
  constructor(data: { readonly message: string; readonly gravityVector?: { x: number; y: number; z: number }; readonly cause?: unknown }) {
    super({
      message: data.message,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class ConstraintViolationError extends DomainError {
  readonly _tag = 'ConstraintViolationError' as const
  constructor(data: { readonly constraintId: string; readonly entityIds: readonly EntityId[]; readonly constraintType: string; readonly violation: string }) {
    super({
      message: `Constraint violation in ${data.constraintType} constraint ${data.constraintId}: ${data.violation}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class PhysicsMaterialError extends DomainError {
  readonly _tag = 'PhysicsMaterialError' as const
  constructor(data: { readonly message: string; readonly materialName?: string; readonly entityId?: EntityId; readonly materialId?: string; readonly cause?: unknown }) {
    super({
      message: data.message,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class VelocityLimitError extends DomainError {
  readonly _tag = 'VelocityLimitError' as const
  constructor(data: { readonly entityId: EntityId; readonly currentVelocity: { x: number; y: number; z: number }; readonly maxVelocity: number; readonly reason: string }) {
    super({
      message: `Velocity limit exceeded for entity ${data.entityId}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class CollisionShapeError extends DomainError {
  readonly _tag = 'CollisionShapeError' as const
  constructor(data: { readonly entityId: EntityId; readonly shapeType: string; readonly reason: string; readonly shapeData?: unknown }) {
    super({
      message: `Collision shape error for entity ${data.entityId} (${data.shapeType}): ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class PhysicsEngineError extends InfrastructureError {
  readonly _tag = 'PhysicsEngineError' as const
  constructor(data: { readonly engineName: string; readonly initializationStep: string; readonly reason: string; readonly configuration?: Record<string, unknown> }) {
    super({
      message: `Physics engine initialization failed for ${data.engineName} at ${data.initializationStep}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== SYSTEM ERRORS =====

export class SystemExecutionError extends ApplicationError {
  readonly _tag = 'SystemExecutionError' as const
  constructor(data: { readonly systemName: string; readonly reason: string; readonly entityId?: EntityId }) {
    super({
      message: `System execution failed for ${data.systemName}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class QueryExecutionError extends DomainError {
  readonly _tag = 'QueryExecutionError' as const
  constructor(data: { readonly queryType: string; readonly reason: string; readonly components?: readonly ComponentName[] }) {
    super({
      message: `Query execution failed for ${data.queryType}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class SystemInitializationError extends ApplicationError {
  readonly _tag = 'SystemInitializationError' as const
  constructor(data: { readonly systemName: string; readonly reason: string }) {
    super({
      message: `System initialization failed for ${data.systemName}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== RESOURCE ERRORS =====

export class ResourceNotFoundError extends InfrastructureError {
  readonly _tag = 'ResourceNotFoundError' as const
  constructor(data: { readonly resourceId: string; readonly resourceType: string }) {
    super({
      message: `Resource not found: ${data.resourceType} with id ${data.resourceId}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

export class ResourceLoadError extends InfrastructureError {
  readonly _tag = 'ResourceLoadError' as const
  constructor(data: { readonly resourceId: string; readonly reason: string }) {
    super({
      message: `Failed to load resource ${data.resourceId}: ${data.reason}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== VALIDATION ERRORS =====

export class ValidationError extends DomainError {
  readonly _tag = 'ValidationError' as const
  constructor(data: { readonly field: string; readonly value: unknown; readonly constraint: string }) {
    super({
      message: `Validation failed for field ${data.field}: ${data.constraint}`,
      timestamp: Date.now(),
      context: data,
    })
  }
}

// ===== ERROR UTILITIES =====

/**
 * Union type of all domain errors for comprehensive error handling
 */
export type DomainErrors =
  | EntityNotFoundError
  | EntityAlreadyExistsError
  | EntityCreationError
  | EntityDestructionError
  | EntityLimitExceededError
  | InvalidEntityStateError
  | ComponentNotFoundError
  | ComponentAlreadyExistsError
  | InvalidComponentDataError
  | ComponentTypeMismatchError
  | ChunkNotLoadedError
  | ChunkGenerationError
  | InvalidPositionError
  | BlockNotFoundError
  | WorldStateError
  | CollisionDetectionError
  | PhysicsSimulationError
  | RaycastError
  | RigidBodyError
  | GravityError
  | ConstraintViolationError
  | PhysicsMaterialError
  | VelocityLimitError
  | CollisionShapeError
  | SystemExecutionError
  | QueryExecutionError
  | SystemInitializationError
  | ValidationError

/**
 * Union type of all infrastructure errors
 */
export type InfrastructureErrors = ResourceNotFoundError | ResourceLoadError | PhysicsEngineError

/**
 * Union type of all application errors
 */
export type ApplicationErrors = SystemExecutionError | SystemInitializationError

/**
 * Union type of all possible game errors
 */
export type AllGameErrors = DomainErrors | InfrastructureErrors | ApplicationErrors

/**
 * Error categorization utility
 */
export const ErrorCategories = {
  Entity: [
    'EntityNotFoundError',
    'EntityAlreadyExistsError',
    'EntityCreationError',
    'EntityDestructionError',
    'EntityLimitExceededError',
    'InvalidEntityStateError',
  ] as const,
  Component: [
    'ComponentNotFoundError',
    'ComponentAlreadyExistsError',
    'InvalidComponentDataError',
    'ComponentTypeMismatchError',
  ] as const,
  World: ['ChunkNotLoadedError', 'ChunkGenerationError', 'InvalidPositionError', 'BlockNotFoundError', 'WorldStateError'] as const,
  Physics: ['CollisionDetectionError', 'PhysicsSimulationError', 'RaycastError', 'RigidBodyError', 'GravityError', 'ConstraintViolationError', 'PhysicsMaterialError', 'VelocityLimitError', 'CollisionShapeError'] as const,
  System: ['SystemExecutionError', 'QueryExecutionError', 'SystemInitializationError'] as const,
  Resource: ['ResourceNotFoundError', 'ResourceLoadError'] as const,
  Validation: ['ValidationError'] as const,
} as const

/**
 * Type guard utilities for error classification
 */
export const isEntityError = (error: AllGameErrors): error is EntityNotFoundError | EntityAlreadyExistsError | EntityCreationError | EntityDestructionError | EntityLimitExceededError | InvalidEntityStateError =>
  ErrorCategories.Entity.includes(error._tag as any)

export const isComponentError = (error: AllGameErrors): error is ComponentNotFoundError | ComponentAlreadyExistsError | InvalidComponentDataError | ComponentTypeMismatchError =>
  ErrorCategories.Component.includes(error._tag as any)

export const isWorldError = (error: AllGameErrors): error is ChunkNotLoadedError | ChunkGenerationError | InvalidPositionError | BlockNotFoundError | WorldStateError =>
  ErrorCategories.World.includes(error._tag as any)

export const isPhysicsError = (error: AllGameErrors): error is CollisionDetectionError | PhysicsSimulationError | RaycastError | RigidBodyError | GravityError | ConstraintViolationError | PhysicsMaterialError | VelocityLimitError | CollisionShapeError =>
  ErrorCategories.Physics.includes(error._tag as any)

export const isSystemError = (error: AllGameErrors): error is SystemExecutionError | QueryExecutionError | SystemInitializationError =>
  ErrorCategories.System.includes(error._tag as any)

export const isResourceError = (error: AllGameErrors): error is ResourceNotFoundError | ResourceLoadError =>
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