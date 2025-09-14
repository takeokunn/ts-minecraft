---
title: "Effect-TS エラーハンドリング実装ガイド"
description: "Effect-TS 3.17+でのエラー処理の実装方法とベストプラクティス"
category: "guide"
difficulty: "intermediate"
tags: ["effect-ts", "error-handling", "implementation", "best-practices"]
prerequisites: ["effect-ts-basics", "typescript-types"]
estimated_reading_time: "20分"
---


# Effect-TS エラーハンドリング実装ガイド

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [アーキテクチャ](./README.md) → **エラーハンドリング実装**
>
> **🎯 学習目標**: Effect-TSでの型安全なエラー処理の実装
>
> **⏱️ 所要時間**: 20分
>
> **📚 前提知識**: [Effect-TSパターン](./06-effect-ts-patterns.md) → [基本実装](./06a-effect-ts-basics.md)

### 📋 関連ドキュメント
- **概念説明**: [Effect-TSパターン](./06-effect-ts-patterns.md)
- **APIリファレンス**: [Effect-TS Schema API](../reference/effect-ts-schema-api.md)
- **実践例**: [エラーハンドリング例](../examples/02-advanced-patterns/01-effect-composition.md)

---

## 1. TaggedErrorによる型安全エラー定義

### 1.1 基本的なエラー定義

```typescript
import { Schema } from "effect"

// ドメインエラーの定義 - 関数型パターン
const BlockNotFoundError = Schema.TaggedError("BlockNotFoundError")({
  position: Position,
  reason: Schema.optional(Schema.String)
})

const InvalidBlockError = Schema.TaggedError("InvalidBlockError")({
  blockType: Schema.String,
  message: Schema.String
})

// エラーユニオン型の定義
type BlockError =
  | typeof BlockNotFoundError.Type
  | typeof InvalidBlockError.Type
```

### 1.2 階層的エラー構造

```typescript
// 基底エラー型の定義 - 関数型パターン
const GameError = Schema.TaggedError("GameError")({
  timestamp: Schema.DateTimeUtc,
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

// 具体的なエラー実装 - Match.value で処理
const NetworkError = Schema.TaggedError("NetworkError")({
  statusCode: Schema.Number,
  endpoint: Schema.String,
  timestamp: Schema.DateTimeUtc,
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

// エラーファクトリー関数
const createNetworkError = (
  statusCode: number,
  endpoint: string,
  context?: Record<string, unknown>
) => NetworkError({
  statusCode,
  endpoint,
  timestamp: new Date().toISOString(),
  context
})
```

## 2. エラーハンドリングパターン

### 2.1 Effect.genでのエラー処理

```typescript
import { Effect, pipe } from "effect"

const placeBlock = (
  position: Position,
  blockType: BlockType
): Effect.Effect<Block, BlockError> =>
  Effect.gen(function* () {
    // 位置の検証
    const chunk = yield* getChunk(position).pipe(
      Effect.catchTag("ChunkNotLoadedError", () =>
        Effect.fail(new BlockNotFoundError({
          position,
          reason: "Chunk not loaded"
        }))
      )
    )

    // ブロックタイプの検証（Match.valueパターン）
    yield* pipe(
      Match.value(isValidBlockType(blockType)),
      Match.when(false, () => Effect.fail(
        new InvalidBlockError({
          blockType,
          message: "Unknown block type"
        })
      )),
      Match.orElse(() => Effect.unit)
    )

    // ブロック配置
    return yield* chunk.setBlock(position, blockType)
  })
```

### 2.2 Match.valueによるエラー分岐

```typescript
import { Match } from "effect"

const handleBlockError = (error: BlockError): string =>
  Match.value(error).pipe(
    Match.tag("BlockNotFoundError", (e) =>
      `Block not found at ${e.position}: ${e.reason ?? "Unknown reason"}`
    ),
    Match.tag("InvalidBlockError", (e) =>
      `Invalid block ${e.blockType}: ${e.message}`
    ),
    Match.exhaustive
  )

// Effectチェーン内での使用
const processBlock = pipe(
  placeBlock(position, blockType),
  Effect.catchAll((error) =>
    Effect.succeed({
      success: false,
      message: handleBlockError(error)
    })
  )
)
```

## 3. エラーの変換と伝播

### 3.1 層間でのエラー変換

```typescript
// インフラ層のエラー - 関数型パターン
const DatabaseError = Schema.TaggedError("DatabaseError")({
  query: Schema.String,
  code: Schema.String
})

// ドメイン層のエラー - 関数型パターン
const SaveError = Schema.TaggedError("SaveError")({
  entityId: Schema.String,
  reason: Schema.String
})

// エラー変換 - Match.value パターン使用
const savePlayer = (player: Player) =>
  pipe(
    database.save(player),
    Effect.mapError((dbError: typeof DatabaseError.Type) =>
      SaveError({
        entityId: player.id,
        reason: `Database error: ${dbError.code}`
      })
    )
  )
```

### 3.2 エラーの集約

