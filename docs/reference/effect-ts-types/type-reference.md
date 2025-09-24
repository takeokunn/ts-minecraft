# Effect-TS Types Reference

> 型安全なTypeScript Minecraftクローンで使用されているEffect-TS Brand型・Schema定義の包括的リファレンス

## 目次

- [概要](#概要)
- [Brand型とは](#brand型とは)
- [基本的なパターン](#基本的なパターン)
- [型カテゴリ別リファレンス](#型カテゴリ別リファレンス)
  - [識別子型](#識別子型)
  - [座標・位置型](#座標位置型)
  - [時間型](#時間型)
  - [レンダリング型](#レンダリング型)
  - [統計・パフォーマンス型](#統計パフォーマンス型)
  - [物理演算型](#物理演算型)
  - [ゲーム要素型](#ゲーム要素型)
  - [複合型](#複合型)
- [Schema定義パターン](#schema定義パターン)
- [変換ユーティリティ](#変換ユーティリティ)
- [ベストプラクティス](#ベストプラクティス)

## 概要

本プロジェクトでは、型安全性を確保するためにEffect-TSのBrand型とSchemaを活用しています。これにより、コンパイル時に値の種類を区別し、実行時にデータの検証を行います。

**プロジェクト内Brand型総数**: 50+ 型

## Brand型とは

Brand型は、同じプリミティブ型（string、numberなど）でも論理的に異なる概念を表現する型を区別するためのTypeScript技法です。

```typescript
// 通常の型では区別されない
const playerId: string = 'player123'
const blockId: string = 'stone'
// これらは誤って混同される可能性がある

// Brand型で区別
export type PlayerId = string & Brand.Brand<'PlayerId'>
export type BlockId = string & Brand.Brand<'BlockId'>
// コンパイル時に型エラーで混同を防げる
```

## 基本的なパターン

### 1. 基本Brand型定義

```typescript
import { Brand } from 'effect'
import { Schema } from '@effect/schema'

// Brand型定義
export type PlayerId = string & Brand.Brand<'PlayerId'>

// Schemaファクトリ
export const PlayerId = Brand.nominal<PlayerId>()

// または、Schemaパイプライン形式
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
```

### 2. 制約付きBrand型

```typescript
// 数値範囲制約
export const Height = Schema.Number.pipe(Schema.int(), Schema.between(0, 256), Schema.brand('Height'))

// 文字列パターン制約
export const ChunkId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand('ChunkId')
)
```

### 3. 複合Brand型

```typescript
// 構造体のBrand型
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))

// AABBのような特殊なBrand型
export const AABBSchema = Schema.Struct({
  _tag: Schema.Literal('AABB'),
  min: Vector3Schema,
  max: Vector3Schema,
}).pipe(Schema.brand('AABB'))

export type AABB = Schema.Schema.Type<typeof AABBSchema> & Brand.Brand<'AABB'>
```

## 型カテゴリ別リファレンス

### 識別子型

一意性を保証する識別子のためのBrand型群。

#### PlayerId

```typescript
// ファイル: src/shared/types/branded.ts
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

// 使用例
const playerId = BrandedTypes.createPlayerId('player_12345')
```

#### EntityId

```typescript
// ファイル: src/shared/types/branded.ts
export const EntityId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('EntityId'),
  Schema.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity',
  })
)
export type EntityId = Schema.Schema.Type<typeof EntityId>

// 使用例
const entityId = BrandedTypes.createEntityId('entity_mob_001')
```

#### ItemId

```typescript
// ファイル: src/shared/types/branded.ts
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

// 使用例
const itemId = BrandedTypes.createItemId('iron_sword')
```

#### BlockId

```typescript
// ファイル: src/domain/block/BlockType.ts + src/shared/types/branded.ts
export type BlockId = string & Brand.Brand<'BlockId'>
export const BlockId = Brand.nominal<BlockId>()

// 文字列版（統一形式）
export const BlockId = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockId>

// 使用例
const blockId = BrandedTypes.createBlockId('minecraft:stone')
```

#### TextureId

```typescript
// ファイル: src/domain/block/BlockType.ts
export type TextureId = string & Brand.Brand<'TextureId'>
export const TextureId = Brand.nominal<TextureId>()

// 使用例
const textureId = TextureId('stone_texture')
```

#### SessionId

```typescript
// ファイル: src/shared/types/branded.ts
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

// 使用例
const sessionId = BrandedTypes.createSessionId('sess_abc123def456')
```

#### ChunkId

```typescript
// ファイル: src/shared/types/branded.ts
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

// 使用例
const chunkId = BrandedTypes.createChunkId('chunk_0_0')
```

#### BlockTypeId

```typescript
// ファイル: src/shared/types/branded.ts
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

// 使用例
const blockTypeId = BrandedTypes.createBlockTypeId(1)
```

#### UUID

```typescript
// ファイル: src/shared/types/branded.ts
export const UUID = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand('UUID')
)
export type UUID = Schema.Schema.Type<typeof UUID>

// 使用例
import { randomUUID } from 'crypto'
const uuid = Schema.decodeSync(UUID)(randomUUID())
```

#### Version

```typescript
// ファイル: src/shared/types/branded.ts
export const Version = Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/), Schema.brand('Version'))
export type Version = Schema.Schema.Type<typeof Version>

// 使用例
const version = Schema.decodeSync(Version)('1.0.0')
```

#### ComponentTypeName

```typescript
// ファイル: src/shared/types/branded.ts
export const ComponentTypeName = Schema.String.pipe(Schema.brand('ComponentTypeName'))
export type ComponentTypeName = Schema.Schema.Type<typeof ComponentTypeName>

// 使用例
const componentType = BrandedTypes.createComponentTypeName('RenderComponent')
```

### 座標・位置型

ワールド内の位置や座標を表現するBrand型群。

#### WorldCoordinate

```typescript
// ファイル: src/shared/types/branded.ts
export const WorldCoordinateSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    title: 'WorldCoordinate',
    description: 'World coordinate value (finite number)',
  })
)
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>

// 使用例
const x = BrandedTypes.createWorldCoordinate(100.5)
```

#### WorldPosition

```typescript
// ファイル: src/shared/types/branded.ts
export const WorldPosition = Schema.Struct({
  x: WorldCoordinateSchema,
  y: WorldCoordinateSchema,
  z: WorldCoordinateSchema,
})
export type WorldPosition = Schema.Schema.Type<typeof WorldPosition>

// 使用例
const position = BrandedTypes.createWorldPosition(10, 64, 20)
```

#### BlockPosition

```typescript
// ファイル: src/shared/types/branded.ts
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('BlockPosition'))
export type BlockPosition = Schema.Schema.Type<typeof BlockPosition>

// 使用例
const blockPos = Schema.decodeSync(BlockPosition)({ x: 10, y: 64, z: 20 })
```

#### ChunkPosition

```typescript
// ファイル: src/shared/types/branded.ts
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(Schema.brand('ChunkPosition'))
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>

// 使用例
const chunkPos = Schema.decodeSync(ChunkPosition)({ x: 0, z: 0 })
```

#### Vector3

```typescript
// ファイル: src/domain/world/types.ts
export const Vector3Schema = Schema.transformOrFail(
  Schema.Unknown,
  Schema.Struct({
    x: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    y: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    z: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
  }),
  {
    decode: (input, options, ast) => validateSchemaInput(input, ['x', 'y', 'z'], ast),
    encode: ParseResult.succeed,
  }
)
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

// 使用例
const vector = Schema.decodeSync(Vector3Schema)({ x: 1.0, y: 2.0, z: 3.0 })
```

#### Height

```typescript
// ファイル: src/shared/types/branded.ts
export const Height = Schema.Number.pipe(Schema.int(), Schema.between(0, 256), Schema.brand('Height'))
export type Height = Schema.Schema.Type<typeof Height>

// 使用例
const height = BrandedTypes.createHeight(64)
```

#### NoiseCoordinate

```typescript
// ファイル: src/shared/types/branded.ts
export const NoiseCoordinate = Schema.Number.pipe(Schema.finite(), Schema.brand('NoiseCoordinate'))
export type NoiseCoordinate = Schema.Schema.Type<typeof NoiseCoordinate>

// 使用例
const noiseX = BrandedTypes.createNoiseCoordinate(123.456)
```

#### NoiseValue

```typescript
// ファイル: src/shared/types/branded.ts
export const NoiseValue = Schema.Number.pipe(Schema.between(-1.1, 1.1), Schema.brand('NoiseValue'))
export type NoiseValue = Schema.Schema.Type<typeof NoiseValue>

// 使用例
const noiseVal = BrandedTypes.createNoiseValue(0.75)
```

### 時間型

時間概念を表現するBrand型群（専用ファイルで管理）。

#### Timestamp

```typescript
// ファイル: src/shared/types/time-brands.ts
export const TimestampSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'Unix timestamp in milliseconds',
  })
)
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

// 使用例
const now = TimeBrands.now()
const custom = TimeBrands.createTimestamp(1640995200000)
```

#### DeltaTime

```typescript
// ファイル: src/shared/types/time-brands.ts
export const DeltaTimeSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(1000), // 最大1秒まで（異常値防止）
  Schema.brand('DeltaTime'),
  Schema.annotations({
    title: 'DeltaTime',
    description: 'Time difference between frames in milliseconds',
  })
)
export type DeltaTime = Schema.Schema.Type<typeof DeltaTimeSchema>

// 使用例
const deltaTime = TimeBrands.createDeltaTime(16.67) // 60FPS
```

#### FrameTime

```typescript
// ファイル: src/shared/types/time-brands.ts
export const FrameTimeSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(100), // 最大100ms（極端な遅延防止）
  Schema.brand('FrameTime'),
  Schema.annotations({
    title: 'FrameTime',
    description: 'Time taken to render a single frame in milliseconds',
  })
)
export type FrameTime = Schema.Schema.Type<typeof FrameTimeSchema>

// 使用例
const frameTime = TimeBrands.createFrameTime(8.33)
```

#### Duration

```typescript
// ファイル: src/shared/types/time-brands.ts
export const DurationSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.finite(),
  Schema.brand('Duration'),
  Schema.annotations({
    title: 'Duration',
    description: 'Duration in seconds',
  })
)
export type Duration = Schema.Schema.Type<typeof DurationSchema>

// 使用例
const duration = TimeBrands.createDuration(30) // 30秒
const fromMs = TimeBrands.durationFromMs(500) // 0.5秒
const fromMin = TimeBrands.durationFromMinutes(5) // 5分
```

#### FPS

```typescript
// ファイル: src/shared/types/time-brands.ts
export const FPSSchema = Schema.Number.pipe(
  Schema.between(1, 240),
  Schema.brand('FPS'),
  Schema.annotations({
    title: 'FPS',
    description: 'Frames per second (1-240 range)',
  })
)
export type FPS = Schema.Schema.Type<typeof FPSSchema>

// 使用例
const targetFps = TimeBrands.targetFPS() // 60 FPS
const customFps = TimeBrands.createFPS(144)
```

#### PerformanceMetric

```typescript
// ファイル: src/shared/types/time-brands.ts
export const PerformanceMetricSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('PerformanceMetric'),
  Schema.annotations({
    title: 'PerformanceMetric',
    description: 'Performance measurement value (non-negative)',
  })
)
export type PerformanceMetric = Schema.Schema.Type<typeof PerformanceMetricSchema>

// 使用例
const metric = TimeBrands.createPerformanceMetric(42.5)
```

### レンダリング型

グラフィックス・レンダリング関連のBrand型群。

#### UVCoordinate

```typescript
// ファイル: src/shared/types/branded.ts
export const UVCoordinate = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate'))
export type UVCoordinate = Schema.Schema.Type<typeof UVCoordinate>

// 使用例
const u = BrandedTypes.createUVCoordinate(0.5)
const v = BrandedTypes.createUVCoordinate(0.75)
```

#### AOValue

```typescript
// ファイル: src/shared/types/branded.ts
export const AOValue = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('AOValue'))
export type AOValue = Schema.Schema.Type<typeof AOValue>

// 使用例
const aoValue = BrandedTypes.createAOValue(0.8) // 80% ambient occlusion
```

#### MeshDimension

```typescript
// ファイル: src/shared/types/branded.ts
export const MeshDimension = Schema.Number.pipe(Schema.positive(), Schema.brand('MeshDimension'))
export type MeshDimension = Schema.Schema.Type<typeof MeshDimension>

// 使用例
const width = BrandedTypes.createMeshDimension(16)
const height = BrandedTypes.createMeshDimension(16)
```

#### SensitivityValue

```typescript
// ファイル: src/shared/types/branded.ts
export const SensitivityValue = Schema.Number.pipe(Schema.positive(), Schema.brand('SensitivityValue'))
export type SensitivityValue = Schema.Schema.Type<typeof SensitivityValue>

// 使用例
const mouseSensitivity = BrandedTypes.createSensitivityValue(2.5)
```

### 統計・パフォーマンス型

統計情報やパフォーマンス測定のためのBrand型群。

#### EntityCount

```typescript
// ファイル: src/shared/types/branded.ts
export const EntityCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('EntityCount'))
export type EntityCount = Schema.Schema.Type<typeof EntityCount>

// 使用例
const activeEntities = BrandedTypes.createEntityCount(150)
```

#### EntityCapacity

```typescript
// ファイル: src/shared/types/branded.ts
export const EntityCapacity = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('EntityCapacity'))
export type EntityCapacity = Schema.Schema.Type<typeof EntityCapacity>

// 使用例
const maxEntities = BrandedTypes.createEntityCapacity(1000)
```

#### CacheSize

```typescript
// ファイル: src/shared/types/branded.ts
export const CacheSize = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheSize'))
export type CacheSize = Schema.Schema.Type<typeof CacheSize>

// 使用例
const cacheSize = BrandedTypes.createCacheSize(1024 * 1024) // 1MB
```

#### CacheHitCount

```typescript
// ファイル: src/shared/types/branded.ts
export const CacheHitCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheHitCount'))
export type CacheHitCount = Schema.Schema.Type<typeof CacheHitCount>

// 使用例
const hits = BrandedTypes.createCacheHitCount(9876)
```

#### CacheMissCount

```typescript
// ファイル: src/shared/types/branded.ts
export const CacheMissCount = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('CacheMissCount'))
export type CacheMissCount = Schema.Schema.Type<typeof CacheMissCount>

// 使用例
const misses = BrandedTypes.createCacheMissCount(123)
```

#### EnvironmentKey

```typescript
// ファイル: src/shared/types/branded.ts
export const EnvironmentKey = Schema.String.pipe(Schema.nonEmptyString(), Schema.brand('EnvironmentKey'))
export type EnvironmentKey = Schema.Schema.Type<typeof EnvironmentKey>

// 使用例
const envKey = BrandedTypes.createEnvironmentKey('NODE_ENV')
```

### 物理演算型

物理エンジン関連のBrand型群。

#### AABB

```typescript
// ファイル: src/domain/physics/types.ts
export const AABBSchema = Schema.Struct({
  _tag: Schema.Literal('AABB'),
  min: Vector3Schema,
  max: Vector3Schema,
}).pipe(Schema.brand('AABB'))

export type AABB = Schema.Schema.Type<typeof AABBSchema> & Brand.Brand<'AABB'>

// 使用例
const aabb: AABB = Schema.decodeSync(AABBSchema)({
  _tag: 'AABB',
  min: { x: 0, y: 0, z: 0 },
  max: { x: 1, y: 1, z: 1 },
})
```

### ゲーム要素型

ゲーム固有の要素を表現するBrand型群（旧型定義との混在パターン）。

#### ItemId（レガシー形式）

```typescript
// ファイル: src/domain/inventory/InventoryTypes.ts
export type ItemId = string & Brand.Brand<'ItemId'>
export const ItemId = Brand.nominal<ItemId>()

// 使用例
const itemId = ItemId('iron_pickaxe')
```

#### PlayerId（レガシー形式）

```typescript
// ファイル: src/domain/inventory/InventoryTypes.ts
export type PlayerId = string & Brand.Brand<'PlayerId'>
export const PlayerId = Brand.nominal<PlayerId>()

// 使用例
const playerId = PlayerId('player_123')
```

### 複合型

複数の要素を組み合わせた複合的なSchema定義。

#### BiomeType

```typescript
// ファイル: src/domain/world/types.ts
export const BiomeType = Schema.Literal(
  'plains',
  'desert',
  'forest',
  'jungle',
  'swamp',
  'taiga',
  'snowy_tundra',
  'mountains',
  'ocean',
  'river',
  'beach',
  'mushroom_fields',
  'savanna',
  'badlands',
  'nether',
  'end',
  'void'
)
export type BiomeType = Schema.Schema.Type<typeof BiomeType>

// 使用例
const biome: BiomeType = 'plains'
```

#### BiomeInfo

```typescript
// ファイル: src/domain/world/types.ts
export const BiomeInfoSchema = Schema.transformOrFail(
  Schema.Unknown,
  Schema.Struct({
    type: BiomeType,
    temperature: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    humidity: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    elevation: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
  }),
  {
    decode: (input, options, ast) => validateSchemaInput(input, ['type', 'temperature', 'humidity', 'elevation'], ast),
    encode: ParseResult.succeed,
  }
)
export type BiomeInfo = Schema.Schema.Type<typeof BiomeInfoSchema>

// 使用例
const biomeInfo = Schema.decodeSync(BiomeInfoSchema)({
  type: 'plains',
  temperature: 0.8,
  humidity: 0.4,
  elevation: 64,
})
```

#### ToolType

```typescript
// ファイル: src/domain/block/BlockType.ts
export const ToolTypeSchema = Schema.Literal('none', 'pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword')
export type ToolType = Schema.Schema.Type<typeof ToolTypeSchema>

// 使用例
const tool: ToolType = 'pickaxe'
```

#### BlockCategory

```typescript
// ファイル: src/domain/block/BlockType.ts
export const BlockCategorySchema = Schema.Literal(
  'natural',
  'building',
  'decoration',
  'redstone',
  'transportation',
  'miscellaneous',
  'food',
  'tools',
  'combat'
)
export type BlockCategory = Schema.Schema.Type<typeof BlockCategorySchema>

// 使用例
const category: BlockCategory = 'building'
```

#### FluidType

```typescript
// ファイル: src/domain/physics/types.ts
export const FluidTypeSchema = Schema.Literal('water', 'lava', 'none')
export type FluidType = Schema.Schema.Type<typeof FluidTypeSchema>

// 使用例
const fluid: FluidType = 'water'
```

#### BlockFace

```typescript
// ファイル: src/domain/interaction/InteractionTypes.ts
export const BlockFaceSchema = Schema.Literal('top', 'bottom', 'north', 'south', 'east', 'west')
export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>

// 使用例
const face: BlockFace = 'top'
```

## Schema定義パターン

### 1. 基本構造体Schema

```typescript
export const BlockTypeSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: BlockCategorySchema,
  texture: BlockTextureSchema,
  physics: BlockPhysicsSchema,
  tool: ToolTypeSchema,
  minToolLevel: Schema.Number,
  drops: Schema.Array(ItemDropSchema),
  sound: BlockSoundSchema,
  stackSize: Schema.Number,
  tags: Schema.Array(Schema.String),
})

export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>
export type BlockTypeEncoded = Schema.Schema.Encoded<typeof BlockTypeSchema>
```

### 2. Union型Schema

```typescript
export const BlockTextureSchema = Schema.Union(SimpleTextureSchema, TextureFacesSchema)
export type BlockTexture = Schema.Schema.Type<typeof BlockTextureSchema>
```

### 3. 配列制約付きSchema

```typescript
export const Inventory = Schema.Struct({
  playerId: Schema.String.pipe(Schema.fromBrand(PlayerId)),
  slots: Schema.Array(Schema.Union(Schema.Null, ItemStack)).pipe(Schema.minItems(36), Schema.maxItems(36)),
  hotbar: Schema.Array(Schema.Number.pipe(Schema.between(0, 35))).pipe(Schema.minItems(9), Schema.maxItems(9)),
  // ...
})
```

### 4. 条件付きSchema

```typescript
export const ItemMetadata = Schema.Struct({
  enchantments: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        level: Schema.Number.pipe(Schema.between(1, 5)),
      })
    )
  ),
  customName: Schema.optional(Schema.String),
  lore: Schema.optional(Schema.Array(Schema.String)),
  damage: Schema.optional(Schema.Number.pipe(Schema.between(0, 1000))),
})
```

### 5. Tagged Union Schema

```typescript
export const AddItemResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('success'),
    remainingItems: Schema.Number,
    affectedSlots: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    _tag: Schema.Literal('partial'),
    addedItems: Schema.Number,
    remainingItems: Schema.Number,
    affectedSlots: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    _tag: Schema.Literal('full'),
    message: Schema.String,
  })
)
```

### 6. 変換Schema

```typescript
export const Vector3Schema = Schema.transformOrFail(
  Schema.Unknown,
  Schema.Struct({
    x: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    y: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
    z: Schema.Number.pipe(Schema.filter((n) => Number.isFinite(n))),
  }),
  {
    decode: (input, options, ast) => validateSchemaInput(input, ['x', 'y', 'z'], ast),
    encode: ParseResult.succeed,
  }
)
```

## 変換ユーティリティ

### Brand型作成ヘルパー

```typescript
// ファイル: src/shared/types/branded.ts
export const BrandedTypes = {
  // 基本型
  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),
  createWorldCoordinate: (value: number): WorldCoordinate => Schema.decodeSync(WorldCoordinateSchema)(value),
  createChunkId: (id: string): ChunkId => Schema.decodeSync(ChunkIdSchema)(id),

  // 複合型
  createWorldPosition: (x: number, y: number, z: number): WorldPosition =>
    Schema.decodeSync(WorldPosition)({
      x: Schema.decodeSync(WorldCoordinateSchema)(x),
      y: Schema.decodeSync(WorldCoordinateSchema)(y),
      z: Schema.decodeSync(WorldCoordinateSchema)(z),
    }),

  // 統計型
  createEntityCount: (value: number): EntityCount => Schema.decodeSync(EntityCount)(value),
  createEntityCapacity: (value: number): EntityCapacity => Schema.decodeSync(EntityCapacity)(value),

  // キャッシュ型
  createCacheSize: (value: number): CacheSize => Schema.decodeSync(CacheSize)(value),
  createCacheHitCount: (value: number): CacheHitCount => Schema.decodeSync(CacheHitCount)(value),
  createCacheMissCount: (value: number): CacheMissCount => Schema.decodeSync(CacheMissCount)(value),
} as const
```

### 時間関連ヘルパー

```typescript
// ファイル: src/shared/types/time-brands.ts
export const TimeBrands = {
  // 基本時間型
  createTimestamp: (value?: number): Timestamp => Schema.decodeSync(TimestampSchema)(value ?? Date.now()),
  now: (): Timestamp => Schema.decodeSync(TimestampSchema)(Date.now()),
  createDeltaTime: (value: number): DeltaTime => Schema.decodeSync(DeltaTimeSchema)(value),

  // 継続時間変換
  createDuration: (value: number): Duration => Schema.decodeSync(DurationSchema)(value),
  durationFromMs: (ms: number): Duration => Schema.decodeSync(DurationSchema)(ms / 1000),
  durationFromMinutes: (minutes: number): Duration => Schema.decodeSync(DurationSchema)(minutes * 60),
  durationFromHours: (hours: number): Duration => Schema.decodeSync(DurationSchema)(hours * 3600),

  // パフォーマンス関連
  createFPS: (value: number): FPS => Schema.decodeSync(FPSSchema)(value),
  targetFPS: (): FPS => Schema.decodeSync(FPSSchema)(60),
  createFrameTime: (value: number): FrameTime => Schema.decodeSync(FrameTimeSchema)(value),
  createPerformanceMetric: (value: number): PerformanceMetric => Schema.decodeSync(PerformanceMetricSchema)(value),
} as const
```

### 検証ヘルパー

```typescript
// 汎用検証関数
export const validateItemStack = Schema.decodeUnknown(ItemStack)
export const validateInventory = Schema.decodeUnknown(Inventory)
export const validateVector3 = Schema.decodeUnknown(Vector3Schema)
export const validateBlockFace = Schema.decodeUnknown(BlockFaceSchema)

// 安全な検証（Either型で結果を返す）
export const safeValidateItemStack = Schema.decodeUnknownEither(ItemStack)
export const safeValidateInventory = Schema.decodeUnknownEither(Inventory)

// 同期的検証（例外を投げる）
export const strictValidateItemStack = Schema.decodeUnknownSync(ItemStack)
export const strictValidateInventory = Schema.decodeUnknownSync(Inventory)
```

### デフォルト値ファクトリ

```typescript
// ファイル: src/domain/block/BlockType.ts
export const createDefaultPhysics = (): BlockPhysics => ({
  hardness: 1.0,
  resistance: 1.0,
  luminance: 0,
  opacity: 15,
  flammable: false,
  gravity: false,
  solid: true,
  replaceable: false,
  waterloggable: false,
})

export const createDefaultSound = (): BlockSound => ({
  break: 'block.stone.break',
  place: 'block.stone.place',
  step: 'block.stone.step',
})

// ファイル: src/domain/inventory/InventoryTypes.ts
export const createEmptyInventory = (playerId: PlayerId): Inventory => ({
  playerId,
  slots: Array(36).fill(null),
  hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  armor: {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  },
  offhand: null,
  selectedSlot: 0,
})
```

## ベストプラクティス

### 1. 型定義の一貫性

```typescript
// ✅ 推奨: 統一されたSchema定義パターン
export const PlayerId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)

// ❌ 非推奨: 混在パターン
export type PlayerId = string & Brand.Brand<'PlayerId'>
export const PlayerId = Brand.nominal<PlayerId>()
```

### 2. 制約の明示的定義

```typescript
// ✅ 推奨: 制約を明確に定義
export const Height = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 256), // Minecraftの高度制限
  Schema.brand('Height')
)

// ❌ 非推奨: 制約なし
export const Height = Schema.Number.pipe(Schema.brand('Height'))
```

### 3. 適切なアノテーション

```typescript
// ✅ 推奨: 説明的なアノテーション
export const ChunkId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'ChunkId',
    description: 'Unique identifier for a chunk (format: chunk_x_z)',
    examples: ['chunk_0_0', 'chunk_-1_5'],
  })
)
```

### 4. 型安全な変換

```typescript
// ✅ 推奨: ヘルパー関数の使用
const playerId = BrandedTypes.createPlayerId('player123')

// ❌ 非推奨: 直接キャスト
const playerId = 'player123' as PlayerId
```

### 5. エラーハンドリング

```typescript
// ✅ 推奨: 安全な検証
const result = Schema.decodeUnknownEither(PlayerIdSchema)('invalid')
if (result._tag === 'Left') {
  console.error('Validation failed:', result.left)
} else {
  const playerId = result.right
  // 安全に使用
}

// ✅ 推奨: try-catch での例外処理
try {
  const playerId = Schema.decodeUnknownSync(PlayerIdSchema)('player123')
  // 使用
} catch (error) {
  console.error('Invalid player ID:', error)
}
```

### 6. 型の組み合わせ

```typescript
// ✅ 推奨: 適切な型の組み合わせ
export const PlayerStats = Schema.Struct({
  playerId: PlayerIdSchema,
  position: WorldPosition,
  health: Schema.Number.pipe(Schema.between(0, 100)),
  lastSeen: TimestampSchema,
})

// ✅ 推奨: Union型の活用
export const GameEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('player_join'),
    playerId: PlayerIdSchema,
    timestamp: TimestampSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('block_break'),
    position: BlockPosition,
    blockId: BlockIdSchema,
    timestamp: TimestampSchema,
  })
)
```

### 7. テスト用ヘルパー

```typescript
// テスト用ファクトリ関数
export const TestDataFactory = {
  createTestPlayerId: () => BrandedTypes.createPlayerId('test_player'),
  createTestBlockPosition: () => Schema.decodeSync(BlockPosition)({ x: 0, y: 64, z: 0 }),
  createTestTimestamp: () => TimeBrands.createTimestamp(1640995200000),
} as const
```

---

この型リファレンスは、TypeScript Minecraftクローンプロジェクトで使用されているすべてのEffect-TS Brand型とSchemaの包括的なガイドです。新しい型を追加する際は、ここで示されたパターンとベストプラクティスに従って一貫性を保ってください。
