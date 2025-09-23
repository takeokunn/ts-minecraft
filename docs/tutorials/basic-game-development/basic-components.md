---
title: '基本コンポーネント作成 - Domain層の基礎実装'
description: 'Schema.Struct、Context.GenericTag、Effect.genを使用したMinecraft Clone Domain層の基礎コンポーネント実装。型安全なブロック、プレイヤー、ワールド管理システム構築。'
category: 'tutorial'
difficulty: 'intermediate'
tags: ['domain-layer', 'schema-struct', 'context-generic-tag', 'effect-ts', 'basic-components']
prerequisites: ['environment-setup', 'effect-ts-basics']
estimated_reading_time: '25分'
related_docs:
  ['./03-effect-services.md', './04-threejs-integration.md', '../../effect-ts-fundamentals/effect-ts-basics.md']
ai_context:
  primary_concepts: ['domain-modeling', 'schema-validation', 'type-safety', 'effect-composition']
  complexity_level: 5.5
  learning_outcomes: ['Domain層コンポーネント設計', 'Schema駆動開発', '型安全エラーハンドリング']
machine_readable:
  confidence_score: 0.95
  api_maturity: 'production-ready'
  execution_time: '1200-1500ms'
performance_benchmarks:
  component_creation: '50-100ms'
  schema_validation: '1-5ms'
  memory_usage: 'low'
---

# 基本コンポーネント作成 - Domain層の基礎実装

## 🎯 学習目標

**⏱️ 学習時間**: 25分 | **🔄 進捗フロー**: [15分 Quick Start] → [30分 Effect-TS基礎] → **[25分 基本コンポーネント]** → [30分 Effect サービス] → [45分 Three.js統合]

このモジュールでは、TypeScript Minecraft CloneのDomain層における基本コンポーネントを作成します。Schema.Struct、Context.GenericTag、Effect.genの実践的な活用方法を習得できます。

> 📍 **Navigation**: ← [環境構築](./environment-setup.md) | → [Effect サービス実装](./03-effect-services.md)

## 1. Domain層アーキテクチャ概要

### 1.1 Clean ArchitectureにおけるDomain層

```typescript
// [LIVE_EXAMPLE: domain-architecture]
// 🏗️ Domain層の責務と設計原則
const DomainLayerPrinciples = {
  responsibility: 'ビジネスロジック・ゲームルールの定義',
  principles: [
    '外部依存なし（Pure Functions）',
    '不変データ構造の使用',
    '型安全なエラーハンドリング',
    'Schema駆動開発による実行時安全性',
  ],
  components: {
    entities: 'ゲーム内オブジェクト（Player、Block、World等）',
    valueObjects: '値オブジェクト（Position、Direction等）',
    domainServices: 'ドメインロジック（衝突判定、地形生成等）',
    errors: 'ドメイン固有エラー定義',
  },
} as const
// [/LIVE_EXAMPLE]
```

### 1.2 Minecraft固有のDomainモデル

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
classDiagram
    class World {
        -chunks: Map~ChunkId, Chunk~
        -spawnPoint: Position
        -time: GameTime
        +getBlock(position) Block
        +setBlock(position, block) void
        +generateChunk(coord) Chunk
    }

    class Chunk {
        -id: ChunkId
        -blocks: Block[][][]
        -biome: BiomeType
        +getBlock(x, y, z) Block
        +setBlock(x, y, z, block) void
    }

    class Player {
        -id: PlayerId
        -position: Position
        -health: Health
        -inventory: Inventory
        +move(direction) Player
        +damage(amount) Player
    }

    class Block {
        -id: BlockId
        -type: BlockType
        -hardness: number
        -lightLevel: number
        +canBreak() boolean
        +getDrops() Item[]
    }

    World ||--o{ Chunk : contains
    Chunk ||--o{ Block : contains
    World ||--o| Player : spawns
    Player ||--|| Inventory : has

    classDef entityStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef valueStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px

    class World,Player entityStyle
    class Chunk,Block,Position,Inventory valueStyle
```

## 2. 基本的なValue Objects作成

### 2.1 Position - 3D座標システム

```typescript
// [LIVE_EXAMPLE: position-value-object]
// 📍 Position - Minecraft座標系の型安全実装
import { Schema, Brand } from 'effect'

// ✅ Schema.Struct による厳密な座標定義
export const Position = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-30_000_000), // Minecraft世界境界
    Schema.lessThanOrEqualTo(30_000_000),
    Schema.annotations({
      identifier: 'X座標',
      description: '東西方向の位置',
    })
  ),
  y: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-64), // 世界底面
    Schema.lessThanOrEqualTo(320), // 世界上限
    Schema.annotations({
      identifier: 'Y座標',
      description: '高度（上下方向）',
    })
  ),
  z: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-30_000_000), // 南北境界
    Schema.lessThanOrEqualTo(30_000_000),
    Schema.annotations({
      identifier: 'Z座標',
      description: '南北方向の位置',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Position',
    title: '3D座標',
    description: 'Minecraft世界内の有効な3次元座標',
  })
)

