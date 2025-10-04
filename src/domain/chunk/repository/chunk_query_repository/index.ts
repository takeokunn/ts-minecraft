/**
 * ChunkQueryRepository Module - Barrel Export
 *
 * CQRS パターンのQuery側実装
 * 読み取り専用の高性能クエリ操作を提供
 */

export {
  // Interface
  type ChunkQueryRepository,
  ChunkQueryRepository,
  type ChunkQueryRepositoryEffect,

  // Types
  type ChunkSearchCriteria,
  type ChunkAnalytics,
  type ChunkPerformanceStats,
  type ChunkNeighborhood,
  type ChunkHeatmapData,
} from './interface'

export {
  // Implementation
  ChunkQueryRepositoryLive,
} from './implementation'