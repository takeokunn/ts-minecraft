import { defineError } from './generator'
import { PhysicsError } from './base-errors'
import type { EntityId } from '@/core/values/entity-id'
import type { Position } from '@/core/values/coordinates'

/**
 * Collision detection computation failed
 * Recovery: Ignore collision or use approximate detection
 */
export const CollisionDetectionError = defineError<{
  readonly entityId: EntityId
  readonly position: Position
  readonly reason: string
  readonly collisionType?: 'entity-entity' | 'entity-block' | 'entity-boundary'
}>('CollisionDetectionError', PhysicsError, 'ignore', 'low')

/**
 * Physics simulation step failed
 * Recovery: Skip frame or use previous state
 */
export const PhysicsSimulationError = defineError<{
  readonly tickNumber: number
  readonly affectedEntities: EntityId[]
  readonly reason: string
  readonly simulationDelta: number
}>('PhysicsSimulationError', PhysicsError, 'ignore', 'medium')

/**
 * Rigid body calculation error
 * Recovery: Reset to stable state or disable physics
 */
export const RigidBodyError = defineError<{
  readonly entityId: EntityId
  readonly bodyType: 'dynamic' | 'kinematic' | 'static'
  readonly reason: string
  readonly mass?: number
  readonly velocity?: { x: number; y: number; z: number }
}>('RigidBodyError', PhysicsError, 'fallback', 'medium')

/**
 * Gravity calculation failed
 * Recovery: Use default gravity or disable gravity
 */
export const GravityError = defineError<{
  readonly entityId: EntityId
  readonly position: Position
  readonly gravityVector: { x: number; y: number; z: number }
  readonly reason: string
}>('GravityError', PhysicsError, 'fallback', 'low')

/**
 * Velocity calculation exceeded safe limits
 * Recovery: Cap velocity or reset to zero
 */
export const VelocityLimitError = defineError<{
  readonly entityId: EntityId
  readonly currentVelocity: { x: number; y: number; z: number }
  readonly maxVelocity: number
  readonly reason: string
}>('VelocityLimitError', PhysicsError, 'fallback', 'low')

/**
 * Physics constraint violation
 * Recovery: Adjust constraints or disable constraint
 */
export const ConstraintViolationError = defineError<{
  readonly constraintId: string
  readonly entityIds: EntityId[]
  readonly constraintType: 'distance' | 'hinge' | 'spring' | 'fixed'
  readonly violation: string
}>('ConstraintViolationError', PhysicsError, 'fallback', 'medium')

/**
 * Raycasting operation failed
 * Recovery: Return empty result or use cached result
 */
export const RaycastError = defineError<{
  readonly origin: Position
  readonly direction: { x: number; y: number; z: number }
  readonly maxDistance: number
  readonly reason: string
}>('RaycastError', PhysicsError, 'fallback', 'low')

/**
 * Physics engine initialization failed
 * Recovery: Use fallback physics or disable physics
 */
export const PhysicsEngineError = defineError<{
  readonly engineName: string
  readonly initializationStep: string
  readonly reason: string
  readonly configuration?: Record<string, unknown>
}>('PhysicsEngineError', PhysicsError, 'fallback', 'high')

/**
 * Collision shape creation/update failed
 * Recovery: Use bounding box or disable collision
 */
export const CollisionShapeError = defineError<{
  readonly entityId: EntityId
  readonly shapeType: 'box' | 'sphere' | 'capsule' | 'mesh' | 'heightfield'
  readonly reason: string
  readonly shapeData?: unknown
}>('CollisionShapeError', PhysicsError, 'fallback', 'medium')

/**
 * Physics material property error
 * Recovery: Use default material properties
 */
export const PhysicsMaterialError = defineError<{
  readonly entityId: EntityId
  readonly materialId: string
  readonly property: 'friction' | 'restitution' | 'density' | 'damping'
  readonly invalidValue: number
  readonly reason: string
}>('PhysicsMaterialError', PhysicsError, 'fallback', 'low')