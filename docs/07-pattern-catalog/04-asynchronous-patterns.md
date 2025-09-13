---
title: "Async Patterns"
category: "Pattern Catalog"
complexity: "high"
dependencies:
  - "effect"
  - "@effect/platform"
ai_tags:
  - "concurrency"
  - "async-operations"
  - "parallelism"
  - "effect-composition"
implementation_time: "2-3 hours"
skill_level: "advanced"
last_pattern_update: "2025-09-14"
---

# Async Patterns

Effect-TSにおける非同期処理とコンカレンシーのベストプラクティス集

## 重要なImport

すべてのパターンで共通して必要なモジュール:

```typescript
import {
  Effect,
  Fiber,
  Queue,
  Stream,
  Context,
  Option,
  Schedule,
  Ref,
  Deferred,
  FiberSet,
  Pool,
  PubSub,
  Console
} from "effect"

// プロジェクト固有の型
import type {
  ChunkCoordinate,
  ChunkData,
  PlayerId,
  ProcessedData,
  NetworkError,
  ProcessingError,
  ChunkLoadError,
  PlayerLoadTimeoutError,
  RateLimitExceededError,
  WorkerBusyError,
  CircuitBreakerOpenError,
  DatabaseError,
  TaskId
} from "@minecraft/types"
```

## Pattern 1: Basic Effect.gen Pattern

**使用場面**: 逐次非同期処理の基本パターン

**実装**:
```typescript
import { Effect, Console, Fiber } from "effect"

export const basicAsyncOperation = Effect.gen(function* () {
  // 非同期処理1
  yield* Console.log("Starting operation...")

  // Promise をEffect に変換（早期リターンパターン）
  const data = yield* Effect.tryPromise({
    try: () => fetch("/api/data").then(r => r.json()),
    catch: (error) => new NetworkError({ cause: error })
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(new NetworkError({ cause: "Request timeout" }))
    )
  )

  // 非同期処理2をFiberで実行
  const processingFiber = yield* Effect.fork(processData(data))
  const processed = yield* Fiber.join(processingFiber)

  yield* Console.log("Operation completed")
  return processed
})

// サービス内での使用
export const DataService = Context.GenericTag<{
  readonly fetchAndProcess: () => Effect.Effect<ProcessedData, NetworkError | ProcessingError>
}>("@minecraft/DataService")
```

## Pattern 2: Parallel Processing with Effect.all

**使用場面**: 複数の独立した処理を並列実行

**実装**:
```typescript
// 並列処理の基本（Fiber使用）
export const parallelChunkLoading = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService

    // 各座標をFiberで並列実行
    const fibers = yield* Effect.all(
      coordinates.map(coord =>
        Effect.fork(
          chunkService.loadChunk(coord).pipe(
            Effect.timeout("30 seconds"),
            Effect.catchAll(error =>
              Effect.gen(function* () {
                yield* Effect.logError(`Failed to load chunk at ${coord.x},${coord.z}`, error)
                return Option.none()
              })
            )
          )
        )
      )
    )

    // 全Fiberの完了を待つ
    const chunks = yield* Fiber.joinAll(fibers)

    // 成功したチャンクのみをフィルタ
    return chunks.filter(Option.isSome).map(chunk => chunk.value)
  })

// オブジェクト形式での並列処理（Fiber使用）
export const loadPlayerData = (playerId: PlayerId) =>
  Effect.gen(function* () {
    // 各データロードをFiberで並列実行
    const profileFiber = yield* Effect.fork(PlayerService.getProfile(playerId))
    const inventoryFiber = yield* Effect.fork(InventoryService.getInventory(playerId))
    const statsFiber = yield* Effect.fork(StatsService.getStats(playerId))
    const achievementsFiber = yield* Effect.fork(AchievementService.getAchievements(playerId))

    // 全Fiberの結果を並行取得
    const [profile, inventory, stats, achievements] = yield* Effect.all([
      Fiber.join(profileFiber),
      Fiber.join(inventoryFiber),
      Fiber.join(statsFiber),
      Fiber.join(achievementsFiber)
    ], { concurrency: "unbounded" })

    return {
      profile,
      inventory,
      stats,
      achievements
    }
  })
```

## Pattern 3: Sequential with Error Recovery

**使用場面**: 失敗時のリトライと回復処理

