---
title: "Performance Patterns"
category: "Pattern Catalog"
complexity: "high"
dependencies:
  - "effect"
  - "@effect/platform"
  - "@effect/schema"
ai_tags:
  - "performance-optimization"
  - "caching"
  - "resource-pooling"
  - "streaming"
  - "memory-management"
  - "concurrent-processing"
implementation_time: "3-4 hours"
skill_level: "advanced"
last_pattern_update: "2025-09-14"
---

# Performance Patterns

Effect-TS 3.17+を使用したパフォーマンス最適化パターン集。Minecraftゲーム開発特有のシナリオに焦点を当てた実践的な最適化手法を提供します。

## Pattern 1: Effect.cached による戦略的キャッシング

**使用場面**: 重い計算処理の結果をメモ化する場合

**実装**:
```typescript
import { Effect, Cache, Duration, Ref } from "effect"

// チャンク生成の結果をキャッシュ
export const CachedChunkGeneratorService = Context.GenericTag<{
  readonly generateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly preloadChunks: (coordinates: ChunkCoordinate[]) => Effect.Effect<void, ChunkGenerationError>
  readonly invalidateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void>
}>("@minecraft/CachedChunkGeneratorService")

const makeCachedChunkGenerator = Effect.gen(function* () {
  const baseGenerator = yield* ChunkGeneratorService

  // TTL付きキャッシュの作成
  const chunkCache = yield* Cache.make({
    capacity: 1000, // 最大1000チャンクをキャッシュ
    timeToLive: Duration.minutes(30), // 30分でキャッシュ期限切れ
    lookup: (coordinate: ChunkCoordinate) => baseGenerator.generateChunk(coordinate)
  })

  // アクセス頻度によるキャッシュ優先度管理
  const accessCount = yield* Ref.make(new Map<string, number>())

  const getCoordKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

  return CachedChunkGeneratorService.of({
    generateChunk: (coordinate) =>
      Effect.gen(function* () {
        // アクセス回数を記録
        const key = getCoordKey(coordinate)
        yield* Ref.update(accessCount, map => {
          const current = map.get(key) || 0
          return new Map(map).set(key, current + 1)
        })

        return yield* Cache.get(chunkCache, coordinate)
      }),

    preloadChunks: (coordinates) =>
      Effect.gen(function* () {
        // バックグラウンドで事前読み込み
        yield* Effect.all(
          coordinates.map(coord =>
            Cache.get(chunkCache, coord).pipe(
              Effect.catchAll(error =>
                Effect.gen(function* () {
                  yield* Effect.logError(`Preload failed for chunk ${getCoordKey(coord)}`, error)
                  return yield* Effect.void
                })
              )
            )
          ),
          { concurrency: 5 }
        )
      }),

    invalidateChunk: (coordinate) =>
      Cache.invalidate(chunkCache, coordinate)
  })
})

export const CachedChunkGeneratorLive = Layer.effect(
  CachedChunkGeneratorService,
  makeCachedChunkGenerator
)

// 階層キャッシュパターン
export const MultiLevelCacheService = Context.GenericTag<{
  readonly get: <K, V>(key: K) => Effect.Effect<Option.Option<V>, never>
  readonly set: <K, V>(key: K, value: V) => Effect.Effect<void>
}>("@minecraft/MultiLevelCacheService")

const makeMultiLevelCache = Effect.gen(function* () {
  // L1: メモリキャッシュ（高速、小容量）
  const l1Cache = yield* Cache.make({
    capacity: 100,
    timeToLive: Duration.minutes(5),
    lookup: (key: string) => Effect.fail("Cache miss" as const)
  })

  // L2: ディスクキャッシュ（中速、大容量）
  const diskCache = yield* DiskCacheService

  return MultiLevelCacheService.of({
    get: <K, V>(key: K) =>
      Effect.gen(function* () {
        // L1キャッシュから試行
        const l1Result = yield* Cache.get(l1Cache, String(key)).pipe(
          Effect.map(Option.some),
          Effect.catchAll(() => Effect.succeed(Option.none()))
        )

        if (Option.isSome(l1Result)) {
          return l1Result
        }

        // L2キャッシュから試行
        const l2Result = yield* diskCache.get(key)
        if (Option.isSome(l2Result)) {
          // L1キャッシュに昇格
          yield* Cache.set(l1Cache, String(key), l2Result.value)
        }

        return l2Result
      }),

    set: <K, V>(key: K, value: V) =>
      Effect.gen(function* () {
        // 両方のキャッシュに保存
        yield* Cache.set(l1Cache, String(key), value)
        yield* diskCache.set(key, value)
      })
  })
})
```

## Pattern 2: Resource Pooling with Pool

**使用場面**: 高価なリソース（データベース接続、ファイルハンドルなど）の効率的な管理

