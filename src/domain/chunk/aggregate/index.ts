/**
 * Chunk Domain Aggregates
 * 明示的エクスポートで重複を回避
 */

// Chunk Aggregate
export {
  BlockId,
  ChunkBoundsError,
  ChunkId,
  ChunkSerializationError,
  WorldCoordinate,
  createChunkAggregate,
  createEmptyChunkAggregate,
  type BlockId,
  type ChunkAggregate,
  type ChunkId,
  type WorldCoordinate,
} from './chunk'

// ChunkData Aggregate (ChunkDataAggregateと命名して区別)
export {
  ChunkDataCorruptionError,
  ChunkDataId,
  ChunkDataValidationError,
  createChunkDataAggregate,
  createEmptyChunkDataAggregate,
  type BiomeType,
  type ChunkDataAggregate,
  type ChunkDataId,
  type HeightValue,
  type LightLevel,
  type Timestamp,
} from './chunk_data'

// 共用のChunkData型はchunkからのみエクスポート
export { ChunkDataSchema, type ChunkData } from './chunk'
