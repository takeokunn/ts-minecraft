---
title: "テストパターン - Effect-TSテスト戦略"
description: "Effect-TS 3.17+環境での@effect/vitestテスト実装パターン。Property-basedテスト、モック、スナップショットテスト。"
category: "patterns"
difficulty: "intermediate"
tags: ["testing", "effect-vitest", "property-based-testing", "mocking", "test-patterns"]
prerequisites: ["effect-ts-basics", "testing-fundamentals"]
estimated_reading_time: "18分"
dependencies: []
status: "complete"
---

# Test Patterns

> **テストパターン**: Effect-TSベースのテスト設計パターン

## 概要

Effect-TS 3.17+環境での@effect/vitestを使用したテスト実装パターンとベストプラクティスについて解説します。

## 基本テストパターン

### Effect.gen テスト

```typescript
import { it, expect } from "@effect/vitest"
import { Effect, Schema, Match, Option } from "effect"
import { Brand } from "effect/Brand"

// Branded Types定義
type PlayerId = string & Brand.Brand<"PlayerId">
const PlayerId = Brand.nominal<PlayerId>()

type PlayerName = string & Brand.Brand<"PlayerName">
const PlayerName = Brand.nominal<PlayerName>()

// Schema定義
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(256)),
  z: Schema.Number
})

const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerId)),
  name: Schema.String.pipe(Schema.brand(PlayerName)),
  position: Position
})

// TaggedError定義
class PlayerCreateError extends Schema.TaggedError<PlayerCreateError>()("PlayerCreateError", {
  reason: Schema.String
}) {}

// テスト実装
it.effect("プレイヤー作成が正常に完了すること", () =>
  Effect.gen(function* () {
    const createResult = yield* PlayerService.create({
      name: PlayerName("TestPlayer"),
      position: { x: 0, y: 64, z: 0 }
    })

    // パターンマッチングで結果を検証
    const player = Match.value(createResult).pipe(
      Match.when(
        { _tag: "Success" },
        ({ player }) => player
      ),
      Match.orElse(() => {
        throw new Error("プレイヤー作成に失敗しました")
      })
    )

    expect(Schema.decodeSync(Player)(player)).toStrictEqual({
      id: expect.any(String),
      name: "TestPlayer",
      position: { x: 0, y: 64, z: 0 }
    })
  })
)

### Layer モックパターン

```typescript
import { Layer, Context, Effect, Option } from "effect"

// サービス定義
class PlayerRepository extends Context.Tag("PlayerRepository")<
  PlayerRepository,
  {
    readonly save: (player: Player) => Effect.Effect<void, PlayerCreateError>
    readonly findById: (id: PlayerId) => Effect.Effect<Option.Option<Player>, never>
    readonly delete: (id: PlayerId) => Effect.Effect<void, never>
  }
>() {}

// モック実装
const MockPlayerRepository = Layer.succeed(
  PlayerRepository,
  {
    save: () => Effect.succeed(undefined),
    findById: (id: PlayerId) => {
      // Early Return パターン
      if (id === PlayerId("invalid")) {
        return Effect.succeed(Option.none())
      }

      return Effect.succeed(Option.some({
        id,
        name: PlayerName("MockPlayer"),
        position: { x: 0, y: 64, z: 0 }
      }))
    },
    delete: () => Effect.succeed(undefined)
  }
)

// テストレイヤー合成
const TestLayer = Layer.mergeAll(
  MockPlayerRepository,
  MockWorldService,
  PlayerServiceLive
)
```

## プロパティベーステスト

### fast-check統合とit.prop

```typescript
import { it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as fc from "fast-check"

// Fast-Check Arbitraryの定義
const positionArbitrary = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }),
  y: fc.integer({ min: -10, max: 300 }), // 無効な値も含める
  z: fc.integer({ min: -1000, max: 1000 })
})

const validPositionArbitrary = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }),
  y: fc.integer({ min: 0, max: 256 }),
  z: fc.integer({ min: -1000, max: 1000 })
})

