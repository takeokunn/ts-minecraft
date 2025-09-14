---
title: "World Management System Specification"
category: "Core Systems"
complexity: "high"
dependencies:
  - "@effect/schema"
  - "@effect/platform"
  - "noise-js"
related_systems:
  - "chunk-system"
  - "terrain-generation"
  - "block-system"
  - "physics"
ai_tags:
  - "performance-critical"
  - "procedural-generation"
  - "memory-intensive"
  - "world-streaming"
implementation_time: "3-4 days"
skill_level: "expert"
testing_coverage: "92%"
last_pattern_update: "2025-09-14"
---

# ワールド管理システム

## 1. 概要

ワールド管理システムは、TypeScript Minecraftクローンにおける世界管理の統合システムです。プロシージャル生成、チャンク管理、ブロック操作を一元化し、Effect-TS 3.17+の最新パターンとDDD原則に基づいて設計されています。

### 主要機能
- **プロシージャル生成**: シードベースの決定論的な無限世界生成
- **チャンク管理**: 16x16x384サイズのチャンク単位での効率的な世界分割
- **ブロック操作**: 高速なブロック配置・破壊・更新システム
- **バイオーム管理**: 温度・湿度・高度による多様な生態系
- **光源処理**: リアルタイムな光の伝播・影計算
- **世界永続化**: NBT形式による効率的なセーブ・ロード

### アーキテクチャ概要
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   プレゼンテーション層  │    │   アプリケーション層   │    │   インフラストラクチャ層│
│     (UI)        │◄──►│     (ユースケース)    │◄──►│     (外部連携)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   ドメイン層      │
                       │   (DDDコア)     │
                       └─────────────────┘
```

## 2. アーキテクチャ

### 2.1 ドメイン層

#### ワールドアグリゲート (DDD)
```typescript
import { Schema, pipe, Brand } from "effect"

// 値オブジェクト
export const ChunkCoordinate = Schema.Struct({
  _tag: Schema.Literal("ChunkCoordinate"),
  x: pipe(Schema.Number, Schema.int(), Schema.brand("ChunkX")),
  z: pipe(Schema.Number, Schema.int(), Schema.brand("ChunkZ"))
})

export const WorldPosition = Schema.Struct({
  _tag: Schema.Literal("WorldPosition"),
  x: Schema.Number,
  y: pipe(Schema.Number, Schema.int(), Schema.between(0, 383)),
  z: Schema.Number
})

export const BlockPosition = Schema.Struct({
  _tag: Schema.Literal("BlockPosition"),
  x: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  y: pipe(Schema.Number, Schema.int(), Schema.between(0, 383)),
  z: pipe(Schema.Number, Schema.int(), Schema.between(0, 15))
})

// チャンクエンティティ
export const Chunk = Schema.Struct({
  _tag: Schema.Literal("Chunk"),
  coordinate: ChunkCoordinate,
  blocks: Schema.Array(pipe(Schema.Number, Schema.int(), Schema.between(0, 65535))),
  biome: Schema.Union(
    Schema.Literal("plains"),
    Schema.Literal("forest"),
    Schema.Literal("desert"),
    Schema.Literal("ocean"),
    Schema.Literal("mountains"),
    Schema.Literal("tundra"),
    Schema.Literal("jungle"),
    Schema.Literal("swamp"),
    Schema.Literal("taiga")
  ),
  heightMap: Schema.Array(Schema.Number),
  lightMap: Schema.Array(Schema.Number),
  isDirty: Schema.Boolean,
  lastModified: Schema.DateTimeUtc,
  metadata: Schema.Struct({
    generatedAt: Schema.DateTimeUtc,
    version: Schema.Number
  })
})

export type Chunk = Schema.Schema.Type<typeof Chunk>

// ワールドアグリゲートルート
export const World = Schema.Struct({
  _tag: Schema.Literal("World"),
  id: Schema.UUID,
  seed: pipe(Schema.Number, Schema.brand("WorldSeed")),
  chunks: Schema.Map(Schema.String, Chunk),
  spawnPoint: WorldPosition,
  worldBorder: Schema.Struct({
    center: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
    radius: pipe(Schema.Number, Schema.positive())
  }),
  gameRules: Schema.Struct({
    doDaylightCycle: Schema.Boolean,
    doWeatherCycle: Schema.Boolean,
    keepInventory: Schema.Boolean,
    mobGriefing: Schema.Boolean,
    naturalRegeneration: Schema.Boolean
  })
})

export type World = Schema.Schema.Type<typeof World>

// ブロック値オブジェクト
export const BlockType = Schema.Union(
  Schema.Literal("air"),
  Schema.Literal("stone"),
  Schema.Literal("grass"),
  Schema.Literal("dirt"),
  Schema.Literal("sand"),
  Schema.Literal("water"),
  Schema.Literal("wood"),
  Schema.Literal("leaves"),
  Schema.Literal("coal_ore"),
  Schema.Literal("iron_ore"),
  Schema.Literal("gold_ore"),
  Schema.Literal("diamond_ore")
)

export type BlockType = Schema.Schema.Type<typeof BlockType>
```

#### バイオーム値オブジェクト
```typescript
export const BiomeDefinition = Schema.Struct({
  _tag: Schema.Literal("BiomeDefinition"),
  id: Schema.String,
  name: Schema.String,
  temperature: pipe(Schema.Number, Schema.between(-1, 1)),
  humidity: pipe(Schema.Number, Schema.between(-1, 1)),
  elevation: pipe(Schema.Number, Schema.between(-1, 1)),
  colors: Schema.Struct({
    grass: Schema.Number,
    foliage: Schema.Number,
    water: Schema.Number
  }),
  blocks: Schema.Struct({
    surface: BlockType,
    subsurface: BlockType,
    stone: BlockType
  }),
  features: Schema.Array(Schema.String),
  spawnRules: Schema.Struct({
    passive: Schema.Array(Schema.String),
    hostile: Schema.Array(Schema.String),
    spawnRate: pipe(Schema.Number, Schema.between(0, 1))
  })
})

