---
title: 'Effect-TS 高度な機能リファレンス'
description: 'Effect-TS 3.17+の高度な機能とAPIの詳細仕様'
category: 'reference'
difficulty: 'advanced'
tags: ['effect-ts', 'advanced', 'api-reference', 'concurrency', 'streams']
prerequisites: ['effect-ts-patterns', 'effect-ts-basics', 'effect-ts-services']
estimated_reading_time: '30分'
---

# Effect-TS 高度な機能リファレンス

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [アーキテクチャ](./README.md) → **Effect-TS高度な機能**
>
> **🎯 学習目標**: Effect-TSの高度な機能とAPIの詳細理解
>
> **⏱️ 所要時間**: 30分
>
> **📚 前提知識**: [Effect-TSパターン](./06-effect-ts-patterns.md) → [サービス設計](./06b-effect-ts-services.md)

### 📋 関連ドキュメント

- **基本概念**: [Effect-TSパターン](./06-effect-ts-patterns.md)
- **実装ガイド**: [Effect-TS実装パターン](./06a-effect-ts-basics.md)
- **APIリファレンス**: [Effect-TS Effect API](../reference/effect-ts-effect-api.md)

---

## 1. Stream処理

### 1.1 Stream基本API

```typescript
import { Stream, Effect, Chunk } from 'effect'

interface StreamAPI {
  // ストリーム生成
  from: <A>(iterable: Iterable<A>) => Stream.Stream<A>
  fromEffect: <R, E, A>(effect: Effect.Effect<R, E, A>) => Stream.Stream<A, E, R>
  fromSchedule: <R, A>(schedule: Schedule<R, A>) => Stream.Stream<A, never, R>

  // 変換操作
  map: <A, B>(f: (a: A) => B) => <R, E>(stream: Stream.Stream<A, E, R>) => Stream.Stream<B, E, R>
  flatMap: <A, R2, E2, B>(
    f: (a: A) => Stream.Stream<B, E2, R2>
  ) => <R, E>(stream: Stream.Stream<A, E, R>) => Stream.Stream<B, E | E2, R | R2>
  filter: <A>(predicate: (a: A) => boolean) => <R, E>(stream: Stream.Stream<A, E, R>) => Stream.Stream<A, E, R>

  // 集約操作
  runCollect: <R, E, A>(stream: Stream.Stream<A, E, R>) => Effect.Effect<R, E, Chunk.Chunk<A>>
  runFold: <S, A>(s: S, f: (s: S, a: A) => S) => <R, E>(stream: Stream.Stream<A, E, R>) => Effect.Effect<R, E, S>
}
```

### 1.2 チャンク処理の実装例

```typescript
// Minecraftのチャンクストリーミング
const chunkStream = (world: World): Stream.Stream<Chunk, ChunkError> =>
  Stream.fromIterable(world.getChunkPositions()).pipe(
    Stream.mapEffect((pos) => loadChunk(pos)),
    Stream.rechunk(16), // 16チャンクずつバッチ処理
    Stream.tap((chunk) => Effect.log(`Processing chunk: ${chunk.position}`))
  )

// バックプレッシャー制御
const processChunksWithBackpressure = pipe(
  chunkStream(world),
  Stream.buffer({ capacity: 32 }), // バッファサイズ制限
  Stream.mapConcurrent(4, processChunk), // 並行処理数制限
  Stream.throttle({
    elements: 10,
    duration: '1 second',
  })
)
```

## 2. Fiber並行制御

### 2.1 Fiber管理API

```typescript
import { Fiber, Effect } from 'effect'

interface FiberAPI {
  // Fiber生成
  fork: <R, E, A>(effect: Effect.Effect<R, E, A>) => Effect.Effect<R, never, Fiber.Fiber<E, A>>
  forkDaemon: <R, E, A>(effect: Effect.Effect<R, E, A>) => Effect.Effect<R, never, Fiber.Fiber<E, A>>
  forkScoped: <R, E, A>(effect: Effect.Effect<R, E, A>) => Effect.Effect<R | Scope, never, Fiber.Fiber<E, A>>

  // Fiber制御
  join: <E, A>(fiber: Fiber.Fiber<E, A>) => Effect.Effect<never, E, A>
  interrupt: <E, A>(fiber: Fiber.Fiber<E, A>) => Effect.Effect<never, never, Exit<E, A>>
  await: <E, A>(fiber: Fiber.Fiber<E, A>) => Effect.Effect<never, never, Exit<E, A>>
}
```

