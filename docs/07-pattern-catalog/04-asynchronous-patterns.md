---
title: "非同期処理パターン - Effect-TS非同期プログラミング"
description: "Effect-TS 3.17+での非同期処理パターン。Promiseからの脫却、型安全で合成可能な非同期処理実現。"
category: "patterns"
difficulty: "intermediate"
tags: ["asynchronous", "effect-ts", "concurrency", "promises", "async-await"]
prerequisites: ["effect-ts-basics", "async-fundamentals"]
estimated_reading_time: "20分"
dependencies: []
status: "complete"
---

# Asynchronous Patterns

> **非同期パターン**: Effect-TSによる非同期処理の実装パターン

## 概要

Effect-TS 3.17+を使用した非同期処理パターンについて解説します。ここでは、Promise・async/awaitから脱却し、型安全で合成可能な非同期処理を実現します。

## 基本的な非同期パターン

### Effect.gen パターン

```typescript
import { Effect, Schema, Match } from "effect"

// Branded Types
type PlayerId = string & { readonly _brand: "PlayerId" }
type PlayerData = {
  readonly player: Player
  readonly inventory: Inventory
  readonly stats: PlayerStats
}

// Tagged Error
class PlayerNotFoundError extends Schema.TaggedError<PlayerNotFoundError>()("PlayerNotFoundError", {
  playerId: Schema.String
}) {}

class NetworkError extends Schema.TaggedError<NetworkError>()("NetworkError", {
  message: Schema.String
}) {}

// 各fetch関数の型定義
declare const fetchPlayer: (playerId: PlayerId) => Effect.Effect<Player, PlayerNotFoundError | NetworkError>
declare const fetchInventory: (playerId: PlayerId) => Effect.Effect<Inventory, NetworkError>
declare const fetchStats: (playerId: PlayerId) => Effect.Effect<PlayerStats, NetworkError>

const fetchPlayerData = (playerId: PlayerId): Effect.Effect<PlayerData, PlayerNotFoundError | NetworkError> =>
  Effect.gen(function* () {
    const player = yield* fetchPlayer(playerId)
    const inventory = yield* fetchInventory(playerId)
    const stats = yield* fetchStats(playerId)

    return {
      player,
      inventory,
      stats
    } as const
  })
```

### 並行処理パターン

```typescript
// Effect.allで並行実行
const fetchParallel = (playerId: PlayerId): Effect.Effect<PlayerData, PlayerNotFoundError | NetworkError> =>
  Effect.gen(function* () {
    const [player, inventory, stats] = yield* Effect.all([
      fetchPlayer(playerId),
      fetchInventory(playerId),
      fetchStats(playerId)
    ], { concurrency: "unbounded" }) // 完全並行実行

    return { player, inventory, stats } as const
  })

// Effect.allSuccessesで部分成功を許容
const fetchPartialSuccess = (playerId: PlayerId): Effect.Effect<Partial<PlayerData>, never> =>
  Effect.gen(function* () {
    const results = yield* Effect.allSuccesses([
      Effect.map(fetchPlayer(playerId), (player) => ({ player })),
      Effect.map(fetchInventory(playerId), (inventory) => ({ inventory })),
      Effect.map(fetchStats(playerId), (stats) => ({ stats }))
    ])

    // 結果をマージ
    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
  })
```

## エラーハンドリング

### タイムアウト処理

```typescript
import { pipe, Effect, Schedule, Match } from "effect"

class TimeoutError extends Schema.TaggedError<TimeoutError>()("TimeoutError", {
  duration: Schema.String
}) {}

const fetchWithTimeout = (playerId: PlayerId) =>
  pipe(
    fetchPlayerData(playerId),
    Effect.timeout("5 seconds"),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(new TimeoutError({ duration: "5 seconds" }))
    ),
    // Matchでエラーハンドリング
    Effect.catchAll((error) =>
      Match.value(error).pipe(
        Match.tag("TimeoutError", ({ duration }) =>
          Effect.succeed({ fallback: true, reason: `timeout after ${duration}` })
        ),
        Match.tag("NetworkError", ({ message }) =>
          Effect.succeed({ fallback: true, reason: `network: ${message}` })
        ),
        Match.tag("PlayerNotFoundError", ({ playerId }) =>
          Effect.succeed({ fallback: true, reason: `player ${playerId} not found` })
        ),
        Match.exhaustive
      )
    )
  )
```

