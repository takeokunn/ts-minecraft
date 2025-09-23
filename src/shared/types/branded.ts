import { Schema } from '@effect/schema'
import type { DeltaTime } from './time-brands'
import { DeltaTimeSchema } from './time-brands'

/**
 * ブランド型定義
 * 型レベルでの安全性を確保し、値の混同を防ぐ
 */

/**
 * プレイヤーID用のブランド型
 * 文字列だが他の文字列と区別される
 */
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

/**
 * ワールド座標用のブランド型
 * 数値だが座標値として明確に区別される
 */
export const WorldCoordinateSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    title: 'WorldCoordinate',
    description: 'World coordinate value (finite number)',
  })
)
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>

/**
 * チャンクID用のブランド型
 * 文字列だがチャンク識別子として区別される
 */
export const ChunkIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Unique identifier for a chunk (format: chunk_x_z)',
  })
)
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>

/**
 * ブロックタイプID用のブランド型
 * 数値だがブロック種別として区別される
 */
export const BlockTypeIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(10000), // 実用的上限
  Schema.brand('BlockTypeId'),
  Schema.annotations({
    title: 'BlockTypeId',
    description: 'Unique identifier for block types (positive integer)',
  })
)
export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>

/**
 * チャンク位置のブランド型
 * チャンクのx,z座標を表現
 */
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('ChunkPosition'))
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>

/**
 * ブロック位置のブランド型
 * ワールド内のブロック座標を表現
 */
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))
export type BlockPosition = Schema.Schema.Type<typeof BlockPosition>

/**
 * エンティティID用のブランド型
 */
export const EntityId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('EntityId'),
  Schema.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity',
  })
)
export type EntityId = Schema.Schema.Type<typeof EntityId>

/**
 * アイテムID用のブランド型
 */
export const ItemId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z_]+$/), // 小文字とアンダースコアのみ
  Schema.brand('ItemId'),
  Schema.annotations({
    title: 'ItemId',
    description: 'Unique identifier for an item (lowercase with underscores)',
  })
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

/**
 * セッションID用のブランド型
 */
export const SessionId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.minLength(8), // 最低8文字
  Schema.brand('SessionId'),
  Schema.annotations({
    title: 'SessionId',
    description: 'Unique identifier for a session (minimum 8 characters)',
  })
)
export type SessionId = Schema.Schema.Type<typeof SessionId>

// ⚠️ Timestamp は time-brands.ts に移行されました
// 新しいインポートを使用してください: import { Timestamp } from './time-brands'

/**
 * バージョン番号用のブランド型
 */
export const Version = Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/), Schema.brand('Version'))
export type Version = Schema.Schema.Type<typeof Version>

/**
 * UUID用のブランド型
 */
export const UUID = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand('UUID')
)
export type UUID = Schema.Schema.Type<typeof UUID>

/**
 * 高度用のブランド型（0-256の範囲）
 */
export const Height = Schema.Number.pipe(Schema.int(), Schema.between(0, 256), Schema.brand('Height'))
export type Height = Schema.Schema.Type<typeof Height>

/**
 * ノイズ座標用のブランド型
 */
export const NoiseCoordinate = Schema.Number.pipe(Schema.finite(), Schema.brand('NoiseCoordinate'))
export type NoiseCoordinate = Schema.Schema.Type<typeof NoiseCoordinate>

/**
 * ノイズ値用のブランド型（-1.1 から 1.1 の範囲、浮動小数点精度を考慮）
 */
export const NoiseValue = Schema.Number.pipe(Schema.between(-1.1, 1.1), Schema.brand('NoiseValue'))
export type NoiseValue = Schema.Schema.Type<typeof NoiseValue>

/**
 * コンポーネント型名用のブランド型
 */
export const ComponentTypeName = Schema.String.pipe(Schema.brand('ComponentTypeName'))
export type ComponentTypeName = Schema.Schema.Type<typeof ComponentTypeName>

// === 統計情報関連のBrand型 ===

/**
 * Entity数の型安全な表現
 */
export const EntityCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('EntityCount'))
export type EntityCount = Schema.Schema.Type<typeof EntityCount>

/**
 * Entity容量の型安全な表現
 */
export const EntityCapacity = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('EntityCapacity'))
export type EntityCapacity = Schema.Schema.Type<typeof EntityCapacity>

// === レンダリング関連のBrand型 ===

/**
 * UV座標の型安全な表現 (0-1範囲)
 */
export const UVCoordinate = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate'))
export type UVCoordinate = Schema.Schema.Type<typeof UVCoordinate>

/**
 * AmbientOcclusion値の型安全な表現 (0-1範囲)
 */
export const AOValue = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('AOValue'))
export type AOValue = Schema.Schema.Type<typeof AOValue>

/**
 * メッシュ寸法の型安全な表現
 */
export const MeshDimension = Schema.Number.pipe(Schema.positive(), Schema.brand('MeshDimension'))
export type MeshDimension = Schema.Schema.Type<typeof MeshDimension>

// ⚠️ DeltaTime は time-brands.ts に移行されました
// 新しいインポートを使用してください: import { DeltaTime } from './time-brands'