**実装**:
```typescript
import { Schedule } from "effect"

// エクスポネンシャルバックオフでリトライ
export const reliableChunkSave = (chunk: ChunkData) =>
  Effect.gen(function* () {
    const storage = yield* ChunkStorageService

    return yield* storage.saveChunk(chunk).pipe(
      Effect.retry(
        Schedule.exponential("100 millis").pipe(
          Schedule.compose(Schedule.recurs(3))
        )
      ),
      Effect.catchAll(error =>
        Effect.gen(function* () {
          // 最終的に失敗した場合はローカルキャッシュに保存
          yield* Effect.logError("Failed to save chunk to primary storage", error)
          const cache = yield* LocalCacheService
          yield* cache.storeForLater(chunk)
          return yield* Effect.fail(new ChunkSaveFailedError({
            coordinate: chunk.coordinate,
            fallbackUsed: true
          }))
        })
      )
    )
  })

// 段階的フォールバック
export const loadChunkWithFallback = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    // 1. メモリキャッシュから試行
    const memoryCache = yield* MemoryCacheService
    const cached = yield* memoryCache.getChunk(coordinate)

    if (Option.isSome(cached)) {
      return cached.value
    }

    // 2. ディスクから試行
    const diskStorage = yield* DiskStorageService
    const fromDisk = yield* diskStorage.loadChunk(coordinate).pipe(
      Effect.catchAll(() => Effect.succeed(Option.none()))
    )

    if (Option.isSome(fromDisk)) {
      // メモリキャッシュに保存
      yield* memoryCache.storeChunk(fromDisk.value)
      return fromDisk.value
    }

    // 3. 生成
    const generator = yield* ChunkGeneratorService
    const generated = yield* generator.generateChunk(coordinate)

    // 両方のキャッシュに保存
    yield* memoryCache.storeChunk(generated)
    yield* diskStorage.saveChunk(generated)

    return generated
  })
```

## Pattern 4: Stream Processing

**使用場面**: 大量データのストリーム処理

**実装**:
```typescript
import { Stream, Sink, Queue, Fiber } from "effect"

// チャンクの連続読み込み処理（Queue使用）
export const processChunkStream = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    // バックプレッシャー付きのQueue作成
    const queue = yield* Queue.bounded<ChunkData>(50)

    // プロデューサーFiber
    const producer = yield* Effect.fork(
      Stream.fromIterable(coordinates).pipe(
        Stream.mapEffect(coord =>
          ChunkService.loadChunk(coord).pipe(
            Effect.timeout("30 seconds"),
            Effect.catchAll(error =>
              Effect.gen(function* () {
                yield* Effect.logError("Chunk processing failed", error)
                return Option.none()
              })
            )
          ),
          { concurrency: 5 }
        ),
        Stream.filter(Option.isSome),
        Stream.map(chunk => chunk.value),
        Stream.runIntoQueue(queue)
      )
    )

    // コンシューマーFiber
    const consumer = yield* Effect.fork(
      Stream.fromQueue(queue).pipe(
        Stream.grouped(10),
        Stream.mapEffect(chunkBatch =>
          Effect.gen(function* () {
            yield* Effect.log(`Processing batch of ${chunkBatch.length} chunks`)
            return yield* WorldService.updateChunks(chunkBatch)
          })
        ),
        Stream.runDrain
      )
    )

    // 両Fiberの完了を待つ
    yield* Fiber.join(producer)
    yield* Queue.shutdown(queue)
    yield* Fiber.join(consumer)
  })

// ストリームを実行
export const runChunkProcessing = (coordinates: ChunkCoordinate[]) =>
  processChunkStream(coordinates).pipe(
    Stream.runDrain
  )
```

## Pattern 5: Resource Management with Acquire/Release

**使用場面**: リソースの確実な取得・解放

