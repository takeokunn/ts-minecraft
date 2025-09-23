// チャンク座標関連
export {
  ChunkPositionSchema,
  type ChunkPosition,
  chunkToBlockCoords,
  blockToChunkCoords,
  chunkPositionToId,
  chunkIdToPosition,
  chunkPositionEquals,
  chunkPositionDistance,
} from './ChunkPosition'

// チャンクデータ関連
export {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  CHUNK_VOLUME,
  CHUNK_MIN_Y,
  CHUNK_MAX_Y,
  ChunkMetadataSchema,
  type ChunkMetadata,
  type ChunkData,
  getBlockIndex,
  getBlockCoords,
  createChunkData,
  getBlock,
  setBlock,
  updateHeightMap,
  getHeight,
  isEmpty,
  getMemoryUsage,
  resetChunkData,
} from './ChunkData'

// チャンクインターフェース関連
export { ChunkBoundsError, ChunkSerializationError, type Chunk, createChunk, createEmptyChunk } from './Chunk'

// チャンクマネージャー関連
export {
  ChunkManager,
  ChunkManagerLive,
  createChunkManager,
  defaultChunkManagerConfig,
  type ChunkManagerConfig,
  type ChunkManagerState,
  type LRUCacheState,
  createLRUCache,
  lruGet,
  lruPut,
  chunkPositionToKey,
  worldToChunkPosition,
  chunkDistance,
  generateLoadOrder,
} from './ChunkManager'

// チャンクローダー関連
export {
  ChunkLoader,
  ChunkLoaderLive,
  createChunkLoader,
  defaultChunkLoaderConfig,
  type ChunkLoaderConfig,
  type ChunkLoadRequest,
  type ChunkLoadPriority,
  type ChunkLoadState,
  calculatePriorityScore,
  sortRequestsByPriority,
  createChunkLoadRequest,
  chunkLoadRequestToKey,
  isLoadExpired,
} from './ChunkLoader'

// 描画距離管理関連
export {
  ViewDistance,
  ViewDistanceLive,
  createViewDistance,
  defaultViewDistanceConfig,
  type ViewDistanceConfig,
  type PerformanceMetrics,
  type ViewDistanceEvent,
  type ViewDistanceAdjustmentReason,
  calculateAverageMetrics,
  analyzePerformanceTrend,
  calculateOptimalViewDistance,
  getVisibleChunkPositions,
  calculateChunkPriority,
} from './ViewDistance'
