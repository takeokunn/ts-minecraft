/**
 * Chunk Domain Aggregates
 * 明示的エクスポートで重複を回避
 */

// Chunk Aggregate
export {
  type ChunkId,
  type BlockId,
  type WorldCoordinate,
  type ChunkAggregate,
  ChunkId,
  BlockId,
  WorldCoordinate,
  ChunkBoundsError,
  ChunkSerializationError,
  createChunkAggregate,
  createEmptyChunkAggregate,
} from './chunk'

// ChunkData Aggregate (ChunkDataAggregateと命名して区別)
export {
  type ChunkDataId,
  type ChunkDataAggregate,
  type BiomeType,
  type LightLevel,
  type Timestamp,
  type HeightValue,
  ChunkDataId,
  ChunkDataValidationError,
  ChunkDataCorruptionError,
  createChunkDataAggregate,
  createEmptyChunkDataAggregate,
} from './chunk-data'

// 共用のChunkData型はchunkからのみエクスポート
export {
  type ChunkData,
  ChunkDataSchema,
} from './chunk'