### 2.2 構造化並行性

```typescript
// レース条件の実装
const raceTimeout = <R, E, A>(
  effect: Effect.Effect<R, E, A>,
  timeout: Duration
): Effect.Effect<R, E | TimeoutError, A> =>
  Effect.race(effect, Effect.sleep(timeout).pipe(Effect.andThen(Effect.fail(new TimeoutError()))))

// フォーク・ジョインパターン
const parallelChunkGeneration = Effect.gen(function* () {
  const fiber1 = yield* Effect.fork(generateTerrain())
  const fiber2 = yield* Effect.fork(generateStructures())
  const fiber3 = yield* Effect.fork(generateEntities())

  // すべてのFiberの完了を待つ
  const [terrain, structures, entities] = yield* Effect.all([
    Fiber.join(fiber1),
    Fiber.join(fiber2),
    Fiber.join(fiber3),
  ])

  return combineChunkData(terrain, structures, entities)
})
```

## 3. Ref & STM

### 3.1 Ref（参照セル）

```typescript
import { Ref, Effect } from "effect"

// ゲーム状態の管理
interface GameStateManager {
  constructor(
    private readonly playersRef: Ref.Ref<Map<PlayerId, Player>>,
    private readonly worldRef: Ref.Ref<World>
  ) {}

  addPlayer(player: Player): Effect.Effect<void> {
    return Ref.update(this.playersRef, (players) =>
      new Map(players).set(player.id, player)
    )
  }

  updateWorld(f: (world: World) => World): Effect.Effect<void> {
    return Ref.update(this.worldRef, f)
  }

  getSnapshot(): Effect.Effect<GameSnapshot> {
    return Effect.all({
      players: Ref.get(this.playersRef),
      world: Ref.get(this.worldRef)
    })
  }
}
```

### 3.2 STM（Software Transactional Memory）

```typescript
import { STM, TRef } from 'effect'

// トランザクショナルなインベントリ操作
const transferItems = (
  from: TRef.TRef<Inventory>,
  to: TRef.TRef<Inventory>,
  items: ItemStack[]
): STM.STM<TransferResult, TransferError> =>
  STM.gen(function* () {
    const sourceInventory = yield* TRef.get(from)
    const targetInventory = yield* TRef.get(to)

    // アトミックな検証
    yield* pipe(
      !hasItems(sourceInventory, items),
      Match.boolean({
        onTrue: () => STM.fail(new InsufficientItemsError()),
        onFalse: () => STM.succeed(undefined),
      })
    )

    yield* pipe(
      !hasSpace(targetInventory, items),
      Match.boolean({
        onTrue: () => STM.fail(new NoSpaceError()),
        onFalse: () => STM.succeed(undefined),
      })
    )

    // アトミックな更新
    yield* TRef.set(from, removeItems(sourceInventory, items))
    yield* TRef.set(to, addItems(targetInventory, items))

    return { success: true, transferred: items }
  })
```

## 4. Schedule & 時間制御

### 4.1 Schedule API

```typescript
import { Schedule, Effect } from 'effect'

interface ScheduleAPI {
  // 基本スケジュール
  forever: Schedule.Schedule<any, never>
  once: Schedule.Schedule<any, never>
  recurs: (n: number) => Schedule.Schedule<any, never>

  // 時間ベース
  spaced: (duration: Duration) => Schedule.Schedule<any, never>
  exponential: (base: Duration, factor?: number) => Schedule.Schedule<any, never>
  fibonacci: (one: Duration) => Schedule.Schedule<any, never>

  // 組み合わせ
  intersect: <Env2, In2, Out2>(
    that: Schedule<Env2, In2, Out2>
  ) => <Env, In, Out>(self: Schedule<Env, In, Out>) => Schedule<Env | Env2, In & In2, [Out, Out2]>
  union: <Env2, In2, Out2>(
    that: Schedule<Env2, In2, Out2>
  ) => <Env, In, Out>(self: Schedule<Env, In, Out>) => Schedule<Env | Env2, In & In2, [Out, Out2]>
}
```