**実装**:
```typescript
import { Pool, Effect, Queue, Ref } from "effect"

// データベース接続プールの実装
export const DatabaseConnectionPoolService = Context.GenericTag<{
  readonly withConnection: <A, E>(
    operation: (connection: DatabaseConnection) => Effect.Effect<A, E>
  ) => Effect.Effect<A, E | ConnectionPoolError>
  readonly getPoolStats: () => Effect.Effect<PoolStats>
}>("@minecraft/DatabaseConnectionPoolService")

const makeDatabaseConnectionPool = Effect.gen(function* () {
  // リソースプールの作成
  const connectionPool = yield* Pool.make({
    acquire: Effect.gen(function* () {
      yield* Effect.log("Creating new database connection")
      const connection = yield* DatabaseConnection.create()
      yield* connection.ping() // 接続確認
      return connection
    }),
    size: 10 // 最大10接続
  })

  // 統計情報の管理
  const stats = yield* Ref.make({
    totalAcquired: 0,
    totalReleased: 0,
    currentActive: 0,
    errors: 0
  })

  return DatabaseConnectionPoolService.of({
    withConnection: <A, E>(
      operation: (connection: DatabaseConnection) => Effect.Effect<A, E>
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(stats, s => ({ ...s, totalAcquired: s.totalAcquired + 1 }))

        return yield* Pool.get(connectionPool).pipe(
          Effect.flatMap(connection =>
            Effect.gen(function* () {
              yield* Ref.update(stats, s => ({ ...s, currentActive: s.currentActive + 1 }))

              try {
                return yield* operation(connection)
              } finally {
                yield* Ref.update(stats, s => ({
                  ...s,
                  currentActive: s.currentActive - 1,
                  totalReleased: s.totalReleased + 1
                }))
              }
            })
          ),
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* Ref.update(stats, s => ({ ...s, errors: s.errors + 1 }))
              return yield* Effect.fail(error)
            })
          )
        )
      }),

    getPoolStats: () => Ref.get(stats)
  })
})

// ファイルハンドルプールの実装
export const FileHandlePoolService = Context.GenericTag<{
  readonly withFile: <A, E>(
    path: string,
    operation: (handle: FileHandle) => Effect.Effect<A, E>
  ) => Effect.Effect<A, E | FilePoolError>
}>("@minecraft/FileHandlePoolService")

const makeFileHandlePool = Effect.gen(function* () {
  // ファイルパス別のプール管理
  const pools = yield* Ref.make(new Map<string, Pool.Pool<FileHandle, FileOpenError>>())

  const getOrCreatePool = (path: string) =>
    Effect.gen(function* () {
      const currentPools = yield* Ref.get(pools)
      const existing = currentPools.get(path)

      if (existing) {
        return existing
      }

      const newPool = yield* Pool.make({
        acquire: Effect.gen(function* () {
          yield* Effect.log(`Opening file handle for: ${path}`)
          return yield* FileSystem.open(path, "r+")
        }),
        size: 5 // ファイル毎に最大5ハンドル
      })

      yield* Ref.update(pools, map => new Map(map).set(path, newPool))
      return newPool
    })

  return FileHandlePoolService.of({
    withFile: <A, E>(
      path: string,
      operation: (handle: FileHandle) => Effect.Effect<A, E>
    ) =>
      Effect.gen(function* () {
        const pool = yield* getOrCreatePool(path)
        return yield* Pool.get(pool).pipe(
          Effect.flatMap(operation)
        )
      })
  })
})
```

## Pattern 3: Stream Optimizations

**使用場面**: 大量データの効率的なストリーミング処理