### リトライパターン

```typescript
// より実践的なリトライ戦略
const fetchWithRetry = (playerId: PlayerId) =>
  pipe(
    fetchPlayerData(playerId),
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.intersect(Schedule.recurs(3)), // 最大3回リトライ
        Schedule.jittered // ジッターを追加してサーバー負荷を分散
      )
    ),
    // 特定エラーのみリトライ
    Effect.retryOrElse(Schedule.recurs(2), (error, details) =>
      Match.value(error).pipe(
        Match.tag("NetworkError", () =>
          Effect.logError(`Network error after ${details.attempt} attempts, using fallback`)
            .pipe(Effect.andThen(Effect.succeed({ fallback: true })))
        ),
        Match.tag("PlayerNotFoundError", () =>
          Effect.fail(error) // NotFoundはリトライしない
        ),
        Match.exhaustive
      )
    )
  )
```

## ストリーミングパターン

### Stream処理

```typescript
import { Stream, Queue, PubSub, Chunk } from "effect"

// ストリーミングデータ処理
const processPlayerEvents = (playerIds: ReadonlyArray<PlayerId>) =>
  Stream.fromIterable(playerIds).pipe(
    Stream.mapEffect((playerId) => fetchPlayerData(playerId), { concurrency: 5 }), // 同時並行数制限
    Stream.buffer(10), // バッファリング
    Stream.groupedWithin(5, "1 second"), // バッチ処理（5件またはタイムアウト1秒）
    Stream.runCollect
  )

// リアルタイムイベントストリーム
const createEventStream = Effect.gen(function* () {
  const eventStream = yield* Stream.fromSchedule(Schedule.spaced("500 millis")).pipe(
    Stream.map(() => ({
      eventId: Math.random().toString(),
      timestamp: Date.now(),
      type: "player_update" as const
    })),
    Stream.take(100) // 最大100イベント
  )

  return eventStream
})

// エラー処理付きストリーム
const robustEventStream = (playerIds: ReadonlyArray<PlayerId>) =>
  Stream.fromIterable(playerIds).pipe(
    Stream.mapEffect((playerId) =>
      fetchPlayerData(playerId).pipe(
        Effect.timeout("2 seconds"),
        Effect.retry(Schedule.recurs(2))
      ),
      { concurrency: "unbounded" }
    ),
    // エラーを無視して処理続行
    Stream.catchAll((error) =>
      Stream.make({ error: error._tag, fallback: true })
    )
  )
```

## Queue・PubSubパターン

### Queue による非同期通信

```typescript
interface PlayerCommand {
  readonly playerId: PlayerId
  readonly command: "move" | "attack" | "use_item"
  readonly data: unknown
}

// Bounded Queueで背圧制御
const createPlayerCommandProcessor = Effect.gen(function* () {
  const commandQueue = yield* Queue.bounded<PlayerCommand>(100)
  const responseQueue = yield* Queue.unbounded<ProcessResult>()

  // プロデューサー
  const producer = Effect.gen(function* () {
    const commands: PlayerCommand[] = [
      { playerId: "player1" as PlayerId, command: "move", data: { x: 10, y: 20 } },
      { playerId: "player2" as PlayerId, command: "attack", data: { target: "enemy1" } }
    ]

    yield* Effect.forEach(commands, (cmd) => Queue.offer(commandQueue, cmd))
  })

  // コンシューマー
  const consumer = Effect.gen(function* () {
    while (true) {
      const command = yield* Queue.take(commandQueue)
      const result = yield* processPlayerCommand(command)
      yield* Queue.offer(responseQueue, result)
    }
  }).pipe(Effect.forever, Effect.forkDaemon)

  return { producer, consumer, responseQueue }
})

declare const processPlayerCommand: (cmd: PlayerCommand) => Effect.Effect<ProcessResult, never>
type ProcessResult = { success: boolean; result?: unknown; error?: string }
```