```typescript
import { Effect, Cause } from "effect"

// 複数のエラーを集約
const validateWorld = (world: World) =>
  Effect.all([
    validateChunks(world.chunks),
    validateEntities(world.entities),
    validateMetadata(world.metadata)
  ], {
    concurrency: "unbounded",
    mode: "either" // すべてのエラーを収集
  }).pipe(
    Effect.catchAll((cause) => {
      const errors = Cause.failures(cause)
      return Effect.fail(
        new ValidationError({
          errors: errors.map(e => e.message)
        })
      )
    })
  )
```

## 4. リトライとフォールバック

### 4.1 エラー時のリトライ戦略

```typescript
import { Schedule, Effect } from "effect"

const fetchChunk = (position: ChunkPosition) =>
  pipe(
    networkFetchChunk(position),
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.intersect(Schedule.recurs(3)),
        Schedule.tapInput((error) =>
          Effect.log(`Retry due to: ${error}`)
        )
      )
    ),
    Effect.catchTag("NetworkError", () =>
      // フォールバック: ローカルキャッシュから取得
      loadChunkFromCache(position)
    )
  )
```

### 4.2 サーキットブレーカーパターン - Match.value 実装

```typescript
import { Match, Effect, pipe } from "effect"

// サーキットブレーカー状態の定義
const CircuitState = Schema.Union(
  Schema.Literal("closed"),
  Schema.Literal("open"),
  Schema.Literal("half-open")
)

const CircuitOpenError = Schema.TaggedError("CircuitOpenError")({
  message: Schema.String,
  retryAfter: Schema.Number
})

interface CircuitBreaker {
  private failures = 0
  private readonly threshold = 5
  private state: typeof CircuitState.Type = "closed"

  execute<R, E, A>(
    effect: Effect.Effect<R, E, A>
  ): Effect.Effect<R, E | typeof CircuitOpenError.Type, A> {
    return Effect.gen(function* () {
      // Match.value でステート管理
      const shouldExecute = yield* Match.value(this.state).pipe(
        Match.when("open", () =>
          Effect.fail(CircuitOpenError({
            message: "Circuit is open",
            retryAfter: 5000
          }))
        ),
        Match.when("closed", () => Effect.succeed(true)),
        Match.when("half-open", () => Effect.succeed(true)),
        Match.exhaustive
      )

      // Match.when による条件分岐 - if文を排除
      return yield* pipe(
        Match.value(shouldExecute),
        Match.when(false, () => Effect.succeed(undefined)),
        Match.orElse(() =>
          pipe(
            effect,
        Effect.tapError(() =>
          Effect.sync(() => {
            this.failures++
            // Match.value でしきい値チェック
            const newState = Match.value(this.failures).pipe(
              Match.when(Match.number.greaterThanOrEqualTo(this.threshold), () => "open" as const),
              Match.orElse(() => this.state)
            )
            this.state = newState

            // Match.value でタイマー制御
            Match.value(newState).pipe(
              Match.when("open", () =>
                setTimeout(() => this.state = "half-open", 5000)
              ),
              Match.orElse(() => {})
            )
          })
        ),
        Effect.tap(() =>
          Effect.sync(() => {
            this.failures = 0
            this.state = "closed"
          })
        )
          )
        )
      )
    }.bind(this))
  }
}
```

## 5. エラーロギングとモニタリング

### 5.1 構造化エラーロギング

```typescript
import { Effect, Logger } from "effect"

const logError = <E>(error: E) =>
  Effect.logError("Operation failed").pipe(
    Effect.annotateLogs({
      error_type: (error as any)._tag,
      error_details: JSON.stringify(error),
      timestamp: new Date().toISOString()
    })
  )

// カスタムロガーレイヤー
const ErrorLoggerLive = Logger.replace(
  Logger.defaultLogger,
  Logger.make(({
    level,
    message,
    cause,
    context,
    spans,
    annotations
  }) => {
    // Match.when によるログレベル判定 - if文の代替
    pipe(
      Match.value(level),
      Match.when("Error", () => {
        // エラーを外部サービスに送信
        sendToMonitoring({
          level,
          message,
          annotations,
          stackTrace: cause ? Cause.pretty(cause) : undefined
        })
      }),
      Match.orElse(() => undefined)
    )
    // デフォルトのログ出力も実行
    Logger.defaultLogger.log({ level, message, cause, context, spans, annotations })
  })
)
```

## 6. ベストプラクティス

### エラー設計の原則

1. **明示的なエラー型**: すべてのエラーを型として定義
2. **コンテキスト情報**: エラーに十分なデバッグ情報を含める
3. **適切な抽象度**: 層に応じた適切なエラー抽象化
4. **回復可能性**: エラーの種類に応じた回復戦略

### パフォーマンス考慮事項

- エラーオブジェクトの生成コストを最小化
- 頻繁に発生するエラーはキャッシュ
- スタックトレースの収集は必要な場合のみ

## 次のステップ

- **テスト戦略**: [Effect-TSテスト](./06d-effect-ts-testing.md)でエラーケースのテスト方法を学習
- **実践例**: [エラーハンドリング例](../examples/02-advanced-patterns/01-effect-composition.md)で実装例を確認
- **APIリファレンス**: [Effect-TS Effect API](../reference/effect-ts-effect-api.md)で詳細なAPI仕様を確認