export type Position = Schema.Schema.Type<typeof Position>

// ✅ 座標計算の純粋関数群
export const PositionOps = {
  // 距離計算
  distance: (pos1: Position, pos2: Position): number =>
    Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2)),

  // 隣接座標取得
  getAdjacent: (pos: Position, direction: Direction): Position => {
    const directions = {
      north: { x: 0, y: 0, z: -1 },
      south: { x: 0, y: 0, z: 1 },
      east: { x: 1, y: 0, z: 0 },
      west: { x: -1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      down: { x: 0, y: -1, z: 0 },
    } as const

    const offset = directions[direction]
    return {
      x: pos.x + offset.x,
      y: pos.y + offset.y,
      z: pos.z + offset.z,
    }
  },

  // チャンク座標への変換
  toChunkCoordinate: (pos: Position): ChunkCoordinate => ({
    x: Math.floor(pos.x / 16),
    z: Math.floor(pos.z / 16),
  }),

  // ワールド座標内での有効性チェック
  isValid: (pos: Position): boolean =>
    pos.x >= -30_000_000 &&
    pos.x <= 30_000_000 &&
    pos.y >= -64 &&
    pos.y <= 320 &&
    pos.z >= -30_000_000 &&
    pos.z <= 30_000_000,
} as const
// [/LIVE_EXAMPLE]
```

### 2.2 Direction と ChunkCoordinate

```typescript
// [LIVE_EXAMPLE: direction-chunk-coordinate]
// 🧭 Direction - 6方向の型安全定義
export const Direction = Schema.Literal('north', 'south', 'east', 'west', 'up', 'down')
export type Direction = Schema.Schema.Type<typeof Direction>

// 🗺️ ChunkCoordinate - チャンクレベルでの位置管理
export const ChunkCoordinate = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(
  Schema.annotations({
    identifier: 'ChunkCoordinate',
    title: 'チャンク座標',
    description: '16x16ブロック単位での区画座標',
  })
)
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// ✅ ChunkCoordinateの操作関数群
export const ChunkOps = {
  // チャンクIDの生成
  toId: (coord: ChunkCoordinate): ChunkId => `chunk_${coord.x}_${coord.z}` as ChunkId,

  // 隣接チャンク取得
  getAdjacent: (coord: ChunkCoordinate, direction: 'north' | 'south' | 'east' | 'west'): ChunkCoordinate => {
    const offsets = {
      north: { x: 0, z: -1 },
      south: { x: 0, z: 1 },
      east: { x: 1, z: 0 },
      west: { x: -1, z: 0 },
    } as const

    const offset = offsets[direction]
    return {
      x: coord.x + offset.x,
      z: coord.z + offset.z,
    }
  },

  // チャンク内座標への変換
  toLocalPosition: (worldPos: Position): LocalPosition => ({
    x: ((worldPos.x % 16) + 16) % 16,
    y: worldPos.y,
    z: ((worldPos.z % 16) + 16) % 16,
  }),
} as const
// [/LIVE_EXAMPLE]
```

## 3. Brand Types による型安全な識別子

### 3.1 ゲームエンティティのID管理

```typescript
// [LIVE_EXAMPLE: brand-types-ids]
// 🏷️ Brand Types - 型レベルでの識別子安全性
import { Schema, Brand } from 'effect'

