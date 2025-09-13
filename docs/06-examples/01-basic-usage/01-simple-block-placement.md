---
title: "シンプルなブロック配置 - Effect-TS実装例"
description: "Effect-TS 3.17+を使ったブロック配置システムの最小実装。Schema.Struct、Context.GenericTag、Effect.genの基本パターンを学習。"
category: "examples"
difficulty: "beginner"
tags: ["block", "effect-ts", "schema", "context", "basic"]
prerequisites: ["TypeScript基礎", "Effect-TS概念"]
estimated_reading_time: "20分"
last_updated: "2025-09-14"
version: "1.0.0"
learning_path: "基本実装パターン"
---

# 🧱 シンプルなブロック配置

## 🧭 スマートナビゲーション

> **📍 現在位置**: ホーム → 実例集 → 基本的な使用例 → ブロック配置
> **🎯 学習目標**: Effect-TS 3.17+基本パターンの実践
> **⏱️ 所要時間**: 20分
> **👤 対象**: Effect-TS初心者

**Effect-TSの基本パターンを使って、型安全なブロック配置システムを実装しましょう！**

## 🎯 学習目標

この実装例では以下を学習します：

- **Schema.Struct**: 型安全なデータモデリング
- **Context.GenericTag**: 依存注入パターン
- **Effect.gen**: 非同期処理の合成
- **Schema.TaggedError**: 型安全なエラーハンドリング
- **Layer**: サービス実装の提供

## 💡 実装の特徴

```mermaid
graph TB
    A[ユーザー入力] --> B[ブロック配置リクエスト]
    B --> C[座標バリデーション]
    C --> D{有効な位置?}
    D -->|Yes| E[ブロック配置実行]
    D -->|No| F[エラー返却]
    E --> G[配置成功通知]

    classDef input fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef process fill:#f1f8e9,stroke:#388e3c,stroke-width:2px
    classDef error fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef success fill:#e8f5e8,stroke:#4caf50,stroke-width:2px

    class A input
    class B,C,E process
    class D,F error
    class G success
```

## 📝 完全実装コード

### 🏗️ 1. 基本データモデル

```typescript
// src/domain/models/position.ts
import { Schema } from "@effect/schema"

/**
 * 3D座標を表現するスキーマ
 *
 * 🎯 学習ポイント：
 * - Schema.Structによる構造化されたデータ定義
 * - 実行時型検証の自動生成
 * - TypeScript型の自動推論
 */
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

// 型エイリアスの定義（TypeScript型として使用）
export type Position = Schema.Schema.Type<typeof Position>

/**
 * ブロックタイプを表現するスキーマ
 *
 * 🎯 学習ポイント：
 * - Schema.Literalによる列挙型定義
 * - ユニオン型の型安全な表現
 */
export const BlockType = Schema.Literal(
  "grass",
  "stone",
  "wood",
  "dirt",
  "sand"
)

export type BlockType = Schema.Schema.Type<typeof BlockType>

/**
 * ブロック配置リクエストのスキーマ
 *
 * 🎯 学習ポイント：
 * - 複合データ構造の定義
 * - スキーマの組み合わせ
 */
export const BlockPlacementRequest = Schema.Struct({
  position: Position,
  blockType: BlockType,
  playerId: Schema.String
})

export type BlockPlacementRequest = Schema.Schema.Type<typeof BlockPlacementRequest>
```

### ❌ 2. エラー定義

```typescript
// src/domain/errors/block-errors.ts
import { Schema } from "@effect/schema"

/**
 * ブロック配置エラーの基底クラス
 *
 * 🎯 学習ポイント：
 * - Schema.TaggedErrorによる型安全なエラー定義
 * - 構造化されたエラー情報の管理
 */
export class BlockPlacementError extends Schema.TaggedError<BlockPlacementError>()(
  "BlockPlacementError",
  {
    reason: Schema.String,
    position: Schema.optional(Position),
    details: Schema.optional(Schema.String)
  }
) {}

/**
 * 無効な位置エラー
 */
export class InvalidPositionError extends Schema.TaggedError<InvalidPositionError>()(
  "InvalidPositionError",
  {
    position: Position,
    reason: Schema.String
  }
) {}

/**
 * 既に存在するブロックエラー
 */
export class BlockAlreadyExistsError extends Schema.TaggedError<BlockAlreadyExistsError>()(
  "BlockAlreadyExistsError",
  {
    position: Position,
    existingBlockType: BlockType
  }
) {}
```

