---
title: "主要概念チュートリアル"
description: "TypeScript Minecraftの主要概念を学ぶための段階的なチュートリアル"
category: "tutorial"
difficulty: "beginner"
tags: ["tutorial", "concepts", "getting-started", "learning-path"]
prerequisites: ["typescript-basics"]
estimated_reading_time: "20分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# 主要概念チュートリアル

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [クイックスタート](./README.md) → **主要概念**
>
> **🎯 学習目標**: プロジェクトの主要概念を理解し、実装できるようになる
>
> **⏱️ 所要時間**: 20分
>
> **📚 前提知識**: TypeScript基礎

### 📋 学習パス
1. **現在**: 主要概念の理解
2. **次**: [5分デモ](./01-5min-demo.md) - 実際に動かしてみる
3. **その後**: [開発ワークフロー](./03-development-workflow.md) - 開発の進め方

---

## 1. Effect-TS: 副作用の管理

### ステップ1: 基本的なEffect

```typescript
import { Effect } from "effect"

// 従来の方法（副作用が隠れている）
function loadChunk(x: number, z: number): Chunk {
  const data = fs.readFileSync(`chunk_${x}_${z}.dat`) // 隠れたI/O
  return JSON.parse(data) // エラーの可能性
}

// Effect-TSを使った方法（副作用が明示的）
const loadChunkEffect = (x: number, z: number): Effect.Effect<Chunk, ChunkError> =>
  Effect.gen(function* () {
    // 各ステップが明示的
    const path = `chunk_${x}_${z}.dat`
    const data = yield* readFile(path)  // I/Oエフェクト
    const chunk = yield* parseChunk(data) // パースエフェクト
    return chunk
  })
```

**学習ポイント**: Effect型により、関数が何をするか（副作用）が型から明確になります。

### ステップ2: エラー処理

```typescript
// エラーを型で表現 (関数型パターン)
const ChunkNotFoundError = Schema.TaggedError("ChunkNotFoundError")({
  x: Schema.Number,
  z: Schema.Number
})

// エラー処理の合成
const loadOrGenerate = (x: number, z: number) =>
  pipe(
    loadChunkEffect(x, z),
    Effect.catchTag("ChunkNotFoundError", () =>
      generateNewChunk(x, z) // フォールバック
    )
  )
```

**練習問題**: ファイル読み込みエラーとパースエラーを別々に処理するようにコードを拡張してみましょう。

## 2. ECS (Entity Component System)

### ステップ1: コンポーネントの定義

```typescript
// データ構造としてのコンポーネント
const PositionComponent = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const HealthComponent = Schema.Struct({
  current: Schema.Number,
  max: Schema.Number
})

// エンティティ = ID + コンポーネントの集合
interface Entity {
  id: string
  components: Map<string, any>
}
```

### ステップ2: システムの作成

```typescript
// システム = コンポーネントを処理する純粋関数
const damageSystem = (entities: Entity[], damage: number): Entity[] =>
  entities.map(entity => {
    const health = entity.components.get("Health")
    if (!health) return entity

    return {
      ...entity,
      components: new Map([
        ...entity.components,
        ["Health", {
          ...health,
          current: Math.max(0, health.current - damage)
        }]
      ])
    }
  })
```

**実践演習**:
1. `MovementSystem`を実装してください（Position + Velocityコンポーネント）
2. 結果を検証するテストを書いてください

## 3. Schema駆動開発

### ステップ1: データモデルの定義

```typescript
import { Schema } from "effect"

// スキーマ = 型 + バリデーション + エンコード/デコード
const BlockSchema = Schema.Struct({
  type: Schema.Literal("stone", "dirt", "grass"),
  hardness: Schema.Number.pipe(Schema.between(0, 10)),
  position: Schema.Struct({
    x: Schema.Int,
    y: Schema.Int.pipe(Schema.between(0, 384)),
    z: Schema.Int
  })
})

// 型の自動導出
type Block = typeof BlockSchema.Type
```

### ステップ2: バリデーションの活用