// ✅ 各種IDのBrand型定義 - より詳細な制約付き
export const PlayerId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    identifier: 'PlayerId',
    title: 'プレイヤー識別子',
    description: 'UUID v4形式のプレイヤー固有ID - ランタイム検証付き',
    examples: ['550e8400-e29b-41d4-a716-446655440000'],
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

// ✅ 安全なPlayerId生成関数
export const createPlayerId = (): PlayerId => {
  const uuid = crypto.randomUUID()
  return Schema.decodeSync(PlayerId)(uuid)
}

export const BlockId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z][a-z0-9_]*$/), // より厳密：先頭は文字、その後は文字・数字・アンダースコア
  Schema.maxLength(32), // 実用的な上限
  Schema.brand('BlockId'),
  Schema.annotations({
    identifier: 'BlockId',
    title: 'ブロック識別子',
    description: '小文字とアンダースコアのみのブロック種別ID（minecraft:stone形式対応）',
    examples: ['stone', 'grass_block', 'oak_wood', 'redstone_ore'],
  })
)
export type BlockId = Schema.Schema.Type<typeof BlockId>

// ✅ Minecraftスタイルのブロック名正規化
export const normalizeBlockId = (name: string): Effect.Effect<BlockId, Schema.ParseError> =>
  Schema.decodeUnknown(BlockId)(name.toLowerCase().replace(/[^a-z0-9_]/g, '_'))

export const ChunkId = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    identifier: 'ChunkId',
    title: 'チャンク識別子',
    description: 'chunk_x_z形式のチャンク座標ID（例: chunk_10_-5）',
    examples: ['chunk_0_0', 'chunk_10_-5', 'chunk_-100_200'],
  })
)
export type ChunkId = Schema.Schema.Type<typeof ChunkId>

// ✅ チャンクIDの構造化パース
export const parseChunkId = (chunkId: ChunkId): Option.Option<ChunkCoordinate> =>
  Option.fromNullable(chunkId.match(/^chunk_(-?\d+)_(-?\d+)$/)).pipe(
    Option.flatMap(([, x, z]) =>
      Option.all([
        Option.fromNullable(x),
        Option.fromNullable(z)
      ]).pipe(
        Option.map(([xStr, zStr]) => ({
          x: parseInt(xStr, 10),
          z: parseInt(zStr, 10),
        } as ChunkCoordinate))
      )
    )
  )

export const ItemId = Schema.String.pipe(
  Schema.pattern(/^[a-z_]+$/),
  Schema.brand('ItemId'),
  Schema.annotations({
    identifier: 'ItemId',
    title: 'アイテム識別子',
    description: '小文字とアンダースコアのみのアイテム種別ID',
  })
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

// ✅ ID生成・バリデーション関数群 - 型安全なファクトリーパターン
export const IdOps = {
  // プレイヤーID生成（安全な生成関数）
  generatePlayerId: (): PlayerId => createPlayerId(),

  // ブロックIDバリデーション
  validateBlockId: (id: string): Effect.Effect<BlockId, Schema.ParseError> =>
    Schema.decodeUnknown(BlockId)(id),

  // チャンクID生成（型安全）
  createChunkId: (x: number, z: number): ChunkId => {
    const id = `chunk_${x}_${z}`
    return Schema.decodeSync(ChunkId)(id) // 実行時検証付き
  },

  // 座標からチャンクIDへの変換
  coordsToChunkId: (coords: ChunkCoordinate): ChunkId =>
    IdOps.createChunkId(coords.x, coords.z),

  // アイテムIDの正規化
  normalizeItemId: (rawId: string): Effect.Effect<ItemId, Schema.ParseError> =>
    Schema.decodeUnknown(ItemId)(rawId.toLowerCase().replace(/[^a-z0-9_]/g, '_')),

  // 複数IDの一括バリデーション
  validateIds: <T extends string>(
    schema: Schema.Schema<T>,
    ids: string[]
  ): Effect.Effect<T[], Schema.ParseError[]> =>
    Effect.all(ids.map(id => Schema.decodeUnknown(schema)(id))),
} as const
// [/LIVE_EXAMPLE]
```

### 3.2 ゲーム固有値オブジェクト

```typescript
// [LIVE_EXAMPLE: game-value-objects]
// 💎 Minecraft固有のValue Objects
export const Health = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(20),
  Schema.brand('Health'),
  Schema.annotations({
    identifier: 'Health',
    title: '体力値',
    description: '0-20の整数値での体力表現',
  })
)
export type Health = Schema.Schema.Type<typeof Health>

