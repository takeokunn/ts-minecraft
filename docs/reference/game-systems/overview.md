---
title: "データモデル設計概要 - Effect-TS Schema・DDD集約・型安全性"
description: "TypeScript Minecraft Cloneの包括的データモデル設計。Effect-TS Schema、DDD集約パターン、ブランド型による完全型安全性とドメイン整合性の実現。"
category: "specification"
difficulty: "advanced"
tags: ["data-modeling", "effect-ts-schema", "ddd-aggregates", "brand-types", "domain-modeling", "type-safety"]
prerequisites: ["effect-ts-schema-advanced", "ddd-tactical-design", "typescript-advanced-types", "domain-modeling"]
estimated_reading_time: "30分"
related_patterns: ["data-modeling-patterns", "validation-patterns", "ddd-patterns"]
related_docs: ["./01-chunk-format.md", "./02-save-file-format.md", "../../01-architecture/02-aggregates.md"]
search_keywords:
  primary: ["data-modeling", "effect-ts-schema", "domain-models", "type-safety"]
  secondary: ["ddd-aggregates", "brand-types", "validation", "data-integrity"]
  context: ["domain-driven-design", "functional-programming", "type-systems"]
---

# データモデル概要

TypeScript Minecraftにおけるデータモデルの設計方針と実装パターンの概要。

## 目次