// プロパティベーステスト
it.prop([positionArbitrary], "座標正規化が正しく動作すること")((pos) =>
  Effect.gen(function* () {
    const normalized = yield* normalizePosition(pos)

    // Schemaで検証
    const validPosition = yield* Schema.decodeUnknown(Position)(normalized)

    expect(validPosition.y).toBeGreaterThanOrEqualTo(0)
    expect(validPosition.y).toBeLessThanOrEqualTo(256)
    expect(validPosition.x).toBe(Math.max(-1000, Math.min(1000, pos.x)))
  })
)

// 有効な座標でのプロパティテスト
it.prop([validPositionArbitrary], "有効な座標は変更されないこと")((pos) =>
  Effect.gen(function* () {
    const normalized = yield* normalizePosition(pos)
    expect(normalized).toStrictEqual(pos)
  })
)

// 複数のArbitraryを使用
it.prop(
  [fc.string({ minLength: 1, maxLength: 16 }), validPositionArbitrary],
  "プレイヤー作成のプロパティテスト"
)((name, position) =>
  Effect.gen(function* () {
    const result = yield* PlayerService.create({
      name: PlayerName(name),
      position
    })

    const validation = Match.value(result).pipe(
      Match.when({ _tag: "Success" }, ({ player }) => {
        expect(player.name).toBe(name)
        expect(player.position).toStrictEqual(position)
        return true
      }),
      Match.when({ _tag: "Error" }, () => false),
      Match.exhaustive
    )

    expect(validation).toBe(true)
  })
)
```

## 統合テスト・時間制御テスト

### TestClockによる時間制御

```typescript
import { it } from "@effect/vitest"
import { Effect, TestClock, Queue, Option, Fiber } from "effect"

// 時間依存のテスト
it.effect("定期実行タスクのテスト", () =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<string>()

    // 60秒ごとに実行されるタスク
    const periodicTask = Queue.offer(queue, "executed").pipe(
      Effect.delay("60 seconds"),
      Effect.forever,
      Effect.fork
    )

    yield* periodicTask

    // 最初はタスクが実行されていないことを確認
    const beforeAdjust = yield* Queue.poll(queue).pipe(
      Effect.andThen(Option.isNone)
    )
    expect(beforeAdjust).toBe(true)

    // 時計を60秒進める
    yield* TestClock.adjust("60 seconds")

    // タスクが実行されたことを確認
    const result = yield* Queue.take(queue)
    expect(result).toBe("executed")

    // もう一度60秒進める
    yield* TestClock.adjust("60 seconds")

    // 再度実行されたことを確認
    const result2 = yield* Queue.take(queue)
    expect(result2).toBe("executed")
  })
)

// タイムアウトテスト
it.effect("タイムアウト処理のテスト", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.sleep("5 minutes").pipe(
      Effect.timeoutTo({
        duration: "1 minute",
        onSuccess: Option.some,
        onTimeout: () => Option.none<void>()
      }),
      Effect.fork
    )

    // 1分進める
    yield* TestClock.adjust("1 minute")

    const result = yield* Fiber.join(fiber)

    // タイムアウトによりNoneが返されることを確認
    expect(Option.isNone(result)).toBe(true)
  })
)
```

### Layer統合テスト

```typescript
// 複数サービスの統合テスト
const IntegrationTestLayer = Layer.mergeAll(
  MockPlayerRepository,
  MockWorldService,
  MockInventoryService,
  PlayerServiceLive,
  WorldServiceLive
)

