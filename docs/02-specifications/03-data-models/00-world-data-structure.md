---
title: "ワールドデータ構造仕様 - DDD設計による型安全な実装"
description: "Effect-TS 3.17+とDDD原則に基づく包括的なワールドデータ構造設計。集約ルート、値オブジェクト、ドメインサービスを含むプロダクションレベルの実装仕様"
category: "specification"
difficulty: "advanced"
tags: ["effect-ts", "ddd", "world-data", "aggregates", "domain-modeling", "performance"]
prerequisites: ["ddd-concepts", "effect-ts-fundamentals", "schema-advanced"]
estimated_reading_time: "35分"
related_patterns: ["data-modeling-patterns", "service-patterns", "aggregate-patterns"]
related_docs: ["./01-chunk-format.md", "../../01-architecture/02-ddd-strategic-design.md"]
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
import { Schema, Brand, Effect, Context, Match, pipe, Option } from "effect"

// すべての設計はドメインロジックを中心に構築
export const DesignPrinciples = {
  // 1. ドメインの複雑性を型システムで表現
  DomainComplexityInTypes: "複雑なビジネスルールを型レベルで強制",

  // 2. 不変性によるデータ整合性
  ImmutableDataIntegrity: "すべての状態変更は新しいインスタンス生成で表現",

  // 3. 明示的な副作用管理
  ExplicitSideEffects: "Effect型による副作用の明示的な管理",

  // 4. コンポーザビリティ重視
  ComposableDesign: "小さな関数を組み合わせた大きな機能の構築"
} as const

// ドメインの普遍言語（Ubiquitous Language）の型定義
export namespace UbiquitousLanguage {
  // ワールド関連用語
  export type World = "ゲーム世界全体を表現する最上位の概念"
  export type Dimension = "オーバーワールド、ネザー、エンドなどの次元"
  export type Region = "32x32チャンクからなる管理単位"
  export type Chunk = "16x16x256ブロックからなる最小読み込み単位"
  export type Section = "チャンク内の16x16x16ブロック単位"
  export type Block = "ワールドの最小構成要素"

  // エンティティ関連用語
  export type Entity = "ワールド内に存在する動的オブジェクト"
  export type Player = "人間が操作するエンティティ"
  export type Mob = "AI制御されるエンティティ"
  export type Item = "拾得・使用可能なオブジェクト"

  // ゲーム機構関連用語
  export type Biome = "環境特性を決定する地域分類"
  export type Structure = "自然生成される建築物や地形"
  export type WorldGeneration = "手続き的世界生成システム"
}
```

## ドメイン境界の定義

### 境界づけられたコンテキスト

```typescript
// ワールド管理境界づけられたコンテキスト
export namespace WorldManagementContext {
  // ワールドID（Brand型による厳密な型区別）
  export type WorldId = string & Brand.Brand<"WorldId">
  export type DimensionId = string & Brand.Brand<"DimensionId">
  export type RegionId = string & Brand.Brand<"RegionId">
  export type ChunkCoordinate = string & Brand.Brand<"ChunkCoordinate">

  export const WorldId = Brand.nominal<WorldId>()
  export const DimensionId = Brand.nominal<DimensionId>()
  export const RegionId = Brand.nominal<RegionId>()
  export const ChunkCoordinate = Brand.nominal<ChunkCoordinate>()

  // 座標系値オブジェクト
  export const WorldPositionSchema = Schema.Struct({
    x: Schema.Number,
    y: Schema.Number.pipe(Schema.clamp(-64, 320)), // Y座標制限
    z: Schema.Number,
    dimension: Schema.String.pipe(Schema.brand(DimensionId))
  })

  export const ChunkCoordinateSchema = Schema.Struct({
    x: Schema.Int.pipe(Schema.between(-1875000, 1875000)), // ワールド境界
    z: Schema.Int.pipe(Schema.between(-1875000, 1875000))
  }).pipe(
    Schema.transform(
      Schema.String,
      {
        decode: (coord) => `${coord.x},${coord.z}`,
        encode: (str) => {
          const [x, z] = str.split(',').map(Number)
          return { x, z }
        }
      }
    ),
    Schema.brand(ChunkCoordinate)
  )

  export const RegionCoordinateSchema = Schema.Struct({
    x: Schema.Int,
    z: Schema.Int
  }).pipe(
    Schema.transform(
      Schema.String,
      {
        decode: (coord) => `r.${coord.x}.${coord.z}`,
        encode: (str) => {
          const parts = str.split('.')
          return { x: parseInt(parts[1]), z: parseInt(parts[2]) }
        }
      }
    ),
    Schema.brand(RegionId)
  )

  export interface WorldPosition extends Schema.Schema.Type<typeof WorldPositionSchema> {}

  // 座標変換ヘルパー関数
  export const CoordinateConversion = {
    worldToChunk: (pos: WorldPosition): Effect.Effect<ChunkCoordinate, never> =>
      Effect.succeed(
        ChunkCoordinate(`${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`)
      ),

    chunkToRegion: (chunk: ChunkCoordinate): Effect.Effect<RegionId, never> =>
      Effect.gen(function* () {
        const coords = yield* parseChunkCoordinate(chunk)
        return RegionId(`r.${Math.floor(coords.x / 32)}.${Math.floor(coords.z / 32)}`)
      }),

    localBlockPosition: (worldPos: WorldPosition): Effect.Effect<LocalPosition, never> =>
      Effect.succeed({
        x: ((worldPos.x % 16) + 16) % 16,
        y: worldPos.y,
        z: ((worldPos.z % 16) + 16) % 16
      })
  }
}

// 地形生成境界づけられたコンテキスト
export namespace TerrainGenerationContext {
  export type BiomeId = string & Brand.Brand<"BiomeId">
  export type StructureId = string & Brand.Brand<"StructureId">
  export type GeneratorSeed = bigint & Brand.Brand<"GeneratorSeed">

  export const BiomeId = Brand.nominal<BiomeId>()
  export const StructureId = Brand.nominal<StructureId>()
  export const GeneratorSeed = Brand.nominal<GeneratorSeed>()

