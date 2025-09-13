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

## Pattern 1: Basic Effect.gen Pattern

**使用場面**: 逐次非同期処理の基本パターン

**実装**:
```typescript
import { Effect, Console } from "effect"

export const basicAsyncOperation = Effect.gen(function* () {
  // 非同期処理1
  yield* Console.log("Starting operation...")

  // Promise をEffect に変換
  const data = yield* Effect.tryPromise({
    try: () => fetch("/api/data").then(r => r.json()),
    catch: (error) => new NetworkError({ cause: error })
  })

  // 非同期処理2
  const processed = yield* processData(data)

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
// 並列処理の基本
export const parallelChunkLoading = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService

    // 全座標のチャンクを並列で読み込み
    const chunks = yield* Effect.all(
      coordinates.map(coord =>
        chunkService.loadChunk(coord).pipe(
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* Effect.logError(`Failed to load chunk at ${coord.x},${coord.z}`, error)
              return Option.none()
            })
          )
        )
      ),
      { concurrency: 5 } // 同時実行数を制限
    )

    // 成功したチャンクのみをフィルタ
    return chunks.filter(Option.isSome).map(chunk => chunk.value)
  })

// オブジェクト形式での並列処理
export const loadPlayerData = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const [profile, inventory, stats, achievements] = yield* Effect.all([
      PlayerService.getProfile(playerId),
      InventoryService.getInventory(playerId),
      StatsService.getStats(playerId),
      AchievementService.getAchievements(playerId)
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
import { Stream, Sink } from "effect"

// チャンクの連続読み込み処理
export const processChunkStream = (coordinates: ChunkCoordinate[]) =>
  Stream.fromIterable(coordinates).pipe(
    // 並列変換（最大5並列）
    Stream.mapEffect(coord =>
      ChunkService.loadChunk(coord).pipe(
        Effect.timeout("30 seconds")
      ),
      { concurrency: 5 }
    ),
    // エラーを無視して継続
    Stream.catchAll(error =>
      Stream.fromEffect(
        Effect.gen(function* () {
          yield* Effect.logError("Chunk processing failed", error)
          return Option.none()
        })
      )
    ),
    // 成功したチャンクのみをフィルタ
    Stream.filter(Option.isSome),
    Stream.map(chunk => chunk.value),
    // バッチ処理（10チャンクずつ）
    Stream.grouped(10),
    Stream.mapEffect(chunkBatch =>
      Effect.gen(function* () {
        yield* Effect.log(`Processing batch of ${chunkBatch.length} chunks`)
        return yield* WorldService.updateChunks(chunkBatch)
      })
    )
  )

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
// ワーカープールサービス
export const WorkerPoolService = Context.GenericTag<{
  readonly submitTask: <A, E>(task: Effect.Effect<A, E>) => Effect.Effect<A, E | WorkerBusyError>
  readonly getStatus: () => Effect.Effect<WorkerPoolStatus, never>
}>("@minecraft/WorkerPoolService")

export const makeWorkerPool = (maxWorkers: number) =>
  Effect.gen(function* () {
    const semaphore = yield* Semaphore.make(maxWorkers)
    const activeWorkers = yield* Ref.make(0)

    return WorkerPoolService.of({
      submitTask: <A, E>(task: Effect.Effect<A, E>) =>
        Effect.gen(function* () {
          return yield* Semaphore.withPermit(semaphore)(
            Effect.gen(function* () {
              yield* Ref.update(activeWorkers, n => n + 1)
              try {
                return yield* task
              } finally {
                yield* Ref.update(activeWorkers, n => n - 1)
              }
            })
          )
        }),

      getStatus: () =>
        Effect.gen(function* () {
          const available = yield* Semaphore.available(semaphore)
          const active = yield* Ref.get(activeWorkers)
          return {
            maxWorkers,
            available,
            active,
            total: maxWorkers
          }
        })
    })
  })

// 使用例：チャンク生成の並列処理
export const generateChunksInParallel = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    const workerPool = yield* WorkerPoolService

    const tasks = coordinates.map(coord =>
      workerPool.submitTask(
        Effect.gen(function* () {
          const generator = yield* ChunkGeneratorService
          return yield* generator.generateChunk(coord)
        })
      )
    )

    return yield* Effect.all(tasks, { concurrency: "unbounded" })
  })
```