**実装**:
```typescript
// ファイルハンドルの安全な管理
export const processWorldFile = (filePath: string) =>
  Effect.gen(function* () {
    return yield* Effect.acquireRelease(
      // リソース取得
      Effect.gen(function* () {
        yield* Effect.log(`Opening world file: ${filePath}`)
        const handle = yield* FileSystem.open(filePath)
        return handle
      }),
      // リソース解放（エラー時も実行される）
      (handle) =>
        Effect.gen(function* () {
          yield* Effect.log(`Closing world file: ${filePath}`)
          yield* FileSystem.close(handle)
        })
    ).pipe(
      Effect.flatMap(handle =>
        Effect.gen(function* () {
          // メインの処理
          const data = yield* FileSystem.readAll(handle)
          const processed = yield* processWorldData(data)
          yield* FileSystem.writeAll(handle, processed)
          return processed
        })
      )
    )
  })

// 複数リソースの管理
export const performDatabaseMigration = Effect.gen(function* () {
  return yield* Effect.acquireRelease(
    // データベース接続プールの取得
    Effect.gen(function* () {
      const pool = yield* DatabasePool.acquire()
      const transaction = yield* pool.beginTransaction()
      return { pool, transaction }
    }),
    // クリーンアップ
    ({ pool, transaction }) =>
      Effect.gen(function* () {
        yield* transaction.rollback().pipe(Effect.catchAll(() => Effect.void))
        yield* DatabasePool.release(pool)
      })
  ).pipe(
    Effect.flatMap(({ pool, transaction }) =>
      Effect.gen(function* () {
        // マイグレーション処理
        yield* runMigrationSteps(transaction)
        yield* transaction.commit()
        return "Migration completed successfully"
      })
    )
  )
})
```

## Pattern 6: Worker Pool Pattern

**使用場面**: CPU集約的タスクの並列処理

**実装**:
```typescript
// ワーカープールサービス（Fiber + Queue使用）
export const WorkerPoolService = Context.GenericTag<{
  readonly submitTask: <A, E>(task: Effect.Effect<A, E>) => Effect.Effect<A, E | WorkerBusyError>
  readonly getStatus: () => Effect.Effect<WorkerPoolStatus, never>
}>("@minecraft/WorkerPoolService")

export const makeWorkerPool = (maxWorkers: number) =>
  Effect.gen(function* () {
    // タスクキュー（バックプレッシャー対応）
    const taskQueue = yield* Queue.bounded<{
      task: Effect.Effect<unknown, unknown>
      deferred: Deferred.Deferred<unknown, unknown>
    }>(100)

    const activeFibers = yield* Ref.make<Set<Fiber.RuntimeFiber<unknown, unknown>>>(new Set())

    // ワーカーFiber群を起動
    const workerFibers = yield* Effect.all(
      Array.from({ length: maxWorkers }, (_, i) =>
        Effect.fork(
          Effect.forever(
            Effect.gen(function* () {
              const { task, deferred } = yield* Queue.take(taskQueue)

              const result = yield* Effect.either(task)
              yield* Deferred.complete(deferred, result)
            })
          )
        )
      )
    )

    yield* Ref.set(activeFibers, new Set(workerFibers))

    return WorkerPoolService.of({
      submitTask: <A, E>(task: Effect.Effect<A, E>) =>
        Effect.gen(function* () {
          const deferred = yield* Deferred.make<A, E>()

          yield* Queue.offer(taskQueue, { task, deferred }).pipe(
            Effect.catchTag("QueueFullException", () =>
              Effect.fail(new WorkerBusyError({ reason: "Queue is full" }))
            )
          )

          return yield* Deferred.await(deferred)
        }),

      getStatus: () =>
        Effect.gen(function* () {
          const queueSize = yield* Queue.size(taskQueue)
          const fibers = yield* Ref.get(activeFibers)

          return {
            maxWorkers,
            active: fibers.size,
            queuedTasks: queueSize,
            total: maxWorkers
          }
        })
    })
  })

// 使用例：チャンク生成の並列処理（Fiber使用）
export const generateChunksInParallel = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    const workerPool = yield* WorkerPoolService

    // 各座標をFiberで並列実行
    const taskFibers = yield* Effect.all(
      coordinates.map(coord =>
        Effect.fork(
          workerPool.submitTask(
            Effect.gen(function* () {
              const generator = yield* ChunkGeneratorService
              return yield* generator.generateChunk(coord)
            })
          )
        )
      )
    )

    // 全Fiberの完了を待つ
    return yield* Fiber.joinAll(taskFibers)
  })
```

## Pattern 7: Timeout and Cancellation

**使用場面**: 長時間実行タスクのタイムアウト制御

