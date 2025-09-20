import { Schema } from 'effect'

/**
 * ブランド型定義
 * 型レベルでの安全性を確保し、値の混同を防ぐ
 */

/**
 * プレイヤーID用のブランド型
 * 文字列だが他の文字列と区別される
 */
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

/**
 * ワールド座標用のブランド型
 * 数値だが座標値として明確に区別される
 */
export const WorldCoordinateSchema = Schema.Number.pipe(Schema.brand('WorldCoordinate'))
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>

/**
 * チャンクID用のブランド型
 * 文字列だがチャンク識別子として区別される
 */
export const ChunkIdSchema = Schema.String.pipe(Schema.brand('ChunkId'))
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>

/**
 * ブロックタイプID用のブランド型
 * 数値だがブロック種別として区別される
 */
export const BlockTypeIdSchema = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('BlockTypeId'))
export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>

/**
 * チャンク位置のブランド型
 * チャンクのx,z座標を表現
 */
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
}).pipe(Schema.brand("ChunkPosition"));
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>;

/**
 * ブロック位置のブランド型
 * ワールド内のブロック座標を表現
 */
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
}).pipe(Schema.brand("BlockPosition"));
export type BlockPosition = Schema.Schema.Type<typeof BlockPosition>;

/**
 * エンティティID用のブランド型
 */
export const EntityId = Schema.String.pipe(
  Schema.brand("EntityId")
);
export type EntityId = Schema.Schema.Type<typeof EntityId>;

/**
 * アイテムID用のブランド型
 */
export const ItemId = Schema.String.pipe(
  Schema.brand("ItemId")
);
export type ItemId = Schema.Schema.Type<typeof ItemId>;

/**
 * セッションID用のブランド型
 */
export const SessionId = Schema.String.pipe(
  Schema.brand("SessionId")
);
export type SessionId = Schema.Schema.Type<typeof SessionId>;

/**
 * タイムスタンプ用のブランド型（Unix時間）
 */
export const Timestamp = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("Timestamp")
);
export type Timestamp = Schema.Schema.Type<typeof Timestamp>;

/**
 * バージョン番号用のブランド型
 */
export const Version = Schema.String.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+$/),
  Schema.brand("Version")
);
export type Version = Schema.Schema.Type<typeof Version>;

/**
 * UUID用のブランド型
 */
export const UUID = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand("UUID")
);
export type UUID = Schema.Schema.Type<typeof UUID>;

/**
 * ブランド型を作成するためのヘルパー関数
 */
export const BrandedTypes = {
  /**
   * 安全なPlayerId作成
   */
  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),

  /**
   * 安全なWorldCoordinate作成
   */
  createWorldCoordinate: (value: number): WorldCoordinate => Schema.decodeSync(WorldCoordinateSchema)(value),

  /**
   * 安全なChunkId作成
   */
  createChunkId: (id: string): ChunkId => Schema.decodeSync(ChunkIdSchema)(id),

  /**
   * 安全なBlockTypeId作成
   */
  createBlockTypeId: (id: number): BlockTypeId => Schema.decodeSync(BlockTypeIdSchema)(id),
} as const
