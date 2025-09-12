/**
 * Infrastructure Repositories - Functional Effect-TS Repository Exports
 *
 * This module contains all detailed export statements for functional repository implementations,
 * following the Repository pattern with Effect-TS functional patterns.
 */

// World Repository
export { 
  createWorldRepository, 
  WorldRepositoryService, 
  WorldRepositoryLive, 
  type IWorldRepository 
} from './world.repository'

// Entity Repository
export {
  createEntityRepository,
  EntityRepository,
  EntityRepositoryLive,
  type IEntityRepository,
  type EntityMetadata,
  type EntityQueryOptions,
  type EntityChange,
} from './entity.repository'

// Chunk Repository
export {
  createChunkRepository,
  ChunkRepository,
  ChunkRepositoryLive,
  type IChunkRepository,
  type ChunkMetadata,
  type ChunkQueryOptions,
  type ChunkStats,
  type ChunkChange,
} from './chunk.repository'

// Component Repository
export {
  createComponentRepository,
  ComponentRepository,
  ComponentRepositoryLive,
  type IComponentRepository,
  type ComponentMetadata,
  type ComponentStats,
  type ComponentQueryOptions,
  type ComponentChange,
} from './component.repository'

// Physics Repository
export {
  createPhysicsRepository,
  PhysicsRepository,
  PhysicsRepositoryLive,
  type IPhysicsRepository,
  type PhysicsBody,
  type CollisionEvent,
  type SpatialRegion,
  type PhysicsQueryOptions,
  type PhysicsStats,
} from './physics.repository'

// Repository Factory
export {
  RepositoryFactory,
  RepositoryComposition,
  RepositoryHealth,
  RepositoryMigration,
  RepositoryTesting,
  RepositoryDI,
  CoreRepositories,
  StorageRepositories,
  PhysicsRepositories,
  AllRepositories,
  type RepositoryConfig,
} from './repository-factory'

// Repository utilities
export * from './repository-utils'

// Functional repository implementations (direct access to all exports)
export * from './world.repository'
export * from './entity.repository' 
export * from './chunk.repository'
export * from './component.repository'
export * from './physics.repository'
export * from './repository-factory'
