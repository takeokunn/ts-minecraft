/**
 * Chunk Repository Domain - Complete Implementation
 *
 * DDDのRepository Patternを完全実装
 * - Command/Query責務分離（CQRS）
 * - Event Sourcing対応
 * - 複数実装Strategy Pattern
 * - 環境適応型選択
 * - 型安全エラーハンドリング
 */

// ===== Core Repository ===== //

export {
  ChunkRepository,
  InMemoryChunkRepositoryLive,
  IndexedDBChunkRepositoryLive,
  WORKER_SCRIPT_TEMPLATE,
  WebWorkerChunkRepositoryLive,
  createWebWorkerChunkRepository,
  type BatchOperationResult,
  type ChunkArray,
  type ChunkOption,
  type ChunkQuery,
  type ChunkRegion,
  // ChunkRepository (Command Side)
  type ChunkRepository,
  type ChunkRepositoryEffect,
  type ChunkStatistics,
} from './chunk_repository'

// ===== Query Repository (CQRS) ===== //

export {
  ChunkQueryRepository,
  ChunkQueryRepositoryLive,
  type ChunkAnalytics,
  type ChunkHeatmapData,
  type ChunkNeighborhood,
  type ChunkPerformanceStats,
  // ChunkQueryRepository (Query Side)
  type ChunkQueryRepository,
  type ChunkQueryRepositoryEffect,
  type ChunkSearchCriteria,
} from './chunk_query_repository'

// ===== Event Repository (Event Sourcing) ===== //

export {
  ChunkEventRepository,
  type BaseChunkEvent,
  type BlockChangedEvent,
  type ChunkCorruptedEvent,
  type ChunkCreatedEvent,
  type ChunkDeletedEvent,
  type ChunkEvent,
  // ChunkEventRepository (Event Sourcing)
  type ChunkEventRepository,
  type ChunkEventRepositoryEffect,
  type ChunkLoadedEvent,
  type ChunkModifiedEvent,
  type ChunkOptimizedEvent,
  type ChunkSavedEvent,
  type ChunkSnapshot,
  type ChunkUnloadedEvent,
  type ChunkValidatedEvent,
  type EventFactory,
  type EventProjection,
  type EventQuery,
  type EventStream,
} from './chunk_event_repository'

// ===== Error Handling ===== //

export {
  RepositoryError,
  RepositoryErrorSchema,
  RepositoryErrors,
  getRetryDelay,
  isChunkNotFoundError,
  isDataIntegrityError,
  isDuplicateChunkError,
  isNetworkError,
  isPermissionError,
  isResourceLimitError,
  isRetryableError,
  isStorageError,
  isTimeoutError,
  isTransientError,
  isValidationError,
  // Repository Errors
  type RepositoryError,
} from './types'

// ===== Strategy Pattern ===== //

export {
  DevelopmentRepositoryLayer,
  ProductionRepositoryLayer,
  RepositoryConfigBuilder,
  TestRepositoryLayer,
  autoSelectStrategy,
  configureRepository,
  createOptimizedRepositoryLayer,
  createRepositoryLayer,
  detectEnvironment,
  selectOptimalStrategy,
  type EnvironmentInfo,
  type PerformanceRequirements,
  type RepositoryConfig,
  // Repository Strategy
  type RepositoryStrategyType,
} from './strategy'

// ===== CQRS Layers ===== //

export {
  ChunkCQRSRepositoryLayer,
  ChunkEventSourcingCQRSLayer,
  ChunkReadOnlyLayer,
  // CQRS Integration
  type ChunkCQRSRepositories,
  type ChunkEventSourcingRepositories,
} from './cqrs'

// ===== Convenience Functions ===== //

/**
 * 開発環境用のAll-in-One Repository Layer
 * メモリベースの高速実装
 */
export const ChunkDevelopmentLayer = ChunkCQRSRepositoryLayer(InMemoryChunkRepositoryLive)

/**
 * テスト環境用のAll-in-One Repository Layer
 * テスト特化の設定
 */
export const ChunkTestLayer = ChunkCQRSRepositoryLayer(InMemoryChunkRepositoryLive)

/**
 * 本番環境用のAll-in-One Repository Layer
 * 環境自動検出による最適化実装
 */
export const ChunkProductionLayer = ChunkCQRSRepositoryLayer(ProductionRepositoryLayer)