```typescript
// 外部データの安全な取り込み
const validateBlockData = (data: unknown) =>
  pipe(
    Schema.decodeUnknown(BlockSchema)(data),
    Effect.mapError(error => new InvalidBlockError({
      reason: TreeFormatter.formatErrorSync(error)
    }))
  )

// 使用例
const processUserBlock = (rawData: unknown) =>
  pipe(
    validateBlockData(rawData),
    Effect.flatMap(placeBlock),
    Effect.catchTag("InvalidBlockError", error => {
      console.log("Invalid block:", error.reason)
      return Effect.succeed(null)
    })
  )
```

## 4. 依存性注入とレイヤー

### ステップ1: サービスの定義

```typescript
import { Context, Layer } from "effect"

// サービスインターフェース (関数型パターン)
interface WorldGeneratorService {
  readonly generate: (seed: number) => Effect.Effect<World>
  readonly generateChunk: (x: number, z: number) => Effect.Effect<Chunk>
}

const WorldGenerator = Context.GenericTag<WorldGeneratorService>("@app/WorldGenerator")
```

### ステップ2: 実装の提供

```typescript
// 実装
const WorldGeneratorLive = Layer.effect(
  WorldGenerator,
  Effect.gen(function* () {
    // 依存するサービスを取得
    const noise = yield* NoiseGenerator

    return {
      generate: (seed) => generateWorld(seed, noise),
      generateChunk: (x, z) => generateChunk(x, z, seed, noise)
    }
  })
)

// テスト用モック
const WorldGeneratorTest = Layer.succeed(
  WorldGenerator,
  {
    generate: () => Effect.succeed(testWorld),
    generateChunk: () => Effect.succeed(testChunk)
  }
)
```

## 5. 実践課題

### 課題1: インベントリシステムの実装

以下の要件を満たすインベントリシステムを実装してください：

```typescript
// 要件:
// 1. アイテムの追加/削除
// 2. 容量制限のチェック
// 3. スタック可能アイテムの処理

// ヒント:
const InventorySchema = Schema.Struct({
  slots: Schema.Array(
    Schema.Union(
      Schema.Struct({
        itemId: Schema.String,
        count: Schema.Number.pipe(Schema.between(1, 64))
      }),
      Schema.Null // 空きスロット
    )
  ).pipe(Schema.maxItems(36))
})

// 実装してください:
const addItem: (inventory: Inventory, item: Item) => Effect.Effect<Inventory, InventoryError>
const removeItem: (inventory: Inventory, slot: number) => Effect.Effect<Inventory, InventoryError>
```

### 課題2: ECSシステムの組み合わせ

複数のシステムを組み合わせて、ゲームループを作成してください：

```typescript
// 実装してください:
const gameLoop = pipe(
  getEntities(),
  Effect.flatMap(entities =>
    pipe(
      Effect.succeed(entities),
      Effect.map(movementSystem),
      Effect.map(collisionSystem),
      Effect.map(renderSystem)
    )
  ),
  Effect.repeat(Schedule.fixed("16 millis")) // 60 FPS
)
```

## 学習の確認

### チェックリスト

- [ ] Effect型で副作用を表現できる
- [ ] エラーを型安全に処理できる
- [ ] ECSの基本概念を理解している
- [ ] Schemaでデータモデルを定義できる
- [ ] 依存性注入パターンを使える

### 理解度テスト

1. **Q**: なぜ副作用をEffect型で包むのですか？
   **A**: 副作用を型レベルで追跡し、合成可能で予測可能なコードを書くため

2. **Q**: ECSの利点は何ですか？
   **A**: データと振る舞いの分離、柔軟な機能追加、パフォーマンスの最適化

3. **Q**: Schema駆動開発の利点は？
   **A**: 型安全性、実行時検証、自動的なエンコード/デコード

## 次のステップ

### 推奨学習パス

1. ✅ **完了**: 主要概念の理解
2. → **次**: [5分デモ](./01-5min-demo.md)で実際に動かす
3. → **詳細**: [アーキテクチャ](../01-architecture/README.md)で設計を深く理解
4. → **実装**: [実装例](../06-examples/README.md)でコードを学ぶ

### 追加リソース

- [Effect-TS公式ドキュメント](https://effect.website/)
- [ECSパターンの詳細](../01-architecture/05-ecs-integration.md)
- [実装サンプル集](../06-examples/README.md)