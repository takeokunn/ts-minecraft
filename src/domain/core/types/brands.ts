import { Schema } from '@effect/schema'

/**
 * coreドメイン用のブランド型定義
 */

/**
 * プレイヤーID用のブランド型
 */
export const PlayerIdSchema = Schema.String.pipe(
  Schema.filter((s) => s.length > 0, {
    message: () => 'PlayerId cannot be empty',
  }),
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

/**
 * エンティティID用のブランド型
 */
export const EntityIdSchema = Schema.String.pipe(
  Schema.brand('EntityId'),
  Schema.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity',
  })
)
export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>

/**
 * アイテムID用のブランド型
 */
export const ItemId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z_]+$/),
  Schema.brand('ItemId'),
  Schema.annotations({
    title: 'ItemId',
    description: 'Unique identifier for an item',
  })
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

/**
 * ヘルス値用のブランド型
 */
export const HealthSchema = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Health'),
  Schema.annotations({
    title: 'Health',
    description: 'Player health value (0-20)',
  })
)
export type Health = Schema.Schema.Type<typeof HealthSchema>

/**
 * チャンクID用のブランド型
 */
export const ChunkIdSchema = Schema.String.pipe(
  Schema.filter((s) => s.length > 0, {
    message: () => 'ChunkId cannot be empty',
  }),
  Schema.nonEmptyString(),
  Schema.minLength(9),
  Schema.pattern(/^chunk_-?\d+_-?\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Unique identifier for a chunk',
  })
)
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>

/**
 * ブロックタイプID用のブランド型
 */
export const BlockTypeIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(10000),
  Schema.brand('BlockTypeId'),
  Schema.annotations({
    title: 'BlockTypeId',
    description: 'Unique identifier for block types',
  })
)
export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>

/**
 * チャンク位置のブランド型
 */
export const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('ChunkPosition'))
export const ChunkPosition = ChunkPositionSchema
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>

/**
 * ブロック位置のブランド型
 */
export const BlockPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))
export const BlockPosition = BlockPositionSchema
export type BlockPosition = Schema.Schema.Type<typeof BlockPositionSchema>

/**
 * ワールド座標用のブランド型
 */
export const WorldCoordinateSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    title: 'WorldCoordinate',
    description: 'World coordinate value',
  })
)
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>

/**
 * ブロックID用のブランド型（文字列版）
 */
export const BlockId = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockId>

/**
 * 高度用のブランド型
 */
export const Height = Schema.Number.pipe(Schema.int(), Schema.between(0, 256), Schema.brand('Height'))
export type Height = Schema.Schema.Type<typeof Height>

/**
 * ノイズ座標用のブランド型
 */
export const NoiseCoordinate = Schema.Number.pipe(Schema.finite(), Schema.brand('NoiseCoordinate'))
export type NoiseCoordinate = Schema.Schema.Type<typeof NoiseCoordinate>

/**
 * ノイズ値用のブランド型
 */
export const NoiseValue = Schema.Number.pipe(Schema.between(-1.1, 1.1), Schema.brand('NoiseValue'))
export type NoiseValue = Schema.Schema.Type<typeof NoiseValue>

/**
 * UV座標用のブランド型
 */
export const UVCoordinate = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate'))
export type UVCoordinate = Schema.Schema.Type<typeof UVCoordinate>

/**
 * AmbientOcclusion値用のブランド型
 */
export const AOValue = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('AOValue'))
export type AOValue = Schema.Schema.Type<typeof AOValue>

/**
 * メッシュ寸法用のブランド型
 */
export const MeshDimension = Schema.Number.pipe(Schema.positive(), Schema.brand('MeshDimension'))
export type MeshDimension = Schema.Schema.Type<typeof MeshDimension>

/**
 * デルタタイム用のブランド型
 */
export const DeltaTimeSchema = Schema.Number.pipe(Schema.positive(), Schema.brand('DeltaTime'))
export type DeltaTime = Schema.Schema.Type<typeof DeltaTimeSchema>

/**
 * セッションID用のブランド型
 */
