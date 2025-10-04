/**
 * ChunkRepository Module - Barrel Export
 *
 * 基盤チャンクリポジトリの統合エクスポート
 * 複数実装とインターフェースの提供
 */

export {
  // Interface
  type ChunkRepository,
  ChunkRepository,
  type ChunkRepositoryEffect,
  type ChunkQuery,
  type ChunkRegion,
  type ChunkStatistics,
  type BatchOperationResult,
  type ChunkOption,
  type ChunkArray,
} from './interface'

export {
  // In-Memory Implementation
  InMemoryChunkRepositoryLive,
} from './memory_implementation'

export {
  // IndexedDB Implementation
  IndexedDBChunkRepositoryLive,
} from './indexeddb_implementation'

export {
  // WebWorker Implementation
  WebWorkerChunkRepositoryLive,
  createWebWorkerChunkRepository,
  WORKER_SCRIPT_TEMPLATE,
} from './webworker_implementation'