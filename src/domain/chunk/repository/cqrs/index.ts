import { ChunkEventRepository } from '../chunk_event_repository'
import { ChunkQueryRepository } from '../chunk_query_repository'
import { ChunkRepository } from '../chunk_repository'

/**
 * CQRS Repository Pattern Implementation
 *
 * Command Query Responsibility Segregation (CQRS) パターンの実装
 * Command（書き込み）とQuery（読み取り）の責務を分離
 */

// ===== CQRS Layer Combinations ===== //

export * from './layer'

// ===== Type Helpers ===== //

/**
 * CQRS Repository Dependencies
 */
export type ChunkCQRSRepositories = ChunkRepository | ChunkQueryRepository

/**
 * Event Sourcing CQRS Dependencies
 */
export type ChunkEventSourcingRepositories = ChunkRepository | ChunkQueryRepository | ChunkEventRepository

// ===== Export Convenience ===== //

export {
  ChunkEventRepository,
  ChunkQueryRepository,
  ChunkRepository,
  type ChunkEventRepository,
  type ChunkQueryRepository,
  // Repository Interfaces
  type ChunkRepository,
} from '../chunk_repository'