**実装**:
```typescript
// タイムアウト付きの処理（Fiber使用）
export const loadPlayerWithTimeout = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const playerService = yield* PlayerService

    // ロード処理をFiberで実行
    const loadFiber = yield* Effect.fork(
      playerService.loadPlayer(playerId)
    )

    // タイムアウト付きでFiberの完了を待つ
    const result = yield* Fiber.join(loadFiber).pipe(
      Effect.timeout("10 seconds"),
      Effect.catchTag("TimeoutException", () =>
        Effect.gen(function* () {
          // Fiberを中断
          yield* Fiber.interrupt(loadFiber)
          yield* Effect.logWarning(`Player loading timed out: ${playerId}`)
          return yield* Effect.fail(new PlayerLoadTimeoutError({ playerId }))
        })
      )
    )

    return result
  })

// キャンセレーション対応の長時間処理（Fiber使用）
export const performLongRunningTask = (
  taskId: TaskId,
  onProgress: (progress: number) => Effect.Effect<void>
) =>
  Effect.gen(function* () {
    const steps = 100

    // 進捗報告用のFiber
    const progressFiber = yield* Effect.fork(
      Effect.gen(function* () {
        for (let i = 0; i < steps; i++) {
          yield* onProgress((i + 1) / steps)
          yield* Effect.sleep("100 millis")
        }
      })
    )

    // メイン処理をFiberで実行
    const mainFiber = yield* Effect.fork(
      Effect.gen(function* () {
        for (let i = 0; i < steps; i++) {
          // キャンセルチェック
          yield* Effect.yieldNow()

          // 実際の処理（キャンセル可能）
          yield* performTaskStep(taskId, i).pipe(
            Effect.interruptible
          )
        }

        return `Task ${taskId} completed successfully`
      })
    )

    // メイン処理完了後、進捗Fiberを中断
    const result = yield* Fiber.join(mainFiber)
    yield* Fiber.interrupt(progressFiber)

    return result
  }).pipe(
    Effect.onInterrupt(() =>
      Effect.gen(function* () {
        yield* Effect.log(`Task interrupted, cleaning up: ${taskId}`)
        yield* cleanupTask(taskId)
      })
    ),
    Effect.ensuring(
      Effect.gen(function* () {
        yield* Effect.log(`Cleaning up task: ${taskId}`)
        yield* cleanupTask(taskId)
      })
    )
  )
```

## Pattern 8: Rate Limiting

**使用場面**: API制限やリソース保護

**実装**:
```typescript
// レートリミッターサービス（Queue使用）
export const RateLimiterService = Context.GenericTag<{
  readonly acquire: (key: string) => Effect.Effect<void, RateLimitExceededError>
  readonly reset: (key: string) => Effect.Effect<void>
}>("@minecraft/RateLimiterService")

export const makeRateLimiter = (maxRequests: number, windowMs: number) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make(new Map<string, { count: number; resetTime: number }>())

    // レート制限用のQueue（トークンバケット方式）
    const tokenQueues = yield* Ref.make(new Map<string, Queue.Queue<void>>())

    return RateLimiterService.of({
      acquire: (key) =>
        Effect.gen(function* () {
          const now = Date.now()
          const current = yield* Ref.get(requests)
          const entry = current.get(key)

          if (!entry || entry.resetTime <= now) {
            // 新しいウィンドウ - Queueを初期化
            const newQueue = yield* Queue.bounded<void>(maxRequests)

            // 初期トークンを配置
            yield* Effect.all(
              Array.from({ length: maxRequests }, () => Queue.offer(newQueue, void 0))
            )

            yield* Ref.update(tokenQueues, map =>
              new Map(map).set(key, newQueue)
            )

            yield* Ref.update(requests, map =>
              new Map(map).set(key, {
                count: 1,
                resetTime: now + windowMs
              })
            )

            // トークンを消費
            yield* Queue.take(newQueue)
            return
          }

          const queues = yield* Ref.get(tokenQueues)
          const queue = queues.get(key)

          if (!queue) {
            return yield* Effect.fail(new RateLimitExceededError({
              key,
              limit: maxRequests,
              resetTime: entry.resetTime
            }))
          }

          // トークンの取得を試行（非ブロッキング）
          const tokenResult = yield* Queue.poll(queue)

          if (Option.isNone(tokenResult)) {
            return yield* Effect.fail(new RateLimitExceededError({
              key,
              limit: maxRequests,
              resetTime: entry.resetTime
            }))
          }

          yield* Ref.update(requests, map =>
            new Map(map).set(key, {
              ...entry,
              count: entry.count + 1
            })
          )
        }),

      reset: (key) =>
        Effect.gen(function* () {
          yield* Ref.update(requests, map => {
            const newMap = new Map(map)
            newMap.delete(key)
            return newMap
          })

          yield* Ref.update(tokenQueues, map => {
            const newMap = new Map(map)
            const queue = newMap.get(key)
            if (queue) {
              // Queueをシャットダウン
              Effect.runSync(Queue.shutdown(queue))
              newMap.delete(key)
            }
            return newMap
          })
        })
    })
  })

// レートリミッター使用例
export const rateLimitedPlayerAction = (playerId: PlayerId, action: string) =>
  Effect.gen(function* () {
    const rateLimiter = yield* RateLimiterService
    const key = `${playerId}:${action}`

    yield* rateLimiter.acquire(key)

    // 実際のアクション実行
    return yield* executePlayerAction(playerId, action)
  })

## Pattern 9: Concurrent Producer-Consumer with Backpressure

**使用場面**: データ処理パイプラインでのフロー制御

**実装**:
```typescript
import { Queue, Fiber, Stream } from "effect"