  // バイオーム値オブジェクト
  export const BiomeSchema = Schema.Struct({
    id: Schema.String.pipe(Schema.brand(BiomeId)),
    name: Schema.String.pipe(
      Schema.minLength(1),
      Schema.maxLength(32)
    ),
    temperature: Schema.Number.pipe(Schema.between(-2.0, 2.0)),
    humidity: Schema.Number.pipe(Schema.between(0.0, 1.0)),
    precipitation: Schema.Literal("none", "rain", "snow"),
    category: Schema.Literal(
      "ocean", "plains", "desert", "mountains", "forest", "taiga",
      "swamp", "river", "nether", "the_end", "icy", "mushroom",
      "beach", "jungle", "savanna", "mesa"
    ),
    colors: Schema.Struct({
      grass: Schema.Number, // RGB値
      foliage: Schema.Number,
      water: Schema.Number,
      sky: Schema.Number,
      fog: Schema.Number
    }),
    features: Schema.Array(Schema.String), // 生成される地形特徴
    structures: Schema.Array(Schema.String.pipe(Schema.brand(StructureId)))
  })

  export interface Biome extends Schema.Schema.Type<typeof BiomeSchema> {}

  // 地形生成パラメータ
  export const TerrainGenerationParametersSchema = Schema.Struct({
    seed: Schema.BigInt.pipe(Schema.brand(GeneratorSeed)),
    generationType: Schema.Literal("default", "flat", "large_biomes", "amplified", "custom"),
    seaLevel: Schema.Number.pipe(Schema.clamp(0, 256)),
    biomeSize: Schema.Number.pipe(Schema.between(0.1, 4.0)),
    structureDensity: Schema.Number.pipe(Schema.between(0.0, 1.0)),
    oreDensity: Schema.Record({
      key: Schema.String, // 鉱石タイプ
      value: Schema.Number.pipe(Schema.between(0.0, 1.0))
    }),
    customSettings: Schema.optional(Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    }))
  })
}
```

## 集約ルートとエンティティ

### ワールド集約ルート

```typescript
// ワールド集約ルート - DRFパターン（Aggregate Root Pattern）
export const WorldAggregateSchema = Schema.Struct({
  // アイデンティティ
  id: Schema.String.pipe(Schema.brand(WorldId)),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(32),
    Schema.pattern(/^[\w\s\-_.]+$/) // 安全なワールド名のみ許可
  ),

  // メタデータ
  metadata: Schema.Struct({
    createdAt: Schema.Date,
    lastModified: Schema.Date,
    lastPlayed: Schema.Date,
    totalPlayTime: Schema.Number.pipe(Schema.nonnegative()), // ミリ秒
    version: Schema.Struct({
      game: Schema.String,
      format: Schema.Number,
      features: Schema.Array(Schema.String)
    }),
    statistics: Schema.Struct({
      totalBlocks: Schema.Number.pipe(Schema.nonnegative()),
      totalEntities: Schema.Number.pipe(Schema.nonnegative()),
      loadedChunks: Schema.Number.pipe(Schema.nonnegative()),
      savedChunks: Schema.Number.pipe(Schema.nonnegative())
    })
  }),

  // 世界生成設定（不変）
  generationSettings: TerrainGenerationParametersSchema,

  // ディメンション管理
  dimensions: Schema.Map({
    key: Schema.String.pipe(Schema.brand(DimensionId)),
    value: DimensionReferenceSchema
  }),

  // ゲームルール設定
  gameRules: Schema.Struct({
    difficulty: Schema.Literal("peaceful", "easy", "normal", "hard"),
    gameMode: Schema.Literal("survival", "creative", "adventure", "spectator"),
    pvp: Schema.Boolean,
    mobSpawning: Schema.Boolean,
    naturalRegeneration: Schema.Boolean,
    keepInventory: Schema.Boolean,
    doDaylightCycle: Schema.Boolean,
    doWeatherCycle: Schema.Boolean,
    commandBlockOutput: Schema.Boolean,
    randomTickSpeed: Schema.Number.pipe(Schema.clamp(0, 4096)),
    maxEntityCramming: Schema.Number.pipe(Schema.clamp(0, 100))
  }),

  // ワールドボーダー
  worldBorder: Schema.Struct({
    centerX: Schema.Number,
    centerZ: Schema.Number,
    size: Schema.Number.pipe(Schema.between(1, 60000000)),
    safeZone: Schema.Number.pipe(Schema.nonnegative()),
    warningDistance: Schema.Number.pipe(Schema.nonnegative()),
    warningTime: Schema.Number.pipe(Schema.nonnegative()),
    damagePerBlock: Schema.Number.pipe(Schema.nonnegative())
  }),

  // グローバル時間状態
  worldTime: Schema.Struct({
    dayTime: Schema.Number.pipe(Schema.clamp(0, 23999)), // 1日 = 24000 tick
    totalTime: Schema.BigInt.pipe(Schema.nonnegative()),
    moonPhase: Schema.Number.pipe(Schema.clamp(0, 7)),
    doDaylightCycle: Schema.Boolean
  }),

  // 天候状態
  weather: Schema.Struct({
    current: Schema.Literal("clear", "rain", "thunder"),
    rainTime: Schema.Number.pipe(Schema.nonnegative()),
    thunderTime: Schema.Number.pipe(Schema.nonnegative()),
    rainLevel: Schema.Number.pipe(Schema.between(0, 1)),
    thunderLevel: Schema.Number.pipe(Schema.between(0, 1))
  }),

  // スポーン設定
  spawnSettings: Schema.Struct({
    worldSpawn: WorldPositionSchema,
    spawnRadius: Schema.Number.pipe(Schema.clamp(0, 128)),
    randomizeSpawn: Schema.Boolean,
    spawnProtection: Schema.Number.pipe(Schema.clamp(0, 16))
  })
})

export interface WorldAggregate extends Schema.Schema.Type<typeof WorldAggregateSchema> {}