export const LightLevel = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(15),
  Schema.brand('LightLevel'),
  Schema.annotations({
    identifier: 'LightLevel',
    title: '光レベル',
    description: '0-15での光源強度表現',
  })
)
export type LightLevel = Schema.Schema.Type<typeof LightLevel>

export const Hardness = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Hardness'),
  Schema.annotations({
    identifier: 'Hardness',
    title: '硬度値',
    description: 'ブロックの破壊しやすさ（数値が高いほど硬い）',
  })
)
export type Hardness = Schema.Schema.Type<typeof Hardness>

export const GameTime = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('GameTime'),
  Schema.annotations({
    identifier: 'GameTime',
    title: 'ゲーム内時間',
    description: 'ゲーム開始からのtick数（20tick=1秒）',
  })
)
export type GameTime = Schema.Schema.Type<typeof GameTime>
// [/LIVE_EXAMPLE]
```

## 4. Core Entity の実装

### 4.1 Block Entity

```typescript
// [LIVE_EXAMPLE: block-entity]
// 🧱 Block - ワールドの基本構成要素
export const BlockType = Schema.Union(
  Schema.Literal('air'),
  Schema.Literal('stone'),
  Schema.Literal('dirt'),
  Schema.Literal('grass_block'),
  Schema.Literal('wood'),
  Schema.Literal('leaves'),
  Schema.Literal('water'),
  Schema.Literal('sand'),
  Schema.Literal('bedrock')
)
export type BlockType = Schema.Schema.Type<typeof BlockType>

export const BlockMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
})
export type BlockMetadata = Schema.Schema.Type<typeof BlockMetadata>

export const Block = Schema.Struct({
  id: BlockId,
  type: BlockType,
  hardness: Hardness,
  lightLevel: LightLevel,
  transparent: Schema.Boolean,
  metadata: Schema.optional(BlockMetadata),
}).pipe(
  Schema.annotations({
    identifier: 'Block',
    title: 'ブロック',
    description: 'ワールドを構成する基本的な立方体要素',
  })
)
export type Block = Schema.Schema.Type<typeof Block>

// ✅ ブロック関連の純粋関数群
export const BlockOps = {
  // 空ブロックの作成
  createAir: (): Block => ({
    id: 'air' as BlockId,
    type: 'air',
    hardness: 0 as Hardness,
    lightLevel: 15 as LightLevel,
    transparent: true,
  }),

  // 基本ブロックの作成
  createStone: (): Block => ({
    id: 'stone' as BlockId,
    type: 'stone',
    hardness: 1.5 as Hardness,
    lightLevel: 0 as LightLevel,
    transparent: false,
  }),

  // ブロック破壊可否判定
  canBreak: (block: Block): boolean => block.type !== 'bedrock',

  // 光透過性判定
  isTransparent: (block: Block): boolean => block.transparent,

  // ドロップアイテム計算
  getDrops: (block: Block): ItemId[] => {
    const dropTable: Record<BlockType, ItemId[]> = {
      air: [],
      stone: ['stone' as ItemId],
      dirt: ['dirt' as ItemId],
      grass_block: ['dirt' as ItemId],
      wood: ['wood' as ItemId],
      leaves: [], // 確率でサンプリングやアイテムドロップ
      water: [],
      sand: ['sand' as ItemId],
      bedrock: [], // 破壊不可
    }

    return dropTable[block.type] || []
  },
} as const
// [/LIVE_EXAMPLE]
```

### 4.2 Player Entity

```typescript
// [LIVE_EXAMPLE: player-entity]
// 👤 Player - ゲームプレイヤーの状態管理
export const GameMode = Schema.Union(
  Schema.Literal("survival"),
  Schema.Literal("creative"),
  Schema.Literal("adventure"),
  Schema.Literal("spectator")
);
export type GameMode = Schema.Schema.Type<typeof GameMode>;