### 🔧 3. サービス定義

```typescript
// src/domain/services/block-service.ts
import { Context, Effect } from "effect"
import { Position, BlockType, BlockPlacementRequest } from "../models/position.js"
import { BlockPlacementError, InvalidPositionError, BlockAlreadyExistsError } from "../errors/block-errors.js"

/**
 * ブロック配置サービスのインターフェース
 *
 * 🎯 学習ポイント：
 * - Context.GenericTagによるサービス定義
 * - Effect型による非同期処理とエラーハンドリングの表現
 * - 依存注入パターンの実装
 */
export interface BlockService {
  /**
   * 指定位置にブロックを配置
   */
  readonly placeBlock: (
    request: BlockPlacementRequest
  ) => Effect.Effect<void, BlockPlacementError | InvalidPositionError | BlockAlreadyExistsError>

  /**
   * 指定位置のブロックを取得
   */
  readonly getBlock: (
    position: Position
  ) => Effect.Effect<BlockType | null, never>

  /**
   * 指定位置のブロックを削除
   */
  readonly removeBlock: (
    position: Position
  ) => Effect.Effect<boolean, BlockPlacementError>
}

/**
 * BlockServiceのContext.GenericTag
 *
 * 🎯 学習ポイント：
 * - サービスの識別子定義
 * - 依存注入における型安全性の確保
 */
export const BlockService = Context.GenericTag<BlockService>("BlockService")
```

### 💾 4. インメモリ実装

```typescript
// src/infrastructure/block-service-impl.ts
import { Effect, Layer } from "effect"
import { BlockService } from "../domain/services/block-service.js"
import { Position, BlockType, BlockPlacementRequest } from "../domain/models/position.js"
import { BlockPlacementError, InvalidPositionError, BlockAlreadyExistsError } from "../domain/errors/block-errors.js"

/**
 * インメモリブロックサービス実装
 *
 * 🎯 学習ポイント：
 * - Mapを使った簡単なデータストレージ
 * - Effect.genによる非同期処理の合成
 * - 実用的なビジネスロジックの実装
 */
class InMemoryBlockService implements BlockService {
  private blocks = new Map<string, BlockType>()

  /**
   * 座標を文字列キーに変換（Mapのキーとして使用）
   */
  private positionToKey(position: Position): string {
    return `${position.x},${position.y},${position.z}`
  }

  /**
   * 位置の有効性検証
   */
  private validatePosition(position: Position): Effect.Effect<void, InvalidPositionError> {
    return Effect.gen(function* () {
      // Y座標の範囲チェック（地下-64〜空中320）
      if (position.y < -64 || position.y > 320) {
        yield* Effect.fail(
          new InvalidPositionError({
            position,
            reason: `Y座標が範囲外です: ${position.y} (有効範囲: -64 〜 320)`
          })
        )
      }

      // 座標が整数値かチェック
      if (!Number.isInteger(position.x) || !Number.isInteger(position.y) || !Number.isInteger(position.z)) {
        yield* Effect.fail(
          new InvalidPositionError({
            position,
            reason: "座標は整数である必要があります"
          })
        )
      }
    })
  }

  placeBlock(request: BlockPlacementRequest): Effect.Effect<void, BlockPlacementError | InvalidPositionError | BlockAlreadyExistsError> {
    return Effect.gen(() => {
      const self = this
      return Effect.gen(function* () {
        // 1. 位置の有効性検証
        yield* self.validatePosition(request.position)

        const key = self.positionToKey(request.position)

        // 2. 既存ブロックのチェック
        const existingBlock = self.blocks.get(key)
        if (existingBlock) {
          yield* Effect.fail(
            new BlockAlreadyExistsError({
              position: request.position,
              existingBlockType: existingBlock
            })
          )
        }

        // 3. ブロック配置実行
        self.blocks.set(key, request.blockType)

        // 4. 成功をログ出力（デモ用）
        yield* Effect.sync(() => {
          console.log(`✅ ブロック配置成功: ${request.blockType} at (${request.position.x}, ${request.position.y}, ${request.position.z})`)
        })
      })
    })().pipe(
      Effect.catchAll((error) =>
        Effect.fail(error instanceof InvalidPositionError || error instanceof BlockAlreadyExistsError
          ? error
          : new BlockPlacementError({ reason: `配置処理中にエラーが発生しました: ${error}` })
        )
      )
    )
  }

  getBlock(position: Position): Effect.Effect<BlockType | null, never> {
    return Effect.sync(() => {
      const key = this.positionToKey(position)
      return this.blocks.get(key) ?? null
    })
  }

  removeBlock(position: Position): Effect.Effect<boolean, BlockPlacementError> {
    return Effect.gen(() => {
      const self = this
      return Effect.gen(function* () {
        const key = self.positionToKey(position)
        const existed = self.blocks.has(key)

        if (existed) {
          self.blocks.delete(key)
          yield* Effect.sync(() => {
            console.log(`🗑️ ブロック削除: (${position.x}, ${position.y}, ${position.z})`)
          })
        }

        return existed
      })
    })().pipe(
      Effect.catchAll((error) =>
        Effect.fail(new BlockPlacementError({
          reason: `削除処理中にエラーが発生しました: ${error}`,
          position
        }))
      )
    )
  }
}

/**
 * BlockServiceの実装を提供するLayer
 *
 * 🎯 学習ポイント：
 * - Layer.succeedによるサービス実装の提供
 * - 依存注入の設定方法
 */
export const InMemoryBlockServiceLive = Layer.succeed(
  BlockService,
  new InMemoryBlockService()
)
```

