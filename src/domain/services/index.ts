/**
 * Domain Services - Pure business logic services without infrastructure dependencies
 *
 * This module exports domain services that contain the core business logic
 * of the Minecraft game, following DDD (Domain-Driven Design) principles.
 * All services are pure domain logic with port interfaces for external dependencies.
 */

// Entity Domain Service
export { EntityDomainService } from './entity-domain.service'
export type {
  EntityDomainServiceInterface,
  EntityRepositoryPort,
  EntityQueryPort,
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
} from './entity-domain.service'

// Physics Domain Service
export { PhysicsDomainService } from './physics-domain.service'
export type {
  PhysicsDomainServiceInterface,
  PhysicsPort,
  RigidBodyId,
  ConstraintId,
  PhysicsMaterialId,
  RigidBodyDefinition,
  RigidBodyState,
  RigidBody,
  BodyType,
  CollisionShape,
  PhysicsStepResult,
  CollisionPair,
  ContactPoint,
  CollisionResult,
  RaycastOptions,
  RaycastResult,
  RaycastHit,
  PhysicsStats,
  PhysicsMemoryUsage,
  PhysicsPerformanceMetrics,
} from './physics-domain.service'

// Raycast Domain Service
export { RaycastDomainService } from './raycast-domain.service'
export type { Ray, RayHit, GeometryPort, AABB as RaycastAABB } from './raycast-domain.service'

// World Domain Service
export { WorldDomainService, WorldDomainServiceLive } from './world-domain.service'
export type { WorldState, WorldRepositoryPort, ChunkRepositoryPort } from './world-domain.service'

// Camera Logic Service
export { CameraLogic } from './camera-logic'
export type { CameraConfig, CameraState, CameraUpdates, ViewMatrix, ProjectionMatrix } from './camera-logic'

// Domain Systems (updated naming convention)
export { collisionSystem } from './collision-system.service'
export { cameraControlSystem } from './camera-control.service'
export { spatialGridSystem } from './spatial-grid-system.service'
export { targetingSystem } from './targeting.service'

// Advanced systems
export * from './targeting-advanced.service'

// ECS services
export * from './ecs'

// Terrain Generation Domain Service
export { TerrainGenerationDomainService, TerrainGenerationDomainServiceLive, TerrainGenerationUtils } from './terrain-generation-domain.service'

// Mesh Generation Domain Service  
export { MeshGenerationDomainService, MeshGenerationDomainServiceLive, MeshGenerationUtils } from './mesh-generation-domain.service'

// World Management Domain Service
export { 
  WorldManagementDomainService, 
  WorldManagementDomainServiceLive, 
  WorldManagementUtils,
  WorldManagementDomainServicePort
} from './world-management-domain.service'
export type {
  IWorldManagementDomainService,
  ChunkLoadingStatus,
  ChunkMetadata,
  WorldManagementConfig,
  WorldManagementStats,
  ChunkLoadResult
} from './world-management-domain.service'
