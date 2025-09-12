/**
 * Domain Services - Detailed Service Exports
 *
 * This module contains all the detailed export statements for domain services,
 * including type re-exports and specific service implementations.
 */

// Entity Domain Service
export { EntityDomainService } from '@domain/services/entity-domain.service'
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
} from '@domain/services/entity-domain.service'

// Physics Domain Service
export { PhysicsDomainService } from '@domain/services/physics-domain.service'
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
} from '@domain/services/physics-domain.service'

// Raycast Domain Service
export { RaycastDomainService } from '@domain/services/raycast-domain.service'
export type { Ray, RayHit, GeometryPort, AABB as RaycastAABB } from '@domain/services/raycast-domain.service'

// World Domain Service
export { WorldDomainService, WorldDomainServiceLive } from '@domain/services/world-domain.service'
export type { WorldState, WorldRepositoryPort, ChunkRepositoryPort } from '@domain/services/world-domain.service'

// Camera Logic Service
export { CameraLogic } from '@domain/services/camera-logic'
export type { CameraConfig, CameraState, CameraUpdates, ViewMatrix, ProjectionMatrix } from '@domain/services/camera-logic'

// Domain Systems (updated naming convention)
export { collisionSystem } from '@domain/services/collision-system.service'
export { cameraControlSystem } from '@domain/services/camera-control.service'
export { spatialGridSystem } from '@domain/services/spatial-grid-system.service'
export { targetingSystem } from '@domain/services/targeting.service'

// Terrain Generation Domain Service
export { TerrainGenerationDomainService, TerrainGenerationDomainServiceLive } from '@domain/services/terrain-generation-domain.service'

// Mesh Generation Domain Service
export { MeshGenerationDomainService, MeshGenerationDomainServiceLive } from '@domain/services/mesh-generation-domain.service'

// World Management Domain Service
export { WorldManagementDomainService, WorldManagementDomainServiceLive, WorldManagementDomainServicePort } from '@domain/services/world-management-domain.service'
export type {
  IWorldManagementDomainService,
  ChunkLoadingStatus,
  ChunkMetadata,
  WorldManagementConfig,
  WorldManagementStats,
  ChunkLoadResult,
} from '@domain/services/world-management-domain.service'

// Material Configuration Domain Service
export {
  MaterialConfigDomainServiceLive,
  MaterialConfigDomainServicePort,
  MaterialConfigNotFoundError,
  MaterialConfigValidationError,
} from '@domain/services/material-config-domain.service'
export type { IMaterialConfigDomainService, MaterialConfig, MaterialVariant, MaterialType } from '@domain/services/material-config-domain.service'

// Performance Domain Service
export {
  PerformanceDomainServiceLive,
  PerformanceDomainServicePort,
  PerformanceAnalysisError,
  PerformanceThresholdViolationError,
  PERFORMANCE_THRESHOLDS,
} from '@domain/services/performance-domain.service'
export type {
  IPerformanceDomainService,
  PerformanceMetric,
  PerformanceAlert,
  OptimizationStrategy,
  PerformanceAnalysis,
  GamePerformanceContext,
  PerformanceConfig,
  PerformanceCategory,
  PerformanceSeverity,
  AlertType,
} from '@domain/services/performance-domain.service'

// Optimization Domain Service
export {
  OptimizationDomainServiceLive,
  OptimizationDomainServicePort,
  OptimizationError,
  LODConfigurationError,
  CullingError,
  OPTIMIZATION_CONSTANTS,
} from '@domain/services/optimization-domain.service'
export type {
  IOptimizationDomainService,
  LODLevel,
  LODConfiguration,
  CullingConfiguration,
  CullingResult,
  BatchingStrategy,
  RenderBatch,
  OptimizationTargets,
  OptimizationMetrics,
  OptimizationDecision,
  SpatialOptimizationData,
  QualitySettings,
  CullingType,
} from '@domain/services/optimization-domain.service'