### 🎮 5. アプリケーションレイヤー

```typescript
// src/application/block-placement-use-case.ts
import { Context, Effect, Match, pipe } from "effect"
import { Schema } from "@effect/schema"
import { BlockService } from "../domain/services/block-service.js"
import { BlockPlacementRequest } from "../domain/models/position.js"
import { BlockPlacementError, InvalidPositionError, BlockAlreadyExistsError } from "../domain/errors/block-errors.js"

/**
 * ブロック配置ユースケース
 *
 * 🎯 学習ポイント：
 * - アプリケーション層でのビジネスロジック調整
 * - Effect合成による処理の組み立て
 * - Match.valueによるパターンマッチング
 */
export class BlockPlacementUseCase extends Context.Tag("BlockPlacementUseCase")<
  BlockPlacementUseCase,
  {
    readonly execute: (input: unknown) => Effect.Effect<string, BlockPlacementError | InvalidPositionError | BlockAlreadyExistsError>
  }
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const blockService = yield* BlockService

      return {
        execute: (input: unknown) =>
          Effect.gen(function* () {
            // 1. 入力データの検証とパース
            const request = yield* Schema.decodeUnknown(BlockPlacementRequest)(input).pipe(
              Effect.mapError((parseError) =>
                new BlockPlacementError({
                  reason: `入力データが無効です: ${parseError.message}`
                })
              )
            )

            // 2. ブロック配置実行
            yield* blockService.placeBlock(request)

            // 3. 成功メッセージの生成
            return `ブロック「${request.blockType}」を座標(${request.position.x}, ${request.position.y}, ${request.position.z})に配置しました`
          })
      }
    })
  )
}
```

### 🚀 6. メインアプリケーション

