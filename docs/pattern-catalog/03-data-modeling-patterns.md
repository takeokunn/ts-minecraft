---
title: "Data Modeling Patterns"
category: "Pattern Catalog"
complexity: "intermediate"
dependencies:
  - "@effect/schema"
  - "effect"
ai_tags:
  - "schema-design"
  - "data-validation"
  - "type-safety"
implementation_time: "1-2 hours"
skill_level: "intermediate"
last_pattern_update: "2025-09-14"
---

# Data Modeling Patterns

Effect-TSのSchema.Structを使用したデータモデリングのベストプラクティス集

## Pattern 1: Basic Struct Definition

**使用場面**: 基本的なデータ構造の定義

**実装**:
```typescript
import { Schema } from "effect"

export const BlockPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export type BlockPosition = typeof BlockPosition.Type

// 使用例
const position: BlockPosition = { x: 10, y: 64, z: -5 }
```

**ポイント**:
- `typeof Schema.Type`で型を取得
- 実行時バリデーションと型安全性の両立
- シンプルで読みやすい構造

## Pattern 2: Nested Structures

**使用場面**: 複雑な階層データ構造

**実装**:
```typescript
export const Block = Schema.Struct({
  position: BlockPosition,
  material: Schema.Literal("stone", "dirt", "grass", "water"),
  metadata: Schema.Struct({
    hardness: Schema.Number,
    luminance: Schema.Number,
    transparency: Schema.Boolean
  })
})

export type Block = typeof Block.Type

// バリデーション付きファクトリ関数
export const createBlock = (data: unknown) =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(Block)(data)
  })
```

## Pattern 3: Union Types with Discriminated Unions

**使用場面**: タイプ別の異なるデータ構造

**実装**:
```typescript
export const EntityType = Schema.Literal("player", "mob", "item")

export const Player = Schema.Struct({
  type: Schema.Literal("player"),
  id: Schema.String,
  position: BlockPosition,
  health: Schema.Number,
  inventory: Schema.Array(Schema.String)
})

export const Mob = Schema.Struct({
  type: Schema.Literal("mob"),
  id: Schema.String,
  position: BlockPosition,
  mobType: Schema.Literal("zombie", "skeleton", "creeper"),
  health: Schema.Number
})

export const ItemEntity = Schema.Struct({
  type: Schema.Literal("item"),
  id: Schema.String,
  position: BlockPosition,
  itemType: Schema.String,
  quantity: Schema.Number
})

export const Entity = Schema.Union(Player, Mob, ItemEntity)
export type Entity = typeof Entity.Type

// パターンマッチング
export const processEntity = (entity: Entity) =>
  Match.value(entity).pipe(
    Match.when({ type: "player" }, (player) =>
      Effect.log(`Processing player: ${player.id}`)
    ),
    Match.when({ type: "mob" }, (mob) =>
      Effect.log(`Processing mob: ${mob.mobType}`)
    ),
    Match.when({ type: "item" }, (item) =>
      Effect.log(`Processing item: ${item.itemType}`)
    ),
    Match.exhaustive
  )
```

## Pattern 4: Optional and Default Values

**使用場面**: オプショナルフィールドやデフォルト値を持つデータ

**実装**:
```typescript
export const ChunkData = Schema.Struct({
  coordinate: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number
  }),
  blocks: Schema.Array(Block),
  entities: Schema.optional(Schema.Array(Entity), () => []),
  lastModified: Schema.optional(Schema.DateFromSelf, () => new Date()),
  compressed: Schema.optional(Schema.Boolean, () => false)
})

export type ChunkData = typeof ChunkData.Type

// ファクトリ関数でデフォルト値を適用
export const createChunk = (
  coordinate: { x: number; z: number },
  blocks: Block[]
) =>
  Effect.gen(function* () {
    const chunkData = {
      coordinate,
      blocks,
      // optionalフィールドは自動的にデフォルト値が適用される
    }

    return yield* Schema.decodeUnknown(ChunkData)(chunkData)
  })
```

## Pattern 5: Transformation and Validation

**使用場面**: 入力データの変換と検証

**実装**:
```typescript
// 座標の範囲検証
export const ValidatedPosition = BlockPosition.pipe(
  Schema.filter((pos) => {
    const { x, y, z } = pos
    return x >= -30000000 && x <= 30000000 &&
           y >= 0 && y <= 256 &&
           z >= -30000000 && z <= 30000000
  }, {
    message: () => "Position out of world bounds"
  })
)

// 文字列からの変換
export const CoordinateFromString = Schema.Struct({
  input: Schema.String
}).pipe(
  Schema.transform(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number
    }),
    {
      decode: ({ input }) => {
        const [x, y, z] = input.split(",").map(Number)
        return { x, y, z }
      },
      encode: ({ x, y, z }) => ({ input: `${x},${y},${z}` })
    }
  )
)

// 使用例
export const parseCoordinate = (input: string) =>
  Effect.gen(function* () {
    const coord = yield* Schema.decodeUnknown(CoordinateFromString)({ input })
    return yield* Schema.decodeUnknown(ValidatedPosition)(coord)
  })
```