1. [設計原則](#設計原則)
2. [スキーマ定義パターン](#スキーマ定義パターン)
3. [永続化戦略](#永続化戦略)
4. [バージョニング戦略](#バージョニング戦略)
5. [パフォーマンス最適化](#パフォーマンス最適化)
6. [データモデル一覧](#データモデル一覧)

## 設計原則

### 1. スキーマファースト設計

```typescript
import { Schema } from "effect"

// スキーマから型を導出
export const PlayerSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number.pipe(
    Schema.between(0, 20)
  ),
  createdAt: Schema.Date,
  lastSeen: Schema.Date
})

// 型を自動導出
export interface Player extends Schema.Schema.Type<typeof PlayerSchema> {}
```

### 2. 不変性とイミュータビリティ

```typescript
// すべてのデータは不変
export interface WorldData {
  readonly id: WorldId
  readonly name: string
  readonly seed: number
  readonly chunks: ReadonlyMap<ChunkCoordinate, ChunkData>
  readonly players: ReadonlyMap<PlayerId, PlayerData>
  readonly createdAt: Date
  readonly lastModified: Date
}

// 更新は新しいオブジェクト生成で実行
export const updateWorldData = (
  world: WorldData,
  update: Partial<Omit<WorldData, 'id' | 'createdAt'>>
): WorldData => ({
  ...world,
  ...update,
  lastModified: new Date()
})
```

### 3. 型安全な識別子

```typescript
// Brand型による厳密な型チェック
export type PlayerId = string & Brand.Brand<"PlayerId">
export type ChunkId = string & Brand.Brand<"ChunkId">
export type BlockId = string & Brand.Brand<"BlockId">

export const PlayerId = Brand.nominal<PlayerId>()
export const ChunkId = Brand.nominal<ChunkId>()
export const BlockId = Brand.nominal<BlockId>()
```

## スキーマ定義パターン

### 基本スキーマ構造

```typescript
// 座標系の共通スキーマ
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export const ChunkCoordinateSchema = Schema.Struct({
  x: Schema.Int.pipe(Schema.between(-30000000, 30000000)),
  z: Schema.Int.pipe(Schema.between(-30000000, 30000000))
})

// ブロック位置の詳細スキーマ
export const BlockPositionSchema = Schema.Struct({
  world: Vector3Schema,
  chunk: ChunkCoordinateSchema,
  local: Schema.Struct({
    x: Schema.Int.pipe(Schema.between(0, 15)),
    y: Schema.Int.pipe(Schema.between(0, 255)),
    z: Schema.Int.pipe(Schema.between(0, 15))
  })
})
```

### 複合スキーマパターン

```typescript
// エンティティベーススキーマ
export const EntityBaseSchema = Schema.Struct({
  id: Schema.UUID,
  type: Schema.String,
  position: Vector3Schema,
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(Schema.between(0, 360)),
    pitch: Schema.Number.pipe(Schema.between(-90, 90))
  }),
  velocity: Vector3Schema,
  health: Schema.Number.pipe(Schema.between(0, 20)),
  maxHealth: Schema.Number.pipe(Schema.between(1, 20)),
  createdAt: Schema.Date,
  updatedAt: Schema.Date
})

// プレイヤー固有の拡張
export const PlayerSchema = Schema.extend(EntityBaseSchema, Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/)
  ),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator"),
  experience: Schema.Struct({
    level: Schema.Int.pipe(Schema.between(0, 21863)),
    points: Schema.Int.pipe(Schema.between(0, 1000000)),
    totalPoints: Schema.Int.pipe(Schema.between(0, 1000000))
  }),
  inventory: Schema.Array(Schema.optional(ItemStackSchema)),
  enderChest: Schema.Array(Schema.optional(ItemStackSchema))
}))
```

### バリデーション強化スキーマ

```typescript
// アイテムスタックのスキーマ
export const ItemStackSchema = Schema.Struct({
  type: Schema.String,
  count: Schema.Int.pipe(
    Schema.between(1, 64),
    Schema.annotations({
      title: "アイテム個数",
      description: "1-64の範囲で指定"
    })
  ),
  durability: Schema.optional(
    Schema.Int.pipe(Schema.between(0, 1000))
  ),
  enchantments: Schema.optional(
    Schema.Array(Schema.Struct({
      id: Schema.String,
      level: Schema.Int.pipe(Schema.between(1, 10))
    }))
  ),
  nbt: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

// インベントリスキーマ
export const InventorySchema = Schema.Struct({
  id: Schema.UUID,
  type: Schema.Literal("player", "chest", "furnace", "crafting"),
  size: Schema.Int.pipe(Schema.between(1, 54)),
  items: Schema.Array(Schema.optional(ItemStackSchema)),
  owner: Schema.optional(Schema.UUID)
}).pipe(
  Schema.filter(inv =>
    inv.items.length === inv.size,
    { message: "アイテム配列サイズが一致しません" }
  )
)
```

## 永続化戦略

### 1. レイヤード永続化

```typescript
// 永続化レイヤーの定義
export const PersistenceLayer = Layer.effectContext(
  Tag<PersistenceService>,
  Effect.gen(function* () {
    const config = yield* ConfigService

    return {
      // ワールドデータ永続化
      saveWorld: (world: WorldData): Effect.Effect<void, PersistenceError> =>
        Effect.gen(function* () {
          const serialized = yield* Schema.encode(WorldDataSchema)(world)
          yield* FileSystem.writeFile(
            `${config.savePath}/world_${world.id}.json`,
            JSON.stringify(serialized, null, 2)
          )
        }),

      // プレイヤーデータ永続化
      savePlayer: (player: PlayerData): Effect.Effect<void, PersistenceError> =>
        Effect.gen(function* () {
          const serialized = yield* Schema.encode(PlayerSchema)(player)
          yield* FileSystem.writeFile(
            `${config.savePath}/players/${player.id}.json`,
            JSON.stringify(serialized, null, 2)
          )
        }),

      // チャンクデータ圧縮永続化
      saveChunk: (chunk: ChunkData): Effect.Effect<void, PersistenceError> =>
        Effect.gen(function* () {
          const compressed = yield* CompressionService.compress(chunk)
          yield* FileSystem.writeBinary(
            `${config.savePath}/chunks/${chunk.coordinate.x}_${chunk.coordinate.z}.dat`,
            compressed
          )
        })
    }
  })
)
```

### 2. キャッシュ戦略

```typescript
// 階層化キャッシュ
export const CacheLayer = Layer.effectContext(
  Tag<CacheService>,
  Effect.gen(function* () {
    // L1: インメモリキャッシュ（高速アクセス用）
    const l1Cache = yield* Cache.make({
      capacity: 1000,
      timeToLive: Duration.minutes(5)
    })

    // L2: 永続化キャッシュ（再起動耐性）
    const l2Cache = yield* RedisCache.make()

    return {
      get: <T>(key: string, schema: Schema.Schema<T>) =>
        pipe(
          l1Cache.get(key),
          Effect.orElse(() => l2Cache.get(key)),
          Effect.flatMap(data => Schema.decode(schema)(data)),
          Effect.tap(value => l1Cache.set(key, value))
        ),

      set: <T>(key: string, value: T, schema: Schema.Schema<T>) =>
        pipe(
          Schema.encode(schema)(value),
          Effect.flatMap(encoded =>
            Effect.all([
              l1Cache.set(key, encoded),
              l2Cache.set(key, encoded)
            ])
          )
        )
    }
  })
)
```

## バージョニング戦略

### スキーマ進化パターン

```typescript
// バージョン管理されたスキーマ
export const VersionedSchema = <T>(
  currentVersion: number,
  currentSchema: Schema.Schema<T>,
  migrations: Record<number, Schema.Schema<unknown>>
) => Schema.struct({
  version: Schema.literal(currentVersion),
  data: currentSchema
}).pipe(
  Schema.transformOrFail(
    Schema.struct({
      version: Schema.number,
      data: Schema.unknown
    }),
    {
      decode: (input) => {
        if (input.version === currentVersion) {
          return Effect.succeed(input as any)
        }

        // マイグレーション実行
        return pipe(
          migrations[input.version] || Effect.fail("未対応バージョン"),
          Schema.decode,
          Effect.flatMap(migration => migration(input.data)),
          Effect.map(migrated => ({ version: currentVersion, data: migrated }))
        )
      },
      encode: Effect.succeed
    }
  )
)

// 使用例
export const PlayerDataV3 = VersionedSchema(3, PlayerSchema, {
  1: PlayerDataV1ToV2Migration,
  2: PlayerDataV2ToV3Migration
})
```

### マイグレーション実装

```typescript
// V1 -> V2 マイグレーション例
export const PlayerDataV1ToV2Migration = Schema.transformOrFail(
  // V1スキーマ
  Schema.struct({
    id: Schema.string,
    name: Schema.string,
    x: Schema.number,
    y: Schema.number,
    z: Schema.number
  }),
  // V2スキーマ
  Schema.struct({
    id: Schema.string,
    name: Schema.string,
    position: Vector3Schema,
    health: Schema.number,
    createdAt: Schema.date
  }),
  {
    decode: (v1Data) => Effect.succeed({
      id: v1Data.id,
      name: v1Data.name,
      position: { x: v1Data.x, y: v1Data.y, z: v1Data.z },
      health: 20, // デフォルト値
      createdAt: new Date()
    }),
    encode: (v2Data) => Effect.succeed({
      id: v2Data.id,
      name: v2Data.name,
      x: v2Data.position.x,
      y: v2Data.position.y,
      z: v2Data.position.z
    })
  }
)
```

## パフォーマンス最適化

### 1. 遅延読み込み

```typescript
// チャンクデータの遅延読み込み
export const LazyChunkLoader = {
  loadChunk: (coordinate: ChunkCoordinate): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      // キャッシュから検索
      const cached = yield* ChunkCache.get(coordinate)
      if (cached.isSome()) {
        return cached.value
      }

      // ディスクから読み込み
      const data = yield* FileSystem.readFile(
        chunkPath(coordinate)
      )
      const chunk = yield* Schema.decode(ChunkDataSchema)(JSON.parse(data))

      // キャッシュに保存
      yield* ChunkCache.set(coordinate, chunk)

      return chunk
    }),

  // プリロード戦略
  preloadNearbyChunks: (
    center: ChunkCoordinate,
    radius: number
  ): Effect.Effect<void> =>
    pipe(
      generateChunkCoordinatesInRadius(center, radius),
      Effect.forEach(coord => LazyChunkLoader.loadChunk(coord)),
      Effect.asVoid
    )
}
```

### 2. ストリーミング処理

```typescript
// 大容量データのストリーミング読み込み
export const StreamingDataLoader = {
  streamChunks: (
    world: WorldId
  ): Stream.Stream<ChunkData, LoadError> =>
    pipe(
      FileSystem.listFiles(`${world}/chunks/`),
      Stream.fromIterable,
      Stream.mapEffect(filePath =>
        pipe(
          FileSystem.readFile(filePath),
          Effect.flatMap(content =>
            Schema.decode(ChunkDataSchema)(JSON.parse(content))
          )
        )
      ),
      Stream.buffer(100) // バッファリング
    ),

  // バッチ処理
  processBatched: <A, B>(
    stream: Stream.Stream<A>,
    processor: (batch: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<B>>,
    batchSize: number = 100
  ): Stream.Stream<B> =>
    pipe(
      stream,
      Stream.grouped(batchSize),
      Stream.mapEffect(processor),
      Stream.flattenIterables
    )
}
```

## データモデル一覧

### コアデータモデル

| モデル | ファイル | 説明 | スキーマ複雑度 |
|--------|----------|------|----------------|
| **WorldData** | `00-world-data-structure.md` | ワールドの基本構造 | ⭐⭐⭐ |
| **ChunkData** | `01-chunk-format.md` | チャンクデータ形式 | ⭐⭐⭐⭐ |
| **SaveFormat** | `02-save-file-format.md` | セーブファイル形式 | ⭐⭐⭐⭐⭐ |

### エンティティモデル

```typescript
// プレイヤーエンティティ
export interface PlayerEntity extends BaseEntity {
  readonly type: "player"
  readonly name: string
  readonly gameMode: GameMode
  readonly inventory: ReadonlyArray<ItemStack | null>
  readonly experience: ExperienceData
  readonly statistics: PlayerStatistics
}

// Mobエンティティ
export interface MobEntity extends BaseEntity {
  readonly type: "mob"
  readonly mobType: MobType
  readonly ai: AIBehaviorData
  readonly drops: ReadonlyArray<DropEntry>
  readonly spawning: SpawningData
}

// ブロックエンティティ
export interface BlockEntity extends BaseEntity {
  readonly type: "block_entity"
  readonly blockType: BlockType
  readonly inventory?: ReadonlyArray<ItemStack | null>
  readonly data: Record<string, unknown>
}
```

### アイテムモデル

```typescript
export interface Item {
  readonly id: ItemId
  readonly type: ItemType
  readonly name: string
  readonly stackSize: number
  readonly durability?: number
  readonly enchantable: boolean
  readonly properties: ItemProperties
}

export interface ItemStack {
  readonly item: Item
  readonly count: number
  readonly durability?: number
  readonly enchantments: ReadonlyArray<Enchantment>
  readonly nbt?: NBTCompound
}
```

## 関連ドキュメント

- **詳細仕様**: 各データモデルの詳細は個別のmdファイルを参照
- **実装パターン**: [データモデリングパターン](/docs/07-pattern-catalog/03-data-modeling-patterns.md)
- **API設計**: [ドメインAPI仕様](/docs/02-specifications/02-api-design/00-domain-application-apis.md)
- **アーキテクチャ**: [DDD戦略設計](/docs/01-architecture/02-ddd-strategic-design.md)

このオーバービューは、TypeScript Minecraftのデータモデル設計の全体像を提供します。詳細な実装については、各専門ドキュメントを参照してください。