### PubSub によるイベント配信

```typescript
interface GameEvent {
  readonly type: "player_joined" | "player_left" | "item_dropped"
  readonly playerId: PlayerId
  readonly data: unknown
  readonly timestamp: number
}

const createGameEventSystem = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<GameEvent>()

  // パブリッシャー
  const publisher = (event: GameEvent) => PubSub.publish(pubsub, event)

  // サブスクライバー1：ログ記録
  const logger = Effect.gen(function* () {
    const subscription = yield* PubSub.subscribe(pubsub)

    yield* Stream.fromQueue(subscription).pipe(
      Stream.runForEach((event) =>
        Effect.logInfo(`Game event: ${event.type} by ${event.playerId}`)
      )
    )
  }).pipe(Effect.forkDaemon)

  // サブスクライバー2：統計収集
  const statisticsCollector = Effect.gen(function* () {
    const subscription = yield* PubSub.subscribe(pubsub)
    const stats = yield* Ref.make({ playerJoined: 0, playerLeft: 0, itemDropped: 0 })

    yield* Stream.fromQueue(subscription).pipe(
      Stream.runForEach((event) =>
        Match.value(event.type).pipe(
          Match.when("player_joined", () => Ref.update(stats, s => ({ ...s, playerJoined: s.playerJoined + 1 })))
          Match.when("player_left", () => Ref.update(stats, s => ({ ...s, playerLeft: s.playerLeft + 1 })))
          Match.when("item_dropped", () => Ref.update(stats, s => ({ ...s, itemDropped: s.itemDropped + 1 })))
          Match.exhaustive
        )
      )
    )
  }).pipe(Effect.forkDaemon)

  return { publisher, logger, statisticsCollector }
})
```

## 並行処理制御パターン

### Fiber による軽量スレッド

```typescript
import { Fiber, Duration } from "effect"

// Fiberで並行実行管理
const manageConcurrentTasks = Effect.gen(function* () {
  // 複数のタスクをFiberで起動
  const fiber1 = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep("1 second")
      return "Task 1 completed"
    })
  )

  const fiber2 = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep("2 seconds")
      return "Task 2 completed"
    })
  )

  const fiber3 = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep("500 millis")
      return "Task 3 completed"
    })
  )

  // 最初に完了したものを取得（競合処理）
  const winner = yield* Fiber.race(fiber1, Fiber.race(fiber2, fiber3))

  // 残りのFiberをキャンセル
  yield* Fiber.interrupt(fiber1)
  yield* Fiber.interrupt(fiber2)
  yield* Fiber.interrupt(fiber3)

  return winner
})

// タイムアウト付きFiber
const taskWithTimeout = (task: Effect.Effect<string, never>, timeout: Duration.DurationInput) =>
  Effect.gen(function* () {
    const taskFiber = yield* Effect.fork(task)
    const timeoutFiber = yield* Effect.fork(
      Effect.sleep(timeout).pipe(Effect.andThen(Effect.fail("timeout")))
    )

    const result = yield* Fiber.race(taskFiber, timeoutFiber)

    return result
  })
```

### Semaphore によるリソース制御

```typescript
import { Semaphore } from "effect"

// データベース接続プール的な使用
const createResourcePool = Effect.gen(function* () {
  const semaphore = yield* Semaphore.make(5) // 最大5つの同時接続

  const acquireResource = <A, E>(task: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    Semaphore.withPermit(semaphore, task)

  // 使用例
  const tasks = Array.from({ length: 10 }, (_, i) =>
    acquireResource(
      Effect.gen(function* () {
        yield* Effect.logInfo(`Task ${i} started`)
        yield* Effect.sleep("1 second")
        yield* Effect.logInfo(`Task ${i} completed`)
        return `Result ${i}`
      })
    )
  )

  // 全タスクを並行実行（ただし同時実行数は5つまで）
  const results = yield* Effect.all(tasks, { concurrency: "unbounded" })
  return results
})
```

## STM（Software Transactional Memory）パターン

