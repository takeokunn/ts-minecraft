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
  // ChunkRepository (Command Side)
  type ChunkRepository,
  ChunkRepository,
  type ChunkRepositoryEffect,
  type ChunkQuery,
  type ChunkRegion,
  type ChunkStatistics,
  type BatchOperationResult,
  type ChunkOption,
  type ChunkArray,
  InMemoryChunkRepositoryLive,
  IndexedDBChunkRepositoryLive,
  WebWorkerChunkRepositoryLive,
  createWebWorkerChunkRepository,
  WORKER_SCRIPT_TEMPLATE,
} from './chunk_repository'

// ===== Query Repository (CQRS) ===== //

export {
  // ChunkQueryRepository (Query Side)
  type ChunkQueryRepository,
  ChunkQueryRepository,
  type ChunkQueryRepositoryEffect,
  type ChunkSearchCriteria,
  type ChunkAnalytics,
  type ChunkPerformanceStats,
  type ChunkNeighborhood,
  type ChunkHeatmapData,
  ChunkQueryRepositoryLive,
} from './chunk_query_repository'

// ===== Event Repository (Event Sourcing) ===== //

export {
  // ChunkEventRepository (Event Sourcing)
  type ChunkEventRepository,
  ChunkEventRepository,
  type ChunkEventRepositoryEffect,
  type BaseChunkEvent,
  type ChunkEvent,
  type ChunkCreatedEvent,
  type ChunkLoadedEvent,
  type ChunkUnloadedEvent,
  type ChunkModifiedEvent,
  type ChunkSavedEvent,
  type ChunkDeletedEvent,
  type BlockChangedEvent,
  type ChunkOptimizedEvent,
  type ChunkValidatedEvent,
  type ChunkCorruptedEvent,
  type EventStream,
  type EventProjection,
  type ChunkSnapshot,
  type EventQuery,
  type EventFactory,
} from './chunk_event_repository'

// ===== Error Handling ===== //

export {
  // Repository Errors
  type RepositoryError,
  RepositoryError,
  RepositoryErrors,
  RepositoryErrorSchema,
  isChunkNotFoundError,
  isDuplicateChunkError,
  isStorageError,
  isValidationError,
  isDataIntegrityError,
  isNetworkError,
  isTimeoutError,
  isPermissionError,
  isResourceLimitError,
  isRetryableError,
  isTransientError,
  getRetryDelay,
} from './types'

// ===== Strategy Pattern ===== //

export {
  // Repository Strategy
  type RepositoryStrategyType,
  type EnvironmentInfo,
  type RepositoryConfig,
  type PerformanceRequirements,
  detectEnvironment,
  selectOptimalStrategy,
  autoSelectStrategy,
  createRepositoryLayer,
  RepositoryConfigBuilder,
  configureRepository,
  createOptimizedRepositoryLayer,
  DevelopmentRepositoryLayer,
  TestRepositoryLayer,
  ProductionRepositoryLayer,
} from './strategy'

// ===== CQRS Layers ===== //

export {
  // CQRS Integration
  type ChunkCQRSRepositories,
  type ChunkEventSourcingRepositories,
  ChunkCQRSRepositoryLayer,
  ChunkEventSourcingCQRSLayer,
  ChunkReadOnlyLayer,
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