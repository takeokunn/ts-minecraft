/**
 * Domain Types Aggregation
 *
 * 全ドメインの公開インターフェースを集約したエクスポートファイル。
 * 統合レイヤーやアプリケーション層で使用する際の便利なエクスポート。
 */

// Chunk Domain
export { ChunkDataProvider } from './chunk/types'
export type { ChunkInput } from './chunk/types'

// Chunk Loader Domain
export { ChunkLoadingProvider } from './chunk_loader/types'
export type {
  CacheStatus,
  ChunkLoadRequest,
  LoadError,
  LoadPriority,
  PerformanceStats,
  PreloadError,
  SessionId,
  SessionNotFoundError,
} from './chunk_loader/types'

// Chunk Manager Domain
export {
  ActivationError,
  ChunkLifecycleProvider,
  ConfigError,
  DeactivationError,
} from './chunk_manager/types'
export type {
  AutoManagementConfig,
  LifecycleInput,
  LifecycleStats,
  PoolMetrics,
  SystemLoad,
} from './chunk_manager/types'

// View Distance Domain
export {
  createCullingStrategy,
  createLODSelector,
  createViewController,
  createViewDistanceToolkit,
  createViewFrustum,
  createViewSettingsRepository,
} from './view_distance/index'
export type {
  CameraState,
  CullingDecision,
  LODDecision,
  ViewControlConfig,
  ViewControlContext,
  ViewControlResult,
  ViewDistanceEvent,
} from './view_distance/index'