// ディメンション参照エンティティ
export const DimensionReferenceSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(DimensionId)),
  type: Schema.Literal("overworld", "nether", "the_end", "custom"),
  name: Schema.String,

  // ディメンション固有設定
  settings: Schema.Struct({
    hasWeather: Schema.Boolean,
    hasSkylight: Schema.Boolean,
    hasCeiling: Schema.Boolean,
    ambientLight: Schema.Number.pipe(Schema.between(0, 1)),
    logicalHeight: Schema.Number.pipe(Schema.clamp(0, 384)),
    coordinateScale: Schema.Number.pipe(Schema.positive()),
    piglinSafe: Schema.Boolean,
    bedWorks: Schema.Boolean,
    respawnAnchorWorks: Schema.Boolean,
    ultraWarm: Schema.Boolean,
    natural: Schema.Boolean
  }),

  // チャンク管理情報
  chunkManagement: Schema.Struct({
    loadedRegions: Schema.Set(Schema.String.pipe(Schema.brand(RegionId))),
    activeChunks: Schema.Set(Schema.String.pipe(Schema.brand(ChunkCoordinate))),
    dirtyChunks: Schema.Set(Schema.String.pipe(Schema.brand(ChunkCoordinate))),
    lastCleanup: Schema.Date,
    memoryUsage: Schema.Number.pipe(Schema.nonnegative()) // bytes
  }),

  // バイオーム分布マップ
  biomeDistribution: Schema.Map({
    key: Schema.String.pipe(Schema.brand(BiomeId)),
    value: Schema.Number.pipe(Schema.between(0, 1)) // 分布密度
  })
})

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
      const overworldId = DimensionId("overworld")
      const netherDimensionId = DimensionId("nether")
      const endDimensionId = DimensionId("the_end")

      const defaultDimensions = new Map<DimensionId, DimensionReference>([
        [overworldId, {
          id: overworldId,
          type: "overworld",
          name: "Overworld",
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
            natural: true
          },
          chunkManagement: {
            loadedRegions: new Set(),
            activeChunks: new Set(),
            dirtyChunks: new Set(),
            lastCleanup: now,
            memoryUsage: 0
          },
          biomeDistribution: new Map()
        }]
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
            game: "typescript-minecraft-3.0.0",
            format: 3,
            features: ["effect-ts-3.17", "ddd-aggregates", "typed-data"]
          },
          statistics: {
            totalBlocks: 0,
            totalEntities: 0,
            loadedChunks: 0,
            savedChunks: 0
          }
        },
        generationSettings,
        dimensions: defaultDimensions,
        gameRules: createDefaultGameRules(),
        worldBorder: createDefaultWorldBorder(),
        worldTime: {
          dayTime: 6000, // 正午からスタート
          totalTime: 0n,
          moonPhase: 0,
          doDaylightCycle: true
        },
        weather: {
          current: "clear",
          rainTime: 0,
          thunderTime: 0,
          rainLevel: 0,
          thunderLevel: 0
        },
        spawnSettings: {
          worldSpawn: {
            x: 0,
            y: 64,
            z: 0,
            dimension: overworldId
          },
          spawnRadius: 10,
          randomizeSpawn: true,
          spawnProtection: 16
        }
      }
    })

  // 時間進行（ドメインロジック）
  export const advanceTime = (
    world: WorldAggregate,
    ticks: number
  ): Effect.Effect<WorldAggregate, never> =>
    Effect.succeed({
      ...world,
      worldTime: {
        ...world.worldTime,
        dayTime: (world.worldTime.dayTime + ticks) % 24000,
        totalTime: world.worldTime.totalTime + BigInt(ticks)
      },
      metadata: {
        ...world.metadata,
        lastModified: new Date()
      }
    })

  // 天候変更（ビジネスルール含む）
  export const changeWeather = (
    world: WorldAggregate,
    newWeather: "clear" | "rain" | "thunder",
    duration: number
  ): Effect.Effect<WorldAggregate, WeatherChangeError> =>
    Effect.gen(function* () {
      // ビジネスルール: ネザーでは天候変更不可
      const overworldDimension = world.dimensions.get(DimensionId("overworld"))
      if (!overworldDimension || !overworldDimension.settings.hasWeather) {
        return yield* Effect.fail(new WeatherChangeError("Weather not supported in this dimension"))
      }

      const updatedWeather = pipe(
        newWeather,
        Match.value,
        Match.when("clear", () => ({
          current: "clear" as const,
          rainTime: 0,
          thunderTime: 0,
          rainLevel: 0,
          thunderLevel: 0
        })),
        Match.when("rain", () => ({
          current: "rain" as const,
          rainTime: duration,
          thunderTime: 0,
          rainLevel: 1,
          thunderLevel: 0
        })),
        Match.when("thunder", () => ({
          current: "thunder" as const,
          rainTime: duration,
          thunderTime: duration,
          rainLevel: 1,
          thunderLevel: 1
        })),
        Match.exhaustive
      )

      return {
        ...world,
        weather: updatedWeather,
        metadata: {
          ...world.metadata,
          lastModified: new Date()
        }
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
        lastCleanup: new Date()
      }

      const updatedDimension = {
        ...dimension,
        chunkManagement: updatedChunkManagement
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
            loadedChunks: world.metadata.statistics.loadedChunks + 1
          }
        }
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
          savedChunks: world.metadata.statistics.savedChunks + (delta.savedChunks || 0)
        }
      }
    })
}

// ヘルパー関数
const createDefaultGameRules = () => ({
  difficulty: "normal" as const,
  gameMode: "survival" as const,
  pvp: true,
  mobSpawning: true,
  naturalRegeneration: true,
  keepInventory: false,
  doDaylightCycle: true,
  doWeatherCycle: true,
  commandBlockOutput: true,
  randomTickSpeed: 3,
  maxEntityCramming: 24
})

const createDefaultWorldBorder = () => ({
  centerX: 0,
  centerZ: 0,
  size: 60000000,
  safeZone: 5,
  warningDistance: 5,
  warningTime: 15,
  damagePerBlock: 0.2
})
```

## 値オブジェクト設計

### ブロック状態値オブジェクト

```typescript
// ブロック状態値オブジェクト（Value Object Pattern）
export namespace BlockValueObjects {
  export type BlockId = string & Brand.Brand<"BlockId">
  export type MaterialType = string & Brand.Brand<"MaterialType">

  export const BlockId = Brand.nominal<BlockId>()
  export const MaterialType = Brand.nominal<MaterialType>()