**実装**:
```typescript
import { Stream, Sink, Chunk } from "effect"

// チャンクの効率的なストリーミング読み込み
export const OptimizedChunkStreamService = Context.GenericTag<{
  readonly streamChunksInRadius: (
    center: ChunkCoordinate,
    radius: number
  ) => Stream.Stream<ChunkData, ChunkLoadError>
  readonly processChunkBatch: (
    chunks: Stream.Stream<ChunkData, ChunkLoadError>
  ) => Effect.Effect<ProcessingResult, BatchProcessingError>
}>("@minecraft/OptimizedChunkStreamService")

const makeOptimizedChunkStream = Effect.gen(function* () {
  const chunkLoader = yield* ChunkLoaderService
  const chunkProcessor = yield* ChunkProcessorService

  return OptimizedChunkStreamService.of({
    streamChunksInRadius: (center, radius) => {
      // 螺旋状に座標を生成（近い順）
      const coordinates = generateSpiralCoordinates(center, radius)

      return Stream.fromIterable(coordinates).pipe(
        // 適応的並列度（距離に基づく優先度制御）
        Stream.mapEffect(coord => {
          const distance = calculateDistance(center, coord)
          const priority = Math.max(1, 10 - Math.floor(distance / 16))

          return chunkLoader.loadChunk(coord).pipe(
            Effect.timeout(Duration.seconds(30)),
            Effect.retry(
              Schedule.exponential("100 millis").pipe(
                Schedule.compose(Schedule.recurs(3))
              )
            ),
            Effect.tapError(error =>
              Effect.logError(`Failed to load chunk at ${coord.x},${coord.z}`, error)
            )
          )
        }, {
          concurrency: 8, // 最大8並列
          bufferSize: 16   // バッファサイズ
        }),

        // エラーハンドリング（失敗したチャンクはスキップ）
        Stream.catchAll(error =>
          Stream.fromEffect(
            Effect.gen(function* () {
              yield* Effect.logWarning("Skipping failed chunk", error)
              return Option.none()
            })
          )
        ),
        Stream.filter(Option.isSome),
        Stream.map(chunk => chunk.value),

        // バックプレッシャー制御
        Stream.buffer({ capacity: 32 })
      )
    },

    processChunkBatch: (chunks) =>
      Effect.gen(function* () {
        const processedCount = yield* Ref.make(0)
        const errors = yield* Ref.make<ChunkLoadError[]>([])

        const result = yield* chunks.pipe(
          // チャンクを16個ずつのバッチに分割
          Stream.grouped(16),
          Stream.mapEffect(chunkBatch =>
            Effect.gen(function* () {
              // バッチ処理の最適化
              const batchResults = yield* Effect.all(
                chunkBatch.map(chunk =>
                  chunkProcessor.processChunk(chunk).pipe(
                    Effect.either
                  )
                ),
                { concurrency: "unbounded" }
              )

              // 結果の集計
              const successes = batchResults.filter(Either.isRight).length
              const failures = batchResults
                .filter(Either.isLeft)
                .map(result => result.left)

              yield* Ref.update(processedCount, n => n + successes)
              yield* Ref.update(errors, errs => [...errs, ...failures])

              yield* Effect.log(
                `Processed batch: ${successes} success, ${failures.length} failures`
              )

              return successes
            })
          ),
          Stream.runSum
        )

        const totalProcessed = yield* Ref.get(processedCount)
        const allErrors = yield* Ref.get(errors)

        return {
          totalProcessed,
          errors: allErrors,
          success: allErrors.length === 0
        }
      })
  })
})

// メモリ効率的な大ファイル処理
export const streamLargeWorldFile = (filePath: string) =>
  Stream.fromReadableStream(
    () => FileSystem.createReadStream(filePath),
    error => new FileStreamError({ cause: error })
  ).pipe(
    // チャンク単位でのパース
    Stream.chunks,
    Stream.mapChunks(chunk =>
      Chunk.map(chunk, parseWorldDataChunk)
    ),
    Stream.mapEffect(worldData =>
      Effect.gen(function* () {
        // 各チャンクデータを処理
        const processed = yield* processWorldData(worldData)

        // メモリ使用量の監視
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const memory = process.memoryUsage()
          if (memory.heapUsed > 1024 * 1024 * 1024) { // 1GB
            yield* Effect.logWarning(`High memory usage: ${memory.heapUsed}`)
            // ガベージコレクションの強制実行
            if (global.gc) global.gc()
          }
        }

        return processed
      }),
      { concurrency: 4 }
    ),

    // バックプレッシャー対応
    Stream.buffer({ capacity: 8, strategy: "dropping" })
  )
```

## Pattern 4: Memory Management with Ref

**使用場面**: メモリリークの防止と効率的なメモリ使用

