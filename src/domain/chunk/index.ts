/**
 * Chunk Domain - データ構造管理特化
 *
 * Pure chunk機能のみを提供するDDDアーキテクチャ
 * chunk_loader、chunk_manager、view_distance機能は除外
 */

// 集約（Aggregates） - メイン機能
export {
  // Chunk Aggregate
  type ChunkId,
  type BlockId,
  type WorldCoordinate,
  type ChunkAggregate,
  type ChunkData,
  ChunkId,
  BlockId,
  WorldCoordinate,
  ChunkDataSchema,
  ChunkBoundsError,
  ChunkSerializationError,
  createChunkAggregate,
  createEmptyChunkAggregate,

  // ChunkData Aggregate
  type ChunkDataId,
  type ChunkDataAggregate,
  ChunkDataId,
  ChunkDataValidationError,
  ChunkDataCorruptionError,
  createChunkDataAggregate,
  createEmptyChunkDataAggregate,
} from './aggregate'

// 値オブジェクト（Value Objects） - 各ドメインコンセプト
export {
  // チャンク座標
  type ChunkPosition,
  type ChunkX,
  type ChunkZ,
  type ChunkDistance,
  type ChunkHash,
  ChunkPositionSchema,
  ChunkX,
  ChunkZ,
  ChunkDistance,
  ChunkHash,
  createChunkPosition,
  createChunkPositionSync,
  worldToChunkPosition,
  chunkToWorldPosition,
  calculateChunkDistance,
  getChunkHash,
  parseChunkHash,
  // チャンクメタデータ
  type ChunkMetadata,
  type BiomeType,
  type LightLevel,
  type Timestamp,
  type HeightValue,
  ChunkMetadataSchema,
  BiomeType,
  LightLevel,
  Timestamp,
  HeightValue,
  ChunkMetadataError,
  // ブロックデータ
  type BlockData,
  type BlockInfo,
  type BlockLightLevel,
  type BlockMetadata,
  BlockDataError,
  BlockDataCorruptionError,
} from './value_object'

// 型定義（Types） - 定数・エラー・イベント
export {
  // 定数
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  CHUNK_MIN_Y,
  CHUNK_MAX_Y,
  CHUNK_VOLUME,
  // エラー
  ChunkPositionError,
  ChunkIdError,
  // イベント
  ChunkCreatedEvent,
  ChunkLoadedEvent,
  ChunkUnloadedEvent,
  ChunkModifiedEvent,
  BlockChangedEvent,
  ChunkSavedEvent,
  ChunkCorruptedEvent,
  // インターフェース
  type ChunkDataProvider,
} from './types'

// ドメインサービス（Domain Services）
// export * from './domain_service'

// アプリケーションサービス（Application Services）
// export * from './application_service'

// リポジトリ（Repositories）
// export * from './repository'

// ファクトリ（Factories）
// export * from './factory'
