/**
 * Infrastructure Repositories - Detailed Repository Exports
 *
 * This module contains all detailed export statements for repository implementations,
 * following the Repository pattern to isolate data access concerns.
 */

// World Repository
export { createWorldRepository, WorldRepositoryService, WorldRepositoryLive, type IWorldRepository } from '@infrastructure/repositories/world.repository'

// Entity Repository
export {
  EntityRepositoryImpl,
  EntityRepository,
  EntityRepositoryLive,
  type IEntityRepository,
  type EntityMetadata,
  type EntityQueryOptions,
  type EntityChange,
} from '@infrastructure/entity.repository'

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
} from '@infrastructure/chunk.repository'