```typescript
import { STM, TRef } from "effect"

// 原子的な状態変更
interface GameState {
  readonly players: Record<PlayerId, Player>
  readonly items: Record<string, GameItem>
  readonly score: number
}

const createGameStateManager = Effect.gen(function* () {
  const gameState = yield* TRef.make<GameState>({
    players: {},
    items: {},
    score: 0
  })

  // 原子的なプレイヤー追加
  const addPlayer = (player: Player): Effect.Effect<void, never> =>
    STM.atomically(
      TRef.update(gameState, state => ({
        ...state,
        players: { ...state.players, [player.id]: player }
      }))
    )

  // 原子的なアイテム移動（プレイヤー間）
  const transferItem = (
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    itemId: string
  ): Effect.Effect<boolean, never> =>
    STM.atomically(
      STM.gen(function* () {
        const state = yield* TRef.get(gameState)
        const fromPlayer = state.players[fromPlayerId]
        const toPlayer = state.players[toPlayerId]

        if (!fromPlayer || !toPlayer) {
          return false // トランザクション失敗
        }

        const item = fromPlayer.inventory.find(i => i.id === itemId)
        if (!item) {
          return false
        }

        // 両プレイヤーのインベントリを原子的に更新
        yield* TRef.update(gameState, currentState => ({
          ...currentState,
          players: {
            ...currentState.players,
            [fromPlayerId]: {
              ...fromPlayer,
              inventory: fromPlayer.inventory.filter(i => i.id !== itemId)
            },
            [toPlayerId]: {
              ...toPlayer,
              inventory: [...toPlayer.inventory, item]
            }
          }
        }))

        return true
      })
    )

  return { addPlayer, transferItem, gameState }
})

// 複数STMトランザクションの組み合わせ
const complexTransaction = (playerId: PlayerId, itemId: string) =>
  STM.atomically(
    STM.gen(function* () {
      // 複数の条件を同時にチェック・更新
      const canTransfer = yield* checkPlayerCanTransfer(playerId, itemId)
      if (!canTransfer) {
        return yield* STM.fail("Transfer not allowed")
      }

      yield* updatePlayerInventory(playerId, itemId)
      yield* updateGameScore(100)
      yield* logTransaction(playerId, itemId)

      return "Transfer successful"
    })
  )

declare const checkPlayerCanTransfer: (playerId: PlayerId, itemId: string) => STM.STM<boolean, never>
declare const updatePlayerInventory: (playerId: PlayerId, itemId: string) => STM.STM<void, never>
declare const updateGameScore: (points: number) => STM.STM<void, never>
declare const logTransaction: (playerId: PlayerId, itemId: string) => STM.STM<void, never>
```

## 競合処理（Race）パターン

```typescript
// 複数のデータソースから最速レスポンスを取得
const fetchFromMultipleSources = (playerId: PlayerId) => {
  const source1 = fetchPlayerData(playerId).pipe(Effect.delay("100 millis"))
  const source2 = fetchPlayerDataFromCache(playerId).pipe(Effect.delay("50 millis"))
  const source3 = fetchPlayerDataFromBackup(playerId).pipe(Effect.delay("200 millis"))

  return Effect.race(source1, Effect.race(source2, source3))
}

// タイムアウトとのレース
const fetchWithRaceTimeout = (playerId: PlayerId, timeoutMs: number) => {
  const fetchTask = fetchPlayerData(playerId)
  const timeoutTask = Effect.sleep(`${timeoutMs} millis`).pipe(
    Effect.andThen(Effect.fail(new TimeoutError({ duration: `${timeoutMs}ms` })))
  )

  return Effect.race(fetchTask, timeoutTask)
}

// 複数タスクの部分成功レース
const raceUntilSuccess = <A, E>(tasks: ReadonlyArray<Effect.Effect<A, E>>) => {
  return tasks.reduce(
    (acc, task) => Effect.raceFirst(acc, task),
    Effect.fail("No tasks provided" as E)
  )
}

declare const fetchPlayerDataFromCache: (playerId: PlayerId) => Effect.Effect<PlayerData, NetworkError>
declare const fetchPlayerDataFromBackup: (playerId: PlayerId) => Effect.Effect<PlayerData, NetworkError>
```

