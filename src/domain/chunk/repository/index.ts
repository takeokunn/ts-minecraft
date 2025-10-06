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

// ===== Configuration Builder ===== //

export {
  RepositoryConfigBuilderStateSchema,
  buildConfig,
  buildLayer,
  initialRepositoryConfigBuilderState,
  setCacheSize,
  setEnableCompression,
  setEnableEncryption,
  setEnableWebWorkers,
  setMaxMemoryUsage,
  setPreferredStorage,
  setStrategy,
  type RepositoryConfigBuilderState,
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

export * from './layers'