**実装**:
```typescript
import { Ref, WeakRef, FiberRef } from "effect"

// 自動クリーンアップ付きキャッシュ
export const SelfCleaningCacheService = Context.GenericTag<{
  readonly get: <K, V>(key: K) => Effect.Effect<Option.Option<V>>
  readonly set: <K, V>(key: K, value: V, ttl?: Duration.Duration) => Effect.Effect<void>
  readonly cleanup: () => Effect.Effect<number> // 削除された項目数を返す
}>("@minecraft/SelfCleaningCacheService")

interface CacheEntry<V> {
  readonly value: V
  readonly createdAt: number
  readonly ttl: number
  readonly accessCount: number
  readonly lastAccessed: number
}

const makeSelfCleaningCache = Effect.gen(function* () {
  const cache = yield* Ref.make(new Map<string, CacheEntry<unknown>>())

  // バックグラウンドでの定期クリーンアップ
  const startCleanupScheduler = Effect.gen(function* () {
    yield* Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.minutes(5)) // 5分間隔
        const cleaned = yield* cleanupExpiredEntries()
        if (cleaned > 0) {
          yield* Effect.log(`Cleaned up ${cleaned} expired cache entries`)
        }
      })
    ).pipe(
      Effect.forkDaemon // デーモンファイバーとして実行
    )
  })

  const cleanupExpiredEntries = Effect.gen(function* () {
    const now = Date.now()
    const currentCache = yield* Ref.get(cache)
    let cleanedCount = 0

    const newCache = new Map<string, CacheEntry<unknown>>()

    for (const [key, entry] of currentCache) {
      if (now - entry.createdAt < entry.ttl) {
        newCache.set(key, entry)
      } else {
        cleanedCount++
      }
    }

    yield* Ref.set(cache, newCache)
    return cleanedCount
  })

  // 初期化時にクリーンアップスケジューラーを開始
  yield* startCleanupScheduler

  return SelfCleaningCacheService.of({
    get: <K, V>(key: K) =>
      Effect.gen(function* () {
        const keyStr = String(key)
        const currentCache = yield* Ref.get(cache)
        const entry = currentCache.get(keyStr) as CacheEntry<V> | undefined

        if (!entry) {
          return Option.none()
        }

        const now = Date.now()
        if (now - entry.createdAt >= entry.ttl) {
          // 期限切れエントリの削除
          yield* Ref.update(cache, map => {
            const newMap = new Map(map)
            newMap.delete(keyStr)
            return newMap
          })
          return Option.none()
        }

        // アクセス情報の更新
        const updatedEntry = {
          ...entry,
          accessCount: entry.accessCount + 1,
          lastAccessed: now
        }

        yield* Ref.update(cache, map =>
          new Map(map).set(keyStr, updatedEntry)
        )

        return Option.some(entry.value)
      }),

    set: <K, V>(key: K, value: V, ttl = Duration.hours(1)) =>
      Effect.gen(function* () {
        const keyStr = String(key)
        const now = Date.now()

        const entry: CacheEntry<V> = {
          value,
          createdAt: now,
          ttl: Duration.toMillis(ttl),
          accessCount: 0,
          lastAccessed: now
        }

        yield* Ref.update(cache, map =>
          new Map(map).set(keyStr, entry as CacheEntry<unknown>)
        )
      }),

    cleanup: cleanupExpiredEntries
  })
})

// WeakRefを使用したオブジェクト参照管理
export const WeakReferenceManagerService = Context.GenericTag<{
  readonly track: <T extends object>(obj: T, onFinalize?: () => void) => Effect.Effect<string>
  readonly get: <T extends object>(id: string) => Effect.Effect<Option.Option<T>>
  readonly getStats: () => Effect.Effect<{ tracked: number; alive: number }>
}>("@minecraft/WeakReferenceManagerService")

const makeWeakReferenceManager = Effect.gen(function* () {
  const weakRefs = yield* Ref.make(new Map<string, WeakRef<object>>())
  const finalizers = yield* Ref.make(new Map<string, () => void>())
  let nextId = 0

  return WeakReferenceManagerService.of({
    track: <T extends object>(obj: T, onFinalize?: () => void) =>
      Effect.gen(function* () {
        const id = `ref_${nextId++}`
        const weakRef = new WeakRef(obj)

        yield* Ref.update(weakRefs, map => new Map(map).set(id, weakRef))

        if (onFinalize) {
          yield* Ref.update(finalizers, map => new Map(map).set(id, onFinalize))
        }

        return id
      }),

    get: <T extends object>(id: string) =>
      Effect.gen(function* () {
        const refs = yield* Ref.get(weakRefs)
        const weakRef = refs.get(id)

        if (!weakRef) {
          return Option.none()
        }

        const obj = weakRef.deref()
        if (!obj) {
          // オブジェクトがGCされた場合のクリーンアップ
          yield* Ref.update(weakRefs, map => {
            const newMap = new Map(map)
            newMap.delete(id)
            return newMap
          })

          const finalizersMap = yield* Ref.get(finalizers)
          const finalizer = finalizersMap.get(id)
          if (finalizer) {
            finalizer()
            yield* Ref.update(finalizers, map => {
              const newMap = new Map(map)
              newMap.delete(id)
              return newMap
            })
          }

          return Option.none()
        }

        return Option.some(obj as T)
      }),

    getStats: () =>
      Effect.gen(function* () {
        const refs = yield* Ref.get(weakRefs)
        const tracked = refs.size

        let alive = 0
        for (const [, weakRef] of refs) {
          if (weakRef.deref()) {
            alive++
          }
        }

        return { tracked, alive }
      })
  })
})
```

## Pattern 5: Concurrent Processing Optimization

**使用場面**: 大規模な並列処理の最適化