## Pattern 7: Timeout and Cancellation

**使用場面**: 長時間実行タスクのタイムアウト制御

**実装**:
```typescript
// タイムアウト付きの処理
export const loadPlayerWithTimeout = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const playerService = yield* PlayerService

    return yield* playerService.loadPlayer(playerId).pipe(
      Effect.timeout("10 seconds"),
      Effect.catchTag("TimeoutException", () =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`Player loading timed out: ${playerId}`)
          return yield* Effect.fail(new PlayerLoadTimeoutError({ playerId }))
        })
      )
    )
  })

// キャンセレーション対応の長時間処理
export const performLongRunningTask = (
  taskId: TaskId,
  onProgress: (progress: number) => Effect.Effect<void>
) =>
  Effect.gen(function* () {
    const steps = 100

    for (let i = 0; i < steps; i++) {
      // キャンセルチェック
      yield* Effect.yieldNow()

      // 進捗報告
      yield* onProgress((i + 1) / steps)

      // 実際の処理（キャンセル可能）
      yield* performTaskStep(taskId, i).pipe(
        Effect.interruptible
      )
    }

    return `Task ${taskId} completed successfully`
  }).pipe(
    Effect.uninterruptible, // 重要な処理中は中断不可にする場合
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
// レートリミッターサービス
export const RateLimiterService = Context.GenericTag<{
  readonly acquire: (key: string) => Effect.Effect<void, RateLimitExceededError>
  readonly reset: (key: string) => Effect.Effect<void>
}>("@minecraft/RateLimiterService")

export const makeRateLimiter = (maxRequests: number, windowMs: number) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make(new Map<string, { count: number; resetTime: number }>())

    return RateLimiterService.of({
      acquire: (key) =>
        Effect.gen(function* () {
          const now = Date.now()
          const current = yield* Ref.get(requests)
          const entry = current.get(key)

          if (!entry || entry.resetTime <= now) {
            // 新しいウィンドウ
            yield* Ref.update(requests, map =>
              new Map(map).set(key, {
                count: 1,
                resetTime: now + windowMs
              })
            )
            return
          }

          if (entry.count >= maxRequests) {
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
        Ref.update(requests, map => {
          const newMap = new Map(map)
          newMap.delete(key)
          return newMap
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
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: Promise.all の直接使用

```typescript
// これは避ける
const loadMultipleChunks = async (coords: ChunkCoordinate[]) => {
  const promises = coords.map(coord => loadChunk(coord))
  return await Promise.all(promises)
}
```

### ❌ Anti-Pattern 2: 手動でのtry-catch

```typescript
// これも避ける
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
  Effect.all(
    coords.map(coord =>
      loadChunk(coord).pipe(
        Effect.retry(Schedule.exponential("100 millis"))
      )
    ),
    { concurrency: 5 }
  )
```

## Performance Optimization

### 1. 適切なコンカレンシー制御

```typescript
// CPU集約的タスク: CPUコア数に基づく制限
const cpuIntensiveTasks = Effect.all(tasks, {
  concurrency: navigator.hardwareConcurrency || 4
})

// I/O集約的タスク: より多くの並列処理が可能
const ioIntensiveTasks = Effect.all(tasks, {
  concurrency: 20
})

// 無制限（メモリ消費に注意）
const lightweightTasks = Effect.all(tasks, {
  concurrency: "unbounded"
})
```

### 2. ストリーミングでのメモリ効率

```typescript
// 大量データを一度に読み込まない
const processLargeDataSet = (items: ReadonlyArray<Item>) =>
  Stream.fromIterable(items).pipe(
    Stream.mapEffect(processItem, { concurrency: 5 }),
    Stream.grouped(100), // バッチサイズ
    Stream.mapEffect(processBatch),
    Stream.runDrain
  )
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
```