export const SessionId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.minLength(8),
  Schema.brand('SessionId'),
  Schema.annotations({
    title: 'SessionId',
    description: 'Unique identifier for a session',
  })
)
export type SessionId = Schema.Schema.Type<typeof SessionId>

/**
 * 感度値用のブランド型
 */
export const SensitivityValue = Schema.Number.pipe(Schema.positive(), Schema.brand('SensitivityValue'))
export type SensitivityValue = Schema.Schema.Type<typeof SensitivityValue>

/**
 * タイムスタンプ用のブランド型
 */
export const TimestampSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Timestamp'))
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * コンポーネント型名
 */
export const ComponentTypeName = Schema.String.pipe(Schema.brand('ComponentTypeName'))
export type ComponentTypeName = Schema.Schema.Type<typeof ComponentTypeName>

/**
 * エンティティ数用のブランド型
 */
export const EntityCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('EntityCount'),
  Schema.annotations({
    title: 'EntityCount',
    description: 'Number of entities',
  })
)
export type EntityCount = Schema.Schema.Type<typeof EntityCountSchema>

/**
 * エンティティ容量用のブランド型
 */
export const EntityCapacitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('EntityCapacity'),
  Schema.annotations({
    title: 'EntityCapacity',
    description: 'Maximum capacity for entities',
  })
)
export type EntityCapacity = Schema.Schema.Type<typeof EntityCapacitySchema>

/**
 * ブランド型ヘルパー
 */
export const BrandedTypes = {
  PlayerId: PlayerIdSchema,
  EntityId: EntityIdSchema,
  ComponentTypeName,

  // 作成ヘルパー関数
  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),

  createEntityId: (id: string): EntityId => Schema.decodeSync(EntityIdSchema)(id),

  createItemId: (id: string): ItemId => Schema.decodeSync(ItemId)(id),

  createBlockId: (id: string): BlockId => Schema.decodeSync(BlockId)(id),

  createChunkId: (x: number, z: number): ChunkId => Schema.decodeSync(ChunkIdSchema)(`chunk_${x}_${z}`),

  createChunkPosition: (x: number, z: number): ChunkPosition => Schema.decodeSync(ChunkPositionSchema)({ x, z }),

  createBlockPosition: (x: number, y: number, z: number): BlockPosition =>
    Schema.decodeSync(BlockPositionSchema)({ x, y, z }),

  createBlockTypeId: (id: number): BlockTypeId => Schema.decodeSync(BlockTypeIdSchema)(id),

  createWorldCoordinate: (coord: number): WorldCoordinate => Schema.decodeSync(WorldCoordinateSchema)(coord),

  createHeight: (height: number): Height => Schema.decodeSync(Height)(height),

  createNoiseCoordinate: (coord: number): NoiseCoordinate => Schema.decodeSync(NoiseCoordinate)(coord),

  createNoiseValue: (value: number): NoiseValue => Schema.decodeSync(NoiseValue)(value),

  createUVCoordinate: (coord: number): UVCoordinate => Schema.decodeSync(UVCoordinate)(coord),

  createAOValue: (value: number): AOValue => Schema.decodeSync(AOValue)(value),

  createMeshDimension: (dimension: number): MeshDimension => Schema.decodeSync(MeshDimension)(dimension),

  createDeltaTime: (value: number): DeltaTime => Schema.decodeSync(DeltaTimeSchema)(value),

  createSessionId: (id: string): SessionId => Schema.decodeSync(SessionId)(id),

  createSensitivityValue: (value: number): SensitivityValue => Schema.decodeSync(SensitivityValue)(value),

  createTimestamp: (ms: number): Timestamp => Schema.decodeSync(TimestampSchema)(ms),

  createHealth: (value: number): Health => Schema.decodeSync(HealthSchema)(value),

  createEntityCount: (count: number): EntityCount => Schema.decodeSync(EntityCountSchema)(count),

  createEntityCapacity: (capacity: number): EntityCapacity => Schema.decodeSync(EntityCapacitySchema)(capacity),
}
