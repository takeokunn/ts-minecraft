/**
 * Infrastructure Repositories - Central exports for all repository implementations
 *
 * This module provides a unified interface to all repository implementations,
 * following the Repository pattern to isolate data access concerns from
 * the domain layer. Repositories implement domain port interfaces and
 * provide concrete data storage and retrieval mechanisms.
 */

// World Repository
export { WorldRepositoryImpl, WorldRepositoryService, WorldRepositoryLive, WorldRepositoryUtils, type IWorldRepository } from './world.repository'

// Entity Repository
export {
  EntityRepositoryImpl,
  EntityRepository,
  EntityRepositoryLive,
  type IEntityRepository,
  type EntityMetadata,
  type EntityQueryOptions,
  type EntityChange,
} from './entity.repository'

// Chunk Repository
export {
  ChunkRepositoryImpl,
  ChunkRepository,
  ChunkRepositoryLive,
  type IChunkRepository,
  type ChunkMetadata,
  type ChunkQueryOptions,
  type ChunkStats,
  type ChunkChange,
} from './chunk.repository'

// Repository utilities and helpers
export * from './repository-utils'