### 4.2 ゲームループのスケジューリング

```typescript
// 固定タイムステップのゲームループ
const gameLoop = pipe(
  updateGameState,
  Effect.repeat(
    Schedule.fixed('16 millis').pipe(
      // 60 FPS
      Schedule.compose(Schedule.recurWhile(() => isGameRunning))
    )
  )
)

// 適応的なチャンク更新スケジュール
const adaptiveChunkUpdate = pipe(
  updateNearbyChunks,
  Effect.repeat(
    Schedule.exponential('100 millis').pipe(
      Schedule.intersect(Schedule.recurs(5)), // 最大5回リトライ
      Schedule.resetAfter('5 seconds') // 5秒後にリセット
    )
  )
)
```

## 5. Scope & リソース管理

### 5.1 Scope API

```typescript
import { Scope, Effect } from 'effect'

// スコープ付きリソース管理
const withConnection = <R, E, A>(
  use: (conn: DatabaseConnection) => Effect.Effect<R, E, A>
): Effect.Effect<R | Scope.Scope, E | ConnectionError, A> =>
  Effect.acquireUseRelease(
    // 取得
    connectToDatabase(),
    // 使用
    use,
    // 解放
    (conn, exit) => (Exit.isSuccess(exit) ? conn.close() : conn.rollback().pipe(Effect.andThen(conn.close())))
  )

// マルチリソース管理
const withGameResources = Effect.scoped(
  Effect.gen(function* () {
    const renderer = yield* acquireRenderer()
    const audio = yield* acquireAudioContext()
    const network = yield* acquireNetworkConnection()

    return { renderer, audio, network }
  })
)
```

## 6. Queue & PubSub

### 6.1 Queue実装

```typescript
import { Queue, Effect } from "effect"

// イベントキューシステム
interface EventQueueSystem {
  constructor(
    private readonly eventQueue: Queue.Queue<GameEvent>,
    private readonly priorityQueue: Queue.Queue<PriorityEvent>
  ) {}

  publishEvent(event: GameEvent): Effect.Effect<void> {
    return Queue.offer(this.eventQueue, event)
  }

  processEvents(): Effect.Effect<never, never, void> {
    return pipe(
      Queue.take(this.eventQueue),
      Effect.flatMap(processGameEvent),
      Effect.forever
    )
  }
}
```

### 6.2 PubSubパターン

```typescript
import { PubSub, Effect } from 'effect'

// マルチプレイヤーイベント配信
const multiplayerEventSystem = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<PlayerEvent>()

  // プレイヤーごとのサブスクリプション
  const subscribePlayer = (playerId: PlayerId) =>
    Effect.scoped(
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(pubsub)
        return pipe(
          Queue.take(subscription),
          Effect.filter((event) => event.playerId === playerId),
          Stream.fromQueue
        )
      })
    )

  return {
    publish: (event: PlayerEvent) => PubSub.publish(pubsub, event),
    subscribe: subscribePlayer,
  }
})
```

## APIリファレンス仕様

### 型シグネチャ規約

```typescript
// Effect型の完全な定義
type Effect<Requirements, Error, Value> = {
  readonly _R: Requirements
  readonly _E: Error
  readonly _A: Value
}

// Layer型の完全な定義
type Layer<RIn, Error, ROut> = {
  readonly _RIn: RIn
  readonly _E: Error
  readonly _ROut: ROut
}

// Stream型の完全な定義
type Stream<Value, Error = never, Requirements = never> = {
  readonly _A: Value
  readonly _E: Error
  readonly _R: Requirements
}
```

## 次のステップ

- **実装例**: [高度なパターン例](../examples/02-advanced-patterns/README.md)で実践的な使用例
- **パフォーマンス**: [最適化パターン](../explanations/design-patterns/06-optimization-patterns.md)でパフォーマンスチューニング
- **テスト**: [Effect-TSテスト](./06d-effect-ts-testing.md)で高度な機能のテスト方法
