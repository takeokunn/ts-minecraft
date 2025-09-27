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

// Player Management Domain
export * from './player'

// Block System Domain
export * from './block'

// Chunk System Domain - selective exports to avoid conflicts
export {
  CHUNK_HEIGHT,
  CHUNK_MAX_Y,
  CHUNK_MIN_Y,
  // ChunkData exports
  CHUNK_SIZE,
  CHUNK_VOLUME,
  // Chunk interface exports
  ChunkBoundsError,
  ChunkMetadataSchema,
  // ChunkPosition exports
  ChunkPositionSchema,
  ChunkSerializationError,
  blockToChunkCoords,
  chunkIdToPosition,
  chunkPositionDistance,
  chunkPositionEquals,
  chunkPositionToId,
  chunkToBlockCoords,
  createChunk,
  createChunkData,
  getBlockCoords,
  getBlockIndex,
  getHeight,
  getMemoryUsage,
  isEmpty,
  resetChunkData,
  // Note: getBlock is excluded to avoid conflict with block domain
  setBlock,
  updateHeightMap,
  type Chunk,
  type ChunkData,
  type ChunkMetadata,
  type ChunkPosition,
} from './chunk'

// World Generation Domain
export * from './world'

// Combat System Domain
export * from './combat'