```typescript
// src/main.ts
import { Effect, Layer, Console, Exit } from "effect"
import { InMemoryBlockServiceLive } from "./infrastructure/block-service-impl.js"
import { BlockPlacementUseCase } from "./application/block-placement-use-case.js"

/**
 * メインアプリケーション
 *
 * 🎯 学習ポイント：
 * - Layer.provide*による依存性の解決
 * - Effect実行パイプラインの構築
 * - エラーハンドリングとログ出力
 */
const program = Effect.gen(function* () {
  const useCase = yield* BlockPlacementUseCase

  // テストデータでブロック配置実行
  const testRequests = [
    // 成功ケース
    {
      position: { x: 0, y: 0, z: 0 },
      blockType: "grass",
      playerId: "player-1"
    },
    // 成功ケース
    {
      position: { x: 1, y: 0, z: 1 },
      blockType: "stone",
      playerId: "player-1"
    },
    // 失敗ケース：無効な座標
    {
      position: { x: 0, y: 500, z: 0 },
      blockType: "wood",
      playerId: "player-1"
    },
    // 失敗ケース：重複配置
    {
      position: { x: 0, y: 0, z: 0 },
      blockType: "dirt",
      playerId: "player-1"
    }
  ]

  yield* Console.log("🎮 ブロック配置システム デモ開始")
  yield* Console.log("================================")

  // 各リクエストを順次実行
  for (const [index, request] of testRequests.entries()) {
    yield* Console.log(`\n📝 テスト ${index + 1}: ${JSON.stringify(request, null, 2)}`)

    const result = yield* useCase.execute(request).pipe(
      Effect.either
    )

    if (result._tag === "Right") {
      yield* Console.log(`✅ ${result.right}`)
    } else {
      yield* Console.log(`❌ エラー: ${result.left._tag}`)
      yield* Console.log(`   詳細: ${JSON.stringify(result.left, null, 2)}`)
    }
  }

  yield* Console.log("\n🎯 デモ完了！")
})

/**
 * アプリケーション実行
 */
const runnable = program.pipe(
  Effect.provide(BlockPlacementUseCase.Live),
  Effect.provide(InMemoryBlockServiceLive)
)

// 実行とエラーハンドリング
Effect.runPromiseExit(runnable).then((exit) => {
  if (Exit.isFailure(exit)) {
    console.error("アプリケーション実行エラー:", exit.cause)
    process.exit(1)
  } else {
    console.log("アプリケーション正常終了")
  }
})
```

## 🧪 実行とテスト

### 1️⃣ 実行方法

```bash
# TypeScriptコンパイル & 実行
npx tsx src/main.ts

# または、tsconfig.jsonでモジュール設定してから
npm run build
node dist/main.js
```

### 2️⃣ 期待される出力

```
🎮 ブロック配置システム デモ開始
================================

📝 テスト 1: {
  "position": { "x": 0, "y": 0, "z": 0 },
  "blockType": "grass",
  "playerId": "player-1"
}
✅ ブロック配置成功: grass at (0, 0, 0)
✅ ブロック「grass」を座標(0, 0, 0)に配置しました

📝 テスト 2: {
  "position": { "x": 1, "y": 0, "z": 1 },
  "blockType": "stone",
  "playerId": "player-1"
}
✅ ブロック配置成功: stone at (1, 0, 1)
✅ ブロック「stone」を座標(1, 0, 1)に配置しました

📝 テスト 3: {
  "position": { "x": 0, "y": 500, "z": 0 },
  "blockType": "wood",
  "playerId": "player-1"
}
❌ エラー: InvalidPositionError
   詳細: {
     "_tag": "InvalidPositionError",
     "position": { "x": 0, "y": 500, "z": 0 },
     "reason": "Y座標が範囲外です: 500 (有効範囲: -64 〜 320)"
   }

📝 テスト 4: {
  "position": { "x": 0, "y": 0, "z": 0 },
  "blockType": "dirt",
  "playerId": "player-1"
}
❌ エラー: BlockAlreadyExistsError
   詳細: {
     "_tag": "BlockAlreadyExistsError",
     "position": { "x": 0, "y": 0, "z": 0 },
     "existingBlockType": "grass"
   }

🎯 デモ完了！
アプリケーション正常終了
```

