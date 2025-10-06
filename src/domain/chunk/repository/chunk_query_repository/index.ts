/**
 * ChunkQueryRepository Module - Barrel Export
 *
 * CQRS パターンに基づく読み取り専用リポジトリ
 * 高速な検索・集約クエリの最適化
 */

export {
  ChunkQueryRepository,
  // Query Types
  type ChunkFilter,
  // Interface
  type ChunkQueryRepository,
  type ChunkQueryRepositoryEffect,
  type ChunkQueryResult,
  type ChunkSortOptions,
  type ChunkStatistics,
  // Pagination
  type PageInfo,
  type PaginatedChunkResult,
  // Query Builders
  type QueryBuilder,
  type QueryCriteria,
  type QueryProjection,
} from './interface'

// Note: Implementation will be added in a separate task
// For now, we export only the interface and types