export const InventorySlot = Schema.Struct({
  itemId: Schema.optional(ItemId),
  quantity: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(64)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
export type InventorySlot = Schema.Schema.Type<typeof InventorySlot>;

export const Inventory = Schema.Struct({
  hotbar: Schema.Tuple(
    InventorySlot, InventorySlot, InventorySlot, InventorySlot, InventorySlot,
    InventorySlot, InventorySlot, InventorySlot, InventorySlot // 9スロット
  ),
  main: Schema.Array(InventorySlot).pipe(Schema.maxItems(27)), // 27スロット
  selectedSlot: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(8))
});
export type Inventory = Schema.Schema.Type<typeof Inventory>;

export const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Position,
  health: Health,
  gameMode: GameMode,
  inventory: Inventory,
  isOnGround: Schema.Boolean,
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  lastUpdated: Schema.String.pipe(Schema.brand("ISO8601DateTime"))
}).pipe(
  Schema.annotations({
    identifier: "Player",
    title: "プレイヤー",
    description: "ゲーム内のプレイヤーエンティティ"
  })
);
export type Player = Schema.Schema.Type<typeof Player>;

// ✅ プレイヤー関連操作関数
export const PlayerOps = {
  // 新規プレイヤー作成
  create: (name: string, spawnPosition: Position = { x: 0, y: 64, z: 0 }): Player => ({
    id: IdOps.generatePlayerId(),
    name,
    position: spawnPosition,
    health: 20 as Health,
    gameMode: "survival",
    inventory: createEmptyInventory(),
    isOnGround: true,
    velocity: { x: 0, y: 0, z: 0 },
    lastUpdated: new Date().toISOString() as Schema.Schema.Type<typeof Schema.String.pipe(Schema.brand("ISO8601DateTime"))>
  }),

  // プレイヤー移動
  move: (player: Player, newPosition: Position): Player => ({
    ...player,
    position: newPosition,
    lastUpdated: new Date().toISOString() as Schema.Schema.Type<typeof Schema.String.pipe(Schema.brand("ISO8601DateTime"))>
  }),

  // ダメージ処理
  damage: (player: Player, amount: number): Player => {
    const newHealth = Math.max(0, player.health - amount) as Health;
    return {
      ...player,
      health: newHealth,
      lastUpdated: new Date().toISOString() as Schema.Schema.Type<typeof Schema.String.pipe(Schema.brand("ISO8601DateTime"))>
    };
  },

  // 生存判定
  isAlive: (player: Player): boolean => player.health > 0
} as const;

// ヘルパー関数
const createEmptyInventory = (): Inventory => ({
  hotbar: Array(9).fill({ quantity: 0 }) as any,
  main: Array(27).fill({ quantity: 0 }),
  selectedSlot: 0
});
// [/LIVE_EXAMPLE]
```

## 5. Domain Errors の定義

### 5.1 Schema.TaggedError による型安全エラー

```typescript
// [LIVE_EXAMPLE: domain-errors]
// ❌ Domain層のエラー定義 - 型安全なエラーハンドリング
import { Schema } from 'effect'

