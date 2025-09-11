/**
 * Domain Services - Detailed Service Exports
 *
 * This module contains all the detailed export statements for domain services,
 * including type re-exports and specific service implementations.
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

// Material Configuration Domain Service
export { 
  MaterialConfigDomainServiceLive, 
  MaterialConfigUtils,
  MaterialConfigDomainServicePort,
  MaterialConfigNotFoundError,
  MaterialConfigValidationError
} from './material-config-domain.service'
export type {
  IMaterialConfigDomainService,
  MaterialConfig,
  MaterialVariant,
  MaterialType
} from './material-config-domain.service'