export type BiomeDefinition = Schema.Schema.Type<typeof BiomeDefinition>
```

### 2.2 インフラストラクチャ層

#### ノイズ生成サービス
```typescript
import { Context, Effect, Layer } from "effect"

export interface NoiseGeneratorServiceInterface {
  readonly noise2D: (x: number, y: number, seed: number) => Effect.Effect<number, never>
  readonly noise3D: (x: number, y: number, z: number, seed: number) => Effect.Effect<number, never>
  readonly octaveNoise: (
    x: number,
    y: number,
    seed: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ) => Effect.Effect<number, never>
  readonly ridgedNoise: (x: number, y: number, seed: number, octaves: number) => Effect.Effect<number, never>
}

export const NoiseGeneratorService = Context.GenericTag<NoiseGeneratorServiceInterface>("@minecraft/NoiseGeneratorService")

const makeNoiseGeneratorService = Effect.gen(function* () {
  const permutation = generatePermutationTable()

  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a)
  const grad = (hash: number, x: number, y: number): number => {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  const noise2D = (x: number, y: number, seed: number) =>
    Effect.sync(() => {
      const X = Math.floor(x) & 255
      const Y = Math.floor(y) & 255

      x -= Math.floor(x)
      y -= Math.floor(y)

      const u = fade(x)
      const v = fade(y)

      const A = permutation[X] + Y
      const AA = permutation[A]
      const AB = permutation[A + 1]
      const B = permutation[X + 1] + Y
      const BA = permutation[B]
      const BB = permutation[B + 1]

      return lerp(
        lerp(grad(permutation[AA], x, y),
             grad(permutation[BA], x - 1, y), u),
        lerp(grad(permutation[AB], x, y - 1),
             grad(permutation[BB], x - 1, y - 1), u), v)
    })

  const octaveNoise = (x: number, y: number, seed: number, octaves: number, persistence: number, lacunarity: number) =>
    Effect.gen(function* () {
      let total = 0
      let frequency = 1
      let amplitude = 1
      let maxValue = 0

      yield* pipe(
        Array.range(0, octaves),
        Array.reduce(
          { total: 0, maxValue: 0, amplitude: 1, frequency: 1 },
          (acc, i) =>
            Effect.gen(function* () {
              const noiseValue = yield* noise2D(x * acc.frequency, y * acc.frequency, seed + i)
              return {
                total: acc.total + noiseValue * acc.amplitude,
                maxValue: acc.maxValue + acc.amplitude,
                amplitude: acc.amplitude * persistence,
                frequency: acc.frequency * lacunarity
              }
            })
        ),
        Effect.map(({ total, maxValue }) => total / maxValue)
      )

      return total / maxValue
    })

  return NoiseGeneratorService.of({
    noise2D,
    noise3D: (x, y, z, seed) => noise2D(x + z * 0.1, y, seed),
    octaveNoise,
    ridgedNoise: (x, y, seed, octaves) =>
      Effect.gen(function* () {
        let total = 0
        let frequency = 1
        let amplitude = 1
        let weight = 1

        const result = yield* pipe(
          Array.range(0, octaves),
          Array.reduce(
            { total: 0, amplitude: 1, frequency: 1, weight: 1 },
            (acc, i) =>
              Effect.gen(function* () {
                let noiseValue = yield* noise2D(x * acc.frequency, y * acc.frequency, seed + i)
                noiseValue = 1.0 - Math.abs(noiseValue)
                noiseValue *= noiseValue
                noiseValue *= acc.weight
                const newWeight = Math.max(0, Math.min(1, noiseValue * 2))

                return {
                  total: acc.total + noiseValue * acc.amplitude,
                  amplitude: acc.amplitude * 0.5,
                  frequency: acc.frequency * 2,
                  weight: newWeight
                }
              })
          )
        )
        total = result.total

        return total
      })
  })
})

export const NoiseGeneratorServiceLive = Layer.effect(
  NoiseGeneratorService,
  makeNoiseGeneratorService
)

const generatePermutationTable = (): ReadonlyArray<number> => {
  const perm = Array.from({ length: 256 }, (_, i) => i)

  // Fisher-Yates シャッフルを関数型で実装
  pipe(
    Array.range(perm.length - 1, 0),
    Array.forEach((i) => {
      const j = Math.floor(Math.random() * (i + 1))
      ;[perm[i], perm[j]] = [perm[j], perm[i]]
    })
  )

  return [...perm, ...perm]
}
```

#### チャンクストレージサービス
```typescript
export interface ChunkStorageServiceInterface {
  readonly save: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly load: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkNotFoundError>
  readonly exists: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never>
  readonly delete: (coordinate: ChunkCoordinate) => Effect.Effect<void, never>
}

export const ChunkStorageService = Context.GenericTag<ChunkStorageServiceInterface>("@minecraft/ChunkStorageService")

export const ChunkSaveError = Schema.TaggedError("ChunkSaveError")({
  message: Schema.String
  readonly coordinate: typeof ChunkCoordinate.Type
  timestamp: Schema.Number
  readonly cause?: unknown
})

export const ChunkNotFoundError = Schema.TaggedError("ChunkNotFoundError")({
  coordinate: typeof ChunkCoordinate.Type
})

const makeChunkStorageService = Effect.gen(function* () {
  const storage = new Map<string, Chunk>()

  const chunkKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

  const save = (chunk: Chunk) =>
    Effect.gen(function* () {
      // ✅ Effect-TS完全準拠パターン: Schema.TaggedError使用
      const key = chunkKey(chunk.coordinate)

      yield* Effect.tryPromise({
        try: () => Promise.resolve(storage.set(key, chunk)),
        catch: (cause) => new ChunkSaveError({
          message: "チャンクの保存に失敗しました",
          coordinate: chunk.coordinate,
          timestamp: Date.now(),
          cause
        })
      })
    })

  const load = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = chunkKey(coordinate)
      const chunk = storage.get(key)

      if (!chunk) {
        return yield* Effect.fail({
          _tag: "ChunkNotFoundError" as const,
          coordinate
        })
      }

      return chunk
    })

  return ChunkStorageService.of({
    save,
    load,
    exists: (coordinate) => Effect.succeed(storage.has(chunkKey(coordinate))),
    delete: (coordinate) => Effect.sync(() => storage.delete(chunkKey(coordinate)))
  })
})