**実装**:
```typescript
import { Effect, Fiber, Semaphore, Queue } from "effect"

// アダプティブ並列度制御
export const AdaptiveConcurrencyService = Context.GenericTag<{
  readonly processWithAdaptiveConcurrency: <A, E>(
    tasks: ReadonlyArray<Effect.Effect<A, E>>,
    options?: AdaptiveConcurrencyOptions
  ) => Effect.Effect<ReadonlyArray<A>, E>
}>("@minecraft/AdaptiveConcurrencyService")

interface AdaptiveConcurrencyOptions {
  readonly initialConcurrency?: number
  readonly maxConcurrency?: number
  readonly adaptationInterval?: Duration.Duration
  readonly targetLatency?: Duration.Duration
}

const makeAdaptiveConcurrency = Effect.gen(function* () {
  const currentConcurrency = yield* Ref.make(4)
  const latencyHistory = yield* Ref.make<number[]>([])
  const adaptationLock = yield* Semaphore.make(1)

  const adaptConcurrency = Effect.gen(function* () {
    return yield* Semaphore.withPermit(adaptationLock)(
      Effect.gen(function* () {
        const history = yield* Ref.get(latencyHistory)
        if (history.length < 5) return // 十分なデータがない

        const current = yield* Ref.get(currentConcurrency)
        const avgLatency = history.reduce((a, b) => a + b, 0) / history.length
        const targetLatency = 100 // 100ms

        if (avgLatency > targetLatency * 1.2) {
          // レイテンシが高い：並列度を下げる
          const newConcurrency = Math.max(1, Math.floor(current * 0.8))
          yield* Ref.set(currentConcurrency, newConcurrency)
          yield* Effect.log(`Reduced concurrency to ${newConcurrency}`)
        } else if (avgLatency < targetLatency * 0.8) {
          // レイテンシが低い：並列度を上げる
          const newConcurrency = Math.min(16, Math.floor(current * 1.2))
          yield* Ref.set(currentConcurrency, newConcurrency)
          yield* Effect.log(`Increased concurrency to ${newConcurrency}`)
        }

        // 履歴をリセット
        yield* Ref.set(latencyHistory, [])
      })
    )
  })

  return AdaptiveConcurrencyService.of({
    processWithAdaptiveConcurrency: <A, E>(
      tasks: ReadonlyArray<Effect.Effect<A, E>>,
      options: AdaptiveConcurrencyOptions = {}
    ) =>
      Effect.gen(function* () {
        const concurrency = yield* Ref.get(currentConcurrency)
        const startTime = Date.now()

        const results = yield* Effect.all(tasks, { concurrency })

        const endTime = Date.now()
        const latency = endTime - startTime

        // レイテンシ履歴を更新
        yield* Ref.update(latencyHistory, history =>
          [...history, latency].slice(-10) // 最新10件を保持
        )

        // 定期的に並列度を調整
        yield* adaptConcurrency.pipe(Effect.forkDaemon)

        return results
      })
  })
})

// バッチ処理の最適化
export const BatchProcessorService = Context.GenericTag<{
  readonly processBatch: <A, B, E>(
    items: ReadonlyArray<A>,
    processor: (batch: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<B>, E>,
    options?: BatchProcessingOptions
  ) => Effect.Effect<ReadonlyArray<B>, E>
}>("@minecraft/BatchProcessorService")

interface BatchProcessingOptions {
  readonly batchSize?: number
  readonly maxConcurrency?: number
  readonly priorityFunction?: (item: any) => number
  readonly retryOptions?: {
    readonly maxRetries: number
    readonly backoff: Schedule.Schedule<any, any, Duration.Duration>
  }
}

const makeBatchProcessor = Effect.gen(function* () {
  const metrics = yield* Ref.make({
    totalProcessed: 0,
    totalBatches: 0,
    failures: 0,
    averageBatchTime: 0
  })

  return BatchProcessorService.of({
    processBatch: <A, B, E>(
      items: ReadonlyArray<A>,
      processor: (batch: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<B>, E>,
      options: BatchProcessingOptions = {}
    ) =>
      Effect.gen(function* () {
        const {
          batchSize = 50,
          maxConcurrency = 4,
          priorityFunction,
          retryOptions
        } = options

        // 優先度による並び替え
        const sortedItems = priorityFunction
          ? [...items].sort((a, b) => priorityFunction(b) - priorityFunction(a))
          : items

        // バッチに分割
        const batches: ReadonlyArray<A>[] = []
        for (let i = 0; i < sortedItems.length; i += batchSize) {
          batches.push(sortedItems.slice(i, i + batchSize))
        }

        yield* Effect.log(`Processing ${items.length} items in ${batches.length} batches`)

        const startTime = Date.now()

        // バッチを並列処理
        const batchTasks = batches.map((batch, index) =>
          Effect.gen(function* () {
            const batchStartTime = Date.now()

            const processingEffect = retryOptions
              ? processor(batch).pipe(
                  Effect.retry(retryOptions.backoff),
                  Effect.tapError(error =>
                    Effect.gen(function* () {
                      yield* Effect.logError(`Batch ${index} failed after retries`, error)
                      yield* Ref.update(metrics, m => ({ ...m, failures: m.failures + 1 }))
                    })
                  )
                )
              : processor(batch)

            const result = yield* processingEffect

            const batchTime = Date.now() - batchStartTime
            yield* Effect.log(`Batch ${index} completed in ${batchTime}ms`)

            return result
          })
        )

        const batchResults = yield* Effect.all(batchTasks, { concurrency: maxConcurrency })
        const results = batchResults.flat()

        const totalTime = Date.now() - startTime
        const avgBatchTime = totalTime / batches.length

        yield* Ref.update(metrics, m => ({
          totalProcessed: m.totalProcessed + items.length,
          totalBatches: m.totalBatches + batches.length,
          failures: m.failures, // エラーカウントは個別に更新済み
          averageBatchTime: (m.averageBatchTime + avgBatchTime) / 2
        }))

        yield* Effect.log(
          `Batch processing completed: ${results.length} results in ${totalTime}ms`
        )

        return results
      })
  })
})
```

