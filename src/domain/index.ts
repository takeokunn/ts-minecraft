/**
 * Domain Layer - ビジネスロジックとドメインモデル
 *
 * このレイヤーはアプリケーションのコアとなるビジネスロジックを含みます。
 * 技術的な詳細から独立しており、純粋なビジネスルールを表現します。
 * 純粋な関数型プログラミングで実装されます。
 */

// Scene Management Domain
export * from './scene'

// Camera System Domain
export * from './camera'

// Input System Domain
export * from './input'

// Block System Domain
export * from './block'

// Chunk System Domain - selective exports to avoid conflicts
export {
  // ChunkPosition exports
  ChunkPositionSchema,
  type ChunkPosition,
  chunkToBlockCoords,
  blockToChunkCoords,
  chunkPositionToId,
  chunkIdToPosition,
  chunkPositionEquals,
  chunkPositionDistance,
  // ChunkData exports
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
  // Note: getBlock is excluded to avoid conflict with block domain
  setBlock,
  resetChunkData,
  updateHeightMap,
  getHeight,
  isEmpty,
  getMemoryUsage,
  // Chunk interface exports
  ChunkBoundsError,
  ChunkSerializationError,
  type Chunk,
  createChunk,
} from './chunk'

// World Generation Domain
export * from './world'