  // ブロック状態の不変値オブジェクト
  export const BlockStateSchema = Schema.Struct({
    id: Schema.String.pipe(Schema.brand(BlockId)),
    material: Schema.String.pipe(Schema.brand(MaterialType)),

    // 物理的プロパティ
    properties: Schema.Struct({
      solid: Schema.Boolean,
      transparent: Schema.Boolean,
      luminous: Schema.Boolean,
      hardness: Schema.Number.pipe(Schema.between(0, 50)),
      resistance: Schema.Number.pipe(Schema.between(0, 3600000)),
      lightLevel: Schema.Number.pipe(Schema.clamp(0, 15)),
      lightOpacity: Schema.Number.pipe(Schema.clamp(0, 15))
    }),

    // 状態プロパティ（ブロック種別固有）
    stateProperties: Schema.Record({
      key: Schema.String,
      value: Schema.Union(
        Schema.String,
        Schema.Number,
        Schema.Boolean
      )
    }),

    // レンダリング情報
    rendering: Schema.Struct({
      model: Schema.String,
      textures: Schema.Map({
        key: Schema.Literal("top", "bottom", "north", "south", "east", "west", "all"),
        value: Schema.String // テクスチャリソースパス
      }),
      tintIndex: Schema.optional(Schema.Number),
      cullFaces: Schema.Array(
        Schema.Literal("up", "down", "north", "south", "east", "west")
      )
    }),

    // ゲーム動作
    behavior: Schema.Struct({
      tickable: Schema.Boolean, // randomTick対象か
      interactable: Schema.Boolean, // 右クリック可能か
      placeable: Schema.Boolean, // 設置可能か
      breakable: Schema.Boolean, // 破壊可能か
      waterloggable: Schema.Boolean, // 水没可能か
      flammable: Schema.Boolean // 燃焼するか
    })
  })

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
          ...properties
        },
        stateProperties: {},
        rendering: {
          model: "block/cube_all",
          textures: new Map([["all", `blocks/${id}`]]),
          cullFaces: ["up", "down", "north", "south", "east", "west"]
        },
        behavior: {
          tickable: false,
          interactable: false,
          placeable: true,
          breakable: true,
          waterloggable: false,
          flammable: false
        }
      }),

    // 透明ブロック作成
    createTransparentBlock: (
      id: string,
      lightOpacity: number = 0
    ): Effect.Effect<BlockState, ValidationError> =>
      BlockStateFactory.createBasicBlock(id, "glass", {
        transparent: true,
        lightOpacity
      }),

    // 光源ブロック作成
    createLightSource: (
      id: string,
      lightLevel: number
    ): Effect.Effect<BlockState, ValidationError> =>
      BlockStateFactory.createBasicBlock(id, "light_source", {
        luminous: true,
        lightLevel
      }),

    // 流体ブロック作成
    createFluidBlock: (
      id: string,
      viscosity: number = 1
    ): Effect.Effect<BlockState, ValidationError> =>
      Schema.decode(BlockStateSchema)({
        id: BlockId(id),
        material: MaterialType("fluid"),
        properties: {
          solid: false,
          transparent: true,
          luminous: false,
          hardness: 100,
          resistance: 100,
          lightLevel: 0,
          lightOpacity: 3
        },
        stateProperties: {
          level: 8, // 流体レベル (0-8)
          falling: false,
          viscosity
        },
        rendering: {
          model: "block/fluid",
          textures: new Map([
            ["still", `blocks/${id}_still`],
            ["flowing", `blocks/${id}_flow`]
          ]),
          cullFaces: []
        },
        behavior: {
          tickable: true,
          interactable: false,
          placeable: false,
          breakable: false,
          waterloggable: false,
          flammable: false
        }
      })
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
        stateProperties: Object.fromEntries(updatedProperties)
      }
    })

  // ブロック状態比較
  export const blockStatesEqual = (a: BlockState, b: BlockState): boolean => {
    return a.id === b.id &&
           deepEqual(a.stateProperties, b.stateProperties)
  }

  // ブロック状態のハッシュ値計算（最適化用）
  export const hashBlockState = (blockState: BlockState): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const stateString = JSON.stringify({
        id: blockState.id,
        properties: blockState.stateProperties
      })
      return yield* hashString(stateString)
    })
}
```

### 座標値オブジェクト

```typescript
// 3D座標系値オブジェクト
export namespace CoordinateValueObjects {
  // 絶対座標（ワールド座標系）
  export const AbsolutePositionSchema = Schema.Struct({
    x: Schema.Number,
    y: Schema.Number.pipe(Schema.clamp(-64, 320)), // ワールド高度制限
    z: Schema.Number,
    dimension: Schema.String.pipe(Schema.brand(DimensionId))
  })

  // 相対座標（チャンク内座標）
  export const LocalPositionSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.clamp(0, 15)),
    y: Schema.Number.pipe(Schema.clamp(0, 255)),
    z: Schema.Number.pipe(Schema.clamp(0, 15))
  })

  // 方向ベクトル
  export const DirectionVectorSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.between(-1, 1)),
    y: Schema.Number.pipe(Schema.between(-1, 1)),
    z: Schema.Number.pipe(Schema.between(-1, 1))
  }).pipe(
    Schema.filter(
      (vec) => Math.abs(Math.sqrt(vec.x ** 2 + vec.y ** 2 + vec.z ** 2) - 1) < 1e-6,
      { message: "Direction vector must be normalized" }
    )
  )

  // 境界ボックス
  export const BoundingBoxSchema = Schema.Struct({
    min: AbsolutePositionSchema,
    max: AbsolutePositionSchema
  }).pipe(
    Schema.filter(
      (box) => box.min.x <= box.max.x &&
               box.min.y <= box.max.y &&
               box.min.z <= box.max.z &&
               box.min.dimension === box.max.dimension,
      { message: "Invalid bounding box: min must be less than or equal to max" }
    )
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

        return Math.sqrt(
          (a.x - b.x) ** 2 +
          (a.y - b.y) ** 2 +
          (a.z - b.z) ** 2
        )
      }),

    // マンハッタン距離
    manhattanDistance: (a: AbsolutePosition, b: AbsolutePosition): Effect.Effect<number, DimensionMismatchError> =>
      Effect.gen(function* () {
        if (a.dimension !== b.dimension) {
          return yield* Effect.fail(new DimensionMismatchError())
        }

        return Math.abs(a.x - b.x) +
               Math.abs(a.y - b.y) +
               Math.abs(a.z - b.z)
      }),

    // 座標加算
    add: (pos: AbsolutePosition, offset: DirectionVector): AbsolutePosition => ({
      ...pos,
      x: pos.x + offset.x,
      y: Math.max(-64, Math.min(320, pos.y + offset.y)), // Y座標クランプ
      z: pos.z + offset.z
    }),

    // 境界ボックス内判定
    isWithinBounds: (pos: AbsolutePosition, bounds: BoundingBox): Effect.Effect<boolean, DimensionMismatchError> =>
      Effect.gen(function* () {
        if (pos.dimension !== bounds.min.dimension) {
          return yield* Effect.fail(new DimensionMismatchError())
        }

        return pos.x >= bounds.min.x && pos.x <= bounds.max.x &&
               pos.y >= bounds.min.y && pos.y <= bounds.max.y &&
               pos.z >= bounds.min.z && pos.z <= bounds.max.z
      }),

    // 座標正規化（ブロック座標への丸め）
    normalize: (pos: AbsolutePosition): AbsolutePosition => ({
      ...pos,
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z)
    }),

    // 周辺座標生成
    getNeighbors: (
      pos: AbsolutePosition,
      radius: number = 1
    ): Effect.Effect<ReadonlyArray<AbsolutePosition>, never> =>
      Effect.succeed(
        Range.make(-radius, radius).flatMap(dx =>
          Range.make(-radius, radius).flatMap(dy =>
            Range.make(-radius, radius).map(dz => ({
              ...pos,
              x: pos.x + dx,
              y: Math.max(-64, Math.min(320, pos.y + dy)),
              z: pos.z + dz
            }))
          )
        ).filter(neighbor =>
          !(neighbor.x === pos.x && neighbor.y === pos.y && neighbor.z === pos.z)
        )
      ),

    // チャンク座標への変換
    toChunkCoordinate: (pos: AbsolutePosition): ChunkCoordinate =>
      ChunkCoordinate(`${Math.floor(pos.x / 16)},${Math.floor(pos.z / 16)}`),

    // ローカル座標への変換
    toLocalCoordinate: (pos: AbsolutePosition): LocalPosition => ({
      x: ((pos.x % 16) + 16) % 16,
      y: pos.y,
      z: ((pos.z % 16) + 16) % 16
    })
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