## Pattern 6: Lazy Evaluation Patterns

**使用場面**: 重い処理の遅延実行と必要時のみの計算

**実装**:
```typescript
import { Effect, LazyArg } from "effect"

// 遅延評価サービス
export const LazyComputationService = Context.GenericTag<{
  readonly createLazyChunk: (coordinate: ChunkCoordinate) => LazyChunk
  readonly createLazyEntity: (entityId: EntityId) => LazyEntity
}>("@minecraft/LazyComputationService")

// 遅延チャンクの実装
interface LazyChunk {
  readonly coordinate: ChunkCoordinate
  readonly getData: () => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly getBlocks: () => Effect.Effect<BlockData[], ChunkGenerationError>
  readonly getEntities: () => Effect.Effect<EntityData[], ChunkGenerationError>
  readonly isLoaded: () => boolean
}

const makeLazyComputation = Effect.gen(function* () {
  const chunkGenerator = yield* ChunkGeneratorService
  const entityLoader = yield* EntityLoaderService

  const createLazyChunk = (coordinate: ChunkCoordinate): LazyChunk => {
    let cached: Option.Option<ChunkData> = Option.none()
    let loading = false

    const ensureLoaded = Effect.gen(function* () {
      if (Option.isSome(cached)) {
        return cached.value
      }

      if (loading) {
        // 他のファイバーが読み込み中の場合は待機
        return yield* Effect.sleep(Duration.millis(10)).pipe(
          Effect.flatMap(() => ensureLoaded)
        )
      }

      loading = true
      const chunkData = yield* chunkGenerator.generateChunk(coordinate)
      cached = Option.some(chunkData)
      loading = false

      return chunkData
    })

    return {
      coordinate,
      getData: () => ensureLoaded,
      getBlocks: () =>
        Effect.gen(function* () {
          const data = yield* ensureLoaded
          return data.blocks
        }),
      getEntities: () =>
        Effect.gen(function* () {
          const data = yield* ensureLoaded
          return data.entities
        }),
      isLoaded: () => Option.isSome(cached)
    }
  }

  const createLazyEntity = (entityId: EntityId): LazyEntity => {
    const lazyData = LazyArg.make(() =>
      entityLoader.loadEntity(entityId).pipe(
        Effect.cached(Duration.minutes(5)) // 5分キャッシュ
      )
    )

    return {
      entityId,
      getData: () => LazyArg.value(lazyData).pipe(Effect.flatten),
      getPosition: () =>
        LazyArg.value(lazyData).pipe(
          Effect.flatten,
          Effect.map(entity => entity.position)
        ),
      getStats: () =>
        LazyArg.value(lazyData).pipe(
          Effect.flatten,
          Effect.map(entity => entity.stats)
        )
    }
  }

  return LazyComputationService.of({
    createLazyChunk,
    createLazyEntity
  })
})

// 条件付き遅延実行パターン
export const ConditionalProcessingService = Context.GenericTag<{
  readonly processIfNeeded: <A, E>(
    condition: () => Effect.Effect<boolean>,
    computation: LazyArg.LazyArg<Effect.Effect<A, E>>
  ) => Effect.Effect<Option.Option<A>, E>
  readonly processWithThreshold: <A, E>(
    getValue: () => Effect.Effect<number>,
    threshold: number,
    computation: LazyArg.LazyArg<Effect.Effect<A, E>>
  ) => Effect.Effect<Option.Option<A>, E>
}>("@minecraft/ConditionalProcessingService")

const makeConditionalProcessing = Effect.gen(function* () {
  return ConditionalProcessingService.of({
    processIfNeeded: <A, E>(
      condition: () => Effect.Effect<boolean>,
      computation: LazyArg.LazyArg<Effect.Effect<A, E>>
    ) =>
      Effect.gen(function* () {
        const shouldProcess = yield* condition()

        if (shouldProcess) {
          const result = yield* LazyArg.value(computation).pipe(Effect.flatten)
          return Option.some(result)
        }

        return Option.none()
      }),

    processWithThreshold: <A, E>(
      getValue: () => Effect.Effect<number>,
      threshold: number,
      computation: LazyArg.LazyArg<Effect.Effect<A, E>>
    ) =>
      Effect.gen(function* () {
        const value = yield* getValue()

        if (value >= threshold) {
          const result = yield* LazyArg.value(computation).pipe(Effect.flatten)
          return Option.some(result)
        }

        yield* Effect.log(`Value ${value} below threshold ${threshold}, skipping computation`)
        return Option.none()
      })
  })
})

// 使用例：条件付きチャンク生成
export const conditionalChunkGeneration = (
  playerPosition: Position,
  viewDistance: number
) =>
  Effect.gen(function* () {
    const conditionalProcessor = yield* ConditionalProcessingService
    const lazyComputation = yield* LazyComputationService

    const chunksInRange = getChunksInRange(playerPosition, viewDistance)

    const results = yield* Effect.all(
      chunksInRange.map(coordinate =>
        conditionalProcessor.processIfNeeded(
          () =>
            Effect.gen(function* () {
              // プレイヤーとの距離をチェック
              const distance = calculateDistance(playerPosition, coordinate)
              return distance <= viewDistance
            }),
          LazyArg.make(() =>
            Effect.gen(function* () {
              const lazyChunk = lazyComputation.createLazyChunk(coordinate)
              return yield* lazyChunk.getData()
            })
          )
        )
      ),
      { concurrency: 8 }
    )

    return results.filter(Option.isSome).map(opt => opt.value)
  })
```

