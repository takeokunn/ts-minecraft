/**
 * @fileoverview Chunk Domain Layer
 * Domain層の依存関係を提供（Repository層のみ）
 */

import { Layer } from 'effect'
import { ChunkDomainServices } from './domain_service'
import { ChunkCommandHandlerLive, ChunkQueryHandlerLive, ChunkReadModelLive } from './cqrs'
import { ChunkDevelopmentLayer } from './repository/layers'

/**
 * Chunk Domain Layer
 * - Repository: ChunkDevelopmentLayer (CQRS + InMemory)
 * - Domain Service: ChunkDomainServices (Validation / Serialization / Optimization)
 */
export const ChunkDomainLive = Layer.mergeAll(
  ChunkDevelopmentLayer,
  ChunkDomainServices,
  ChunkReadModelLive,
  ChunkCommandHandlerLive,
  ChunkQueryHandlerLive
)