export const PositionError = Schema.TaggedError('PositionError')({
  cause: Schema.Union(
    Schema.Literal('OutOfBounds'),
    Schema.Literal('InvalidCoordinate'),
    Schema.Literal('ChunkNotLoaded')
  ),
  position: Schema.optional(Position),
  message: Schema.String,
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type PositionError = Schema.Schema.Type<typeof PositionError>

export const BlockError = Schema.TaggedError('BlockError')({
  cause: Schema.Union(
    Schema.Literal('NotFound'),
    Schema.Literal('InvalidType'),
    Schema.Literal('CannotBreak'),
    Schema.Literal('AlreadyExists')
  ),
  blockId: Schema.optional(BlockId),
  position: Schema.optional(Position),
  message: Schema.String,
})
export type BlockError = Schema.Schema.Type<typeof BlockError>

export const PlayerError = Schema.TaggedError('PlayerError')({
  cause: Schema.Union(
    Schema.Literal('NotFound'),
    Schema.Literal('InvalidMove'),
    Schema.Literal('InsufficientHealth'),
    Schema.Literal('InventoryFull'),
    Schema.Literal('InvalidGameMode')
  ),
  playerId: Schema.optional(PlayerId),
  message: Schema.String,
  additionalInfo: Schema.optional(Schema.Unknown),
})
export type PlayerError = Schema.Schema.Type<typeof PlayerError>

export const WorldError = Schema.TaggedError('WorldError')({
  cause: Schema.Union(
    Schema.Literal('ChunkNotFound'),
    Schema.Literal('GenerationFailed'),
    Schema.Literal('SaveFailed'),
    Schema.Literal('LoadFailed'),
    Schema.Literal('CorruptedData')
  ),
  coordinate: Schema.optional(ChunkCoordinate),
  chunkId: Schema.optional(ChunkId),
  message: Schema.String,
})
export type WorldError = Schema.Schema.Type<typeof WorldError>

// ✅ エラー作成ヘルパー関数
export const ErrorFactories = {
  positionOutOfBounds: (position: Position): PositionError => ({
    _tag: 'PositionError',
    cause: 'OutOfBounds',
    position,
    message: `座標 (${position.x}, ${position.y}, ${position.z}) は有効範囲外です`,
  }),

  blockNotFound: (position: Position): BlockError => ({
    _tag: 'BlockError',
    cause: 'NotFound',
    position,
    message: `位置 (${position.x}, ${position.y}, ${position.z}) にブロックが見つかりません`,
  }),

  playerNotFound: (playerId: PlayerId): PlayerError => ({
    _tag: 'PlayerError',
    cause: 'NotFound',
    playerId,
    message: `プレイヤー ${playerId} が見つかりません`,
  }),

  chunkGenerationFailed: (coordinate: ChunkCoordinate): WorldError => ({
    _tag: 'WorldError',
    cause: 'GenerationFailed',
    coordinate,
    chunkId: ChunkOps.toId(coordinate),
    message: `チャンク (${coordinate.x}, ${coordinate.z}) の生成に失敗しました`,
  }),
} as const
// [/LIVE_EXAMPLE]
```

## 6. Domain Services の基礎

### 6.1 CollisionDetection Service

```typescript
// [LIVE_EXAMPLE: collision-detection-service]
// 🎯 CollisionDetection - 衝突判定ドメインサービス
export interface CollisionDetection {
  readonly checkBlockCollision: (position: Position, block: Block) => boolean
  readonly checkPlayerMovement: (player: Player, newPosition: Position, worldBlocks: Block[][][]) => boolean
  readonly getCollidingBlocks: (
    position: Position,
    size: { width: number; height: number; depth: number }
  ) => Position[]
}

// ✅ 衝突判定の純粋関数実装
export const CollisionDetectionOps = {
  // ブロック境界との衝突判定
  checkBlockCollision: (position: Position, block: Block): boolean => {
    if (block.type === 'air') return false

    // プレイヤーのバウンディングボックス (0.8 x 1.8 x 0.8)
    const playerBounds = {
      minX: position.x - 0.4,
      maxX: position.x + 0.4,
      minY: position.y,
      maxY: position.y + 1.8,
      minZ: position.z - 0.4,
      maxZ: position.z + 0.4,
    }

    // ブロックのバウンディングボックス (1 x 1 x 1)
    const blockPos = PositionOps.toChunkCoordinate(position)
    const blockBounds = {
      minX: blockPos.x,
      maxX: blockPos.x + 1,
      minY: position.y,
      maxY: position.y + 1,
      minZ: blockPos.z,
      maxZ: blockPos.z + 1,
    }

    // AABB (Axis-Aligned Bounding Box) 衝突判定
    return !(
      playerBounds.maxX <= blockBounds.minX ||
      playerBounds.minX >= blockBounds.maxX ||
      playerBounds.maxY <= blockBounds.minY ||
      playerBounds.minY >= blockBounds.maxY ||
      playerBounds.maxZ <= blockBounds.minZ ||
      playerBounds.minZ >= blockBounds.maxZ
    )
  },

  // プレイヤー移動可能性判定
  checkPlayerMovement: (player: Player, newPosition: Position, getBlock: (pos: Position) => Block | null): boolean => {
    // プレイヤーが占める空間のブロック位置を計算
    const checkPositions = [
      newPosition,
      { ...newPosition, y: newPosition.y + 1 }, // 頭部分
      { ...newPosition, x: newPosition.x + 0.4, z: newPosition.z + 0.4 }, // 四隅
      { ...newPosition, x: newPosition.x - 0.4, z: newPosition.z + 0.4 },
      { ...newPosition, x: newPosition.x + 0.4, z: newPosition.z - 0.4 },
      { ...newPosition, x: newPosition.x - 0.4, z: newPosition.z - 0.4 },
    ]

    // すべての位置で衝突チェック
    return checkPositions.every((pos) => {
      const block = getBlock(pos)
      return !block || block.type === 'air' || block.transparent
    })
  },

  // 重力・落下判定
  calculateGravity: (player: Player, getBlock: (pos: Position) => Block | null): Player => {
    const groundPosition = { ...player.position, y: player.position.y - 0.1 }
    const groundBlock = getBlock(groundPosition)

    const isOnGround = groundBlock && groundBlock.type !== 'air' && !groundBlock.transparent

    if (!isOnGround && player.velocity.y >= -10) {
      // 最大落下速度制限
      return {
        ...player,
        velocity: {
          ...player.velocity,
          y: player.velocity.y - 0.08, // 重力加速度
        },
        isOnGround: false,
      }
    }

    return {
      ...player,
      velocity: { ...player.velocity, y: 0 },
      isOnGround: true,
    }
  },
} as const
// [/LIVE_EXAMPLE]
```

## 7. 実践演習

### 7.1 コンポーネント統合テスト

```typescript
// [LIVE_EXAMPLE: integration-test]
// 🧪 基本コンポーネントの統合動作確認
import { Effect, Console } from 'effect'

// ✅ 実践演習: Minecraft基本操作のシミュレーション
const minecraftBasicSimulation = Effect.gen(function* () {
  yield* Console.log('=== Minecraft Basic Components Demo ===')

  // 1. プレイヤー作成
  const player = PlayerOps.create('Steve', { x: 0, y: 64, z: 0 })
  yield* Console.log(
    `✅ プレイヤー作成: ${player.name} at (${player.position.x}, ${player.position.y}, ${player.position.z})`
  )

  // 2. ワールドブロック配置
  const stoneBlock = BlockOps.createStone()
  const airBlock = BlockOps.createAir()
  yield* Console.log(`✅ ブロック作成: ${stoneBlock.type} (硬度: ${stoneBlock.hardness})`)

  // 3. プレイヤー移動テスト
  const newPosition = { x: 1, y: 64, z: 0 }
  const movedPlayer = PlayerOps.move(player, newPosition)
  yield* Console.log(
    `✅ プレイヤー移動: (${movedPlayer.position.x}, ${movedPlayer.position.y}, ${movedPlayer.position.z})`
  )

  // 4. 衝突判定テスト
  const mockGetBlock = (pos: Position) => (pos.y < 64 ? stoneBlock : airBlock)
  const canMove = CollisionDetectionOps.checkPlayerMovement(player, { x: 0, y: 63, z: 0 }, mockGetBlock)
  yield* Console.log(`✅ 衝突判定: ${canMove ? '移動可能' : '移動不可'}`)

  // 5. エラーハンドリングテスト
  const invalidPosition = { x: 40_000_000, y: 500, z: 0 }
  if (!PositionOps.isValid(invalidPosition)) {
    const error = ErrorFactories.positionOutOfBounds(invalidPosition)
    yield* Console.log(`✅ エラーハンドリング: ${error.message}`)
  }

  yield* Console.log('=== Demo Complete! ===')
})

// 🚀 実行例（実際のプロジェクトで試してください）
// Effect.runSync(minecraftBasicSimulation);
// [/LIVE_EXAMPLE]
```

## 関連ドキュメント

### 📚 Effect-TS基礎学習

- **[Effect-TS型システム](../effect-ts-fundamentals/effect-ts-type-system.md)** - Brand型とSchemaの詳細パターン
- **[Effect-TSパターン集](../effect-ts-fundamentals/effect-ts-patterns.md)** - Layer構成、Service設計の実践的パターン
- **[Effect-TSエラーハンドリング](../effect-ts-fundamentals/effect-ts-error-handling.md)** - Schema.TaggedErrorと構造化エラー
- **[Effect-TSテスト](../effect-ts-fundamentals/effect-ts-testing.md)** - Domain層のテスト戦略

### 🏗️ 設計・実装指針

- **[型安全性パターン](../design-patterns/type-safety-patterns.md)** - Brand型とドメインモデリングのベストプラクティス
- **[ドメインレイヤー設計](./domain-layer-architecture.md)** - Clean ArchitectureでのDomain層責務
- **[アーキテクチャ原則](../../explanations/architecture/README.md)** - 全体設計思想とパターン

### 💡 実装のヒント

> **Brand型の適用指針**: 異なる概念のIDや値オブジェクトには必ずBrand型を使用することで、型レベルでの混同を防ぐ
>
> **Schema.decodeSync vs Schema.decode**: 既知の安全なデータには`decodeSync`、外部入力には`decode`（Effect）を使用
>
> **Option型の活用**: チャンクIDのパース例のように、失敗の可能性がある処理にはOption型を積極活用

## まとめ

このモジュールで学習した基本コンポーネントの設計パターン：

### ✅ 習得したスキル

1. **Schema.Struct による型安全なデータモデリング**
   - 実行時バリデーション付きの厳密な型定義
   - Minecraft固有の制約（座標範囲、値範囲）の実装

2. **Brand Types による識別子安全性**
   - コンパイル時での型誤用防止
   - ドメイン固有IDの型安全管理

3. **Value Objects と Entity の区別**
   - 不変なValue Objects（Position、Direction）
   - 識別可能なEntity（Player、Block）

4. **Schema.TaggedError による型安全エラーハンドリング**
   - ドメイン固有エラーの明示的定義
   - エラー原因の構造化

5. **Pure Functions によるビジネスロジック**
   - 副作用のないドメインサービス
   - テストしやすい関数設計

### 🎯 学習成果確認

- [ ] Position、Direction、ChunkCoordinateの作成・操作
- [ ] Brand Types による型安全なID管理
- [ ] Player、Blockエンティティの作成・更新
- [ ] Domain固有エラーの適切な定義・使用
- [ ] 衝突判定などのドメインロジック実装

### 🚀 Next Steps

次のモジュールでは、これらの基本コンポーネントを活用したEffect-TSサービス層の実装を学習します。

> 🔗 **Continue Learning**: [Effect サービス実装](./03-effect-services.md) - Context.GenericTag、Layer、依存性注入

---

**⏱️ Completion Time**: 25分 | **🎯 Progress**: 55/165分（33%）完了

**📊 Learning Effectiveness**: 高度な型安全性とドメイン駆動設計の基礎が確立されました。