export const ChunkStorageServiceLive = Layer.effect(
  ChunkStorageService,
  makeChunkStorageService
)
```

#### ワールド永続化サービス
```typescript
export interface WorldPersistenceServiceInterface {
  readonly saveWorld: (world: World) => Effect.Effect<void, WorldSaveError>
  readonly loadWorld: (worldId: string) => Effect.Effect<World, WorldLoadError>
  readonly deleteWorld: (worldId: string) => Effect.Effect<void, never>
  readonly listWorlds: () => Effect.Effect<ReadonlyArray<WorldMetadata>, never>
}

export const WorldPersistenceService = Context.GenericTag<WorldPersistenceServiceInterface>("@minecraft/WorldPersistenceService")

export const WorldSaveError = Schema.Struct({
  _tag: Schema.Literal("WorldSaveError"),
  message: Schema.String,
  worldId: Schema.String
})

export const WorldLoadError = Schema.Struct({
  _tag: Schema.Literal("WorldLoadError"),
  message: Schema.String,
  worldId: Schema.String
})

export const WorldMetadata = Schema.Struct({
  _tag: Schema.Literal("WorldMetadata"),
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  lastPlayed: Schema.DateTimeUtc,
  seed: Schema.Number
})

export type WorldSaveError = Schema.Schema.Type<typeof WorldSaveError>
export type WorldLoadError = Schema.Schema.Type<typeof WorldLoadError>
export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadata>
```

## 3. プロシージャル生成

### 3.1 地形生成パイプライン

```typescript
export interface TerrainGenerationServiceInterface {
  readonly generateChunk: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<Chunk, GenerationError>
  readonly generateHeightMap: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<ReadonlyArray<number>, never>
  readonly determineBiome: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<BiomeDefinition, never>
}

export const TerrainGenerationService = Context.GenericTag<TerrainGenerationServiceInterface>("@minecraft/TerrainGenerationService")

export const GenerationError = Schema.Struct({
  _tag: Schema.Literal("GenerationError"),
  message: Schema.String,
  coordinate: ChunkCoordinate
})

export type GenerationError = Schema.Schema.Type<typeof GenerationError>

const makeTerrainGenerationService = Effect.gen(function* () {
  const noiseGenerator = yield* NoiseGeneratorService

  // 純粋関数: 座標生成
  const generateLocalCoordinates = (chunkSize: number): ReadonlyArray<BlockPosition> =>
    Array.from({ length: chunkSize * chunkSize }, (_, index) => ({
      _tag: "BlockPosition" as const,
      x: Math.floor(index / chunkSize),
      y: 0,
      z: index % chunkSize
    }))

  // 純粋関数: 座標変換
  const calculateWorldCoordinate = (
    chunkCoord: ChunkCoordinate,
    localCoord: BlockPosition
  ): { x: number; z: number } => ({
    x: chunkCoord.x * CHUNK_SIZE + localCoord.x,
    z: chunkCoord.z * CHUNK_SIZE + localCoord.z
  })

  // 純粋関数: 高さ計算
  const calculateHeight = (elevation: number): number =>
    Math.floor(elevation * 64 + 64)

  // バイオーム判定ロジック
  const determineBiomeFromClimate = (temperature: number, humidity: number): BiomeDefinition =>
    pipe(
      { temperature, humidity },
      Match.value,
      Match.when(
        ({ temperature }) => temperature < -0.5,
        () => BiomeDefinitions.Tundra
      ),
      Match.when(
        ({ temperature, humidity }) => temperature > 0.5 && humidity < -0.3,
        () => BiomeDefinitions.Desert
      ),
      Match.when(
        ({ humidity }) => humidity > 0.3,
        () => BiomeDefinitions.Jungle
      ),
      Match.when(
        ({ temperature, humidity }) => temperature > 0 && humidity > 0,
        () => BiomeDefinitions.Forest
      ),
      Match.orElse(() => BiomeDefinitions.Plains)
    )

  const generateHeightMap = (coordinate: ChunkCoordinate, seed: number) =>
    pipe(
      generateLocalCoordinates(CHUNK_SIZE),
      Effect.forEach(localCoord => {
        const worldCoord = calculateWorldCoordinate(coordinate, localCoord)
        return pipe(
          noiseGenerator.octaveNoise(
            worldCoord.x * 0.01,
            worldCoord.z * 0.01,
            seed,
            4, // octaves
            0.5, // persistence
            2.0 // lacunarity
          ),
          Effect.map(calculateHeight)
        )
      })
    )

  const determineBiome = (coordinate: ChunkCoordinate, seed: number) =>
    Effect.gen(function* () {
      const temperature = yield* noiseGenerator.noise2D(
        coordinate.x * 0.05,
        coordinate.z * 0.05,
        seed + 1000
      )
      const humidity = yield* noiseGenerator.noise2D(
        coordinate.x * 0.05,
        coordinate.z * 0.05,
        seed + 2000
      )

      return determineBiomeFromClimate(temperature, humidity)
    })

  const generateChunk = (coordinate: ChunkCoordinate, seed: number) =>
    Effect.gen(function* () {
      const [heightMap, biome] = yield* Effect.all([
        generateHeightMap(coordinate, seed),
        determineBiome(coordinate, seed)
      ], { concurrency: 2 })

      const blocks = yield* generateBlocks(heightMap, biome)
      const lightMap = new Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15)

      return {
        _tag: "Chunk" as const,
        coordinate,
        blocks,
        biome: biome.id,
        heightMap,
        lightMap,
        isDirty: false,
        lastModified: new Date(),
        metadata: {
          generatedAt: new Date(),
          version: CHUNK_FORMAT_VERSION
        }
      }
    })

  return TerrainGenerationService.of({
    generateChunk,
    generateHeightMap,
    determineBiome
  })
})