## 🔧 カスタマイズ方法

### 📝 1. 新しいブロックタイプ追加

```typescript
// BlockTypeスキーマを拡張
export const BlockType = Schema.Literal(
  "grass", "stone", "wood", "dirt", "sand",
  // 新しいタイプを追加
  "diamond", "gold", "iron", "redstone"
)
```

### 🌍 2. 永続化レイヤー追加

```typescript
// ファイルシステム永続化
class FileSystemBlockService implements BlockService {
  constructor(private savePath: string) {}

  placeBlock(request: BlockPlacementRequest) {
    return Effect.gen(function* () {
      // ファイルに保存する実装
      yield* Effect.promise(() => fs.writeFile(this.savePath, JSON.stringify(blocks)))
    })
  }

  // 他のメソッドも実装...
}
```

### ⚡ 3. イベント駆動アーキテクチャ

```typescript
// イベント定義
export const BlockPlacedEvent = Schema.Struct({
  position: Position,
  blockType: BlockType,
  playerId: Schema.String,
  timestamp: Schema.DateFromString
})

// イベント発行機能付きサービス
class EventDrivenBlockService implements BlockService {
  placeBlock(request: BlockPlacementRequest) {
    return Effect.gen(function* () {
      // ブロック配置実行
      yield* originalPlacement(request)

      // イベント発行
      yield* eventBus.publish(new BlockPlacedEvent({
        ...request,
        timestamp: new Date()
      }))
    })
  }
}
```

## 🧪 テスト実装例

### 単体テスト

```typescript
// src/tests/block-service.test.ts
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { InMemoryBlockServiceLive } from "../infrastructure/block-service-impl.js"
import { BlockService } from "../domain/services/block-service.js"

describe("BlockService", () => {
  const testProgram = <A, E>(effect: Effect.Effect<A, E>) =>
    effect.pipe(Effect.provide(InMemoryBlockServiceLive))

  it("正常なブロック配置", async () => {
    const result = await Effect.runPromise(
      testProgram(
        Effect.gen(function* () {
          const service = yield* BlockService

          yield* service.placeBlock({
            position: { x: 0, y: 0, z: 0 },
            blockType: "grass",
            playerId: "test-player"
          })

          const block = yield* service.getBlock({ x: 0, y: 0, z: 0 })
          expect(block).toBe("grass")
        })
      )
    )
  })

  it("無効な位置でエラー", async () => {
    const result = await Effect.runPromiseExit(
      testProgram(
        Effect.gen(function* () {
          const service = yield* BlockService

          yield* service.placeBlock({
            position: { x: 0, y: 999, z: 0 }, // 無効な高さ
            blockType: "stone",
            playerId: "test-player"
          })
        })
      )
    )

    expect(result._tag).toBe("Failure")
  })
})
```

## 🎯 重要な学習ポイント

### 1️⃣ **Schema.Struct**の威力
- 実行時型検証とTypeScript型の両立
- JSONパース時の自動バリデーション
- 型安全性とランタイム安全性の確保

### 2️⃣ **Context.GenericTag**による依存注入
- インターフェースと実装の分離
- テスタビリティの向上
- モジュラーなアーキテクチャ

### 3️⃣ **Effect.gen**の合成能力
- 非同期処理の線形記述
- エラーハンドリングの自動伝播
- 関数型プログラミングの実践

### 4️⃣ **Layer**によるサービス管理
- 依存関係の整理
- 環境固有の実装切り替え
- アプリケーション構成の明確化

## 🔗 次のステップ

この基本実装をマスターしたら、以下に進みましょう：

1. **[プレイヤー移動実装](./02-player-movement.md)** - より複雑な状態管理
2. **[インベントリ管理](./03-inventory-management.md)** - UI統合とイベント処理
3. **[高度なパターン](../02-advanced-patterns/README.md)** - Effect合成の応用

---

**🎉 おめでとうございます！Effect-TSの基本パターンを実装できました！**
**次は実際の物理演算やUI統合に挑戦してみましょう。**