## Pattern 7: Performance Monitoring & Profiling

**使用場面**: システムパフォーマンスの監視と最適化

**実装**:
```typescript
import { Metric, MetricKeyType, Duration } from "effect"

// パフォーマンス監視サービス
export const PerformanceMonitorService = Context.GenericTag<{
  readonly startTiming: (operation: string) => Effect.Effect<PerformanceTimer>
  readonly recordMetric: (name: string, value: number, tags?: Record<string, string>) => Effect.Effect<void>
  readonly getMetrics: () => Effect.Effect<MetricsSnapshot>
  readonly startProfiling: (sampleInterval?: Duration.Duration) => Effect.Effect<ProfilerSession>
}>("@minecraft/PerformanceMonitorService")

interface PerformanceTimer {
  readonly stop: () => Effect.Effect<number> // elapsed time in milliseconds
}

interface MetricsSnapshot {
  readonly counters: Record<string, number>
  readonly histograms: Record<string, HistogramData>
  readonly gauges: Record<string, number>
}

interface HistogramData {
  readonly count: number
  readonly mean: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
}

const makePerformanceMonitor = Effect.gen(function* () {
  // メトリクス定義
  const chunkLoadTime = Metric.histogram(
    "chunk_load_duration",
    MetricKeyType.Histogram({
      boundaries: [10, 50, 100, 500, 1000, 5000] // milliseconds
    })
  )

  const entityCount = Metric.gauge("active_entities", MetricKeyType.Gauge())
  const chunkCacheHitRate = Metric.counter("chunk_cache_hits", MetricKeyType.Counter())

  const activeTimers = yield* Ref.make(new Map<string, number>())
  const customMetrics = yield* Ref.make(new Map<string, number[]>())

  return PerformanceMonitorService.of({
    startTiming: (operation) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const timerId = `${operation}_${startTime}_${Math.random()}`

        yield* Ref.update(activeTimers, map => map.set(timerId, startTime))

        return {
          stop: () =>
            Effect.gen(function* () {
              const endTime = Date.now()
              const timers = yield* Ref.get(activeTimers)
              const start = timers.get(timerId)

              if (!start) {
                return yield* Effect.fail(new Error(`Timer ${timerId} not found`))
              }

              const elapsed = endTime - start

              // メトリクスに記録
              yield* Metric.increment(chunkLoadTime, elapsed)

              // タイマーを削除
              yield* Ref.update(activeTimers, map => {
                const newMap = new Map(map)
                newMap.delete(timerId)
                return newMap
              })

              yield* Effect.log(`${operation} completed in ${elapsed}ms`)
              return elapsed
            })
        }
      }),

    recordMetric: (name, value, tags = {}) =>
      Effect.gen(function* () {
        yield* Ref.update(customMetrics, map => {
          const current = map.get(name) || []
          return map.set(name, [...current, value].slice(-100)) // 最新100件を保持
        })

        yield* Effect.log(`Recorded metric ${name}: ${value}`)
      }),

    getMetrics: () =>
      Effect.gen(function* () {
        const custom = yield* Ref.get(customMetrics)

        const histograms: Record<string, HistogramData> = {}
        const gauges: Record<string, number> = {}
        const counters: Record<string, number> = {}

        for (const [name, values] of custom) {
          if (values.length === 0) continue

          const sorted = [...values].sort((a, b) => a - b)
          const count = sorted.length
          const mean = sorted.reduce((a, b) => a + b, 0) / count

          histograms[name] = {
            count,
            mean,
            p50: sorted[Math.floor(count * 0.5)],
            p95: sorted[Math.floor(count * 0.95)],
            p99: sorted[Math.floor(count * 0.99)]
          }

          gauges[name] = values[values.length - 1] // 最新値
          counters[name] = count
        }

        return { counters, histograms, gauges }
      }),

    startProfiling: (sampleInterval = Duration.seconds(1)) =>
      Effect.gen(function* () {
        const profilerData = yield* Ref.make<ProfilingData>({
          samples: [],
          startTime: Date.now(),
          endTime: 0
        })

        const samplingFiber = yield* Effect.forever(
          Effect.gen(function* () {
            yield* Effect.sleep(sampleInterval)

            const sample = yield* collectSample()
            yield* Ref.update(profilerData, data => ({
              ...data,
              samples: [...data.samples, sample]
            }))
          })
        ).pipe(Effect.forkDaemon)

        return {
          stop: () =>
            Effect.gen(function* () {
              yield* Fiber.interrupt(samplingFiber)
              yield* Ref.update(profilerData, data => ({
                ...data,
                endTime: Date.now()
              }))

              return yield* Ref.get(profilerData)
            }),

          getCurrentData: () => Ref.get(profilerData)
        }
      })
  })
})

// サンプル収集の実装
const collectSample = Effect.gen(function* () {
  const memoryUsage = typeof process !== 'undefined'
    ? process.memoryUsage()
    : { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }

  return {
    timestamp: Date.now(),
    memory: memoryUsage,
    // 追加のメトリクス収集
    activeEffects: 0, // Effect実行中の数（実装依存）
    fiberCount: 0     // アクティブなFiber数（実装依存）
  }
})

// 使用例：チャンク処理のパフォーマンス監視
export const monitoredChunkProcessing = (coordinates: ChunkCoordinate[]) =>
  Effect.gen(function* () {
    const monitor = yield* PerformanceMonitorService
    const chunkService = yield* ChunkService

    const timer = yield* monitor.startTiming("chunk_batch_processing")
    const profiler = yield* monitor.startProfiling(Duration.seconds(0.5))

    try {
      const results = yield* Effect.all(
        coordinates.map(coord =>
          Effect.gen(function* () {
            const chunkTimer = yield* monitor.startTiming("single_chunk_load")
            const chunk = yield* chunkService.loadChunk(coord)
            const elapsed = yield* chunkTimer.stop()

            yield* monitor.recordMetric("chunk_load_time", elapsed, {
              x: String(coord.x),
              z: String(coord.z)
            })

            return chunk
          })
        ),
        { concurrency: 8 }
      )

      const totalTime = yield* timer.stop()
      const profilingData = yield* profiler.stop()

      yield* monitor.recordMetric("batch_total_time", totalTime)
      yield* monitor.recordMetric("chunks_processed", results.length)

      yield* Effect.log(
        `Processed ${results.length} chunks in ${totalTime}ms. Average: ${totalTime/results.length}ms per chunk`
      )

      return { results, profilingData }

    } catch (error) {
      yield* profiler.stop()
      return yield* Effect.fail(error)
    }
  })
```