export const TerrainGenerationServiceLive = Layer.effect(
  TerrainGenerationService,
  makeTerrainGenerationService
).pipe(Layer.provide(NoiseGeneratorServiceLive))

const CHUNK_SIZE = 16
const CHUNK_HEIGHT = 384
const CHUNK_FORMAT_VERSION = 1
```

### 3.2 バイオームシステム

```typescript
// バイオーム定義
export const BiomeDefinitions = {
  Plains: {
    _tag: "BiomeDefinition" as const,
    id: "plains",
    name: "平原",
    temperature: 0.3,
    humidity: 0.4,
    elevation: 0.2,
    colors: { grass: 0x91bd59, foliage: 0x77ab2f, water: 0x3f76e4 },
    blocks: { surface: "grass" as const, subsurface: "dirt" as const, stone: "stone" as const },
    features: ["tallGrass", "flowers", "trees_sparse"],
    spawnRules: {
      passive: ["sheep", "cow", "pig", "chicken"],
      hostile: ["zombie", "skeleton", "creeper"],
      spawnRate: 0.7
    }
  },

  Desert: {
    _tag: "BiomeDefinition" as const,
    id: "desert",
    name: "砂漠",
    temperature: 0.95,
    humidity: 0.0,
    elevation: 0.25,
    colors: { grass: 0xbfb755, foliage: 0xaea42a, water: 0x3f76e4 },
    blocks: { surface: "sand" as const, subsurface: "sand" as const, stone: "stone" as const },
    features: ["cactus", "deadBush", "desertWell"],
    spawnRules: {
      passive: ["rabbit"],
      hostile: ["husk", "spider"],
      spawnRate: 0.5
    }
  },

  Forest: {
    _tag: "BiomeDefinition" as const,
    id: "forest",
    name: "森林",
    temperature: 0.2,
    humidity: 0.6,
    elevation: 0.3,
    colors: { grass: 0x79c05a, foliage: 0x59ae30, water: 0x3f76e4 },
    blocks: { surface: "grass" as const, subsurface: "dirt" as const, stone: "stone" as const },
    features: ["oak_trees", "birch_trees", "flowers", "ferns"],
    spawnRules: {
      passive: ["sheep", "cow", "pig", "chicken", "wolf"],
      hostile: ["zombie", "skeleton", "creeper", "spider"],
      spawnRate: 0.8
    }
  },

  Mountains: {
    _tag: "BiomeDefinition" as const,
    id: "mountains",
    name: "山岳",
    temperature: -0.3,
    humidity: 0.2,
    elevation: 0.7,
    colors: { grass: 0x8ab689, foliage: 0x6da36b, water: 0x3f76e4 },
    blocks: { surface: "stone" as const, subsurface: "stone" as const, stone: "stone" as const },
    features: ["pine_trees", "snow"],
    spawnRules: {
      passive: ["sheep", "goat"],
      hostile: ["zombie", "skeleton", "creeper"],
      spawnRate: 0.4
    }
  },

  Jungle: {
    _tag: "BiomeDefinition" as const,
    id: "jungle",
    name: "ジャングル",
    temperature: 0.9,
    humidity: 0.9,
    elevation: 0.1,
    colors: { grass: 0x59c93c, foliage: 0x30bb0b, water: 0x3f76e4 },
    blocks: { surface: "grass" as const, subsurface: "dirt" as const, stone: "stone" as const },
    features: ["jungle_trees", "vines", "cocoa"],
    spawnRules: {
      passive: ["parrot", "ocelot"],
      hostile: ["zombie", "skeleton", "creeper", "spider"],
      spawnRate: 0.9
    }
  },

  Tundra: {
    _tag: "BiomeDefinition" as const,
    id: "tundra",
    name: "ツンドラ",
    temperature: -0.8,
    humidity: 0.1,
    elevation: 0.2,
    colors: { grass: 0x80b497, foliage: 0x60a17b, water: 0x3f76e4 },
    blocks: { surface: "grass" as const, subsurface: "dirt" as const, stone: "stone" as const },
    features: ["spruce_trees", "snow"],
    spawnRules: {
      passive: ["polar_bear", "rabbit"],
      hostile: ["stray", "skeleton"],
      spawnRate: 0.3
    }
  }
} as const
```

### 3.3 地形ごとのノイズパターン

```typescript
export const TerrainPatterns = {
  // 山岳地形
  mountains: {
    heightNoise: {
      octaves: 6,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 200,
      offset: { x: 0, y: 0, z: 0 }
    },
    modifier: (noise: number) => Math.pow(noise, 2.0) * 128 + 64
  },

  // 平原
  plains: {
    heightNoise: {
      octaves: 4,
      persistence: 0.3,
      lacunarity: 2.0,
      scale: 100,
      offset: { x: 1000, y: 0, z: 0 }
    },
    modifier: (noise: number) => noise * 10 + 64
  },

  // 海洋
  ocean: {
    heightNoise: {
      octaves: 3,
      persistence: 0.2,
      lacunarity: 2.0,
      scale: 150,
      offset: { x: 2000, y: 0, z: 0 }
    },
    modifier: (noise: number) => noise * 5 + 30
  },

  // 洞窟
  caves: {
    noise3D: {
      octaves: 3,
      persistence: 0.6,
      lacunarity: 2.0,
      scale: 50,
      threshold: 0.15
    }
  }
} as const
```

## 4. チャンク管理

### 4.1 チャンクマネージャーサービス

```typescript
export interface ChunkManagerInterface {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>, never>
  readonly updateChunk: (
    coord: ChunkCoordinate,
    update: (chunk: Chunk) => Chunk
  ) => Effect.Effect<void, ChunkNotLoadedError>
}

export const ChunkManager = Context.GenericTag<ChunkManagerInterface>("@minecraft/ChunkManager")

export const ChunkLoadError = Schema.Struct({
  _tag: Schema.Literal("ChunkLoadError"),
  message: Schema.String,
  coordinate: ChunkCoordinate
})

