import { Schema } from 'effect'
import { BaseErrorData, createErrorContext } from '@domain/errors/generator'
import type { EntityId } from '@domain/value-objects/entity-id.vo'
import type { Position } from '@domain/value-objects/coordinates'

/**
 * Collision detection computation failed
 * Recovery: Ignore collision or use approximate detection
 */
export const CollisionDetectionError = Schema.TaggedError('CollisionDetectionError')<
  BaseErrorData & {
    readonly affectedBodies: ReadonlyArray<string>
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    affectedBodies: Schema.Array(Schema.String),
  })
)
export type CollisionDetectionError = Schema.Schema.Type<typeof CollisionDetectionError>

export const createCollisionDetectionError = (
  message: string,
  affectedBodies: ReadonlyArray<string> = [],
  metadata?: Record<string, unknown>,
): CollisionDetectionError =>
  CollisionDetectionError({
    message,
    affectedBodies,
    context: createErrorContext('ignore', 'low', metadata),
  })

/**
 * Physics simulation step failed
 * Recovery: Skip frame or use previous state
 */
export const PhysicsSimulationError = Schema.TaggedError('PhysicsSimulationError')<
  BaseErrorData & {
    readonly deltaTime?: number
    readonly timeScale?: number
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    deltaTime: Schema.optional(Schema.Number),
    timeScale: Schema.optional(Schema.Number),
  })
)
export type PhysicsSimulationError = Schema.Schema.Type<typeof PhysicsSimulationError>

export const createPhysicsSimulationError = (
  message: string,
  deltaTime?: number,
  timeScale?: number,
  metadata?: Record<string, unknown>,
): PhysicsSimulationError =>
  PhysicsSimulationError({
    message,
    deltaTime,
    timeScale,
    context: createErrorContext('ignore', 'medium', metadata),
  })

/**
 * Rigid body calculation error
 * Recovery: Reset to stable state or disable physics
 */
export const RigidBodyError = Schema.TaggedError('RigidBodyError')<
  BaseErrorData & {
    readonly entityId?: EntityId
    readonly bodyId?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    entityId: Schema.optional(Schema.String),
    bodyId: Schema.optional(Schema.String),
  })
)
export type RigidBodyError = Schema.Schema.Type<typeof RigidBodyError>

export const createRigidBodyError = (
  message: string,
  entityId?: EntityId,
  bodyId?: string,
  metadata?: Record<string, unknown>,
): RigidBodyError =>
  RigidBodyError({
    message,
    entityId,
    bodyId,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * Gravity calculation failed
 * Recovery: Use default gravity or disable gravity
 */
export const GravityError = Schema.TaggedError('GravityError')<
  BaseErrorData & {
    readonly entityId?: EntityId
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    entityId: Schema.optional(Schema.String),
  })
)
export type GravityError = Schema.Schema.Type<typeof GravityError>

export const createGravityError = (
  message: string,
  entityId?: EntityId,
  metadata?: Record<string, unknown>,
): GravityError =>
  GravityError({
    message,
    entityId,
    context: createErrorContext('fallback', 'low', metadata),
  })

/**
 * Physics constraint violation
 * Recovery: Adjust constraints or disable constraint
 */
export const ConstraintViolationError = Schema.TaggedError('ConstraintViolationError')<
  BaseErrorData & {
    readonly constraintId?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    constraintId: Schema.optional(Schema.String),
  })
)
export type ConstraintViolationError = Schema.Schema.Type<typeof ConstraintViolationError>

export const createConstraintViolationError = (
  message: string,
  constraintId?: string,
  metadata?: Record<string, unknown>,
): ConstraintViolationError =>
  ConstraintViolationError({
    message,
    constraintId,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * Raycasting operation failed
 * Recovery: Return empty result or use cached result
 */
export const RaycastError = Schema.TaggedError('RaycastError')<
  BaseErrorData & {
    readonly ray?: { origin: Position; direction: { x: number; y: number; z: number } }
    readonly maxDistance?: number
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    ray: Schema.optional(
      Schema.Struct({
        origin: Schema.Unknown, // Position type would need to be defined as Schema
        direction: Schema.Struct({
          x: Schema.Number,
          y: Schema.Number,
          z: Schema.Number,
        }),
      })
    ),
    maxDistance: Schema.optional(Schema.Number),
  })
)
export type RaycastError = Schema.Schema.Type<typeof RaycastError>

export const createRaycastError = (
  message: string,
  ray?: { origin: Position; direction: { x: number; y: number; z: number } },
  maxDistance?: number,
  metadata?: Record<string, unknown>,
): RaycastError =>
  RaycastError({
    message,
    ray,
    maxDistance,
    context: createErrorContext('fallback', 'low', metadata),
  })

/**
 * Physics material property error
 * Recovery: Use default material properties
 */
export const PhysicsMaterialError = Schema.TaggedError('PhysicsMaterialError')<
  BaseErrorData & {
    readonly materialName?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    materialName: Schema.optional(Schema.String),
  })
)
export type PhysicsMaterialError = Schema.Schema.Type<typeof PhysicsMaterialError>

export const createPhysicsMaterialError = (
  message: string,
  materialName?: string,
  metadata?: Record<string, unknown>,
): PhysicsMaterialError =>
  PhysicsMaterialError({
    message,
    materialName,
    context: createErrorContext('fallback', 'low', metadata),
  })