export const WorldGenerationService = Context.GenericTag<WorldGenerationService>("WorldGenerationService")

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
          generatedAt: new Date()
        }
      }),

    generateBiomes: (coord, settings) =>
      Effect.gen(function* () {
        // 温度・湿度ノイズマップ生成
        const temperatureMap = yield* noiseGenerator.generateTemperatureMap(coord, settings.seed)
        const humidityMap = yield* noiseGenerator.generateHumidityMap(coord, settings.seed)

        // Whittaker biome分類法の適用
        const biomes = Range.make(0, 16).flatMap(x =>
          Range.make(0, 16).map(z => {
            const temp = temperatureMap[x][z]
            const humidity = humidityMap[x][z]
            return determineBiome(temp, humidity)
          })
        )

        return {
          coordinate: coord,
          biomes: new Uint8Array(biomes.map(biome => biome.id)),
          temperatureMap,
          humidityMap
        }
      }),

    generateStructures: (coord, biomeMap) =>
      Effect.gen(function* () {
        const structures: StructureInstance[] = []

        // バイオーム別構造物生成確率
        for (const biome of biomeMap.biomes) {
          const structureTypes = yield* getStructureTypesForBiome(biome)

          for (const structureType of structureTypes) {
            const shouldGenerate = yield* rollStructureGeneration(structureType, coord)

            if (shouldGenerate) {
              const structure = yield* generateStructureInstance(structureType, coord, biomeMap)
              structures.push(structure)
            }
          }
        }

        return structures
      }),

    populateChunk: (coord, terrain, structures) =>
      Effect.gen(function* () {
        // 基本地形ブロック配置
        let chunkData = yield* generateBaseTerrainBlocks(terrain)

        // 構造物配置
        for (const structure of structures) {
          chunkData = yield* placeStructure(chunkData, structure)
        }

        // 植生・デコレーション配置
        chunkData = yield* populateVegetation(chunkData, terrain.biomeMap)

        // 初期照明計算
        chunkData = yield* calculateInitialLighting(chunkData)

        return {
          ...chunkData,
          generationStatus: "populated",
          populatedAt: new Date()
        }
      })
  })
})
```

### データ整合性チェックサービス

```typescript
// データ整合性ドメインサービス
export interface DataIntegrityService {
  readonly validateWorldConsistency: (
    world: WorldAggregate
  ) => Effect.Effect<IntegrityReport, ValidationError>

  readonly validateChunkBoundaries: (
    chunks: ReadonlyMap<ChunkCoordinate, ChunkData>
  ) => Effect.Effect<BoundaryReport, ValidationError>

  readonly repairCorruptedData: (
    issues: ReadonlyArray<IntegrityIssue>
  ) => Effect.Effect<RepairResult, RepairError>
}

export const DataIntegrityService = Context.GenericTag<DataIntegrityService>("DataIntegrityService")

export const makeDataIntegrityService = Effect.gen(function* () {
  const logger = yield* Logger

  return DataIntegrityService.of({
    validateWorldConsistency: (world) =>
      Effect.gen(function* () {
        const issues: IntegrityIssue[] = []

        // ディメンション参照整合性チェック
        for (const [dimId, dimension] of world.dimensions) {
          if (dimension.id !== dimId) {
            issues.push({
              type: "DimensionIdMismatch",
              dimensionId: dimId,
              severity: "high"
            })
          }

          // チャンク管理データ整合性
          const activeChunkCount = dimension.chunkManagement.activeChunks.size
          if (activeChunkCount > 1000) { // 閾値チェック
            issues.push({
              type: "ExcessiveLoadedChunks",
              dimensionId: dimId,
              count: activeChunkCount,
              severity: "medium"
            })
          }
        }

        // 世界時間整合性チェック
        if (world.worldTime.dayTime < 0 || world.worldTime.dayTime >= 24000) {
          issues.push({
            type: "InvalidDayTime",
            value: world.worldTime.dayTime,
            severity: "high"
          })
        }

        // ワールドボーダー整合性
        if (world.worldBorder.size <= 0 || world.worldBorder.size > 60000000) {
          issues.push({
            type: "InvalidWorldBorderSize",
            size: world.worldBorder.size,
            severity: "medium"
          })
        }

        return {
          worldId: world.id,
          issues,
          overallHealth: calculateHealthScore(issues),
          checkedAt: new Date()
        }
      }),

    validateChunkBoundaries: (chunks) =>
      Effect.gen(function* () {
        const boundaryIssues: BoundaryIssue[] = []

        for (const [coord, chunk] of chunks) {
          const neighbors = yield* getNeighborChunkCoordinates(coord)

          for (const neighborCoord of neighbors) {
            const neighborChunk = chunks.get(neighborCoord)
            if (neighborChunk) {
              const inconsistencies = yield* findBoundaryInconsistencies(chunk, neighborChunk)
              boundaryIssues.push(...inconsistencies)
            }
          }
        }

        return {
          totalChunks: chunks.size,
          boundaryIssues,
          severity: calculateBoundarySeverity(boundaryIssues),
          validatedAt: new Date()
        }
      }),

    repairCorruptedData: (issues) =>
      Effect.gen(function* () {
        let repairedCount = 0
        let failedCount = 0
        const repairLog: string[] = []

        for (const issue of issues) {
          try {
            const repairResult = yield* pipe(
              issue.type,
              Match.value,
              Match.when("DimensionIdMismatch", () => repairDimensionIdMismatch(issue)),
              Match.when("ExcessiveLoadedChunks", () => unloadExcessChunks(issue)),
              Match.when("InvalidDayTime", () => fixDayTime(issue)),
              Match.when("InvalidWorldBorderSize", () => resetWorldBorder(issue)),
              Match.orElse(() => Effect.fail(new UnrepairableIssueError(issue)))
            )

            if (repairResult.success) {
              repairedCount++
              repairLog.push(`Repaired: ${issue.type}`)
            } else {
              failedCount++
              repairLog.push(`Failed to repair: ${issue.type} - ${repairResult.reason}`)
            }
          } catch (error) {
            failedCount++
            repairLog.push(`Error repairing ${issue.type}: ${error.message}`)
          }
        }

        return {
          totalIssues: issues.length,
          repairedCount,
          failedCount,
          repairLog,
          repairedAt: new Date()
        }
      })
  })
})
```

## イベントソーシング

### ドメインイベント定義

```typescript
// ドメインイベント基底型
export const DomainEventSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(Brand.nominal<"EventId">())),
  aggregateId: Schema.String,
  aggregateType: Schema.String,
  eventType: Schema.String,
  eventVersion: Schema.Number.pipe(Schema.positive()),
  timestamp: Schema.Date,
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