## パフォーマンス最適化パターン

### 遅延評価とメモ化

```typescript
import { Effect, Cache, Duration } from "effect"

// キャッシュ付きデータ取得
const createCachedFetcher = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 100,
    timeToLive: Duration.minutes(5),
    lookup: (playerId: PlayerId) => fetchPlayerData(playerId)
  })

  return (playerId: PlayerId) => Cache.get(cache, playerId)
})

// 遅延初期化
const lazyResource = Effect.suspend(() =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Expensive resource initialization")
    yield* Effect.sleep("1 second")
    return { resource: "initialized" }
  })
)
```

### バッチ処理パターン

```typescript
// DataLoaderパターンの実装
const createBatchedPlayerFetcher = Effect.gen(function* () {
  const queue = yield* Queue.bounded<{
    playerId: PlayerId
    deferred: Deferred.Deferred<Player, PlayerNotFoundError>
  }>(100)

  // バッチ処理のワーカー
  const batchWorker = Effect.gen(function* () {
    while (true) {
      const batch = yield* Queue.takeUpTo(queue, 10) // 最大10件をバッチ処理
      if (batch.length === 0) {
        yield* Effect.sleep("10 millis")
        continue
      }

      const playerIds = batch.map(item => item.playerId)
      const players = yield* fetchMultiplePlayers(playerIds)

      // 結果を各Deferredに配信
      yield* Effect.forEach(batch, ({ playerId, deferred }) => {
        const player = players.find(p => p.id === playerId)
        return player
          ? Deferred.succeed(deferred, player)
          : Deferred.fail(deferred, new PlayerNotFoundError({ playerId }))
      })
    }
  }).pipe(Effect.forever, Effect.forkDaemon)

  const batchedFetch = (playerId: PlayerId) => Effect.gen(function* () {
    const deferred = yield* Deferred.make<Player, PlayerNotFoundError>()
    yield* Queue.offer(queue, { playerId, deferred })
    return yield* Deferred.await(deferred)
  })

  return { batchedFetch, batchWorker }
})

declare const fetchMultiplePlayers: (playerIds: ReadonlyArray<PlayerId>) => Effect.Effect<ReadonlyArray<Player>, NetworkError>
```

## テスト支援パターン

### モックとスタブ

```typescript
import { TestServices, TestClock } from "effect/Testing"

// テスト用のモックサービス
const createMockPlayerService = Layer.succeed(
  PlayerService,
  {
    fetchPlayer: (playerId: PlayerId) =>
      Match.value(playerId).pipe(
        Match.when("test-player-1" as PlayerId, () =>
          Effect.succeed({ id: playerId, name: "Test Player 1" })
        ),
        Match.orElse(() =>
          Effect.fail(new PlayerNotFoundError({ playerId }))
        )
      ),

    fetchInventory: (_: PlayerId) =>
      Effect.succeed([{ id: "item1", name: "Test Item" }]),

    fetchStats: (_: PlayerId) =>
      Effect.succeed({ level: 1, experience: 0 })
  }
)

// 時間を制御したテスト
const testTimeBasedLogic = Effect.gen(function* () {
  const testClock = yield* TestClock.TestClock

  // タスクを開始
  const fiber = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep("1 hour")
      return "completed after 1 hour"
    })
  )

  // 時間を進める
  yield* TestClock.adjust("30 minutes")

  const isCompleted = yield* Fiber.poll(fiber)
  yield* Effect.logInfo(`Task completed after 30 minutes: ${Option.isSome(isCompleted)}`)

  // さらに時間を進める
  yield* TestClock.adjust("30 minutes")
  const result = yield* Fiber.join(fiber)

  return result
}).pipe(
  Effect.provide(TestServices.layer), // テストサービスを提供
  Effect.provide(createMockPlayerService)
)
```

## 関連項目

- [Effect-TSパターン](../01-architecture/06-effect-ts-patterns.md)
- [エラーハンドリングパターン](./02-error-handling-patterns.md)
- [テストパターン](./05-test-patterns.md)
- [最適化パターン](./06-optimization-patterns.md)