export const ChunkNotLoadedError = Schema.Struct({
  _tag: Schema.Literal("ChunkNotLoadedError"),
  coordinate: ChunkCoordinate
})

export type ChunkLoadError = Schema.Schema.Type<typeof ChunkLoadError>
export type ChunkNotLoadedError = Schema.Schema.Type<typeof ChunkNotLoadedError>

const makeChunkManager = Effect.gen(function* () {
  const storage = yield* ChunkStorageService
  const generator = yield* TerrainGenerationService
  const cache = yield* Effect.sync(() => new Map<string, Chunk>())

  const chunkKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

  const loadChunk = (coord: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = chunkKey(coord)

      // 早期リターン: キャッシュチェック
      const cached = cache.get(key)
      if (cached) return cached

      // ストレージから読み込み、なければ生成
      const chunk = yield* storage.load(coord).pipe(
        Effect.catchTag("ChunkNotFoundError", () =>
          generator.generateChunk(coord, worldSeed)
        )
      )

      cache.set(key, chunk)
      return chunk
    })

  const unloadChunk = (coord: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = chunkKey(coord)
      const chunk = cache.get(key)

      // ダーティチャンクの保存
      if (chunk?.isDirty) {
        yield* storage.save(chunk)
      }

      cache.delete(key)
    })

  const updateChunk = (coord: ChunkCoordinate, update: (chunk: Chunk) => Chunk) =>
    Effect.gen(function* () {
      const key = chunkKey(coord)
      const chunk = cache.get(key)

      // 早期リターン: チャンクが存在しない場合はエラー
      if (!chunk) {
        return yield* Effect.fail({
          _tag: "ChunkNotLoadedError" as const,
          coordinate: coord
        })
      }

      const updated = update(chunk)
      cache.set(key, { ...updated, isDirty: true })
    })

  return ChunkManager.of({
    loadChunk,
    unloadChunk,
    saveChunk: storage.save,
    getLoadedChunks: () => Effect.succeed(Array.from(cache.values())),
    updateChunk
  })
})

export const ChunkManagerLive = Layer.effect(
  ChunkManager,
  makeChunkManager
).pipe(
  Layer.provide(ChunkStorageServiceLive),
  Layer.provide(TerrainGenerationServiceLive)
)
```

### 4.2 チャンクロード戦略

```typescript
export interface ChunkLoadingStrategyInterface {
  readonly predictiveLoading: (
    playerPosition: WorldPosition,
    velocity: { x: number; y: number; z: number },
    viewDistance: number
  ) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>

  readonly loadVisibleChunks: (
    playerPosition: WorldPosition,
    viewDistance: number
  ) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>

  readonly adaptiveUnloading: (
    memoryPressure: number,
    playerPositions: ReadonlyArray<WorldPosition>
  ) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>
}

export const ChunkLoadingStrategy = Context.GenericTag<ChunkLoadingStrategyInterface>("@minecraft/ChunkLoadingStrategy")

