---
title: 'ワールドデータ構造仕様 - Effect-TS Schema対応DDD設計'
description: 'Effect-TS 3.17+ SchemaとDDD原則に基づく型安全なワールドデータ構造設計。Schema-driven型定義、集約ルート、値オブジェクト、Event Sourcingを含むプロダクションレベルの実装仕様'
category: 'specification'
difficulty: 'advanced'
tags: ['effect-ts', 'ddd', 'world-data', 'aggregates', 'domain-modeling', 'performance']
prerequisites: ['ddd-concepts', 'effect-ts-fundamentals', 'schema-advanced']
estimated_reading_time: '35分'
related_patterns: ['data-modeling-patterns', 'service-patterns', 'aggregate-patterns']
related_docs: ['./chunk-format.md', '../explanations/architecture/02-ddd-strategic-design.md']
---

# ワールドデータ構造仕様

TypeScript Minecraft Cloneにおける、DDD（ドメイン駆動設計）原則とEffect-TS 3.17+を活用した、型安全で高性能なワールドデータ構造の包括的な設計仕様書。

## 目次

1. [設計哲学](#設計哲学)
2. [ドメイン境界の定義](#ドメイン境界の定義)
3. [集約ルートとエンティティ](#集約ルートとエンティティ)
4. [値オブジェクト設計](#値オブジェクト設計)
5. [ドメインサービス](#ドメインサービス)
6. [イベントソーシング](#イベントソーシング)
7. [パフォーマンス最適化](#パフォーマンス最適化)
8. [実装例とテスト戦略](#実装例とテスト戦略)

## 設計哲学

### ドメイン中心設計

```typescript
import { Schema, Brand, Effect, Context, Match, pipe, Option, ReadonlyArray } from 'effect'

// すべての設計はドメインロジックを中心に構築
export const DesignPrinciples = {
  // 1. ドメインの複雑性を型システムで表現
  DomainComplexityInTypes: '複雑なビジネスルールを型レベルで強制',

  // 2. 不変性によるデータ整合性
  ImmutableDataIntegrity: 'すべての状態変更は新しいインスタンス生成で表現',

  // 3. 明示的な副作用管理
  ExplicitSideEffects: 'Effect型による副作用の明示的な管理',

  // 4. コンポーザビリティ重視
  ComposableDesign: '小さな関数を組み合わせた大きな機能の構築',
} as const

// ドメインの普遍言語（Ubiquitous Language）の型定義
export namespace UbiquitousLanguage {
  // ワールド関連用語
  export type World = 'ゲーム世界全体を表現する最上位の概念'
  export type Dimension = 'オーバーワールド、ネザー、エンドなどの次元'
  export type Region = '32x32チャンクからなる管理単位'
  export type Chunk = '16x16x256ブロックからなる最小読み込み単位'
  export type Section = 'チャンク内の16x16x16ブロック単位'
  export type Block = 'ワールドの最小構成要素'

  // エンティティ関連用語
  export type Entity = 'ワールド内に存在する動的オブジェクト'
  export type Player = '人間が操作するエンティティ'
  export type Mob = 'AI制御されるエンティティ'
  export type Item = '拾得・使用可能なオブジェクト'

  // ゲーム機構関連用語
  export type Biome = '環境特性を決定する地域分類'
  export type Structure = '自然生成される建築物や地形'
  export type WorldGeneration = '手続き的世界生成システム'
}
```

## ドメイン境界の定義

### 境界づけられたコンテキスト

```typescript
// ワールド管理境界づけられたコンテキスト
export namespace WorldManagementContext {
  // ワールドID（Brand型による厳密な型区別）
  export type WorldId = string & Brand.Brand<'WorldId'>
  export type DimensionId = string & Brand.Brand<'DimensionId'>
  export type RegionId = string & Brand.Brand<'RegionId'>
  export type ChunkCoordinate = string & Brand.Brand<'ChunkCoordinate'>

  export const WorldId = Brand.nominal<WorldId>()
  export const DimensionId = Brand.nominal<DimensionId>()
  export const RegionId = Brand.nominal<RegionId>()
  export const ChunkCoordinate = Brand.nominal<ChunkCoordinate>()

  // Schemaベースの型定義への変換
  export const WorldIdSchema = Schema.String.pipe(
    Schema.brand(WorldId),
    Schema.minLength(1),
    Schema.maxLength(64),
    Schema.description('一意のワールド識別子')
  )
  export const DimensionIdSchema = Schema.String.pipe(
    Schema.brand(DimensionId),
    Schema.pattern(/^(overworld|nether|the_end|custom:[a-z0-9_-]+)$/),
    Schema.description('ディメンション識別子')
  )
  export const RegionIdSchema = Schema.String.pipe(
    Schema.brand(RegionId),
    Schema.pattern(/^r\.-?\d+\.-?\d+$/),
    Schema.description('リージョンファイル識別子')
  )
  export const ChunkCoordinateSchema = Schema.String.pipe(
    Schema.brand(ChunkCoordinate),
    Schema.pattern(/^-?\d+,-?\d+$/),
    Schema.description('チャンク座標文字列')
  )

  // === 高度なUUID系識別子とEntity管理（Newtype Pattern強化版） ===

  // Player UUID with strict validation
  export const PlayerUUIDSchema = Schema.String.pipe(
    Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    Schema.brand('PlayerUUID'),
    Schema.annotations({
      identifier: 'PlayerUUID',
      title: 'Player UUID',
      description: 'RFC 4122 compliant UUID v4 for unique player identification in world management',
      examples: ['550e8400-e29b-41d4-a716-446655440000'],
      security: 'Unique player identification for world access control',
    })
  )
  export type PlayerUUID = Schema.Schema.Type<typeof PlayerUUIDSchema>

  // Entity UUID for world entities
  export const EntityUUIDSchema = Schema.String.pipe(
    Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    Schema.brand('EntityUUID'),
    Schema.annotations({
      identifier: 'EntityUUID',
      title: 'Entity UUID',
      description: 'RFC 4122 compliant UUID v4 for unique entity identification in world',
      examples: ['123e4567-e89b-12d3-a456-426614174000'],
    })
  )
  export type EntityUUID = Schema.Schema.Type<typeof EntityUUIDSchema>

  // Session token with security considerations
  export const WorldSessionTokenSchema = Schema.String.pipe(
    Schema.minLength(64),
    Schema.maxLength(128),
    Schema.pattern(/^[A-Za-z0-9+/]+=*$/), // Base64 pattern
    Schema.brand('WorldSessionToken'),
    Schema.annotations({
      identifier: 'WorldSessionToken',
      title: 'World Session Token',
      description: 'Cryptographically secure session identifier for world access',
      security: 'Contains sensitive authentication data for world access',
    })
  )
  export type WorldSessionToken = Schema.Schema.Type<typeof WorldSessionTokenSchema>

  // Block entity identifier with coordinate validation
  export const BlockEntityIdSchema = Schema.Struct({
    worldId: WorldIdSchema,
    x: Schema.Number.pipe(Schema.int(), Schema.brand('BlockX')),
    y: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320), Schema.brand('BlockY')),
    z: Schema.Number.pipe(Schema.int(), Schema.brand('BlockZ')),
  }).pipe(
    Schema.transform({
      decode: (coord) => `${coord.worldId}:${coord.x},${coord.y},${coord.z}`,
      encode: (id: string) => {
        const [worldId, coords] = id.split(':')
        const [x, y, z] = coords.split(',').map(Number)
        return { worldId, x, y, z }
      },
    }),
    Schema.brand('BlockEntityId'),
    Schema.annotations({
      identifier: 'BlockEntityId',
      title: 'Block Entity Identifier',
      description: 'Composite identifier for block entities including world and position',
      examples: ['world_overworld:100,64,200'],
    })
  )
  export type BlockEntityId = Schema.Schema.Type<typeof BlockEntityIdSchema>

  // Enhanced chunk identifier with world context
  export const EnhancedChunkIdSchema = Schema.Struct({
    worldId: WorldIdSchema,
    x: Schema.Number.pipe(
      Schema.int(),
      Schema.between(-1875000, 1875000), // Minecraft chunk limits
      Schema.brand('ChunkX')
    ),
    z: Schema.Number.pipe(Schema.int(), Schema.between(-1875000, 1875000), Schema.brand('ChunkZ')),
  }).pipe(
    Schema.transform({
      decode: (coord) => `${coord.worldId}:chunk_${coord.x}_${coord.z}`,
      encode: (id: string) => {
        const [worldId, chunkPart] = id.split(':')
        const [, x, z] = chunkPart.split('_').map((v, i) => (i === 0 ? v : Number(v)))
        return { worldId, x: x as number, z: z as number }
      },
    }),
    Schema.brand('EnhancedChunkId'),
    Schema.annotations({
      identifier: 'EnhancedChunkId',
      title: 'Enhanced Chunk Identifier',
      description: 'Composite identifier for world chunks with coordinate validation and world context',
      examples: ['world_overworld:chunk_10_-5'],
    })
  )
  export type EnhancedChunkId = Schema.Schema.Type<typeof EnhancedChunkIdSchema>

  // Time-based identifiers with validation
  export const GameTimestampSchema = Schema.Number.pipe(
    Schema.int(),
    Schema.nonnegative(),
    Schema.brand('GameTimestamp'),
    Schema.annotations({
      identifier: 'GameTimestamp',
      title: 'Game Timestamp',
      description: 'Game time in ticks (20 ticks = 1 second)',
      examples: [24000, 12000, 0],
      performance: 'Optimized for frequent updates',
    })
  )
  export type GameTimestamp = Schema.Schema.Type<typeof GameTimestampSchema>

  // Real world timestamp for events
  export const WorldEventTimestampSchema = Schema.DateFromSelf.pipe(
    Schema.brand('WorldEventTimestamp'),
    Schema.annotations({
      identifier: 'WorldEventTimestamp',
      title: 'World Event Timestamp',
      description: 'Real-world timestamp for world event tracking and logging',
    })
  )
  export type WorldEventTimestamp = Schema.Schema.Type<typeof WorldEventTimestampSchema>

  // 座標系値オブジェクト
  export const WorldPositionSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.finite(), Schema.description('X座標（東西方向）')),
    y: Schema.Number.pipe(
      Schema.clamp(-64, 320), // Y座標制限
      Schema.description('Y座標（上下方向、-64から320まで）')
    ),
    z: Schema.Number.pipe(Schema.finite(), Schema.description('Z座標（南北方向）')),
    dimension: DimensionIdSchema,
  }).pipe(Schema.readonly, Schema.description('ワールド内の絶対座標'))

  export const ChunkCoordinateDataSchema = Schema.Struct({
    x: Schema.Int.pipe(
      Schema.between(-1875000, 1875000), // ワールド境界
      Schema.description('チャンクX座標')
    ),
    z: Schema.Int.pipe(Schema.between(-1875000, 1875000), Schema.description('チャンクZ座標')),
  }).pipe(Schema.readonly, Schema.description('チャンク座標データ'))

  export const ChunkCoordinateTransformSchema = ChunkCoordinateDataSchema.pipe(
    Schema.transform(ChunkCoordinateSchema, {
      strict: true,
      decode: (coord) => ChunkCoordinate(`${coord.x},${coord.z}`),
      encode: (str) => {
        const [x, z] = str.split(',').map(Number)
        if (isNaN(x) || isNaN(z)) {
          throw new Error(`Invalid chunk coordinate format: ${str}`)
        }
        return { x, z }
      },
    }),
    Schema.description('チャンク座標の文字列変換')
  )

  export const RegionCoordinateDataSchema = Schema.Struct({
    x: Schema.Int.pipe(Schema.description('リージョンX座標')),
    z: Schema.Int.pipe(Schema.description('リージョンZ座標')),
  }).pipe(Schema.readonly, Schema.description('リージョン座標データ'))

  export const RegionCoordinateTransformSchema = RegionCoordinateDataSchema.pipe(
    Schema.transform(RegionIdSchema, {
      strict: true,
      decode: (coord) => RegionId(`r.${coord.x}.${coord.z}`),
      encode: (str) => {
        const parts = str.split('.')
        if (parts.length !== 3 || parts[0] !== 'r') {
          throw new Error(`Invalid region ID format: ${str}`)
        }
        const x = parseInt(parts[1])
        const z = parseInt(parts[2])
        if (isNaN(x) || isNaN(z)) {
          throw new Error(`Invalid region coordinates in: ${str}`)
        }
        return { x, z }
      },
    }),
    Schema.description('リージョンIDの文字列変換')
  )

  export interface WorldPosition extends Schema.Schema.Type<typeof WorldPositionSchema> {}
  export interface ChunkCoordinateData extends Schema.Schema.Type<typeof ChunkCoordinateDataSchema> {}
  export interface RegionCoordinateData extends Schema.Schema.Type<typeof RegionCoordinateDataSchema> {}

  // 座標変換ヘルパー関数
  export const CoordinateConversion = {
    worldToChunk: (pos: WorldPosition): Effect.Effect<ChunkCoordinate, never> =>
      Effect.succeed(ChunkCoordinate(`${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`)),

    chunkToRegion: (chunk: ChunkCoordinate): Effect.Effect<RegionId, never> =>
      Effect.gen(function* () {
        const coords = yield* parseChunkCoordinate(chunk)
        return RegionId(`r.${Math.floor(coords.x / 32)}.${Math.floor(coords.z / 32)}`)
      }),

    localBlockPosition: (worldPos: WorldPosition): Effect.Effect<LocalPosition, never> =>
      Effect.succeed({
        x: ((worldPos.x % 16) + 16) % 16,
        y: worldPos.y,
        z: ((worldPos.z % 16) + 16) % 16,
      }),
  }
}

// 地形生成境界づけられたコンテキスト
export namespace TerrainGenerationContext {
  export type BiomeId = string & Brand.Brand<'BiomeId'>
  export type StructureId = string & Brand.Brand<'StructureId'>
  export type GeneratorSeed = bigint & Brand.Brand<'GeneratorSeed'>

  export const BiomeId = Brand.nominal<BiomeId>()
  export const StructureId = Brand.nominal<StructureId>()
  export const GeneratorSeed = Brand.nominal<GeneratorSeed>()

  // Schemaベースの型定義
  export const BiomeIdSchema = Schema.String.pipe(
    Schema.brand(BiomeId),
    Schema.pattern(/^[a-z0-9_]+$/),
    Schema.minLength(1),
    Schema.maxLength(64),
    Schema.description('バイオーム識別子')
  )
  export const StructureIdSchema = Schema.String.pipe(
    Schema.brand(StructureId),
    Schema.pattern(/^[a-z0-9_]+$/),
    Schema.minLength(1),
    Schema.maxLength(64),
    Schema.description('構造物識別子')
  )
  export const GeneratorSeedSchema = Schema.BigIntFromSelf.pipe(
    Schema.brand(GeneratorSeed),
    Schema.description('地形生成シード値')
  )

  // バイオーム値オブジェクト（Value Object Pattern強化）
  export const BiomeSchema = Schema.Struct({
    id: BiomeIdSchema,
    name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32), Schema.description('表示用バイオーム名')),
    temperature: Schema.Number.pipe(Schema.between(-2.0, 2.0), Schema.description('温度値（-2.0:極寒 ～ 2.0:極暑）')),
    humidity: Schema.Number.pipe(Schema.between(0.0, 1.0), Schema.description('湿度値（0.0:乾燥 ～ 1.0:湿潤）')),
    precipitation: Schema.Literal('none', 'rain', 'snow').pipe(Schema.description('降水タイプ')),
    category: Schema.Literal(
      'ocean',
      'plains',
      'desert',
      'mountains',
      'forest',
      'taiga',
      'swamp',
      'river',
      'nether',
      'the_end',
      'icy',
      'mushroom',
      'beach',
      'jungle',
      'savanna',
      'mesa'
    ).pipe(Schema.description('バイオームカテゴリ')),
    colors: Schema.Struct({
      grass: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xffffff), Schema.description('草の色（RGB値）')),
      foliage: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xffffff), Schema.description('葉の色（RGB値）')),
      water: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xffffff), Schema.description('水の色（RGB値）')),
      sky: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xffffff), Schema.description('空の色（RGB値）')),
      fog: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xffffff), Schema.description('霧の色（RGB値）')),
    }).pipe(Schema.readonly, Schema.description('バイオーム固有の色情報')),
    features: Schema.Array(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64))).pipe(
      Schema.readonly,
      Schema.description('生成される地形特徴のリスト')
    ),
    structures: Schema.Array(StructureIdSchema).pipe(Schema.readonly, Schema.description('生成される構造物のリスト')),
  }).pipe(Schema.readonly, Schema.description('バイオーム値オブジェクト（不変）'))

  export interface Biome extends Schema.Schema.Type<typeof BiomeSchema> {}

  // 地形生成パラメータ（Value Object Pattern）
  export const TerrainGenerationParametersSchema = Schema.Struct({
    seed: GeneratorSeedSchema,
    generationType: Schema.Literal('default', 'flat', 'large_biomes', 'amplified', 'custom').pipe(
      Schema.description('地形生成タイプ')
    ),
    seaLevel: Schema.Number.pipe(Schema.clamp(0, 256), Schema.int(), Schema.description('海面レベル（Y座標）')),
    biomeSize: Schema.Number.pipe(Schema.between(0.1, 4.0), Schema.description('バイオームサイズ倍率')),
    structureDensity: Schema.Number.pipe(Schema.between(0.0, 1.0), Schema.description('構造物生成密度')),
    oreDensity: Schema.Record({
      key: Schema.String.pipe(Schema.pattern(/^[a-z0-9_]+$/), Schema.description('鉱石タイプ識別子')),
      value: Schema.Number.pipe(Schema.between(0.0, 1.0), Schema.description('鉱石生成密度')),
    }).pipe(Schema.readonly, Schema.description('鉱石生成密度マップ')),
    customSettings: Schema.optional(
      Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }).pipe(Schema.readonly, Schema.description('カスタム生成設定'))
    ),
  }).pipe(Schema.readonly, Schema.description('地形生成パラメータ（不変）'))
}
```

## 集約ルートとエンティティ

### ワールド集約ルート

```typescript
// ワールド集約ルート - Aggregate Root Pattern（強化版）
export const WorldAggregateSchema = Schema.Struct({
  // アイデンティティ
  id: WorldIdSchema,
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(32),
    Schema.pattern(/^[\w\s\-_.]+$/), // 安全なワールド名のみ許可
    Schema.description('ワールド名（表示用）')
  ),

  // メタデータ（Value Object Pattern）
  metadata: Schema.Struct({
    createdAt: Schema.DateFromSelf.pipe(Schema.description('ワールド作成日時')),
    lastModified: Schema.DateFromSelf.pipe(Schema.description('最終更新日時')),
    lastPlayed: Schema.DateFromSelf.pipe(Schema.description('最終プレイ日時')),
    totalPlayTime: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('総プレイ時間（ミリ秒）')),
    version: Schema.Struct({
      game: Schema.String.pipe(Schema.minLength(1), Schema.description('ゲームバージョン')),
      format: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.description('セーブフォーマットバージョン')),
      features: Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
        Schema.readonly,
        Schema.description('有効機能リスト')
      ),
    }).pipe(Schema.readonly, Schema.description('バージョン情報')),
    statistics: Schema.Struct({
      totalBlocks: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('総ブロック数')),
      totalEntities: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('総エンティティ数')),
      loadedChunks: Schema.Number.pipe(
        Schema.nonnegative(),
        Schema.int(),
        Schema.description('読み込み済みチャンク数')
      ),
      savedChunks: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('保存済みチャンク数')),
    }).pipe(Schema.readonly, Schema.description('統計情報')),
  }).pipe(Schema.readonly, Schema.description('ワールドメタデータ')),

  // 世界生成設定（不変）
  generationSettings: TerrainGenerationParametersSchema,

  // ディメンション管理（Aggregate内のEntity参照）
  dimensions: Schema.Map({
    key: DimensionIdSchema,
    value: Schema.suspend(() => DimensionReferenceSchema), // 循環参照回避
  }).pipe(Schema.readonly, Schema.description('ディメンション管理マップ')),

  // ゲームルール設定（Value Object Pattern）
  gameRules: Schema.Struct({
    difficulty: Schema.Literal('peaceful', 'easy', 'normal', 'hard').pipe(Schema.description('難易度設定')),
    gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator').pipe(
      Schema.description('デフォルトゲームモード')
    ),
    pvp: Schema.Boolean.pipe(Schema.description('PvP有効フラグ')),
    mobSpawning: Schema.Boolean.pipe(Schema.description('Mob生成有効フラグ')),
    naturalRegeneration: Schema.Boolean.pipe(Schema.description('自然回復有効フラグ')),
    keepInventory: Schema.Boolean.pipe(Schema.description('死亡時インベントリ保持フラグ')),
    doDaylightCycle: Schema.Boolean.pipe(Schema.description('昼夜サイクル有効フラグ')),
    doWeatherCycle: Schema.Boolean.pipe(Schema.description('天候サイクル有効フラグ')),
    commandBlockOutput: Schema.Boolean.pipe(Schema.description('コマンドブロック出力有効フラグ')),
    randomTickSpeed: Schema.Number.pipe(
      Schema.clamp(0, 4096),
      Schema.int(),
      Schema.description('ランダムティック速度')
    ),
    maxEntityCramming: Schema.Number.pipe(
      Schema.clamp(0, 100),
      Schema.int(),
      Schema.description('最大エンティティ詰め込み数')
    ),
  }).pipe(Schema.readonly, Schema.description('ゲームルール設定')),

  // ワールドボーダー（Value Object Pattern）
  worldBorder: Schema.Struct({
    centerX: Schema.Number.pipe(Schema.finite(), Schema.description('ワールドボーダー中心X座標')),
    centerZ: Schema.Number.pipe(Schema.finite(), Schema.description('ワールドボーダー中心Z座標')),
    size: Schema.Number.pipe(Schema.between(1, 60000000), Schema.description('ワールドボーダーサイズ（直径）')),
    safeZone: Schema.Number.pipe(Schema.nonnegative(), Schema.description('安全地帯サイズ')),
    warningDistance: Schema.Number.pipe(Schema.nonnegative(), Schema.description('警告表示距離')),
    warningTime: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('警告表示時間（秒）')),
    damagePerBlock: Schema.Number.pipe(Schema.nonnegative(), Schema.description('ブロック当たりダメージ')),
  }).pipe(Schema.readonly, Schema.description('ワールドボーダー設定')),

  // グローバル時間状態（Value Object Pattern）
  worldTime: Schema.Struct({
    dayTime: Schema.Number.pipe(
      Schema.clamp(0, 23999), // 1日 = 24000 tick
      Schema.int(),
      Schema.description('1日の時間（0-23999ティック）')
    ),
    totalTime: Schema.BigIntFromSelf.pipe(Schema.nonnegative(), Schema.description('ワールド開始からの総ティック数')),
    moonPhase: Schema.Number.pipe(Schema.clamp(0, 7), Schema.int(), Schema.description('月の満ち欠け（0-7）')),
    doDaylightCycle: Schema.Boolean.pipe(Schema.description('昼夜サイクル有効フラグ')),
  }).pipe(Schema.readonly, Schema.description('ワールド時間状態')),

  // 天候状態（Value Object Pattern）
  weather: Schema.Struct({
    current: Schema.Literal('clear', 'rain', 'thunder').pipe(Schema.description('現在の天候状態')),
    rainTime: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('雨の残り時間（ティック）')),
    thunderTime: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('雷の残り時間（ティック）')),
    rainLevel: Schema.Number.pipe(Schema.between(0, 1), Schema.description('雨の強度（0.0-1.0）')),
    thunderLevel: Schema.Number.pipe(Schema.between(0, 1), Schema.description('雷の強度（0.0-1.0）')),
  }).pipe(Schema.readonly, Schema.description('天候状態')),

  // スポーン設定（Value Object Pattern）
  spawnSettings: Schema.Struct({
    worldSpawn: WorldPositionSchema,
    spawnRadius: Schema.Number.pipe(Schema.clamp(0, 128), Schema.int(), Schema.description('スポーン範囲半径')),
    randomizeSpawn: Schema.Boolean.pipe(Schema.description('ランダムスポーン有効フラグ')),
    spawnProtection: Schema.Number.pipe(Schema.clamp(0, 16), Schema.int(), Schema.description('スポーン保護範囲')),
  }).pipe(Schema.readonly, Schema.description('スポーン設定')),
}).pipe(Schema.readonly, Schema.description('ワールド集約ルート（Aggregate Root Pattern）'))

export interface WorldAggregate extends Schema.Schema.Type<typeof WorldAggregateSchema> {}

// ディメンション参照エンティティ（Entity Pattern）
export const DimensionReferenceSchema = Schema.Struct({
  id: DimensionIdSchema,
  type: Schema.Literal('overworld', 'nether', 'the_end', 'custom').pipe(Schema.description('ディメンションタイプ')),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64), Schema.description('ディメンション表示名')),

  // ディメンション固有設定（Value Object Pattern）
  settings: Schema.Struct({
    hasWeather: Schema.Boolean.pipe(Schema.description('天候システム有効フラグ')),
    hasSkylight: Schema.Boolean.pipe(Schema.description('空光源有効フラグ')),
    hasCeiling: Schema.Boolean.pipe(Schema.description('天井存在フラグ')),
    ambientLight: Schema.Number.pipe(Schema.between(0, 1), Schema.description('環境光レベル（0.0-1.0）')),
    logicalHeight: Schema.Number.pipe(Schema.clamp(0, 384), Schema.int(), Schema.description('論理的高度制限')),
    coordinateScale: Schema.Number.pipe(Schema.positive(), Schema.description('座標スケール倍率')),
    piglinSafe: Schema.Boolean.pipe(Schema.description('ピグリン安全地帯フラグ')),
    bedWorks: Schema.Boolean.pipe(Schema.description('ベッド使用可能フラグ')),
    respawnAnchorWorks: Schema.Boolean.pipe(Schema.description('リスポーンアンカー使用可能フラグ')),
    ultraWarm: Schema.Boolean.pipe(Schema.description('超高温環境フラグ')),
    natural: Schema.Boolean.pipe(Schema.description('自然ディメンションフラグ')),
  }).pipe(Schema.readonly, Schema.description('ディメンション固有設定')),

  // チャンク管理情報（Entity状態管理）
  chunkManagement: Schema.Struct({
    loadedRegions: Schema.Set(RegionIdSchema).pipe(Schema.readonly, Schema.description('読み込み済みリージョンセット')),
    activeChunks: Schema.Set(ChunkCoordinateSchema).pipe(
      Schema.readonly,
      Schema.description('アクティブチャンクセット')
    ),
    dirtyChunks: Schema.Set(ChunkCoordinateSchema).pipe(
      Schema.readonly,
      Schema.description('保存が必要なチャンクセット')
    ),
    lastCleanup: Schema.DateFromSelf.pipe(Schema.description('最終クリーンアップ日時')),
    memoryUsage: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('メモリ使用量（バイト）')),
  }).pipe(Schema.readonly, Schema.description('チャンク管理情報')),

  // バイオーム分布マップ（Value Object）
  biomeDistribution: Schema.Map({
    key: BiomeIdSchema,
    value: Schema.Number.pipe(Schema.between(0, 1), Schema.description('分布密度（0.0-1.0）')),
  }).pipe(Schema.readonly, Schema.description('バイオーム分布密度マップ')),
}).pipe(Schema.readonly, Schema.description('ディメンション参照エンティティ'))

export interface DimensionReference extends Schema.Schema.Type<typeof DimensionReferenceSchema> {}
```

### 集約操作（ビジネスロジック）

```typescript
// ワールド集約のビジネスロジック操作
export namespace WorldAggregateOperations {
  // ワールド作成（ファクトリーメソッド）
  export const createWorld = (
    name: string,
    generationSettings: TerrainGenerationContext.TerrainGenerationParameters
  ): Effect.Effect<WorldAggregate, WorldCreationError, IdGeneratorService> =>
    Effect.gen(function* () {
      const idGenerator = yield* IdGeneratorService
      const worldId = yield* idGenerator.generateWorldId()

      const now = new Date()

      // デフォルトディメンション作成
      const overworldId = DimensionId('overworld')
      const netherDimensionId = DimensionId('nether')
      const endDimensionId = DimensionId('the_end')

      const defaultDimensions = new Map<DimensionId, DimensionReference>([
        [
          overworldId,
          {
            id: overworldId,
            type: 'overworld',
            name: 'Overworld',
            settings: {
              hasWeather: true,
              hasSkylight: true,
              hasCeiling: false,
              ambientLight: 0,
              logicalHeight: 384,
              coordinateScale: 1,
              piglinSafe: false,
              bedWorks: true,
              respawnAnchorWorks: false,
              ultraWarm: false,
              natural: true,
            },
            chunkManagement: {
              loadedRegions: new Set(),
              activeChunks: new Set(),
              dirtyChunks: new Set(),
              lastCleanup: now,
              memoryUsage: 0,
            },
            biomeDistribution: new Map(),
          },
        ],
      ])

      return {
        id: worldId,
        name,
        metadata: {
          createdAt: now,
          lastModified: now,
          lastPlayed: now,
          totalPlayTime: 0,
          version: {
            game: 'typescript-minecraft-3.0.0',
            format: 3,
            features: ['effect-ts-3.17', 'ddd-aggregates', 'typed-data'],
          },
          statistics: {
            totalBlocks: 0,
            totalEntities: 0,
            loadedChunks: 0,
            savedChunks: 0,
          },
        },
        generationSettings,
        dimensions: defaultDimensions,
        gameRules: createDefaultGameRules(),
        worldBorder: createDefaultWorldBorder(),
        worldTime: {
          dayTime: 6000, // 正午からスタート
          totalTime: 0n,
          moonPhase: 0,
          doDaylightCycle: true,
        },
        weather: {
          current: 'clear',
          rainTime: 0,
          thunderTime: 0,
          rainLevel: 0,
          thunderLevel: 0,
        },
        spawnSettings: {
          worldSpawn: {
            x: 0,
            y: 64,
            z: 0,
            dimension: overworldId,
          },
          spawnRadius: 10,
          randomizeSpawn: true,
          spawnProtection: 16,
        },
      }
    })

  // 時間進行（ドメインロジック）
  export const advanceTime = (world: WorldAggregate, ticks: number): Effect.Effect<WorldAggregate, never> =>
    Effect.succeed({
      ...world,
      worldTime: {
        ...world.worldTime,
        dayTime: (world.worldTime.dayTime + ticks) % 24000,
        totalTime: world.worldTime.totalTime + BigInt(ticks),
      },
      metadata: {
        ...world.metadata,
        lastModified: new Date(),
      },
    })

  // 天候変更（ビジネスルール含む）
  export const changeWeather = (
    world: WorldAggregate,
    newWeather: 'clear' | 'rain' | 'thunder',
    duration: number
  ): Effect.Effect<WorldAggregate, WeatherChangeError> =>
    Effect.gen(function* () {
      // ビジネスルール: ネザーでは天候変更不可
      const overworldDimension = world.dimensions.get(DimensionId('overworld'))
      if (!overworldDimension || !overworldDimension.settings.hasWeather) {
        return yield* Effect.fail(new WeatherChangeError('Weather not supported in this dimension'))
      }

      const updatedWeather = pipe(
        newWeather,
        Match.value,
        Match.when('clear', () => ({
          current: 'clear' as const,
          rainTime: 0,
          thunderTime: 0,
          rainLevel: 0,
          thunderLevel: 0,
        })),
        Match.when('rain', () => ({
          current: 'rain' as const,
          rainTime: duration,
          thunderTime: 0,
          rainLevel: 1,
          thunderLevel: 0,
        })),
        Match.when('thunder', () => ({
          current: 'thunder' as const,
          rainTime: duration,
          thunderTime: duration,
          rainLevel: 1,
          thunderLevel: 1,
        })),
        Match.exhaustive
      )

      return {
        ...world,
        weather: updatedWeather,
        metadata: {
          ...world.metadata,
          lastModified: new Date(),
        },
      }
    })

  // チャンク読み込み追跡
  export const trackChunkLoading = (
    world: WorldAggregate,
    dimensionId: DimensionId,
    chunkCoord: ChunkCoordinate
  ): Effect.Effect<WorldAggregate, DimensionNotFoundError> =>
    Effect.gen(function* () {
      const dimension = world.dimensions.get(dimensionId)
      if (!dimension) {
        return yield* Effect.fail(new DimensionNotFoundError(dimensionId))
      }

      const updatedChunkManagement = {
        ...dimension.chunkManagement,
        activeChunks: new Set([...dimension.chunkManagement.activeChunks, chunkCoord]),
        lastCleanup: new Date(),
      }

      const updatedDimension = {
        ...dimension,
        chunkManagement: updatedChunkManagement,
      }

      const updatedDimensions = new Map(world.dimensions)
      updatedDimensions.set(dimensionId, updatedDimension)

      return {
        ...world,
        dimensions: updatedDimensions,
        metadata: {
          ...world.metadata,
          lastModified: new Date(),
          statistics: {
            ...world.metadata.statistics,
            loadedChunks: world.metadata.statistics.loadedChunks + 1,
          },
        },
      }
    })

  // 統計情報更新
  export const updateStatistics = (
    world: WorldAggregate,
    delta: {
      totalBlocks?: number
      totalEntities?: number
      loadedChunks?: number
      savedChunks?: number
    }
  ): Effect.Effect<WorldAggregate, never> =>
    Effect.succeed({
      ...world,
      metadata: {
        ...world.metadata,
        lastModified: new Date(),
        statistics: {
          totalBlocks: world.metadata.statistics.totalBlocks + (delta.totalBlocks || 0),
          totalEntities: world.metadata.statistics.totalEntities + (delta.totalEntities || 0),
          loadedChunks: world.metadata.statistics.loadedChunks + (delta.loadedChunks || 0),
          savedChunks: world.metadata.statistics.savedChunks + (delta.savedChunks || 0),
        },
      },
    })
}

// ヘルパー関数
const createDefaultGameRules = () => ({
  difficulty: 'normal' as const,
  gameMode: 'survival' as const,
  pvp: true,
  mobSpawning: true,
  naturalRegeneration: true,
  keepInventory: false,
  doDaylightCycle: true,
  doWeatherCycle: true,
  commandBlockOutput: true,
  randomTickSpeed: 3,
  maxEntityCramming: 24,
})

const createDefaultWorldBorder = () => ({
  centerX: 0,
  centerZ: 0,
  size: 60000000,
  safeZone: 5,
  warningDistance: 5,
  warningTime: 15,
  damagePerBlock: 0.2,
})
```

## 値オブジェクト設計

### ブロック状態値オブジェクト

```typescript
// ブロック状態値オブジェクト（Value Object Pattern強化）
export namespace BlockValueObjects {
  export type BlockId = string & Brand.Brand<'BlockId'>
  export type MaterialType = string & Brand.Brand<'MaterialType'>

  export const BlockId = Brand.nominal<BlockId>()
  export const MaterialType = Brand.nominal<MaterialType>()

  // Schema定義
  export const BlockIdSchema = Schema.String.pipe(
    Schema.brand(BlockId),
    Schema.pattern(/^[a-z0-9_]+$/),
    Schema.minLength(1),
    Schema.maxLength(64),
    Schema.description('ブロック識別子')
  )
  export const MaterialTypeSchema = Schema.String.pipe(
    Schema.brand(MaterialType),
    Schema.pattern(/^[a-z0-9_]+$/),
    Schema.minLength(1),
    Schema.maxLength(32),
    Schema.description('材質タイプ識別子')
  )

  // === 高度なブロックID管理（Newtype Pattern強化版） ===

  // Advanced Block UUID with namespace support
  export const BlockUUIDSchema = Schema.String.pipe(
    Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    Schema.brand('BlockUUID'),
    Schema.annotations({
      identifier: 'BlockUUID',
      title: 'Block UUID',
      description: 'RFC 4122 compliant UUID v4 for unique block entity identification',
      examples: ['123e4567-e89b-12d3-a456-426614174000'],
      usage: 'Used for complex block entities like chests, furnaces, etc.',
    })
  )
  export type BlockUUID = Schema.Schema.Type<typeof BlockUUIDSchema>

  // Enhanced Material Type with namespacing
  export const EnhancedMaterialTypeSchema = Schema.String.pipe(
    Schema.pattern(/^([a-z0-9_]+:)?[a-z0-9_]+$/), // Optional namespace support
    Schema.minLength(1),
    Schema.maxLength(64),
    Schema.brand('EnhancedMaterialType'),
    Schema.annotations({
      identifier: 'EnhancedMaterialType',
      title: 'Enhanced Material Type',
      description: 'Material type identifier with optional namespace support',
      examples: ['minecraft:stone', 'custom:special_ore', 'wood'],
    })
  )
  export type EnhancedMaterialType = Schema.Schema.Type<typeof EnhancedMaterialTypeSchema>

  // Block Registry Key with validation
  export const BlockRegistryKeySchema = Schema.String.pipe(
    Schema.pattern(/^[a-z0-9_]+:[a-z0-9_/]+$/),
    Schema.minLength(3),
    Schema.maxLength(128),
    Schema.brand('BlockRegistryKey'),
    Schema.annotations({
      identifier: 'BlockRegistryKey',
      title: 'Block Registry Key',
      description: 'Namespaced registry key for block types',
      examples: ['minecraft:stone', 'minecraft:oak_wood', 'custom:special_block'],
    })
  )
  export type BlockRegistryKey = Schema.Schema.Type<typeof BlockRegistryKeySchema>

  // Block Version identifier for format compatibility
  export const BlockVersionSchema = Schema.String.pipe(
    Schema.pattern(/^\d+\.\d+\.\d+$/),
    Schema.brand('BlockVersion'),
    Schema.annotations({
      identifier: 'BlockVersion',
      title: 'Block Version',
      description: 'Semantic version for block format compatibility',
      examples: ['1.0.0', '2.1.3'],
    })
  )
  export type BlockVersion = Schema.Schema.Type<typeof BlockVersionSchema>

  // ブロック状態の不変値オブジェクト（強化版）
  export const BlockStateSchema = Schema.Struct({
    id: BlockIdSchema,
    material: MaterialTypeSchema,

    // 物理的プロパティ（Value Object Pattern）
    properties: Schema.Struct({
      solid: Schema.Boolean.pipe(Schema.description('固体ブロックかどうか')),
      transparent: Schema.Boolean.pipe(Schema.description('透明ブロックかどうか')),
      luminous: Schema.Boolean.pipe(Schema.description('発光ブロックかどうか')),
      hardness: Schema.Number.pipe(Schema.between(0, 50), Schema.description('硬度値（破壊時間に影響）')),
      resistance: Schema.Number.pipe(Schema.between(0, 3600000), Schema.description('爆発耐性値')),
      lightLevel: Schema.Number.pipe(Schema.clamp(0, 15), Schema.int(), Schema.description('発光レベル（0-15）')),
      lightOpacity: Schema.Number.pipe(Schema.clamp(0, 15), Schema.int(), Schema.description('光透過度（0-15）')),
    }).pipe(Schema.readonly, Schema.description('ブロックの物理的プロパティ')),

    // 状態プロパティ（ブロック種別固有）
    stateProperties: Schema.Record({
      key: Schema.String.pipe(Schema.pattern(/^[a-z_]+$/), Schema.description('プロパティ名')),
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean).pipe(Schema.description('プロパティ値')),
    }).pipe(Schema.readonly, Schema.description('ブロック固有の状態プロパティ')),

    // レンダリング情報（Value Object Pattern）
    rendering: Schema.Struct({
      model: Schema.String.pipe(Schema.minLength(1), Schema.description('3Dモデルリソースパス')),
      textures: Schema.Map({
        key: Schema.Literal('top', 'bottom', 'north', 'south', 'east', 'west', 'all').pipe(
          Schema.description('テクスチャ面指定')
        ),
        value: Schema.String.pipe(Schema.minLength(1), Schema.description('テクスチャリソースパス')),
      }).pipe(Schema.readonly, Schema.description('面別テクスチャマッピング')),
      tintIndex: Schema.optional(
        Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.description('色調インデックス'))
      ),
      cullFaces: Schema.Array(Schema.Literal('up', 'down', 'north', 'south', 'east', 'west')).pipe(
        Schema.readonly,
        Schema.description('カリング対象面リスト')
      ),
    }).pipe(Schema.readonly, Schema.description('レンダリング情報')),

    // ゲーム動作（Value Object Pattern）
    behavior: Schema.Struct({
      tickable: Schema.Boolean.pipe(Schema.description('randomTick処理対象かどうか')),
      interactable: Schema.Boolean.pipe(Schema.description('右クリック相互作用可能かどうか')),
      placeable: Schema.Boolean.pipe(Schema.description('プレイヤーが設置可能かどうか')),
      breakable: Schema.Boolean.pipe(Schema.description('破壊可能かどうか')),
      waterloggable: Schema.Boolean.pipe(Schema.description('水没状態になれるかどうか')),
      flammable: Schema.Boolean.pipe(Schema.description('燃焼するかどうか')),
    }).pipe(Schema.readonly, Schema.description('ブロックのゲーム内動作')),
  }).pipe(Schema.readonly, Schema.description('ブロック状態値オブジェクト（不変）'))

  export interface BlockState extends Schema.Schema.Type<typeof BlockStateSchema> {}

  // ブロック状態ファクトリー
  export const BlockStateFactory = {
    // 基本ブロック作成
    createBasicBlock: (
      id: string,
      material: string,
      properties: Partial<BlockState['properties']> = {}
    ): Effect.Effect<BlockState, ValidationError> =>
      Schema.decode(BlockStateSchema)({
        id: BlockId(id),
        material: MaterialType(material),
        properties: {
          solid: true,
          transparent: false,
          luminous: false,
          hardness: 1.5,
          resistance: 6.0,
          lightLevel: 0,
          lightOpacity: 15,
          ...properties,
        },
        stateProperties: {},
        rendering: {
          model: 'block/cube_all',
          textures: new Map([['all', `blocks/${id}`]]),
          cullFaces: ['up', 'down', 'north', 'south', 'east', 'west'],
        },
        behavior: {
          tickable: false,
          interactable: false,
          placeable: true,
          breakable: true,
          waterloggable: false,
          flammable: false,
        },
      }),

    // 透明ブロック作成
    createTransparentBlock: (id: string, lightOpacity: number = 0): Effect.Effect<BlockState, ValidationError> =>
      BlockStateFactory.createBasicBlock(id, 'glass', {
        transparent: true,
        lightOpacity,
      }),

    // 光源ブロック作成
    createLightSource: (id: string, lightLevel: number): Effect.Effect<BlockState, ValidationError> =>
      BlockStateFactory.createBasicBlock(id, 'light_source', {
        luminous: true,
        lightLevel,
      }),

    // 流体ブロック作成
    createFluidBlock: (id: string, viscosity: number = 1): Effect.Effect<BlockState, ValidationError> =>
      Schema.decode(BlockStateSchema)({
        id: BlockId(id),
        material: MaterialType('fluid'),
        properties: {
          solid: false,
          transparent: true,
          luminous: false,
          hardness: 100,
          resistance: 100,
          lightLevel: 0,
          lightOpacity: 3,
        },
        stateProperties: {
          level: 8, // 流体レベル (0-8)
          falling: false,
          viscosity,
        },
        rendering: {
          model: 'block/fluid',
          textures: new Map([
            ['still', `blocks/${id}_still`],
            ['flowing', `blocks/${id}_flow`],
          ]),
          cullFaces: [],
        },
        behavior: {
          tickable: true,
          interactable: false,
          placeable: false,
          breakable: false,
          waterloggable: false,
          flammable: false,
        },
      }),
  }

  // ブロック状態変更（不変更新）
  export const updateBlockState = (
    blockState: BlockState,
    propertyName: string,
    value: string | number | boolean
  ): Effect.Effect<BlockState, InvalidPropertyError> =>
    Effect.gen(function* () {
      // プロパティ存在チェック
      const validProperties = yield* getValidPropertiesForBlock(blockState.id)
      if (!validProperties.includes(propertyName)) {
        return yield* Effect.fail(new InvalidPropertyError(propertyName, blockState.id))
      }

      const updatedProperties = new Map(Object.entries(blockState.stateProperties))
      updatedProperties.set(propertyName, value)

      return {
        ...blockState,
        stateProperties: Object.fromEntries(updatedProperties),
      }
    })

  // ブロック状態比較
  export const blockStatesEqual = (a: BlockState, b: BlockState): boolean => {
    return a.id === b.id && deepEqual(a.stateProperties, b.stateProperties)
  }

  // ブロック状態のハッシュ値計算（最適化用）
  export const hashBlockState = (blockState: BlockState): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const stateString = JSON.stringify({
        id: blockState.id,
        properties: blockState.stateProperties,
      })
      return yield* hashString(stateString)
    })
}
```

### 座標値オブジェクト

```typescript
// 3D座標系値オブジェクト（Value Object Pattern強化）
export namespace CoordinateValueObjects {
  // 絶対座標（ワールド座標系）
  export const AbsolutePositionSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.finite(), Schema.description('X座標（東西方向）')),
    y: Schema.Number.pipe(
      Schema.clamp(-64, 320), // ワールド高度制限
      Schema.description('Y座標（上下方向、-64から320まで）')
    ),
    z: Schema.Number.pipe(Schema.finite(), Schema.description('Z座標（南北方向）')),
    dimension: DimensionIdSchema,
  }).pipe(Schema.readonly, Schema.description('ワールド内絶対座標'))

  // 相対座標（チャンク内座標）
  export const LocalPositionSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.clamp(0, 15), Schema.int(), Schema.description('チャンク内X座標（0-15）')),
    y: Schema.Number.pipe(Schema.clamp(0, 255), Schema.int(), Schema.description('チャンク内Y座標（0-255）')),
    z: Schema.Number.pipe(Schema.clamp(0, 15), Schema.int(), Schema.description('チャンク内Z座標（0-15）')),
  }).pipe(Schema.readonly, Schema.description('チャンク内相対座標'))

  // 方向ベクトル（正規化済み）
  export const DirectionVectorSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.between(-1, 1), Schema.description('X方向成分')),
    y: Schema.Number.pipe(Schema.between(-1, 1), Schema.description('Y方向成分')),
    z: Schema.Number.pipe(Schema.between(-1, 1), Schema.description('Z方向成分')),
  }).pipe(
    Schema.filter((vec) => Math.abs(Math.sqrt(vec.x ** 2 + vec.y ** 2 + vec.z ** 2) - 1) < 1e-6, {
      message: (actual) =>
        `Direction vector must be normalized (length=${Math.sqrt(actual.x ** 2 + actual.y ** 2 + actual.z ** 2)})`,
    }),
    Schema.readonly,
    Schema.description('正規化済み方向ベクトル')
  )

  // 境界ボックス（Value Object Pattern）
  export const BoundingBoxSchema = Schema.Struct({
    min: AbsolutePositionSchema.pipe(Schema.description('境界ボックス最小座標')),
    max: AbsolutePositionSchema.pipe(Schema.description('境界ボックス最大座標')),
  }).pipe(
    Schema.filter(
      (box) =>
        box.min.x <= box.max.x &&
        box.min.y <= box.max.y &&
        box.min.z <= box.max.z &&
        box.min.dimension === box.max.dimension,
      {
        message: (actual) =>
          `Invalid bounding box: min(${actual.min.x},${actual.min.y},${actual.min.z}) must be <= max(${actual.max.x},${actual.max.y},${actual.max.z}) and same dimension`,
      }
    ),
    Schema.readonly,
    Schema.description('3D境界ボックス')
  )

  export interface AbsolutePosition extends Schema.Schema.Type<typeof AbsolutePositionSchema> {}
  export interface LocalPosition extends Schema.Schema.Type<typeof LocalPositionSchema> {}
  export interface DirectionVector extends Schema.Schema.Type<typeof DirectionVectorSchema> {}
  export interface BoundingBox extends Schema.Schema.Type<typeof BoundingBoxSchema> {}

  // 座標演算ユーティリティ
  export const CoordinateOperations = {
    // 距離計算
    distance: (a: AbsolutePosition, b: AbsolutePosition): Effect.Effect<number, DimensionMismatchError> =>
      Effect.gen(function* () {
        if (a.dimension !== b.dimension) {
          return yield* Effect.fail(new DimensionMismatchError())
        }

        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
      }),

    // マンハッタン距離
    manhattanDistance: (a: AbsolutePosition, b: AbsolutePosition): Effect.Effect<number, DimensionMismatchError> =>
      Effect.gen(function* () {
        if (a.dimension !== b.dimension) {
          return yield* Effect.fail(new DimensionMismatchError())
        }

        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
      }),

    // 座標加算
    add: (pos: AbsolutePosition, offset: DirectionVector): AbsolutePosition => ({
      ...pos,
      x: pos.x + offset.x,
      y: Math.max(-64, Math.min(320, pos.y + offset.y)), // Y座標クランプ
      z: pos.z + offset.z,
    }),

    // 境界ボックス内判定
    isWithinBounds: (pos: AbsolutePosition, bounds: BoundingBox): Effect.Effect<boolean, DimensionMismatchError> =>
      Effect.gen(function* () {
        if (pos.dimension !== bounds.min.dimension) {
          return yield* Effect.fail(new DimensionMismatchError())
        }

        return (
          pos.x >= bounds.min.x &&
          pos.x <= bounds.max.x &&
          pos.y >= bounds.min.y &&
          pos.y <= bounds.max.y &&
          pos.z >= bounds.min.z &&
          pos.z <= bounds.max.z
        )
      }),

    // 座標正規化（ブロック座標への丸め）
    normalize: (pos: AbsolutePosition): AbsolutePosition => ({
      ...pos,
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z),
    }),

    // 周辺座標生成
    getNeighbors: (pos: AbsolutePosition, radius: number = 1): Effect.Effect<ReadonlyArray<AbsolutePosition>, never> =>
      Effect.succeed(
        Range.make(-radius, radius)
          .flatMap((dx) =>
            Range.make(-radius, radius).flatMap((dy) =>
              Range.make(-radius, radius).map((dz) => ({
                ...pos,
                x: pos.x + dx,
                y: Math.max(-64, Math.min(320, pos.y + dy)),
                z: pos.z + dz,
              }))
            )
          )
          .filter((neighbor) => !(neighbor.x === pos.x && neighbor.y === pos.y && neighbor.z === pos.z))
      ),

    // チャンク座標への変換
    toChunkCoordinate: (pos: AbsolutePosition): ChunkCoordinate =>
      ChunkCoordinate(`${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`),

    // ローカル座標への変換
    toLocalCoordinate: (pos: AbsolutePosition): LocalPosition => ({
      x: ((pos.x % 16) + 16) % 16,
      y: pos.y,
      z: ((pos.z % 16) + 16) % 16,
    }),
  }
}
```

## ドメインサービス

### ワールド生成ドメインサービス

```typescript
// ワールド生成ドメインサービス
export interface WorldGenerationService {
  readonly generateTerrain: (
    coord: ChunkCoordinate,
    settings: TerrainGenerationContext.TerrainGenerationParameters
  ) => Effect.Effect<TerrainData, GenerationError>

  readonly generateBiomes: (
    coord: ChunkCoordinate,
    settings: TerrainGenerationContext.TerrainGenerationParameters
  ) => Effect.Effect<BiomeMap, GenerationError>

  readonly generateStructures: (
    coord: ChunkCoordinate,
    biomes: BiomeMap
  ) => Effect.Effect<ReadonlyArray<StructureInstance>, GenerationError>

  readonly populateChunk: (
    coord: ChunkCoordinate,
    terrain: TerrainData,
    structures: ReadonlyArray<StructureInstance>
  ) => Effect.Effect<PopulatedChunk, GenerationError>
}

export const WorldGenerationService = Context.GenericTag<WorldGenerationService>('@app/WorldGenerationService')

// 実装例
export const makeWorldGenerationService = Effect.gen(function* () {
  const logger = yield* Logger
  const noiseGenerator = yield* NoiseGeneratorService

  return WorldGenerationService.of({
    generateTerrain: (coord, settings) =>
      Effect.gen(function* () {
        yield* logger.debug(`Generating terrain for chunk ${coord}`)

        // パーリンノイズベースの高度マップ生成
        const heightMap = yield* noiseGenerator.generateHeightMap(coord, settings.seed)

        // バイオーム固有の地形特徴適用
        const biomeMap = yield* WorldGenerationService.generateBiomes(coord, settings)

        // 地質構造生成（洞窟、鉱脈など）
        const geologicalFeatures = yield* generateGeologicalFeatures(coord, heightMap, settings)

        return {
          coordinate: coord,
          heightMap,
          geologicalFeatures,
          generatedAt: new Date(),
        }
      }),

    generateBiomes: (coord, settings) =>
      Effect.gen(function* () {
        // 温度・湿度ノイズマップ生成
        const temperatureMap = yield* noiseGenerator.generateTemperatureMap(coord, settings.seed)
        const humidityMap = yield* noiseGenerator.generateHumidityMap(coord, settings.seed)

        // Whittaker biome分類法の適用
        const biomes = Range.make(0, 16).flatMap((x) =>
          Range.make(0, 16).map((z) => {
            const temp = temperatureMap[x][z]
            const humidity = humidityMap[x][z]
            return determineBiome(temp, humidity)
          })
        )

        return {
          coordinate: coord,
          biomes: new Uint8Array(biomes.map((biome) => biome.id)),
          temperatureMap,
          humidityMap,
        }
      }),

    generateStructures: (coord, biomeMap) =>
      Effect.gen(function* () {
        const structures = yield* pipe(
          ReadonlyArray.fromIterable(biomeMap.biomes),
          Effect.reduce([] as ReadonlyArray<StructureInstance>, (acc, biome) =>
            Effect.gen(function* () {
              const structureTypes = yield* getStructureTypesForBiome(biome)

              const generatedStructures = yield* pipe(
                ReadonlyArray.fromIterable(structureTypes),
                Effect.reduce([] as ReadonlyArray<StructureInstance>, (innerAcc, structureType) =>
                  Effect.gen(function* () {
                    const shouldGenerate = yield* rollStructureGeneration(structureType, coord)
                    if (!shouldGenerate) {
                      return innerAcc
                    }

                    const structure = yield* generateStructureInstance(structureType, coord, biomeMap)
                    return [...innerAcc, structure]
                  })
                )
              )

              return [...acc, ...generatedStructures]
            })
          )
        )

        return structures
      }),

    populateChunk: (coord, terrain, structures) =>
      Effect.gen(function* () {
        // 基本地形ブロック配置
        let chunkData = yield* generateBaseTerrainBlocks(terrain)

        // 構造物配置
        chunkData = yield* pipe(
          ReadonlyArray.fromIterable(structures),
          Effect.reduce(chunkData, (acc, structure) => placeStructure(acc, structure))
        )

        // 植生・デコレーション配置
        chunkData = yield* populateVegetation(chunkData, terrain.biomeMap)

        // 初期照明計算
        chunkData = yield* calculateInitialLighting(chunkData)

        return {
          ...chunkData,
          generationStatus: 'populated',
          populatedAt: new Date(),
        }
      }),
  })
})
```

### データ整合性チェックサービス

```typescript
// データ整合性ドメインサービス
export interface DataIntegrityService {
  readonly validateWorldConsistency: (world: WorldAggregate) => Effect.Effect<IntegrityReport, ValidationError>

  readonly validateChunkBoundaries: (
    chunks: ReadonlyMap<ChunkCoordinate, ChunkData>
  ) => Effect.Effect<BoundaryReport, ValidationError>

  readonly repairCorruptedData: (issues: ReadonlyArray<IntegrityIssue>) => Effect.Effect<RepairResult, RepairError>
}

export const DataIntegrityService = Context.GenericTag<DataIntegrityService>('@app/DataIntegrityService')

export const makeDataIntegrityService = Effect.gen(function* () {
  const logger = yield* Logger

  return DataIntegrityService.of({
    validateWorldConsistency: (world) =>
      Effect.gen(function* () {
        const dimensionIssues = pipe(
          ReadonlyArray.fromIterable(world.dimensions),
          ReadonlyArray.flatMap(([dimId, dimension]) => {
            const mismatchIssues: ReadonlyArray<IntegrityIssue> =
              dimension.id !== dimId
                ? [
                    {
                      type: 'DimensionIdMismatch' as const,
                      dimensionId: dimId,
                      severity: 'high',
                    },
                  ]
                : []

            const chunkLoadIssues: ReadonlyArray<IntegrityIssue> =
              dimension.chunkManagement.activeChunks.size > 1000
                ? [
                    {
                      type: 'ExcessiveLoadedChunks' as const,
                      dimensionId: dimId,
                      count: dimension.chunkManagement.activeChunks.size,
                      severity: 'medium',
                    },
                  ]
                : []

            return [...mismatchIssues, ...chunkLoadIssues]
          })
        )

        const issues = ([] as ReadonlyArray<IntegrityIssue>)
          .concat(dimensionIssues)
          .concat(
            world.worldTime.dayTime < 0 || world.worldTime.dayTime >= 24000
              ? [
                  {
                    type: 'InvalidDayTime' as const,
                    value: world.worldTime.dayTime,
                    severity: 'high',
                  },
                ]
              : []
          )
          .concat(
            world.worldBorder.size <= 0 || world.worldBorder.size > 60000000
              ? [
                  {
                    type: 'InvalidWorldBorderSize' as const,
                    size: world.worldBorder.size,
                    severity: 'medium',
                  },
                ]
              : []
          )

        return {
          worldId: world.id,
          issues,
          overallHealth: calculateHealthScore(issues),
          checkedAt: new Date(),
        }
      }),

    validateChunkBoundaries: (chunks) =>
      Effect.gen(function* () {
        const boundaryIssues = yield* pipe(
          ReadonlyArray.fromIterable(chunks),
          Effect.reduce([] as ReadonlyArray<BoundaryIssue>, (acc, [coord, chunk]) =>
            Effect.gen(function* () {
              const neighbors = yield* getNeighborChunkCoordinates(coord)

              const issuesForChunk = yield* pipe(
                ReadonlyArray.fromIterable(neighbors),
                Effect.reduce([] as ReadonlyArray<BoundaryIssue>, (innerAcc, neighborCoord) =>
                  Effect.gen(function* () {
                    const neighborChunk = chunks.get(neighborCoord)
                    if (!neighborChunk) {
                      return innerAcc
                    }

                    const inconsistencies = yield* findBoundaryInconsistencies(chunk, neighborChunk)
                    return [...innerAcc, ...inconsistencies]
                  })
                )
              )

              return [...acc, ...issuesForChunk]
            })
          )
        )

        return {
          totalChunks: chunks.size,
          boundaryIssues,
          severity: calculateBoundarySeverity(boundaryIssues),
          validatedAt: new Date(),
        }
      }),

    repairCorruptedData: (issues) =>
      Effect.gen(function* () {
        const { repairedCount, failedCount, repairLog } = yield* pipe(
          issues,
          Effect.reduce(
            {
              repairedCount: 0,
              failedCount: 0,
              repairLog: [] as ReadonlyArray<string>,
            },
            (state, issue) =>
              pipe(
                pipe(
                  issue.type,
                  Match.value,
                  Match.when('DimensionIdMismatch', () => repairDimensionIdMismatch(issue)),
                  Match.when('ExcessiveLoadedChunks', () => unloadExcessChunks(issue)),
                  Match.when('InvalidDayTime', () => fixDayTime(issue)),
                  Match.when('InvalidWorldBorderSize', () => resetWorldBorder(issue)),
                  Match.orElse(() => Effect.fail(new UnrepairableIssueError(issue)))
                ),
                Effect.match(
                  (error) => ({
                    repairedCount: state.repairedCount,
                    failedCount: state.failedCount + 1,
                    repairLog: [...state.repairLog, `Error repairing ${issue.type}: ${(error as Error).message}`],
                  }),
                  (repairResult) =>
                    repairResult.success
                      ? {
                          repairedCount: state.repairedCount + 1,
                          failedCount: state.failedCount,
                          repairLog: [...state.repairLog, `Repaired: ${issue.type}`],
                        }
                      : {
                          repairedCount: state.repairedCount,
                          failedCount: state.failedCount + 1,
                          repairLog: [...state.repairLog, `Failed to repair: ${issue.type} - ${repairResult.reason}`],
                        }
                )
              )
          )
        )

        return {
          totalIssues: issues.length,
          repairedCount,
          failedCount,
          repairLog,
          repairedAt: new Date(),
        }
      }),
  })
})
```

## イベントソーシング

### ドメインイベント定義

```typescript
// ドメインイベント基底型（Event Sourcing Pattern）
export type EventId = string & Brand.Brand<'EventId'>
export const EventId = Brand.nominal<EventId>()
export const EventIdSchema = Schema.String.pipe(
  Schema.brand(EventId),
  Schema.uuid(),
  Schema.description('イベント一意識別子')
)

export const DomainEventSchema = Schema.Struct({
  id: EventIdSchema,
  aggregateId: Schema.String.pipe(Schema.minLength(1), Schema.description('集約ルートID')),
  aggregateType: Schema.String.pipe(Schema.pattern(/^[A-Z][a-zA-Z0-9]*$/), Schema.description('集約ルートタイプ')),
  eventType: Schema.String.pipe(Schema.pattern(/^[A-Z][a-zA-Z0-9]*$/), Schema.description('イベントタイプ')),
  eventVersion: Schema.Number.pipe(Schema.positive(), Schema.int(), Schema.description('イベントスキーマバージョン')),
  timestamp: Schema.DateFromSelf.pipe(Schema.description('イベント発生日時')),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).pipe(Schema.readonly, Schema.description('イベントメタデータ'))
  ),
}).pipe(Schema.readonly, Schema.description('ドメインイベント基底スキーマ'))

// ワールド関連ドメインイベント（Tagged Union Pattern強化）
export const WorldDomainEventSchema = Schema.TaggedUnion('eventType', {
  WorldCreated: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('WorldCreated'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        worldName: Schema.String.pipe(
          Schema.minLength(1),
          Schema.maxLength(32),
          Schema.description('作成されたワールド名')
        ),
        generationSettings: TerrainGenerationParametersSchema,
        createdBy: Schema.String.pipe(Schema.minLength(1), Schema.description('作成者プレイヤーID')),
      }).pipe(Schema.readonly, Schema.description('ワールド作成イベントデータ')),
    })
  ),

  WorldTimeAdvanced: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('WorldTimeAdvanced'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        previousTime: Schema.Number.pipe(Schema.clamp(0, 23999), Schema.int(), Schema.description('変更前の時間')),
        newTime: Schema.Number.pipe(Schema.clamp(0, 23999), Schema.int(), Schema.description('変更後の時間')),
        ticksAdvanced: Schema.Number.pipe(Schema.positive(), Schema.int(), Schema.description('進んだティック数')),
      }).pipe(Schema.readonly, Schema.description('時間進行イベントデータ')),
    })
  ),

  WeatherChanged: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('WeatherChanged'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        dimensionId: DimensionIdSchema,
        previousWeather: Schema.Literal('clear', 'rain', 'thunder').pipe(Schema.description('変更前の天候')),
        newWeather: Schema.Literal('clear', 'rain', 'thunder').pipe(Schema.description('変更後の天候')),
        duration: Schema.Number.pipe(
          Schema.nonnegative(),
          Schema.int(),
          Schema.description('天候持続時間（ティック）')
        ),
        changedBy: Schema.optional(
          Schema.String.pipe(Schema.minLength(1), Schema.description('変更実行者プレイヤーID'))
        ),
      }).pipe(Schema.readonly, Schema.description('天候変更イベントデータ')),
    })
  ),

  ChunkLoaded: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('ChunkLoaded'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        dimensionId: DimensionIdSchema,
        chunkCoordinate: ChunkCoordinateSchema,
        loadReason: Schema.Literal('player_proximity', 'forced_load', 'structure_generation').pipe(
          Schema.description('チャンク読み込み理由')
        ),
        loadedBy: Schema.optional(
          Schema.String.pipe(Schema.minLength(1), Schema.description('読み込み実行者（プレイヤーIDまたはsystem）'))
        ),
      }).pipe(Schema.readonly, Schema.description('チャンク読み込みイベントデータ')),
    })
  ),

  ChunkUnloaded: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('ChunkUnloaded'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        dimensionId: DimensionIdSchema,
        chunkCoordinate: ChunkCoordinateSchema,
        unloadReason: Schema.Literal('player_distance', 'memory_pressure', 'world_shutdown').pipe(
          Schema.description('チャンクアンロード理由')
        ),
        wasDirty: Schema.Boolean.pipe(Schema.description('保存が必要な未保存変更があったか')),
      }).pipe(Schema.readonly, Schema.description('チャンクアンロードイベントデータ')),
    })
  ),

  GameRuleChanged: Schema.extend(
    DomainEventSchema,
    Schema.Struct({
      eventType: Schema.Literal('GameRuleChanged'),
      data: Schema.Struct({
        worldId: WorldIdSchema,
        ruleName: Schema.String.pipe(
          Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
          Schema.description('変更されたゲームルール名')
        ),
        previousValue: Schema.Unknown.pipe(Schema.description('変更前の値')),
        newValue: Schema.Unknown.pipe(Schema.description('変更後の値')),
        changedBy: Schema.String.pipe(
          Schema.minLength(1),
          Schema.description('変更実行者（プレイヤーIDまたは管理者）')
        ),
      }).pipe(Schema.readonly, Schema.description('ゲームルール変更イベントデータ')),
    })
  ),
}).pipe(Schema.description('ワールド関連ドメインイベントのTagged Union'))

export interface WorldDomainEvent extends Schema.Schema.Type<typeof WorldDomainEventSchema> {}

// イベントストリーム管理（Event Sourcing基盤）
export type StreamId = string & Brand.Brand<'StreamId'>
export const StreamId = Brand.nominal<StreamId>()
export const StreamIdSchema = Schema.String.pipe(
  Schema.brand(StreamId),
  Schema.minLength(1),
  Schema.maxLength(256),
  Schema.description('イベントストリーム識別子')
)

export type StreamVersion = number & Brand.Brand<'StreamVersion'>
export const StreamVersion = Brand.nominal<StreamVersion>()
export const StreamVersionSchema = Schema.Number.pipe(
  Schema.brand(StreamVersion),
  Schema.int(),
  Schema.nonnegative(),
  Schema.description('ストリームバージョン番号')
)

// イベントストア（型安全強化版）
export interface EventStore {
  readonly appendEvents: (
    streamId: StreamId,
    expectedVersion: StreamVersion,
    events: ReadonlyArray<WorldDomainEvent>
  ) => Effect.Effect<StreamVersion, EventStoreError>

  readonly readEvents: (
    streamId: StreamId,
    fromVersion?: StreamVersion
  ) => Effect.Effect<ReadonlyArray<WorldDomainEvent>, EventStoreError>

  readonly readAllEvents: (filter?: {
    aggregateType?: string
    eventType?: string
    fromTimestamp?: Date
    toTimestamp?: Date
  }) => Stream.Stream<WorldDomainEvent, EventStoreError>

  readonly getStreamVersion: (streamId: StreamId) => Effect.Effect<StreamVersion, EventStoreError>

  readonly streamExists: (streamId: StreamId) => Effect.Effect<boolean, EventStoreError>

  readonly deleteStream: (streamId: StreamId, expectedVersion: StreamVersion) => Effect.Effect<void, EventStoreError>
}

export const EventStore = Context.GenericTag<EventStore>('@app/EventStore')
```

### イベントハンドラーとプロジェクション

```typescript
// イベントハンドラー基底インターフェース
export interface EventHandler<TEvent extends WorldDomainEvent> {
  readonly eventType: TEvent['eventType']
  readonly handle: (event: TEvent) => Effect.Effect<void, EventHandlerError>
}

// 統計更新イベントハンドラー
export const makeStatisticsEventHandler = Effect.gen(function* () {
  const statisticsService = yield* StatisticsService

  return {
    eventType: 'ChunkLoaded' as const,
    handle: (event: WorldDomainEvent & { eventType: 'ChunkLoaded' }) =>
      Effect.gen(function* () {
        yield* statisticsService.incrementCounter('chunks_loaded_total')
        yield* statisticsService.recordHistogram('chunk_load_time', Date.now() - event.timestamp.getTime())

        // ディメンション別統計
        yield* statisticsService.incrementCounter(`chunks_loaded_${event.data.dimensionId}`, {
          dimension: event.data.dimensionId,
        })
      }),
  }
})

// プレイヤー活動追跡イベントハンドラー
export const makePlayerActivityHandler = Effect.gen(function* () {
  const playerService = yield* PlayerService
  const logger = yield* Logger

  return {
    eventType: 'WeatherChanged' as const,
    handle: (event: WorldDomainEvent & { eventType: 'WeatherChanged' }) =>
      Effect.gen(function* () {
        if (event.data.changedBy) {
          yield* logger.info(`Player ${event.data.changedBy} changed weather to ${event.data.newWeather}`)

          yield* playerService.recordActivity(event.data.changedBy, {
            type: 'weather_change',
            details: {
              from: event.data.previousWeather,
              to: event.data.newWeather,
              dimension: event.data.dimensionId,
            },
            timestamp: event.timestamp,
          })
        }
      }),
  }
})

// イベント配信サービス
export interface EventDispatcher {
  readonly dispatch: (events: ReadonlyArray<WorldDomainEvent>) => Effect.Effect<void, DispatchError>
  readonly subscribe: <TEvent extends WorldDomainEvent>(
    eventType: TEvent['eventType'],
    handler: EventHandler<TEvent>
  ) => Effect.Effect<Subscription, SubscriptionError>
}

export const EventDispatcher = Context.GenericTag<EventDispatcher>('@app/EventDispatcher')

export const makeEventDispatcher = Effect.gen(function* () {
  const handlers = yield* Ref.make(new Map<string, ReadonlyArray<EventHandler<any>>>())
  const logger = yield* Logger

  return EventDispatcher.of({
    dispatch: (events) =>
      Effect.gen(function* () {
        const currentHandlers = yield* Ref.get(handlers)

        yield* pipe(
          events,
          Effect.forEach(
            (event) =>
              Effect.all(
                (currentHandlers.get(event.eventType) || []).map((handler) =>
                  pipe(
                    handler.handle(event),
                    Effect.catchAll((error) =>
                      logger.error(`Event handler failed: ${error.message}`, {
                        eventType: event.eventType,
                        eventId: event.id,
                        handlerName: handler.constructor.name,
                      })
                    )
                  )
                ),
                { concurrency: 5 }
              ),
            { discard: true }
          )
        )
      }),

    subscribe: (eventType, handler) =>
      Effect.gen(function* () {
        yield* Ref.update(handlers, (currentHandlers) => {
          const existingHandlers = currentHandlers.get(eventType) || []
          return new Map(currentHandlers).set(eventType, [...existingHandlers, handler])
        })

        return {
          unsubscribe: () =>
            Ref.update(handlers, (currentHandlers) => {
              const existingHandlers = currentHandlers.get(eventType) || []
              const filteredHandlers = existingHandlers.filter((h) => h !== handler)
              return new Map(currentHandlers).set(eventType, filteredHandlers)
            }),
        }
      }),
  })
})
```

## パフォーマンス最適化

### Structure of Arrays (SoA) 最適化

```typescript
// Structure of Arrays パターンによる最適化（Schema強化版）
export namespace PerformanceOptimizations {
  // 従来の Array of Structures (AoS) - キャッシュ効率が悪い
  interface BlockDataAoS {
    type: number
    state: number
    light: number
    metadata: number
  }

  // 最適化された Structure of Arrays (SoA) - キャッシュ効率が良い
  export const BlockDataSoASchema = Schema.Struct({
    types: Schema.InstanceOf(Uint16Array).pipe(Schema.description('ブロックタイプ配列（パフォーマンス最適化）')),
    states: Schema.InstanceOf(Uint32Array).pipe(Schema.description('ブロック状態配列（4バイト値）')),
    lightLevels: Schema.InstanceOf(Uint8Array).pipe(Schema.description('光レベル配列（4ビット×2値パック）')),
    metadata: Schema.InstanceOf(Uint8Array).pipe(Schema.description('メタデータ配列')),
    count: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('有効ブロック数')),
  }).pipe(Schema.readonly, Schema.description('Structure of Arrays形式のブロックデータ（キャッシュ効率最適化）'))

  export interface BlockDataSoA extends Schema.Schema.Type<typeof BlockDataSoASchema> {}

  // SoAデータ操作ユーティリティ
  export const SoAOperations = {
    // 新しいSoAデータ作成
    create: (capacity: number = 4096): BlockDataSoA => ({
      types: new Uint16Array(capacity),
      states: new Uint32Array(capacity),
      lightLevels: new Uint8Array(Math.ceil(capacity / 2)), // 4ビット×2値パック
      metadata: new Uint8Array(capacity),
      count: 0,
    }),

    // ブロックデータ設定
    setBlock: (
      soa: BlockDataSoA,
      index: number,
      type: number,
      state: number = 0,
      light: number = 0,
      meta: number = 0
    ): BlockDataSoA => {
      if (index < 0 || index >= soa.types.length) {
        throw new Error(`Index out of bounds: ${index}`)
      }

      const newSoA = {
        types: new Uint16Array(soa.types),
        states: new Uint32Array(soa.states),
        lightLevels: new Uint8Array(soa.lightLevels),
        metadata: new Uint8Array(soa.metadata),
        count: soa.count,
      }

      newSoA.types[index] = type
      newSoA.states[index] = state
      newSoA.metadata[index] = meta

      // 4ビット光レベルパッキング
      const byteIndex = Math.floor(index / 2)
      const isHighNibble = index % 2 === 1

      if (isHighNibble) {
        newSoA.lightLevels[byteIndex] = (newSoA.lightLevels[byteIndex] & 0x0f) | ((light & 0x0f) << 4)
      } else {
        newSoA.lightLevels[byteIndex] = (newSoA.lightLevels[byteIndex] & 0xf0) | (light & 0x0f)
      }

      return newSoA
    },

    // ブロックデータ取得
    getBlock: (soa: BlockDataSoA, index: number) => {
      if (index < 0 || index >= soa.types.length) {
        throw new Error(`Index out of bounds: ${index}`)
      }

      const byteIndex = Math.floor(index / 2)
      const isHighNibble = index % 2 === 1
      const light = isHighNibble ? (soa.lightLevels[byteIndex] >> 4) & 0x0f : soa.lightLevels[byteIndex] & 0x0f

      return {
        type: soa.types[index],
        state: soa.states[index],
        light,
        metadata: soa.metadata[index],
      }
    },

    // バッチブロック操作（SIMD最適化の前準備）
    batchSetBlocks: (
      soa: BlockDataSoA,
      operations: ReadonlyArray<{
        index: number
        type: number
        state?: number
        light?: number
        metadata?: number
      }>
    ): BlockDataSoA => {
      return pipe(
        operations,
        ReadonlyArray.reduce(soa, (acc, op) =>
          SoAOperations.setBlock(acc, op.index, op.type, op.state ?? 0, op.light ?? 0, op.metadata ?? 0)
        )
      )
    },

    // メモリ使用量計算
    getMemoryUsage: (soa: BlockDataSoA): number => {
      return soa.types.byteLength + soa.states.byteLength + soa.lightLevels.byteLength + soa.metadata.byteLength
    },
  }

  // SIMD操作のサポート検出と活用
  export const SIMDOperations = {
    // SIMDサポート検出
    checkSIMDSupport: (): Effect.Effect<boolean, never> =>
      Effect.succeed(typeof SharedArrayBuffer !== 'undefined' && typeof WebAssembly !== 'undefined'),

    // SIMD対応ブロック検索
    findBlocksSIMD: (soa: BlockDataSoA, targetType: number): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.gen(function* () {
        const hasSIMD = yield* SIMDOperations.checkSIMDSupport()

        if (hasSIMD) {
          return yield* findBlocksSIMDNative(soa.types, targetType)
        } else {
          return yield* findBlocksScalar(soa.types, targetType)
        }
      }),

    // SIMD対応ライト計算
    calculateLightingSIMD: (soa: BlockDataSoA): Effect.Effect<BlockDataSoA, never> =>
      Effect.gen(function* () {
        const hasSIMD = yield* SIMDOperations.checkSIMDSupport()

        if (hasSIMD) {
          const newLightLevels = yield* calculateLightingSIMDNative(soa.lightLevels, soa.types)
          return { ...soa, lightLevels: newLightLevels }
        } else {
          return yield* calculateLightingScalar(soa)
        }
      }),
  }
}

// ネイティブSIMD実装（WebAssemblyまたはWorker経由）
const findBlocksSIMDNative = (types: Uint16Array, targetType: number): Effect.Effect<ReadonlyArray<number>, never> =>
  Effect.succeed([]) // プレースホルダー実装

const findBlocksScalar = (types: Uint16Array, targetType: number): Effect.Effect<ReadonlyArray<number>, never> =>
  Effect.succeed(
    Array.from(types)
      .map((type, index) => (type === targetType ? index : -1))
      .filter((index) => index >= 0)
  )
```

### メモリプール管理

```typescript
// 高性能メモリプール実装（Schema型安全版）
export const PoolStatsSchema = Schema.Struct({
  totalAcquired: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('総取得回数')),
  totalReleased: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('総解放回数')),
  currentlyInUse: Schema.Number.pipe(
    Schema.nonnegative(),
    Schema.int(),
    Schema.description('現在使用中のオブジェクト数')
  ),
  peakUsage: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('最大同時使用数')),
  memoryUsage: Schema.Number.pipe(Schema.nonnegative(), Schema.int(), Schema.description('メモリ使用量（バイト）')),
}).pipe(Schema.readonly, Schema.description('メモリプール統計情報'))

export interface PoolStats extends Schema.Schema.Type<typeof PoolStatsSchema> {}

export interface MemoryPool<T> {
  readonly acquire: () => Effect.Effect<T, PoolExhaustedError>
  readonly release: (item: T) => Effect.Effect<void, never>
  readonly size: () => Effect.Effect<number, never>
  readonly capacity: () => Effect.Effect<number, never>
  readonly stats: () => Effect.Effect<PoolStats, never>
  readonly clear: () => Effect.Effect<void, never>
  readonly resize: (newCapacity: number) => Effect.Effect<void, PoolResizeError>
}

// チャンクデータ用メモリプール
export const makeChunkMemoryPool = (
  maxSize: number = 200,
  chunkFactory: () => Effect.Effect<ChunkData, never> = createEmptyChunk
): Effect.Effect<MemoryPool<ChunkData>, never> =>
  Effect.gen(function* () {
    const availableChunks = yield* Queue.bounded<ChunkData>(maxSize)
    const stats = yield* Ref.make<PoolStats>({
      totalAcquired: 0,
      totalReleased: 0,
      currentlyInUse: 0,
      peakUsage: 0,
      memoryUsage: 0,
    })

    // プール初期化
    yield* pipe(
      Range.make(0, Math.min(maxSize / 2, 50)), // 初期サイズは最大容量の半分
      Effect.forEach(() =>
        pipe(
          chunkFactory(),
          Effect.flatMap((chunk) => availableChunks.offer(chunk))
        )
      )
    )

    return {
      acquire: () =>
        Effect.gen(function* () {
          // 利用可能なチャンクがあれば取得
          const chunk = yield* pipe(
            availableChunks.poll,
            Effect.flatMap((option) =>
              pipe(
                option,
                Option.match({
                  onNone: () => chunkFactory(), // プールが空なら新規作成
                  onSome: (chunk) => Effect.succeed(chunk),
                })
              )
            )
          )

          // 統計更新
          yield* Ref.update(stats, (currentStats) => ({
            ...currentStats,
            totalAcquired: currentStats.totalAcquired + 1,
            currentlyInUse: currentStats.currentlyInUse + 1,
            peakUsage: Math.max(currentStats.peakUsage, currentStats.currentlyInUse + 1),
          }))

          return chunk
        }),

      release: (chunk) =>
        Effect.gen(function* () {
          // チャンクをリセット
          const resetChunk = yield* resetChunkData(chunk)

          // プールに戻す（容量に余裕があれば）
          const wasOffered = yield* availableChunks.offer(resetChunk)

          // 統計更新
          yield* Ref.update(stats, (currentStats) => ({
            ...currentStats,
            totalReleased: currentStats.totalReleased + 1,
            currentlyInUse: Math.max(0, currentStats.currentlyInUse - 1),
          }))

          if (!wasOffered) {
            // プールが満杯の場合は解放してGCに任せる
            yield* cleanupChunkData(resetChunk)
          }
        }),

      size: () => availableChunks.size,

      capacity: () => Effect.succeed(maxSize),

      stats: () => Ref.get(stats),
    }
  })

// チャンクデータリセット（再利用のための初期化）
const resetChunkData = (chunk: ChunkData): Effect.Effect<ChunkData, never> =>
  Effect.succeed({
    ...chunk,
    blocks: PerformanceOptimizations.SoAOperations.create(),
    entities: new Map(),
    blockEntities: new Map(),
    isDirty: false,
    lastModified: new Date(),
  })

const cleanupChunkData = (chunk: ChunkData): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // メモリ集約的なリソースのクリーンアップ
    // TypedArraysは自動的にGCされるが、明示的にnullにすることで
    // GCのヒントを提供
    ;(chunk as any).blocks = null
    ;(chunk as any).entities = null
    ;(chunk as any).blockEntities = null
  })
```

## 実装例とテスト戦略

### 統合テスト例

```typescript
// 統合テストスイート
describe('World Data Structure Integration Tests', () => {
  const testLayer = Layer.provide(
    Layer.merge(TestWorldService, TestEventStore, TestMemoryPool),
    Layer.provide(TestLogger, TestContext.TestContext)
  )

  it('should create and manage world lifecycle correctly', () =>
    Effect.gen(function* () {
      const worldService = yield* WorldService
      const eventStore = yield* EventStore

      // 1. ワールド作成
      const generationSettings = {
        seed: 12345n,
        generationType: 'default' as const,
        seaLevel: 64,
        biomeSize: 1.0,
        structureDensity: 0.5,
        oreDensity: {},
        customSettings: undefined,
      }

      const world = yield* WorldAggregateOperations.createWorld('test-world', generationSettings)

      expect(world.name).toBe('test-world')
      expect(world.dimensions.size).toBe(1) // デフォルトでOverworldのみ

      // 2. イベント永続化確認
      const events = yield* eventStore.readEvents(world.id)
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('WorldCreated')

      // 3. 時間進行テスト
      const advancedWorld = yield* WorldAggregateOperations.advanceTime(world, 1000)
      expect(advancedWorld.worldTime.dayTime).toBe(7000) // 6000 + 1000
      expect(advancedWorld.worldTime.totalTime).toBe(1000n)

      // 4. チャンク管理テスト
      const chunkCoord = ChunkCoordinate('0,0')
      const trackedWorld = yield* WorldAggregateOperations.trackChunkLoading(
        advancedWorld,
        DimensionId('overworld'),
        chunkCoord
      )

      const dimension = trackedWorld.dimensions.get(DimensionId('overworld'))!
      expect(dimension.chunkManagement.activeChunks.has(chunkCoord)).toBe(true)
    }).pipe(Effect.provide(testLayer), Effect.runPromise))

  it('should handle concurrent world modifications safely', () =>
    Effect.gen(function* () {
      const world = yield* createTestWorld()

      // 100個の並列操作を実行
      const concurrentOperations = Range.make(0, 100).map((i) =>
        pipe(
          WorldAggregateOperations.advanceTime(world, i),
          Effect.flatMap((w) => WorldAggregateOperations.changeWeather(w, 'rain', 1000 + i))
        )
      )

      const results = yield* Effect.all(concurrentOperations, {
        concurrency: 10,
      })

      // すべての操作が成功し、最後の結果が期待される状態であることを確認
      expect(results).toHaveLength(100)
      const finalWorld = results[results.length - 1]
      expect(finalWorld.weather.current).toBe('rain')
      expect(finalWorld.worldTime.totalTime).toBeGreaterThan(0n)
    }).pipe(Effect.provide(testLayer), Effect.runPromise))

  it('should maintain data integrity under stress conditions', () =>
    Effect.gen(function* () {
      const integrityService = yield* DataIntegrityService
      const world = yield* createLargeTestWorld(1000) // 1000チャンク

      // 大量のランダム変更を適用
      const modifiedWorld = yield* pipe(
        ReadonlyArray.range(0, 999),
        Effect.reduce(world, (currentWorld) =>
          Effect.gen(function* () {
            const randomOperation = yield* generateRandomWorldOperation()
            return yield* applyWorldOperation(currentWorld, randomOperation)
          })
        )
      )

      // データ整合性チェック
      const integrityReport = yield* integrityService.validateWorldConsistency(modifiedWorld)

      expect(integrityReport.overallHealth).toBeGreaterThan(0.8) // 80%以上の健全性
      expect(integrityReport.issues.filter((issue) => issue.severity === 'high')).toHaveLength(0)
    }).pipe(Effect.provide(testLayer), Effect.runPromise))
})

// Property-Based Testing
describe('World Data Structure Property Tests', () => {
  const worldGen = fc.record({
    name: fc.string({ minLength: 1, maxLength: 32 }),
    seed: fc.bigInt(),
    gameMode: fc.constantFrom('survival', 'creative', 'adventure', 'spectator'),
  })

  it('should preserve invariants across all valid world configurations', () =>
    fc.assert(
      fc.asyncProperty(worldGen, (config) =>
        Effect.gen(function* () {
          const world = yield* WorldAggregateOperations.createWorld(config.name, {
            seed: config.seed,
            generationType: 'default',
            seaLevel: 64,
            biomeSize: 1.0,
            structureDensity: 0.5,
            oreDensity: {},
            customSettings: undefined,
          })

          // 不変条件のチェック
          expect(world.name).toBe(config.name)
          expect(world.generationSettings.seed).toBe(config.seed)
          expect(world.dimensions.size).toBeGreaterThan(0)
          expect(world.worldTime.dayTime).toBeGreaterThanOrEqual(0)
          expect(world.worldTime.dayTime).toBeLessThan(24000)
          expect(world.worldBorder.size).toBeGreaterThan(0)

          return true
        }).pipe(Effect.provide(testLayer), Effect.runPromise)

        return result
      })
    ))
})
```

### ベンチマークテスト

```typescript
// パフォーマンスベンチマーク
describe('Performance Benchmarks', () => {
  it('should meet chunk loading performance targets', async () => {
    const benchmark = await Effect.gen(function* () {
      const memoryPool = yield* makeChunkMemoryPool(200)
      const startTime = performance.now()
      const targetLoadTime = 50 // ms

      // 100チャンクの並列読み込み
      const loadOperations = Range.make(0, 100).map((i) =>
        pipe(
          memoryPool.acquire(),
          Effect.tap((chunk) => simulateChunkData(chunk, i)),
          Effect.tap((chunk) => memoryPool.release(chunk))
        )
      )

      yield* Effect.all(loadOperations, { concurrency: 8 })

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / 100

      expect(averageTime).toBeLessThan(targetLoadTime)

      // メモリ使用量チェック
      const stats = yield* memoryPool.stats()
      expect(stats.memoryUsage).toBeLessThan(1024 * 1024 * 100) // 100MB上限

      return { averageTime, memoryUsage: stats.memoryUsage }
    }).pipe(Effect.provide(TestMemoryPool), Effect.runPromise)

    console.log(`Benchmark results: ${JSON.stringify(benchmark, null, 2)}`)
  })

  it('should efficiently handle SoA operations', async () => {
    const benchmark = await Effect.gen(function* () {
      const soa = PerformanceOptimizations.SoAOperations.create(65536) // 16x16x256
      const startTime = performance.now()

      // 大量のブロック設定操作
      const modifiedSoA = pipe(
        ReadonlyArray.range(0, 65535),
        ReadonlyArray.reduce(soa, (acc, index) =>
          PerformanceOptimizations.SoAOperations.setBlock(
            acc,
            index,
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 16),
            Math.floor(Math.random() * 16),
            Math.floor(Math.random() * 256)
          )
        )
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const operationsPerMs = 65536 / totalTime

      expect(operationsPerMs).toBeGreaterThan(1000) // 1000 ops/ms以上

      return { totalTime, operationsPerMs }
    }).pipe(Effect.runPromise)

    console.log(`SoA Benchmark: ${JSON.stringify(benchmark, null, 2)}`)
  })
})
```

---

## まとめ

この仕様書では、TypeScript Minecraft Cloneにおけるワールドデータ構造を、DDD原則とEffect-TS 3.17+のSchema機能を活用して包括的に設計し、型定義をEffect-TS Schemaに変換しました。

### 変換後の主な改善点

1. **Schema-driven型安全性**: すべての型定義がEffect-TS Schemaベースとなり、実行時バリデーションが可能
2. **DDDパターン強化**: Aggregate Root、Value Object、Entity、Domain Eventの型表現が明確化
3. **Event Sourcing型安全性**: イベントストリーム管理が型安全なBrand型で強化
4. **不変性の強制**: `Schema.readonly`により、すべてのValue Objectが不変性を保証
5. **バリデーション強化**: `Schema.filter`、`Schema.clamp`、`Schema.pattern`による厳密なデータ検証
6. **ドキュメント内蔵**: `Schema.description`により、型定義に説明が組み込まれ、自己文書化を実現

### Effect-TS Schema活用のメリット

- **型推論**: `Schema.Schema.Type<typeof Schema>`による正確な型推論
- **変換処理**: `Schema.transform`による型安全な変換
- **エラーハンドリング**: Effect型との組み合わせによる包括的エラー処理
- **コンポーザビリティ**: スキーマの合成・拡張による柔軟な型定義
- **パフォーマンス**: 実行時型チェックの最適化

### DDDパターンの型実装

- **Aggregate Root**: `WorldAggregateSchema` - 集約境界とビジネスルール
- **Value Objects**: `WorldPositionSchema`、`BlockStateSchema` - 不変性と等価性
- **Entities**: `DimensionReferenceSchema` - アイデンティティと変更可能な状態
- **Domain Events**: `WorldDomainEventSchema` - Tagged Unionによるイベント型安全性
- **Event Sourcing**: `EventStore`インターフェース - ストリーム管理の型安全化

### 次のステップ

- [チャンクフォーマット仕様](./chunk-format.md)でより詳細な実装を確認
- [セーブファイル仕様](./save-file-format.md)で永続化戦略を学習
- [DDD戦略設計](../explanations/architecture/02-ddd-strategic-design.md)でアーキテクチャ全体を理解
- Effect-TS Service/Layer実装でのSchema活用パターンを学習

この設計により、型安全性、実行時検証、自己文書化を兼ね備えたプロダクションレベルのワールドデータ管理システムを構築できます。