/**
 * マウス感度の型安全な表現
 */
export const SensitivityValue = Schema.Number.pipe(Schema.positive(), Schema.brand('SensitivityValue'))
export type SensitivityValue = Schema.Schema.Type<typeof SensitivityValue>

/**
 * 環境変数キーの型安全な表現
 */
export const EnvironmentKey = Schema.String.pipe(Schema.nonEmptyString(), Schema.brand('EnvironmentKey'))
export type EnvironmentKey = Schema.Schema.Type<typeof EnvironmentKey>

/**
 * キャッシュサイズの型安全な表現
 */
export const CacheSize = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheSize'))
export type CacheSize = Schema.Schema.Type<typeof CacheSize>

/**
 * キャッシュヒット回数の型安全な表現
 */
export const CacheHitCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheHitCount'))
export type CacheHitCount = Schema.Schema.Type<typeof CacheHitCount>

/**
 * キャッシュミス回数の型安全な表現
 */
export const CacheMissCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheMissCount'))
export type CacheMissCount = Schema.Schema.Type<typeof CacheMissCount>

/**
 * ワールド位置の型安全な表現
 */
export const WorldPosition = Schema.Struct({
  x: WorldCoordinateSchema,
  y: WorldCoordinateSchema,
  z: WorldCoordinateSchema,
})
export type WorldPosition = Schema.Schema.Type<typeof WorldPosition>

/**
 * ブロックID用のブランド型（文字列版）
 */
export const BlockId = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockId>

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

  /**
   * 安全なEntityId作成
   */
  createEntityId: (id: string): EntityId => Schema.decodeSync(EntityId)(id),

  /**
   * 安全なItemId作成
   */
  createItemId: (id: string): ItemId => Schema.decodeSync(ItemId)(id),

  /**
   * 安全なHeight作成
   */
  createHeight: (value: number): Height => Schema.decodeSync(Height)(value),

  /**
   * 安全なNoiseCoordinate作成
   */
  createNoiseCoordinate: (value: number): NoiseCoordinate => Schema.decodeSync(NoiseCoordinate)(value),

  /**
   * 安全なNoiseValue作成
   */
  createNoiseValue: (value: number): NoiseValue => Schema.decodeSync(NoiseValue)(value),

  /**
   * 安全なComponentTypeName作成
   */
  createComponentTypeName: (name: string): ComponentTypeName => Schema.decodeSync(ComponentTypeName)(name),

  /**
   * 安全なBlockId作成
   */
  createBlockId: (id: string): BlockId => Schema.decodeSync(BlockId)(id),

  // === 統計情報関連のヘルパー ===

  /**
   * 安全なEntityCount作成
   */
  createEntityCount: (value: number): EntityCount => Schema.decodeSync(EntityCount)(value),

  /**
   * 安全なEntityCapacity作成
   */
  createEntityCapacity: (value: number): EntityCapacity => Schema.decodeSync(EntityCapacity)(value),

  // === レンダリング関連のヘルパー ===

  /**
   * 安全なUVCoordinate作成
   */
  createUVCoordinate: (value: number): UVCoordinate => Schema.decodeSync(UVCoordinate)(value),

  /**
   * 安全なAOValue作成
   */
  createAOValue: (value: number): AOValue => Schema.decodeSync(AOValue)(value),

  /**
   * 安全なMeshDimension作成
   */
  createMeshDimension: (value: number): MeshDimension => Schema.decodeSync(MeshDimension)(value),

  /**
   * 安全なDeltaTime作成
   */
  createDeltaTime: (value: number): DeltaTime => Schema.decodeSync(DeltaTimeSchema)(value),

  /**
   * 安全なSensitivityValue作成
   */
  createSensitivityValue: (value: number): SensitivityValue => Schema.decodeSync(SensitivityValue)(value),

  /**
   * 安全なEnvironmentKey作成
   */
  createEnvironmentKey: (key: string): EnvironmentKey => Schema.decodeSync(EnvironmentKey)(key),

  /**
   * 安全なCacheSize作成
   */
  createCacheSize: (value: number): CacheSize => Schema.decodeSync(CacheSize)(value),

  /**
   * 安全なCacheHitCount作成
   */
  createCacheHitCount: (value: number): CacheHitCount => Schema.decodeSync(CacheHitCount)(value),

  /**
   * 安全なCacheMissCount作成
   */
  createCacheMissCount: (value: number): CacheMissCount => Schema.decodeSync(CacheMissCount)(value),

  /**
   * 安全なWorldPosition作成
   */
  createWorldPosition: (x: number, y: number, z: number): WorldPosition =>
    Schema.decodeSync(WorldPosition)({
      x: Schema.decodeSync(WorldCoordinateSchema)(x),
      y: Schema.decodeSync(WorldCoordinateSchema)(y),
      z: Schema.decodeSync(WorldCoordinateSchema)(z),
    }),
} as const

// Re-export time-related types for backward compatibility
export type { DeltaTime, Timestamp } from './time-brands'
export { DeltaTimeSchema, TimestampSchema } from './time-brands'