// Producer-Consumer パターン（バックプレッシャー付き）
export const createDataPipeline = <A, B>(
  source: Stream.Stream<A, never>,
  processor: (data: A) => Effect.Effect<B, ProcessingError>,
  batchSize: number = 10,
  queueCapacity: number = 100
) =>
  Effect.gen(function* () {
    // 入力Queue
    const inputQueue = yield* Queue.bounded<A>(queueCapacity)
    // 出力Queue
    const outputQueue = yield* Queue.bounded<B>(queueCapacity)

    // Producer Fiber
    const producer = yield* Effect.fork(
      source.pipe(
        Stream.runIntoQueue(inputQueue)
      )
    )

    // Processor Fibers（複数並列）
    const processors = yield* Effect.all(
      Array.from({ length: 4 }, () =>
        Effect.fork(
          Effect.forever(
            Effect.gen(function* () {
              const data = yield* Queue.take(inputQueue)
              const result = yield* processor(data).pipe(
                Effect.catchAll(error =>
                  Effect.gen(function* () {
                    yield* Effect.logError("Processing failed", error)
                    return Option.none()
                  })
                )
              )

              if (Option.isSome(result)) {
                yield* Queue.offer(outputQueue, result.value)
              }
            })
          )
        )
      )
    )

    // Consumer Stream
    const consumer = Stream.fromQueue(outputQueue).pipe(
      Stream.grouped(batchSize)
    )

    return {
      consumer,
      shutdown: Effect.gen(function* () {
        yield* Queue.shutdown(inputQueue)
        yield* Fiber.interrupt(producer)
        yield* Fiber.interruptAll(processors)
        yield* Queue.shutdown(outputQueue)
      })
    }
  })
```

## Pattern 10: Structured Concurrency with FiberSet

**使用場面**: 関連するFiberの集合管理

**実装**:
```typescript
import { FiberSet, Fiber } from "effect"

// チャンクローダーサービス
export const ChunkLoaderService = Context.GenericTag<{
  readonly loadRegion: (region: Region) => Effect.Effect<void, ChunkLoadError>
  readonly cancelAll: () => Effect.Effect<void>
}>("@minecraft/ChunkLoaderService")

export const makeChunkLoader = Effect.gen(function* () {
  const fiberSet = yield* FiberSet.make<ChunkData, ChunkLoadError>()

  return ChunkLoaderService.of({
    loadRegion: (region) =>
      Effect.gen(function* () {
        // 地域内のすべてのチャンクを並列ロード
        yield* Effect.all(
          region.chunks.map(coordinate =>
            FiberSet.run(fiberSet)(
              ChunkService.loadChunk(coordinate).pipe(
                Effect.timeout("30 seconds")
              )
            )
          )
        )

        // すべてのFiberの完了を待機
        yield* FiberSet.join(fiberSet)
      }),

    cancelAll: () =>
      Effect.gen(function* () {
        // 実行中のすべてのFiberを中断
        yield* FiberSet.clear(fiberSet)
      })
  })
})
```

## Pattern 11: Async Resource Pool with Circuit Breaker

**使用場面**: 外部リソースの安全な管理

**実装**:
```typescript
import { Pool, Ref, Schedule } from "effect"

