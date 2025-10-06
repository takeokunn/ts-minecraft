/**
 * ChunkRepository Module - Barrel Export
 *
 * 基盤チャンクリポジトリの統合エクスポート
 * 複数実装とインターフェースの提供
 */

export {
  ChunkRepository,
  type BatchOperationResult,
  type ChunkArray,
  type ChunkOption,
  type ChunkQuery,
  type ChunkRegion,
  // Interface
  type ChunkRepository,
  type ChunkRepositoryEffect,
  type ChunkStatistics,
} from './index'

export {
  // In-Memory Implementation
  InMemoryChunkRepositoryLive,
} from './index'

export {
  // IndexedDB Implementation
  IndexedDBChunkRepositoryLive,
} from './index'

export {
  WORKER_SCRIPT_TEMPLATE,
  // WebWorker Implementation
  WebWorkerChunkRepositoryLive,
  createWebWorkerChunkRepository,
} from './index'
export * from './index';
export * from './index';
export * from './index';
export * from './index';
export * from './interface';