const makeChunkLoadingStrategy = Effect.gen(function* () {
  const manager = yield* ChunkManager

  // 純粋関数: ワールド座標からチャンク座標への変換
  const worldToChunkCoord = (pos: WorldPosition): ChunkCoordinate => ({
    _tag: "ChunkCoordinate" as const,
    x: Math.floor(pos.x / CHUNK_SIZE),
    z: Math.floor(pos.z / CHUNK_SIZE)
  })

  const loadVisibleChunks = (playerPosition: WorldPosition, viewDistance: number) =>
    Effect.gen(function* () {
      const centerChunk = worldToChunkCoord(playerPosition)
      const chunks: ChunkCoordinate[] = []

      const chunks = pipe(
        Array.range(-viewDistance, viewDistance),
        Array.flatMap((dx) =>
          pipe(
            Array.range(-viewDistance, viewDistance),
            Array.filterMap((dz) => {
              const distance = Math.sqrt(dx * dx + dz * dz)
              return Match.value(distance <= viewDistance).pipe(
                Match.when(true, () => Option.some({
                  _tag: "ChunkCoordinate" as const,
                  x: centerChunk.x + dx,
                  z: centerChunk.z + dz
                })),
                Match.when(false, () => Option.none()),
                Match.exhaustive
              )
            })
          )
        )
      )

      // 距離順にソート
      return chunks.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.x - centerChunk.x, 2) +
          Math.pow(a.z - centerChunk.z, 2)
        )
        const distB = Math.sqrt(
          Math.pow(b.x - centerChunk.x, 2) +
          Math.pow(b.z - centerChunk.z, 2)
        )
        return distA - distB
      })
    })

  const predictiveLoading = (
    playerPosition: WorldPosition,
    velocity: { x: number; y: number; z: number },
    viewDistance: number
  ) =>
    Effect.gen(function* () {
      const PREDICTION_TIME_SECONDS = 3
      const currentChunk = worldToChunkCoord(playerPosition)

      // プレイヤーの移動予測
      const predictedPosition: WorldPosition = {
        _tag: "WorldPosition" as const,
        x: playerPosition.x + velocity.x * PREDICTION_TIME_SECONDS,
        y: playerPosition.y + velocity.y * PREDICTION_TIME_SECONDS,
        z: playerPosition.z + velocity.z * PREDICTION_TIME_SECONDS
      }

      const predictedChunk = worldToChunkCoord(predictedPosition)

      // 予測位置周辺のチャンクを優先ロード対象に
      const chunks: ChunkCoordinate[] = []

      const chunks = pipe(
        Array.range(-viewDistance, viewDistance),
        Array.flatMap((dx) =>
          pipe(
            Array.range(-viewDistance, viewDistance),
            Array.map((dz) => ({
              _tag: "ChunkCoordinate" as const,
              x: predictedChunk.x + dx,
              z: predictedChunk.z + dz
            }))
          )
        )
      )

      // 距離と移動方向による優先度付け
      return chunks.sort((a, b) => {
        const distA = Math.abs(a.x - currentChunk.x) + Math.abs(a.z - currentChunk.z)
        const distB = Math.abs(b.x - currentChunk.x) + Math.abs(b.z - currentChunk.z)

        // 移動方向により近いチャンクを優先
        const dirA = Math.sign((a.x - currentChunk.x) * velocity.x + (a.z - currentChunk.z) * velocity.z)
        const dirB = Math.sign((b.x - currentChunk.x) * velocity.x + (b.z - currentChunk.z) * velocity.z)

        if (dirA !== dirB) return dirB - dirA // 移動方向優先
        return distA - distB // 距離順
      })
    })

  const adaptiveUnloading = (memoryPressure: number, playerPositions: ReadonlyArray<WorldPosition>) =>
    Effect.gen(function* () {
      const loadedChunks = yield* manager.getLoadedChunks()

      // メモリ圧迫度に応じてアンロード基準を調整
      const baseUnloadDistance = 10
      const pressureMultiplier = Math.max(0.5, 1 - memoryPressure)
      const unloadDistance = baseUnloadDistance * pressureMultiplier

      const chunksToUnload: ChunkCoordinate[] = []

      const chunksToUnload = pipe(
        loadedChunks,
        Array.filter((chunk) =>
          pipe(
            playerPositions,
            Array.every((playerPos) => {
              const playerChunk = worldToChunkCoord(playerPos)
          const distance = Math.sqrt(
            Math.pow(chunk.coordinate.x - playerChunk.x, 2) +
            Math.pow(chunk.coordinate.z - playerChunk.z, 2)
          )

          if (distance < unloadDistance) {
            shouldUnload = false
            break
          }
        }

        if (shouldUnload) {
          chunksToUnload.push(chunk.coordinate)
        }
      }

      return chunksToUnload
    })

  return ChunkLoadingStrategy.of({
    predictiveLoading,
    loadVisibleChunks,
    adaptiveUnloading
  })
})

export const ChunkLoadingStrategyLive = Layer.effect(
  ChunkLoadingStrategy,
  makeChunkLoadingStrategy
).pipe(Layer.provide(ChunkManagerLive))
```

## 5. ブロック操作

### 5.1 ブロック操作サービス

```typescript
export interface BlockOperationsInterface {
  readonly getBlock: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<BlockType, BlockNotFoundError>

  readonly setBlock: (
    world: World,
    position: WorldPosition,
    block: BlockType
  ) => Effect.Effect<World, BlockPlaceError>

  readonly breakBlock: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<World, BlockBreakError>

  readonly getAdjacentBlocks: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<ReadonlyArray<BlockType>, never>
}

export const BlockOperations = Context.GenericTag<BlockOperationsInterface>("@minecraft/BlockOperations")

export const BlockNotFoundError = Schema.Struct({
  _tag: Schema.Literal("BlockNotFoundError"),
  position: WorldPosition
})

export const BlockPlaceError = Schema.Struct({
  _tag: Schema.Literal("BlockPlaceError"),
  message: Schema.String,
  position: WorldPosition
})

export const BlockBreakError = Schema.Struct({
  _tag: Schema.Literal("BlockBreakError"),
  message: Schema.String,
  position: WorldPosition
})

export type BlockNotFoundError = Schema.Schema.Type<typeof BlockNotFoundError>
export type BlockPlaceError = Schema.Schema.Type<typeof BlockPlaceError>
export type BlockBreakError = Schema.Schema.Type<typeof BlockBreakError>

const makeBlockOperations = Effect.gen(function* () {
  const chunkManager = yield* ChunkManager

  // 純粋関数: 座標変換
  const worldToChunkCoord = (pos: WorldPosition): ChunkCoordinate => ({
    _tag: "ChunkCoordinate" as const,
    x: Math.floor(pos.x / CHUNK_SIZE),
    z: Math.floor(pos.z / CHUNK_SIZE)
  })

  const worldToLocalCoord = (pos: WorldPosition): BlockPosition => ({
    _tag: "BlockPosition" as const,
    x: ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: Math.floor(pos.y),
    z: ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  })

  const getBlockIndex = (local: BlockPosition): number =>
    local.y * CHUNK_SIZE * CHUNK_SIZE + local.z * CHUNK_SIZE + local.x

  const getBlock = (world: World, position: WorldPosition) =>
    Effect.gen(function* () {
      const chunkCoord = worldToChunkCoord(position)
      const chunk = yield* chunkManager.loadChunk(chunkCoord)
      const localCoord = worldToLocalCoord(position)
      const index = getBlockIndex(localCoord)

      const blockId = chunk.blocks[index] ?? 0
      return blockId === 0 ? "air" as const : "stone" as const // 簡単な実装
    })

  const setBlock = (world: World, position: WorldPosition, block: BlockType) =>
    Effect.gen(function* () {
      const chunkCoord = worldToChunkCoord(position)
      const localCoord = worldToLocalCoord(position)
      const index = getBlockIndex(localCoord)
      const blockId = getBlockId(block)

      yield* chunkManager.updateChunk(chunkCoord, (chunk) => ({
        ...chunk,
        blocks: chunk.blocks.map((b, i) => i === index ? blockId : b),
        isDirty: true,
        lastModified: new Date()
      }))

      return world
    })

  const breakBlock = (world: World, position: WorldPosition) =>
    setBlock(world, position, "air")

  const getAdjacentBlocks = (world: World, position: WorldPosition) =>
    Effect.gen(function* () {
      const directions = [
        { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
      ]

      const adjacentPositions = directions.map(dir => ({
        _tag: "WorldPosition" as const,
        x: position.x + dir.x,
        y: position.y + dir.y,
        z: position.z + dir.z
      }))

      return yield* Effect.all(
        adjacentPositions.map(pos =>
          getBlock(world, pos).pipe(
            Effect.catchAll(() => Effect.succeed("air" as const))
          )
        )
      )
    })

  return BlockOperations.of({
    getBlock,
    setBlock,
    breakBlock,
    getAdjacentBlocks
  })
})

export const BlockOperationsLive = Layer.effect(
  BlockOperations,
  makeBlockOperations
).pipe(Layer.provide(ChunkManagerLive))

// ヘルパー関数
const getBlockId = (block: BlockType): number => {
  const blockIds = {
    air: 0,
    stone: 1,
    grass: 2,
    dirt: 3,
    sand: 4,
    water: 8,
    wood: 17,
    leaves: 18,
    coal_ore: 16,
    iron_ore: 15,
    gold_ore: 14,
    diamond_ore: 56
  } as const

  return blockIds[block] ?? 0
}
```

## 6. パフォーマンス最適化

### 6.1 詳細度 (LOD) システム

```typescript
export enum LODLevel {
  Full = "full",
  High = "high",
  Medium = "medium",
  Low = "low",
  Minimal = "minimal"
}

export interface LODSystemInterface {
  readonly selectLOD: (distance: number) => Effect.Effect<LODLevel, never>
  readonly generateWithLOD: (
    coordinate: ChunkCoordinate,
    lod: LODLevel,
    seed: number
  ) => Effect.Effect<Chunk, GenerationError>
}

export const LODSystem = Context.GenericTag<LODSystemInterface>("@minecraft/LODSystem")

const makeLODSystem = Effect.gen(function* () {
  const generator = yield* TerrainGenerationService

  // 純粋関数: 距離に応じたLOD選択
  const selectLOD = (distance: number) =>
    Effect.succeed(
      Match.value(distance).pipe(
        Match.when((d) => d < 50, () => LODLevel.Full),
        Match.when((d) => d < 100, () => LODLevel.High),
        Match.when((d) => d < 200, () => LODLevel.Medium),
        Match.when((d) => d < 400, () => LODLevel.Low),
        Match.orElse(() => LODLevel.Minimal)
      )
    )

  const generateWithLOD = (coordinate: ChunkCoordinate, lod: LODLevel, seed: number) =>
    Match.value(lod).pipe(
      Match.when(LODLevel.Full, () => generator.generateChunk(coordinate, seed)),
      Match.when(LODLevel.High, () => generateHighDetail(coordinate, seed)),
      Match.when(LODLevel.Medium, () => generateMediumDetail(coordinate, seed)),
      Match.when(LODLevel.Low, () => generateLowDetail(coordinate, seed)),
      Match.when(LODLevel.Minimal, () => generateMinimalDetail(coordinate, seed)),
      Match.exhaustive
    )

  return LODSystem.of({
    selectLOD,
    generateWithLOD
  })
})

export const LODSystemLive = Layer.effect(
  LODSystem,
  makeLODSystem
).pipe(Layer.provide(TerrainGenerationServiceLive))

// LOD別生成関数（実装は省略）
const generateHighDetail = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<Chunk, GenerationError> =>
  Effect.succeed({} as Chunk)

const generateMediumDetail = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<Chunk, GenerationError> =>
  Effect.succeed({} as Chunk)

const generateLowDetail = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<Chunk, GenerationError> =>
  Effect.succeed({} as Chunk)

const generateMinimalDetail = (coordinate: ChunkCoordinate, seed: number): Effect.Effect<Chunk, GenerationError> =>
  Effect.succeed({} as Chunk)
```

### 6.2 非同期生成とキャッシング

```typescript
import { Queue, WorkerPool } from "effect"

export interface AsyncWorldGenerationInterface {
  readonly enqueueGeneration: (request: GenerationRequest) => Effect.Effect<void, never>
  readonly processQueue: () => Effect.Effect<void, never>
  readonly getCachedChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<Chunk>, never>
}

export const AsyncWorldGeneration = Context.GenericTag<AsyncWorldGenerationInterface>("@minecraft/AsyncWorldGeneration")

export const GenerationRequest = Schema.Struct({
  _tag: Schema.Literal("GenerationRequest"),
  coordinate: ChunkCoordinate,
  priority: Schema.Number,
  seed: Schema.Number,
  lod: Schema.String
})

export type GenerationRequest = Schema.Schema.Type<typeof GenerationRequest>

const makeAsyncWorldGeneration = Effect.gen(function* () {
  const generationQueue = yield* Queue.unbounded<GenerationRequest>()
  const chunkCache = yield* Effect.sync(() => new Map<string, Chunk>())
  const generator = yield* TerrainGenerationService

  const chunkKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

  const enqueueGeneration = (request: GenerationRequest) =>
    Queue.offer(generationQueue, request)

  const processQueue = () =>
    Effect.gen(function* () {
      yield* Effect.forever(
        Effect.gen(function* () {
          const request = yield* Queue.take(generationQueue)

          const chunk = yield* generator.generateChunk(request.coordinate, request.seed)
          const key = chunkKey(request.coordinate)

          chunkCache.set(key, chunk)

          // 生成完了イベントの発行（実装省略）
          yield* Effect.log(`チャンク生成完了: ${key}`)
        })
      )
    })

  const getCachedChunk = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = chunkKey(coordinate)
      const cached = chunkCache.get(key)
      return Option.fromNullable(cached)
    })

  return AsyncWorldGeneration.of({
    enqueueGeneration,
    processQueue,
    getCachedChunk
  })
})