interface DatabaseConnection {
  readonly query: (sql: string) => Effect.Effect<unknown[], DatabaseError>
  readonly close: () => Effect.Effect<void>
}

// サーキットブレーカー付きコネクションプール
export const createDatabasePool = (
  maxConnections: number,
  circuitBreakerThreshold: number = 5
) =>
  Effect.gen(function* () {
    const failureCount = yield* Ref.make(0)
    const lastFailure = yield* Ref.make<number | null>(null)

    const pool = yield* Pool.make({
      acquire: Effect.gen(function* () {
        // サーキットブレーカーチェック
        const failures = yield* Ref.get(failureCount)
        const lastFail = yield* Ref.get(lastFailure)
        const now = Date.now()

        if (failures >= circuitBreakerThreshold &&
            lastFail && (now - lastFail) < 30000) {
          return yield* Effect.fail(new CircuitBreakerOpenError())
        }

        // コネクション作成
        const connection = yield* createDatabaseConnection().pipe(
          Effect.tapError(() =>
            Effect.gen(function* () {
              yield* Ref.update(failureCount, n => n + 1)
              yield* Ref.set(lastFailure, now)
            })
          ),
          Effect.tap(() => Ref.set(failureCount, 0)) // 成功時はリセット
        )

        return connection
      }),
      release: (connection) => connection.close(),
    })

    return {
      withConnection: <A, E>(
        f: (connection: DatabaseConnection) => Effect.Effect<A, E>
      ) => Pool.get(pool).pipe(Effect.flatMap(f))
    }
  })
```

## Pattern 12: Stream-based Event Processing

**使用場面**: リアルタイムイベント処理

**実装**:
```typescript
import { Stream, PubSub, Fiber } from "effect"

// イベント処理システム
export const createEventProcessor = <TEvent>(
  eventSource: Stream.Stream<TEvent, never>,
  handlers: ReadonlyArray<{
    predicate: (event: TEvent) => boolean
    handler: (event: TEvent) => Effect.Effect<void, ProcessingError>
  }>
) =>
  Effect.gen(function* () {
    // PubSub for event distribution
    const pubsub = yield* PubSub.bounded<TEvent>(1000)

    // Event publisher fiber
    const publisher = yield* Effect.fork(
      eventSource.pipe(
        Stream.runForEach(event => PubSub.publish(pubsub, event))
      )
    )

    // Handler fibers
    const handlerFibers = yield* Effect.all(
      handlers.map(({ predicate, handler }) =>
        Effect.fork(
          Stream.fromPubSub(pubsub).pipe(
            Stream.filter(predicate),
            Stream.mapEffect(handler, { concurrency: 5 }),
            Stream.runDrain
          )
        )
      )
    )

    return {
      shutdown: Effect.gen(function* () {
        yield* PubSub.shutdown(pubsub)
        yield* Fiber.interrupt(publisher)
        yield* Fiber.interruptAll(handlerFibers)
      })
    }
  })

// 使用例：ゲームイベント処理
export const gameEventProcessor = createEventProcessor(
  gameEventStream,
  [
    {
      predicate: (event): event is PlayerJoinEvent =>
        event.type === "player_join",
      handler: (event) =>
        Effect.gen(function* () {
          yield* PlayerService.initializePlayer(event.playerId)
          yield* WorldService.loadPlayerSpawn(event.spawnLocation)
        })
    },
    {
      predicate: (event): event is ChunkLoadEvent =>
        event.type === "chunk_load",
      handler: (event) =>
        Effect.gen(function* () {
          yield* ChunkService.loadChunk(event.coordinate)
          yield* Effect.log(`Chunk loaded: ${event.coordinate.x},${event.coordinate.z}`)
        })
    }
  ]
)

## Pattern 13: Pattern Matching for Async Flow Control

**使用場面**: 複雑な非同期フロー制御