// ワールド関連ドメインイベント
export const WorldDomainEventSchema = Schema.TaggedUnion("eventType", {
  WorldCreated: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("WorldCreated"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      worldName: Schema.String,
      generationSettings: TerrainGenerationParametersSchema,
      createdBy: Schema.String // プレイヤーID
    })
  })),

  WorldTimeAdvanced: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("WorldTimeAdvanced"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      previousTime: Schema.Number,
      newTime: Schema.Number,
      ticksAdvanced: Schema.Number
    })
  })),

  WeatherChanged: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("WeatherChanged"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      dimensionId: Schema.String.pipe(Schema.brand(DimensionId)),
      previousWeather: Schema.Literal("clear", "rain", "thunder"),
      newWeather: Schema.Literal("clear", "rain", "thunder"),
      duration: Schema.Number,
      changedBy: Schema.optional(Schema.String) // プレイヤーID（コマンドの場合）
    })
  })),

  ChunkLoaded: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("ChunkLoaded"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      dimensionId: Schema.String.pipe(Schema.brand(DimensionId)),
      chunkCoordinate: Schema.String.pipe(Schema.brand(ChunkCoordinate)),
      loadReason: Schema.Literal("player_proximity", "forced_load", "structure_generation"),
      loadedBy: Schema.optional(Schema.String) // プレイヤーIDまたはシステム
    })
  })),

  ChunkUnloaded: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("ChunkUnloaded"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      dimensionId: Schema.String.pipe(Schema.brand(DimensionId)),
      chunkCoordinate: Schema.String.pipe(Schema.brand(ChunkCoordinate)),
      unloadReason: Schema.Literal("player_distance", "memory_pressure", "world_shutdown"),
      wasDirty: Schema.Boolean // 保存されていない変更があったか
    })
  })),

  GameRuleChanged: Schema.extend(DomainEventSchema, Schema.Struct({
    eventType: Schema.Literal("GameRuleChanged"),
    data: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      ruleName: Schema.String,
      previousValue: Schema.Unknown,
      newValue: Schema.Unknown,
      changedBy: Schema.String // プレイヤーIDまたは管理者
    })
  }))
})

export interface WorldDomainEvent extends Schema.Schema.Type<typeof WorldDomainEventSchema> {}

// イベントストア
export interface EventStore {
  readonly appendEvents: (
    streamId: string,
    expectedVersion: number,
    events: ReadonlyArray<WorldDomainEvent>
  ) => Effect.Effect<void, EventStoreError>

  readonly readEvents: (
    streamId: string,
    fromVersion?: number
  ) => Effect.Effect<ReadonlyArray<WorldDomainEvent>, EventStoreError>

  readonly readAllEvents: () => Stream.Stream<WorldDomainEvent, EventStoreError>

  readonly getStreamVersion: (
    streamId: string
  ) => Effect.Effect<number, EventStoreError>
}

export const EventStore = Context.GenericTag<EventStore>("EventStore")
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
    eventType: "ChunkLoaded" as const,
    handle: (event: WorldDomainEvent & { eventType: "ChunkLoaded" }) =>
      Effect.gen(function* () {
        yield* statisticsService.incrementCounter("chunks_loaded_total")
        yield* statisticsService.recordHistogram("chunk_load_time", Date.now() - event.timestamp.getTime())

        // ディメンション別統計
        yield* statisticsService.incrementCounter(
          `chunks_loaded_${event.data.dimensionId}`,
          { dimension: event.data.dimensionId }
        )
      })
  }
})