## Anti-Patterns (避けるべき)

### ❌ Anti-Pattern 1: 手動でのPromise.all
```typescript
// これは避ける - Effect.allを使用する
const loadChunks = async (coordinates: ChunkCoordinate[]) => {
  const promises = coordinates.map(coord => loadChunk(coord))
  return await Promise.all(promises)
}
```

### ❌ Anti-Pattern 2: 無制限キャッシュ
```typescript
// メモリリークの原因
const cache = new Map() // TTLもサイズ制限もない

const getCachedResult = (key: string) => {
  if (cache.has(key)) {
    return cache.get(key)
  }
  const result = expensiveComputation(key)
  cache.set(key, result) // 永続的に蓄積
  return result
}
```

### ❌ Anti-Pattern 3: 同期的な重い処理
```typescript
// UIをブロックする
const processAllChunks = (chunks: ChunkData[]) => {
  for (const chunk of chunks) {
    // 重い同期処理
    const processed = heavyProcessing(chunk)
    updateUI(processed)
  }
}
```

## Performance Best Practices

### 1. 適切なキャッシュ戦略
```typescript
// ✅ TTL付きの階層キャッシュ
const cache = Cache.make({
  capacity: 1000,
  timeToLive: Duration.minutes(30),
  lookup: expensiveComputation
})
```

### 2. バックプレッシャー対応
```typescript
// ✅ ストリームでのバックプレッシャー制御
const processStream = Stream.fromIterable(items).pipe(
  Stream.mapEffect(processItem, { concurrency: 8 }),
  Stream.buffer({ capacity: 16, strategy: "dropping" })
)
```

### 3. リソースの適切な解放
```typescript
// ✅ Effect.acquireReleaseでリソース管理
const withResource = <A, E>(
  use: (resource: Resource) => Effect.Effect<A, E>
) =>
  Effect.acquireRelease(
    acquireResource(),
    releaseResource
  ).pipe(Effect.flatMap(use))
```

### 4. メモリ効率的な処理
```typescript
// ✅ チャンク単位での処理
const processLargeDataset = (data: LargeDataset) =>
  Stream.fromIterable(data).pipe(
    Stream.grouped(100), // 100要素ずつ処理
    Stream.mapEffect(processBatch),
    Stream.runCollect
  )
```

### 5. 条件付き最適化
```typescript
// ✅ 必要な時のみ重い処理を実行
const optimizedProcessing = Effect.gen(function* () {
  const shouldProcess = yield* checkCondition()

  if (shouldProcess) {
    return yield* heavyComputation()
  }

  return cachedResult
})
```

---

これらのパフォーマンス最適化パターンを適用することで、TypeScript Minecraftプロジェクトにおいて効率的で拡張性の高いアプリケーションを構築できます。特に大量のチャンクデータやエンティティ処理において、これらのパターンは大きな性能向上をもたらします。