export const AsyncWorldGenerationLive = Layer.effect(
  AsyncWorldGeneration,
  makeAsyncWorldGeneration
).pipe(Layer.provide(TerrainGenerationServiceLive))
```

## 7. Effect-TS 統合

### 7.1 サービス定義パターン

```typescript
// 統一されたサービス定義パターン
export interface ServiceInterface {
  readonly method: (param: ParamType) => Effect.Effect<ReturnType, ErrorType>
}

export const Service = Context.GenericTag<ServiceInterface>("@minecraft/Service")

const makeService = Effect.gen(function* () {
  const dependency = yield* DependencyService

  const method = (param: ParamType) =>
    Effect.gen(function* () {
      // 実装ロジック
    })

  return Service.of({ method })
})

export const ServiceLive = Layer.effect(Service, makeService).pipe(
  Layer.provide(DependencyServiceLive)
)
```

### 7.2 エラーハンドリングパターン

```typescript
// 統一されたエラーハンドリング
export const WorldSystemError = Schema.Union(
  GenerationError,
  ChunkLoadError,
  ChunkSaveError,
  BlockPlaceError,
  BlockBreakError
)

export type WorldSystemError = Schema.Schema.Type<typeof WorldSystemError>

// エラーハンドリングの共通パターン
const handleWorldError = <A>(effect: Effect.Effect<A, WorldSystemError>) =>
  effect.pipe(
    Effect.mapError(error =>
      Match.value(error).pipe(
        Match.tag("GenerationError", (err) =>
          new Error(`生成失敗: ${err.message}`)
        ),
        Match.tag("ChunkLoadError", (err) =>
          new Error(`チャンクロード失敗: ${err.message}`)
        ),
        Match.tag("ChunkSaveError", (err) =>
          new Error(`チャンク保存失敗: ${err.message}`)
        ),
        Match.orElse((err) => new Error(`不明なエラー: ${JSON.stringify(err)}`))
      )
    ),
    Effect.retry(Schedule.exponential("100 millis").pipe(
      Schedule.intersect(Schedule.recurs(3))
    ))
  )