## Pattern 6: Recursive Structures

**使用場面**: 再帰的なデータ構造（ツリー構造など）

**実装**:
```typescript
export interface TreeNode extends Schema.Schema.Type<typeof TreeNode> {}

export const TreeNode: Schema.Schema<TreeNode> = Schema.Struct({
  value: Schema.String,
  children: Schema.optional(
    Schema.Array(Schema.suspend(() => TreeNode)),
    () => []
  )
})

// 使用例: ディレクトリ構造
export const DirectoryNode = Schema.Struct({
  name: Schema.String,
  type: Schema.Literal("file", "directory"),
  children: Schema.optional(
    Schema.Array(Schema.suspend(() => DirectoryNode)),
    () => []
  )
})

export type DirectoryNode = typeof DirectoryNode.Type
```

## Pattern 7: Brand Types for Type Safety

**使用場面**: 同じ基底型だが意味が異なる値の区別

**実装**:
```typescript
// ブランド型の定義
export const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
export type PlayerId = typeof PlayerId.Type

export const ChunkId = Schema.String.pipe(Schema.brand("ChunkId"))
export type ChunkId = typeof ChunkId.Type

export const BlockId = Schema.String.pipe(Schema.brand("BlockId"))
export type BlockId = typeof BlockId.Type

// 使用例
export const PlayerService = Context.GenericTag<{
  readonly findPlayer: (id: PlayerId) => Effect.Effect<Option.Option<Player>, PlayerNotFoundError>
  readonly movePlayer: (id: PlayerId, newPosition: BlockPosition) => Effect.Effect<void, PlayerMoveError>
}>("@minecraft/PlayerService")

// ファクトリ関数
export const createPlayerId = (id: string): Effect.Effect<PlayerId, ValidationError> =>
  Schema.decodeUnknown(PlayerId)(id)
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Plain Objects without Schema

```typescript
// これは避ける
interface Position {
  x: number
  y: number
  z: number
}

const createPosition = (x: number, y: number, z: number): Position => ({ x, y, z })
```

### ❌ Anti-Pattern 2: Manual Validation

```typescript
// これも避ける
const validateBlock = (data: any): Block | null => {
  if (typeof data.x !== 'number') return null
  if (typeof data.y !== 'number') return null
  // ... 手動検証
  return data as Block
}
```

### ✅ Always Use: Schema.Struct + Effect

```typescript
const Block = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const createBlock = (data: unknown) =>
  Schema.decodeUnknown(Block)(data)
```

## Performance Considerations

### 1. Schema Compilation

```typescript
// 頻繁に使用するスキーマは事前にコンパイル
const decodeBlock = Schema.decodeUnknown(Block)
const encodeBlock = Schema.encodeUnknown(Block)

// 大量データ処理時
export const processBulkBlocks = (data: unknown[]) =>
  Effect.all(data.map(decodeBlock), { concurrency: 10 })
```

### 2. Lazy Schema Loading

```typescript
// 大きなスキーマは遅延ロード
export const ComplexSchema = Schema.suspend(() =>
  Schema.Struct({
    // 複雑なフィールド定義
  })
)
```

### 3. Caching Parsed Results

```typescript
export const CachedSchemaService = Context.GenericTag<{
  readonly parseAndCache: <A>(schema: Schema.Schema<A>, key: string, data: unknown) => Effect.Effect<A, ParseError>
}>("@minecraft/CachedSchemaService")
```

## 統合パターン

Schema.Structで定義したデータモデルを他のEffect-TSパターンと組み合わせる方法：

```typescript
// サービス + データモデル
export const BlockService = Context.GenericTag<{
  readonly getBlock: (position: BlockPosition) => Effect.Effect<Option.Option<Block>, BlockAccessError>
  readonly setBlock: (position: BlockPosition, block: Block) => Effect.Effect<void, BlockUpdateError>
}>("@minecraft/BlockService")

// エラー + データモデル
export class BlockNotFoundError extends Schema.TaggedError("BlockNotFoundError")<{
  readonly position: BlockPosition
  readonly timestamp: number
}> {}

// 統合使用例
export const updateBlockMaterial = (
  position: BlockPosition,
  newMaterial: Block["material"]
) =>
  Effect.gen(function* () {
    const blockService = yield* BlockService
    const currentBlock = yield* blockService.getBlock(position)

    if (Option.isNone(currentBlock)) {
      return yield* Effect.fail(new BlockNotFoundError({
        position,
        timestamp: Date.now()
      }))
    }

    const updatedBlock = { ...currentBlock.value, material: newMaterial }
    yield* blockService.setBlock(position, updatedBlock)
  })
```