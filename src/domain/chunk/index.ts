/**
 * Chunk Domain - データ構造管理特化
 *
 * Pure chunk機能のみを提供するDDDアーキテクチャ
 * chunk_loader、chunk_manager、view_distance機能は除外
 */

// 集約（Aggregates） - メイン機能
export {
  BlockId,
  ChunkBoundsError,
  ChunkDataCorruptionError,
  ChunkDataId,
  ChunkDataSchema,
  ChunkDataValidationError,
  ChunkId,
  ChunkSerializationError,
  WorldCoordinate,
  createChunkAggregate,
  createChunkDataAggregate,
  createEmptyChunkAggregate,
  createEmptyChunkDataAggregate,
  type BlockId,
  type ChunkAggregate,
  type ChunkData,
  type ChunkDataAggregate,
  // ChunkData Aggregate
  type ChunkDataId,
  // Chunk Aggregate
  type ChunkId,
  type WorldCoordinate,
} from './aggregate'

// 値オブジェクト（Value Objects） - 各ドメインコンセプト
export {
  BiomeType,
  BlockDataCorruptionError,
  BlockDataError,
  ChunkDistance,
  ChunkHash,
  ChunkIdSchema,
  ChunkMetadataError,
  ChunkMetadataSchema,
  ChunkPositionSchema,
  ChunkX,
  ChunkZ,
  HeightValue,
  LightLevel,
  Timestamp,
  calculateChunkDistance,
  chunkToWorldPosition,
  createChunkPosition,
  createChunkPositionSync,
  getChunkHash,
  parseChunkHash,
  worldToChunkPosition,
  type BiomeType,
  // ブロックデータ
  type BlockData,
  type BlockInfo,
  type BlockLightLevel,
  type BlockMetadata,
  type ChunkDistance,
  type ChunkHash,
  // チャンクメタデータ
  type ChunkMetadata,
  // チャンク座標
  type ChunkPosition,
  type ChunkX,
  type ChunkZ,
  type HeightValue,
  type LightLevel,
  type Timestamp,
} from './value_object'

// 型定義（Types） - 定数・エラー・イベント
export {
  BlockChangedEvent,
  CHUNK_HEIGHT,
  CHUNK_MAX_Y,
  CHUNK_MIN_Y,
  // 定数
  CHUNK_SIZE,
  CHUNK_VOLUME,
  ChunkCorruptedEvent,
  // イベント
  ChunkCreatedEvent,
  ChunkIdError,
  ChunkLoadedEvent,
  ChunkModifiedEvent,
  // エラー
  ChunkPositionError,
  ChunkSavedEvent,
  ChunkUnloadedEvent,
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
