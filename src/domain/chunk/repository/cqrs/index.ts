import { Layer } from 'effect'
import { ChunkEventRepository } from '../chunk_event_repository/interface'
import { ChunkQueryRepositoryLive } from '../chunk_query_repository/implementation'
import { ChunkQueryRepository } from '../chunk_query_repository/interface'
import { ChunkRepository } from '../chunk_repository/interface'

/**
 * CQRS Repository Pattern Implementation
 *
 * Command Query Responsibility Segregation (CQRS) パターンの実装
 * Command（書き込み）とQuery（読み取り）の責務を分離
 */

// ===== CQRS Layer Combinations ===== //

/**
 * 基本CQRS Layer
 * ChunkRepository（Command側）+ ChunkQueryRepository（Query側）
 */
export const ChunkCQRSRepositoryLayer = <R>(commandLayer: Layer.Layer<ChunkRepository, never, R>) =>
  Layer.mergeAll(commandLayer, ChunkQueryRepositoryLive)

/**
 * Event Sourcing付きCQRS Layer
 * Command + Query + Event の完全な分離
 */
export const ChunkEventSourcingCQRSLayer = <R, E>(
  commandLayer: Layer.Layer<ChunkRepository, E, R>,
  eventLayer: Layer.Layer<ChunkEventRepository, E, R>
) => Layer.mergeAll(commandLayer, ChunkQueryRepositoryLive, eventLayer)

/**
 * 読み取り専用Layer（Query側のみ）
 */
export const ChunkReadOnlyLayer = <R>(queryLayer: Layer.Layer<ChunkRepository, never, R>) =>
  Layer.mergeAll(queryLayer, ChunkQueryRepositoryLive)

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
} from '../chunk_repository/interface'