```

### 7.3 依存性注入

```typescript
// 全システムの統合Layer
export const WorldSystemLive = Layer.mergeAll(
  NoiseGeneratorServiceLive,
  ChunkStorageServiceLive,
  WorldPersistenceServiceLive,
  TerrainGenerationServiceLive,
  ChunkManagerLive,
  BlockOperationsLive,
  ChunkLoadingStrategyLive,
  LODSystemLive,
  AsyncWorldGenerationLive
)

// アプリケーション層での使用
export const WorldApp = Effect.gen(function* () {
  const chunkManager = yield* ChunkManager
  const blockOps = yield* BlockOperations
  const lodSystem = yield* LODSystem

  // アプリケーションロジック
})

// 実行時
const runWorldApp = WorldApp.pipe(
  Effect.provide(WorldSystemLive),
  Effect.runPromise
)
```

## 関連ドキュメント

- [ブロックシステム](./block-system.md) - ブロックシステムの詳細実装
- [チャンクシステム](./chunk-system.md) - チャンクシステムの高度な機能
- [エンティティシステム](./entity-system.md) - ワールド内のエンティティとの相互作用
- [チャンクフォーマット](../../03-data-models/01-chunk-format.md) - チャンクのデータ構造
- [レイヤードアーキテクチャ](../../01-architecture/04-layered-architecture.md) - システム全体のアーキテクチャ
- [ECS統合](../../01-architecture/05-ecs-integration.md) - エンティティコンポーネントシステムとの統合
- [Effect-TSパターン](../../01-architecture/06-effect-ts-patterns.md) - Effect-TSパターンの詳細

## 用語集

- **チャンク (Chunk)**: 16x16x384ブロックの単位 ([詳細](../../../04-appendix/00-glossary.md#chunk))
- **アグリゲート (Aggregate)**: DDDにおけるビジネスルールを管理するドメインオブジェクト ([詳細](../../../04-appendix/00-glossary.md#aggregate))
- **Effect**: Effect-TSにおける純粋関数型の副作用管理 ([詳細](../../../04-appendix/00-glossary.md#effect))
- **スキーマ (Schema)**: Effect-TSにおける型安全なデータ定義 ([詳細](../../../04-appendix/00-glossary.md#schema))
- **ボクセル (Voxel)**: ブロックベースの世界表現の基本概念 ([詳細](../../../04-appendix/00-glossary.md#voxel))
- **プロシージャル生成 (Procedural Generation)**: アルゴリズムによる自動コンテンツ生成 ([詳細](../../../04-appendix/00-glossary.md#procedural-generation))

## 🤖 AI Implementation Guidelines

### For AI Coding Agents
このシステムを実装する際は、以下の順序で進めてください：

1. **Service Interface First**
   ```typescript
   // 必ずインターフェース定義から開始
   export interface WorldManagementService {
     readonly generateWorld: (config: WorldConfig) => Effect.Effect<World, WorldGenerationError>
     readonly getChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkNotFoundError>
     readonly setBlock: (pos: WorldPosition, block: BlockType) => Effect.Effect<void, BlockUpdateError>
   }
   ```

2. **Error Types Second**
   ```typescript
   // 実装前にエラーを定義
   export const WorldGenerationError = Schema.TaggedError("WorldGenerationError")({
     readonly config: WorldConfig
     reason: Schema.String
     timestamp: Schema.Number
   }> {}
   ```

3. **Schema Validation Third**
   ```typescript
   // すべてのデータに対して検証スキーマを作成
   export const WorldConfigSchema = Schema.Struct({
     seed: Schema.Number,
     size: Schema.Struct({
       width: Schema.Number.pipe(Schema.positive()),
       height: Schema.Number.pipe(Schema.positive())
     })
   })
   ```

4. **Implementation Fourth**
   ```typescript
   // すべての非同期操作にはEffect.genを使用
   const makeWorldManagementService = Effect.gen(function* () {
     const chunkGenerator = yield* ChunkGenerator
     const storage = yield* WorldStorage

     return WorldManagementService.of({
       generateWorld: (config) => Effect.gen(function* () {
         // 実装ロジック
       })
     })
   })
   ```

5. **Layer Creation Fifth**
   ```typescript
   // 依存性注入のために必ずLayerを提供
   export const WorldManagementServiceLive = Layer.effect(
     WorldManagementService,
     makeWorldManagementService
   )
   ```

### Critical Patterns to Remember
- **通常のclassキーワードは絶対使用禁止**
- **サービスには必ずContext.GenericTagを使用**
- **Effect.failで早期リターン**
- **Schema.decodeUnknownSyncで入力検証**

### Performance Optimization Hints
- 高価な計算には`Effect.cached`を使用
- 可変状態には`Ref`を使用
- 大量データ処理には`Stream`を使用
- シングルトンサービスには`Layer.memoize`を使用

### World Generation Specific Patterns
- ノイズ関数には`Effect.cached`で結果をキャッシュ
- チャンク生成は`Effect.all`で並列処理
- バイオーム遵移は`Effect.gen`で連続処理
- 構造物配置は`Match.value`でパターンマッチング