**実装**:
```typescript
import { Match, pipe } from "effect"

// パターンマッチングを使った非同期フロー制御
export const processGameEvent = (event: GameEvent) =>
  pipe(
    event,
    Match.value,
    Match.when({ type: "player_join" }, (joinEvent) =>
      Effect.gen(function* () {
        // プレイヤー参加時の並列処理
        const [playerData, spawnChunk] = yield* Effect.all([
          PlayerService.createPlayer(joinEvent.playerId).pipe(
            Effect.fork
          ).pipe(Effect.flatMap(Fiber.join)),
          ChunkService.loadChunk(joinEvent.spawnLocation).pipe(
            Effect.fork
          ).pipe(Effect.flatMap(Fiber.join))
        ], { concurrency: "unbounded" })

        yield* WorldService.spawnPlayer(playerData, spawnChunk)
        return "player_spawned" as const
      })
    ),
    Match.when({ type: "chunk_unload" }, (unloadEvent) =>
      Effect.gen(function* () {
        // チャンクアンロード時の早期リターン
        const hasPlayers = yield* PlayerService.checkPlayersInChunk(unloadEvent.coordinate)

        if (hasPlayers) {
          return "chunk_kept" as const
        }

        const unloadFiber = yield* Effect.fork(
          ChunkService.unloadChunk(unloadEvent.coordinate)
        )

        yield* Fiber.join(unloadFiber)
        return "chunk_unloaded" as const
      })
    ),
    Match.when({ type: "world_save" }, () =>
      Effect.gen(function* () {
        // 世界保存時のStream処理
        const chunks = yield* ChunkService.getAllLoadedChunks()

        yield* Stream.fromIterable(chunks).pipe(
          Stream.mapEffect(chunk =>
            ChunkService.saveChunk(chunk).pipe(
              Effect.timeout("5 seconds"),
              Effect.retry(Schedule.exponential("100 millis"))
            ),
            { concurrency: 10 }
          ),
          Stream.runDrain
        )

        return "world_saved" as const
      })
    ),
    Match.orElse(() =>
      Effect.succeed("event_ignored" as const)
    )
  )

// 早期リターンパターンの実装
export const validateAndProcessChunk = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    // バリデーション（早期リターン）
    const isValid = yield* ChunkValidator.validate(coordinate)
    if (!isValid) {
      return { status: "invalid", coordinate } as const
    }

    // 既存チェック（早期リターン）
    const existing = yield* ChunkService.findChunk(coordinate)
    if (Option.isSome(existing)) {
      return { status: "exists", chunk: existing.value } as const
    }

    // 生成処理（Fiber使用）
    const generationFiber = yield* Effect.fork(
      ChunkGenerator.generate(coordinate)
    )

    const chunk = yield* Fiber.join(generationFiber)

    return { status: "generated", chunk } as const
  })

// Stream + パターンマッチング
export const processEventStream = (events: Stream.Stream<GameEvent, never>) =>
  events.pipe(
    Stream.mapEffect(event =>
      processGameEvent(event).pipe(
        Effect.catchAll(error =>
          Effect.gen(function* () {
            yield* Effect.logError("Event processing failed", error)
            return "event_failed" as const
          })
        )
      )
    ),
    Stream.filter(result => result !== "event_ignored"),
    Stream.grouped(10),
    Stream.mapEffect(batch =>
      Effect.gen(function* () {
        yield* Effect.log(`Processed batch of ${batch.length} events`)
        return batch
      })
    )
  )
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Promise.all の直接使用

```typescript
// これは避ける - Promiseの直接使用
const loadMultipleChunks = async (coords: ChunkCoordinate[]) => {
  const promises = coords.map(coord => loadChunk(coord))
  return await Promise.all(promises)
}
```

### ❌ Anti-Pattern 2: 手動でのtry-catch

```typescript
// これも避ける - 手動try-catch とasync/await
const processWithRetry = async (data: unknown) => {
  for (let i = 0; i < 3; i++) {
    try {
      return await processData(data)
    } catch (error) {
      if (i === 2) throw error
      await sleep(1000 * (i + 1))
    }
  }
}
```

### ✅ Always Use: Effect.all + Effect.retry

```typescript
const loadMultipleChunks = (coords: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    // Fiberで並列実行
    const fibers = yield* Effect.all(
      coords.map(coord =>
        Effect.fork(
          loadChunk(coord).pipe(
            Effect.retry(Schedule.exponential("100 millis")),
            Effect.timeout("30 seconds")
          )
        )
      )
    )

    // 全Fiberの完了を待つ
    return yield* Fiber.joinAll(fibers)
  })
