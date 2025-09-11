/**
 * Domain Services - Core business logic services
 * 
 * This module exports domain services that contain the core business logic
 * of the Minecraft game, following DDD (Domain-Driven Design) principles.
 */

// Entity Management Service
export { EntityService } from './entity.service'
export type {
  EntityServiceInterface,
  Entity,
  ArchetypeInfo,
  SerializedEntity,
  EntityMetadata,
  EntityStats,
  EntityMemoryUsage,
  QueryPerformanceStats,
  EntityIntegrityResult,
  EntityIssue,
  ArchetypeOptimizationResult,
  EntityWithComponents,
  StorageLayout,
} from './entity.service'

// Physics Simulation Service
export { PhysicsService } from './physics.service'
export type {
  PhysicsServiceInterface,
  RigidBodyId,
  ConstraintId,
  PhysicsMaterialId,
  Vector3,
  Quaternion,
  RigidBodyDefinition,
  RigidBodyState,
  RigidBody,
  BodyType,
  CollisionShape,
  PhysicsStepResult,
  CollisionPair,
  ContactPoint,
  CollisionResult,
  Ray,
  RaycastOptions,
  RaycastResult,
  RaycastHit,
  PhysicsStats,
  PhysicsMemoryUsage,
  PhysicsPerformanceMetrics,
} from './physics.service'

// Raycast Service
export { Raycast } from './raycast.service'
export type { RayHit } from './raycast.service'

// Camera Logic Service
export { CameraLogic } from './camera-logic'
export type {
  CameraConfig,
  CameraState,
  CameraUpdates,
  ViewMatrix,
  ProjectionMatrix,
} from './camera-logic'