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
} from './ChunkPosition.js'

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
} from './ChunkData.js'

// チャンクインターフェース関連
export { ChunkBoundsError, ChunkSerializationError, type Chunk, createChunk, createEmptyChunk } from './Chunk.js'