```

## Performance Optimization

### 1. 適切なコンカレンシー制御

```typescript
// CPU集約的タスク: CPUコア数に基づく制限（Fiber使用）
const cpuIntensiveTasks = Effect.gen(function* () {
  const concurrency = navigator.hardwareConcurrency || 4
  const fibers = yield* Effect.all(
    tasks.map(task => Effect.fork(task))
  )
  return yield* Fiber.joinAll(fibers.slice(0, concurrency))
})

// I/O集約的タスク: より多くの並列処理が可能（Queue使用）
const ioIntensiveTasks = Effect.gen(function* () {
  const queue = yield* Queue.bounded<Effect.Effect<unknown, unknown>>(100)

  // プロデューサー
  yield* Effect.fork(
    Effect.all(tasks.map(task => Queue.offer(queue, task)))
  )

  // コンシューマー（20並列）
  const workers = yield* Effect.all(
    Array.from({ length: 20 }, () =>
      Effect.fork(
        Effect.forever(
          Effect.gen(function* () {
            const task = yield* Queue.take(queue)
            yield* task
          })
        )
      )
    )
  )

  return workers
})

// 軽量タスク: Streamで処理
const lightweightTasks = Stream.fromIterable(tasks).pipe(
  Stream.mapEffect(task => task, { concurrency: "unbounded" }),
  Stream.runCollect
)
```

### 2. ストリーミングでのメモリ効率

```typescript
// 大量データを一度に読み込まない（Queue + Stream使用）
const processLargeDataSet = (items: ReadonlyArray<Item>) =>
  Effect.gen(function* () {
    // バックプレッシャー付きQueue
    const queue = yield* Queue.bounded<Item>(1000)

    // プロデューサーFiber
    const producer = yield* Effect.fork(
      Stream.fromIterable(items).pipe(
        Stream.runIntoQueue(queue)
      )
    )

    // コンシューマーFiber（Streamでバッチ処理）
    const consumer = yield* Effect.fork(
      Stream.fromQueue(queue).pipe(
        Stream.mapEffect(processItem, { concurrency: 5 }),
        Stream.grouped(100), // バッチサイズ
        Stream.mapEffect(processBatch),
        Stream.runDrain
      )
    )

    // 両Fiberの完了を待つ
    yield* Fiber.join(producer)
    yield* Queue.shutdown(queue)
    yield* Fiber.join(consumer)
  })
```

### 3. リソースプールの活用

```typescript
export const DatabasePoolLive = Layer.scoped(
  DatabasePool,
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      createConnectionPool({ minConnections: 5, maxConnections: 20 }),
      closeConnectionPool
    )
    return pool
  })
)

## Testing Async Patterns

Effect-TSの非同期パターンをテストする際のベストプラクティス:

```typescript
import { Effect, TestServices, TestContext, Fiber } from "effect"

// Fiberのテスト
const testFiberExecution = Effect.gen(function* () {
  // テスト用のFiberを作成
  const fiber = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep("100 millis")
      return "test result"
    })
  )

  // Fiberの状態をテスト
  const result = yield* Fiber.join(fiber)
  expect(result).toBe("test result")
})

// Queueのテスト
const testQueueProcessing = Effect.gen(function* () {
  const queue = yield* Queue.bounded<string>(10)

  // プロデューサー
  yield* Queue.offer(queue, "test1")
  yield* Queue.offer(queue, "test2")

  // コンシューマー
  const item1 = yield* Queue.take(queue)
  const item2 = yield* Queue.take(queue)

  expect(item1).toBe("test1")
  expect(item2).toBe("test2")
})

// ストリームのテスト
const testStreamProcessing = Effect.gen(function* () {
  const results = yield* Stream.make(1, 2, 3).pipe(
    Stream.mapEffect(n => Effect.succeed(n * 2)),
    Stream.runCollect
  )

  expect(Array.from(results)).toEqual([2, 4, 6])
})

// テストスイート実行
Effect.gen(function* () {
  yield* testFiberExecution
  yield* testQueueProcessing
  yield* testStreamProcessing
}).pipe(
  Effect.provide(TestServices.TestServices)
)