// プレイヤー活動追跡イベントハンドラー
export const makePlayerActivityHandler = Effect.gen(function* () {
  const playerService = yield* PlayerService
  const logger = yield* Logger

  return {
    eventType: "WeatherChanged" as const,
    handle: (event: WorldDomainEvent & { eventType: "WeatherChanged" }) =>
      Effect.gen(function* () {
        if (event.data.changedBy) {
          yield* logger.info(`Player ${event.data.changedBy} changed weather to ${event.data.newWeather}`)

          yield* playerService.recordActivity(event.data.changedBy, {
            type: "weather_change",
            details: {
              from: event.data.previousWeather,
              to: event.data.newWeather,
              dimension: event.data.dimensionId
            },
            timestamp: event.timestamp
          })
        }
      })
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

export const EventDispatcher = Context.GenericTag<EventDispatcher>("EventDispatcher")

export const makeEventDispatcher = Effect.gen(function* () {
  const handlers = yield* Ref.make(new Map<string, ReadonlyArray<EventHandler<any>>>())
  const logger = yield* Logger

  return EventDispatcher.of({
    dispatch: (events) =>
      Effect.gen(function* () {
        const currentHandlers = yield* Ref.get(handlers)

        for (const event of events) {
          const eventHandlers = currentHandlers.get(event.eventType) || []

          yield* Effect.all(
            eventHandlers.map(handler =>
              pipe(
                handler.handle(event),
                Effect.catchAll(error =>
                  logger.error(`Event handler failed: ${error.message}`, {
                    eventType: event.eventType,
                    eventId: event.id,
                    handlerName: handler.constructor.name
                  })
                )
              )
            ),
            { concurrency: 5 }
          )
        }
      }),

    subscribe: (eventType, handler) =>
      Effect.gen(function* () {
        yield* Ref.update(handlers, currentHandlers => {
          const existingHandlers = currentHandlers.get(eventType) || []
          return new Map(currentHandlers).set(eventType, [...existingHandlers, handler])
        })

        return {
          unsubscribe: () =>
            Ref.update(handlers, currentHandlers => {
              const existingHandlers = currentHandlers.get(eventType) || []
              const filteredHandlers = existingHandlers.filter(h => h !== handler)
              return new Map(currentHandlers).set(eventType, filteredHandlers)
            })
        }
      })
  })
})
```

## パフォーマンス最適化

### Structure of Arrays (SoA) 最適化

```typescript
// Structure of Arrays パターンによる最適化
export namespace PerformanceOptimizations {
  // 従来の Array of Structures (AoS) - キャッシュ効率が悪い
  interface BlockDataAoS {
    type: number
    state: number
    light: number
    metadata: number
  }

  // 最適化された Structure of Arrays (SoA) - キャッシュ効率が良い
  export interface BlockDataSoA {
    readonly types: Uint16Array      // ブロックタイプ配列
    readonly states: Uint32Array     // ブロック状態配列
    readonly lightLevels: Uint8Array // 光レベル配列（4ビット×2値パック）
    readonly metadata: Uint8Array    // メタデータ配列
    readonly count: number           // 有効ブロック数
  }

  // SoAデータ操作ユーティリティ
  export const SoAOperations = {
    // 新しいSoAデータ作成
    create: (capacity: number = 4096): BlockDataSoA => ({
      types: new Uint16Array(capacity),
      states: new Uint32Array(capacity),
      lightLevels: new Uint8Array(Math.ceil(capacity / 2)), // 4ビット×2値パック
      metadata: new Uint8Array(capacity),
      count: 0
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
        count: soa.count
      }

      newSoA.types[index] = type
      newSoA.states[index] = state
      newSoA.metadata[index] = meta

      // 4ビット光レベルパッキング
      const byteIndex = Math.floor(index / 2)
      const isHighNibble = index % 2 === 1

      if (isHighNibble) {
        newSoA.lightLevels[byteIndex] = (newSoA.lightLevels[byteIndex] & 0x0F) | ((light & 0x0F) << 4)
      } else {
        newSoA.lightLevels[byteIndex] = (newSoA.lightLevels[byteIndex] & 0xF0) | (light & 0x0F)
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
      const light = isHighNibble
        ? (soa.lightLevels[byteIndex] >> 4) & 0x0F
        : soa.lightLevels[byteIndex] & 0x0F

      return {
        type: soa.types[index],
        state: soa.states[index],
        light,
        metadata: soa.metadata[index]
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
      let result = soa
      for (const op of operations) {
        result = SoAOperations.setBlock(
          result,
          op.index,
          op.type,
          op.state || 0,
          op.light || 0,
          op.metadata || 0
        )
      }
      return result
    },

    // メモリ使用量計算
    getMemoryUsage: (soa: BlockDataSoA): number => {
      return soa.types.byteLength +
             soa.states.byteLength +
             soa.lightLevels.byteLength +
             soa.metadata.byteLength
    }
  }

  // SIMD操作のサポート検出と活用
  export const SIMDOperations = {
    // SIMDサポート検出
    checkSIMDSupport: (): Effect.Effect<boolean, never> =>
      Effect.succeed(typeof SharedArrayBuffer !== 'undefined' &&
                    typeof WebAssembly !== 'undefined'),

    // SIMD対応ブロック検索
    findBlocksSIMD: (
      soa: BlockDataSoA,
      targetType: number
    ): Effect.Effect<ReadonlyArray<number>, never> =>
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
      })
  }
}

// ネイティブSIMD実装（WebAssemblyまたはWorker経由）
const findBlocksSIMDNative = (
  types: Uint16Array,
  targetType: number
): Effect.Effect<ReadonlyArray<number>, never> =>
  Effect.succeed([]) // プレースホルダー実装

const findBlocksScalar = (
  types: Uint16Array,
  targetType: number
): Effect.Effect<ReadonlyArray<number>, never> =>
  Effect.succeed(
    Array.from(types)
      .map((type, index) => type === targetType ? index : -1)
      .filter(index => index >= 0)
  )
```

### メモリプール管理

```typescript
// 高性能メモリプール実装
export interface MemoryPool<T> {
  readonly acquire: () => Effect.Effect<T, PoolExhaustedError>
  readonly release: (item: T) => Effect.Effect<void, never>
  readonly size: () => Effect.Effect<number, never>
  readonly capacity: () => Effect.Effect<number, never>
  readonly stats: () => Effect.Effect<PoolStats, never>
}

export interface PoolStats {
  readonly totalAcquired: number
  readonly totalReleased: number
  readonly currentlyInUse: number
  readonly peakUsage: number
  readonly memoryUsage: number
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
      memoryUsage: 0
    })

    // プール初期化
    yield* pipe(
      Range.make(0, Math.min(maxSize / 2, 50)), // 初期サイズは最大容量の半分
      Effect.forEach(() =>
        pipe(
          chunkFactory(),
          Effect.flatMap(chunk => availableChunks.offer(chunk))
        )
      )
    )

    return {
      acquire: () =>
        Effect.gen(function* () {
          // 利用可能なチャンクがあれば取得
          const chunk = yield* pipe(
            availableChunks.poll,
            Effect.flatMap(option =>
              pipe(
                option,
                Option.match({
                  onNone: () => chunkFactory(), // プールが空なら新規作成
                  onSome: (chunk) => Effect.succeed(chunk)
                })
              )
            )
          )

          // 統計更新
          yield* Ref.update(stats, currentStats => ({
            ...currentStats,
            totalAcquired: currentStats.totalAcquired + 1,
            currentlyInUse: currentStats.currentlyInUse + 1,
            peakUsage: Math.max(currentStats.peakUsage, currentStats.currentlyInUse + 1)
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
          yield* Ref.update(stats, currentStats => ({
            ...currentStats,
            totalReleased: currentStats.totalReleased + 1,
            currentlyInUse: Math.max(0, currentStats.currentlyInUse - 1)
          }))

          if (!wasOffered) {
            // プールが満杯の場合は解放してGCに任せる
            yield* cleanupChunkData(resetChunk)
          }
        }),

      size: () =>
        availableChunks.size,

      capacity: () =>
        Effect.succeed(maxSize),

      stats: () =>
        Ref.get(stats)
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
    lastModified: new Date()
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
describe("World Data Structure Integration Tests", () => {
  const testLayer = Layer.provide(
    Layer.merge(
      TestWorldService,
      TestEventStore,
      TestMemoryPool
    ),
    Layer.provide(
      TestLogger,
      TestContext.TestContext
    )
  )

  it("should create and manage world lifecycle correctly", () =>
    Effect.gen(function* () {
      const worldService = yield* WorldService
      const eventStore = yield* EventStore

      // 1. ワールド作成
      const generationSettings = {
        seed: 12345n,
        generationType: "default" as const,
        seaLevel: 64,
        biomeSize: 1.0,
        structureDensity: 0.5,
        oreDensity: {},
        customSettings: undefined
      }

      const world = yield* WorldAggregateOperations.createWorld(
        "test-world",
        generationSettings
      )

      expect(world.name).toBe("test-world")
      expect(world.dimensions.size).toBe(1) // デフォルトでOverworldのみ

      // 2. イベント永続化確認
      const events = yield* eventStore.readEvents(world.id)
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe("WorldCreated")

      // 3. 時間進行テスト
      const advancedWorld = yield* WorldAggregateOperations.advanceTime(world, 1000)
      expect(advancedWorld.worldTime.dayTime).toBe(7000) // 6000 + 1000
      expect(advancedWorld.worldTime.totalTime).toBe(1000n)

      // 4. チャンク管理テスト
      const chunkCoord = ChunkCoordinate("0,0")
      const trackedWorld = yield* WorldAggregateOperations.trackChunkLoading(
        advancedWorld,
        DimensionId("overworld"),
        chunkCoord
      )

      const dimension = trackedWorld.dimensions.get(DimensionId("overworld"))!
      expect(dimension.chunkManagement.activeChunks.has(chunkCoord)).toBe(true)

    }).pipe(Effect.provide(testLayer), Effect.runPromise)
  )

  it("should handle concurrent world modifications safely", () =>
    Effect.gen(function* () {
      const world = yield* createTestWorld()

      // 100個の並列操作を実行
      const concurrentOperations = Range.make(0, 100).map(i =>
        pipe(
          WorldAggregateOperations.advanceTime(world, i),
          Effect.flatMap(w =>
            WorldAggregateOperations.changeWeather(w, "rain", 1000 + i)
          )
        )
      )

      const results = yield* Effect.all(concurrentOperations, {
        concurrency: 10
      })

      // すべての操作が成功し、最後の結果が期待される状態であることを確認
      expect(results).toHaveLength(100)
      const finalWorld = results[results.length - 1]
      expect(finalWorld.weather.current).toBe("rain")
      expect(finalWorld.worldTime.totalTime).toBeGreaterThan(0n)

    }).pipe(Effect.provide(testLayer), Effect.runPromise)
  )

  it("should maintain data integrity under stress conditions", () =>
    Effect.gen(function* () {
      const integrityService = yield* DataIntegrityService
      const world = yield* createLargeTestWorld(1000) // 1000チャンク

      // 大量のランダム変更を適用
      let modifiedWorld = world
      for (let i = 0; i < 1000; i++) {
        const randomOperation = yield* generateRandomWorldOperation()
        modifiedWorld = yield* applyWorldOperation(modifiedWorld, randomOperation)
      }

      // データ整合性チェック
      const integrityReport = yield* integrityService.validateWorldConsistency(modifiedWorld)

      expect(integrityReport.overallHealth).toBeGreaterThan(0.8) // 80%以上の健全性
      expect(integrityReport.issues.filter(issue => issue.severity === "high")).toHaveLength(0)

    }).pipe(Effect.provide(testLayer), Effect.runPromise)
  )
})

// Property-Based Testing
describe("World Data Structure Property Tests", () => {
  const worldGen = fc.record({
    name: fc.string({ minLength: 1, maxLength: 32 }),
    seed: fc.bigInt(),
    gameMode: fc.constantFrom("survival", "creative", "adventure", "spectator")
  })

  it("should preserve invariants across all valid world configurations", () =>
    fc.assert(
      fc.asyncProperty(worldGen, async (config) => {
        const result = await Effect.gen(function* () {
          const world = yield* WorldAggregateOperations.createWorld(
            config.name,
            {
              seed: config.seed,
              generationType: "default",
              seaLevel: 64,
              biomeSize: 1.0,
              structureDensity: 0.5,
              oreDensity: {},
              customSettings: undefined
            }
          )

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
    )
  )
})
```

### ベンチマークテスト

```typescript
// パフォーマンスベンチマーク
describe("Performance Benchmarks", () => {
  it("should meet chunk loading performance targets", async () => {
    const benchmark = await Effect.gen(function* () {
      const memoryPool = yield* makeChunkMemoryPool(200)
      const startTime = performance.now()
      const targetLoadTime = 50 // ms

      // 100チャンクの並列読み込み
      const loadOperations = Range.make(0, 100).map(i =>
        pipe(
          memoryPool.acquire(),
          Effect.tap(chunk => simulateChunkData(chunk, i)),
          Effect.tap(chunk => memoryPool.release(chunk))
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
    }).pipe(
      Effect.provide(TestMemoryPool),
      Effect.runPromise
    )

    console.log(`Benchmark results: ${JSON.stringify(benchmark, null, 2)}`)
  })

  it("should efficiently handle SoA operations", async () => {
    const benchmark = await Effect.gen(function* () {
      const soa = PerformanceOptimizations.SoAOperations.create(65536) // 16x16x256
      const startTime = performance.now()

      // 大量のブロック設定操作
      let modifiedSoA = soa
      for (let i = 0; i < 65536; i++) {
        modifiedSoA = PerformanceOptimizations.SoAOperations.setBlock(
          modifiedSoA,
          i,
          Math.floor(Math.random() * 256), // ランダムブロックタイプ
          Math.floor(Math.random() * 16),  // ランダム状態
          Math.floor(Math.random() * 16),  // ランダム光レベル
          Math.floor(Math.random() * 256)  // ランダムメタデータ
        )
      }

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

この仕様書では、TypeScript Minecraft Cloneにおけるワールドデータ構造を、DDD原則とEffect-TS 3.17+を活用して包括的に設計しました。

### 主な特徴

1. **ドメイン中心設計**: ビジネスロジックを型システムで表現
2. **型安全性**: Brand型とSchemaによる厳密な型チェック
3. **不変性**: すべての状態変更は新しいインスタンス生成で表現
4. **パフォーマンス最適化**: SoA、メモリプール、SIMD対応
5. **テスタビリティ**: Property-Based TestingとEffect型による高品質保証

### 次のステップ

- [チャンクフォーマット仕様](./01-chunk-format.md)でより詳細な実装を確認
- [セーブファイル仕様](./02-save-file-format.md)で永続化戦略を学習
- [DDD戦略設計](../../01-architecture/02-ddd-strategic-design.md)でアーキテクチャ全体を理解

この設計により、プロダクションレベルの品質と拡張性を備えたワールドデータ管理システムを構築できます。