it.effect("プレイヤーとワールドの統合テスト", () =>
  Effect.gen(function* () {
    const playerResult = yield* PlayerService.create({
      name: PlayerName("IntegrationTestPlayer"),
      position: { x: 100, y: 64, z: 200 }
    })

    const player = Match.value(playerResult).pipe(
      Match.when({ _tag: "Success" }, ({ player }) => player),
      Match.orElse(() => {
        throw new Error("プレイヤー作成に失敗")
      })
    )

    const worldResult = yield* WorldService.addPlayer(player)

    const worldValidation = Match.value(worldResult).pipe(
      Match.when({ _tag: "Success" }, ({ world }) => {
        expect(world.players.has(player.id)).toBe(true)
        return true
      }),
      Match.when({ _tag: "Error" }, () => false),
      Match.exhaustive
    )

    expect(worldValidation).toBe(true)
  }).pipe(Effect.provide(IntegrationTestLayer))
)
```

### フレイキーテスト対応

```typescript
// 不安定なテストの対応
it.effect("ネットワーク依存テスト（フレイキー対応）", () =>
  it.flakyTest(
    Effect.gen(function* () {
      const networkResult = yield* NetworkService.fetchData()

      const validation = Match.value(networkResult).pipe(
        Match.when({ _tag: "Success" }, () => true),
        Match.when({ _tag: "NetworkError" }, () => {
          // ネットワークエラーの場合は再試行
          return false
        }),
        Match.exhaustive
      )

      if (!validation) {
        yield* Effect.fail("ネットワークエラー")
      }

      expect(validation).toBe(true)
    }),
    "10 seconds" // 10秒以内に成功するまで再試行
  )
)
```

## スコープドリソーステスト

### it.scopedによるリソース管理

```typescript
import { it } from "@effect/vitest"
import { Effect, Console, Scope } from "effect"

// リソースのテスト
it.scoped("データベース接続リソースのテスト", () =>
  Effect.gen(function* () {
    // acquire処理とrelease処理のログ
    const acquire = Console.log("データベース接続を取得")
    const release = Console.log("データベース接続を解放")

    // リソース定義
    const dbConnection = Effect.acquireRelease(acquire, () => release)

    yield* dbConnection

    // データベース操作のテスト
    const result = yield* DatabaseService.query("SELECT * FROM players")

    expect(result).toBeDefined()
    // スコープ終了時にリソースが自動的に解放される
  })
)
```

## 高度なテストパターン

### カスタムマッチャー

```typescript
import { Effect, Schema, Match } from "effect"

// カスタム検証関数
const expectValidPlayer = (player: unknown) => {
  const result = Match.value(Schema.decodeUnknownOption(Player)(player)).pipe(
    Match.when(Option.isSome, ({ value }) => {
      expect(value.name).toMatch(/^[a-zA-Z0-9_]+$/)
      expect(value.position.y).toBeGreaterThanOrEqualTo(0)
      expect(value.position.y).toBeLessThanOrEqualTo(256)
      return true
    }),
    Match.when(Option.isNone, () => {
      throw new Error("無効なプレイヤーデータ")
    }),
    Match.exhaustive
  )

  return result
}

// エラーハンドリングテスト
it.effect("エラーケースのテスト", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      PlayerService.create({
        name: PlayerName(""), // 無効な名前
        position: { x: 0, y: -1, z: 0 } // 無効な座標
      })
    )

    const validation = Match.value(result).pipe(
      Match.when(
        { _tag: "Failure" },
        ({ cause }) => {
          expect(cause._tag).toBe("Fail")
          expect(cause.failure).toBeInstanceOf(PlayerCreateError)
          return true
        }
      ),
      Match.when({ _tag: "Success" }, () => {
        throw new Error("エラーが期待されていましたが成功しました")
      }),
      Match.exhaustive
    )

    expect(validation).toBe(true)
  })
)
```

## テスト実行制御

### テスト実行の制御

```typescript
// 単一テストのみ実行
it.effect.only("このテストのみ実行", () =>
  Effect.gen(function* () {
    const result = yield* SomeService.operation()
    expect(result).toBeDefined()
  })
)

// テストをスキップ
it.effect.skip("このテストはスキップ", () =>
  Effect.gen(function* () {
    // まだ実装されていない機能のテスト
    yield* Effect.succeed("スキップされます")
  })
)

// 失敗が期待されるテスト
it.effect.fails("失敗が期待されるテスト", ({ expect }) =>
  Effect.gen(function* () {
    // まだ修正されていないバグのテスト
    const result = yield* BuggyService.operation()
    expect(result).toBe("期待される結果")
  })
)
```

## 関連項目

- [Effect-TSテストパターン](../../03-guides/07-effect-ts-testing-patterns.md)
- [包括的テスト戦略](../../03-guides/05-comprehensive-testing-strategy.md)
- [非同期パターン](./04-asynchronous-patterns.md)
- [Effect-TS基礎](../01-architecture/06a-effect-ts-basics.md)
- [エラーハンドリングパターン](../01-architecture/06c-effect-ts-error-handling.md)