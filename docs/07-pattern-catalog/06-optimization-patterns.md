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
import { Effect, Cache, Duration, Ref, Context, Layer, Option, Data, Chunk } from "effect"

// パフォーマンス指標用のブランド型
type ChunkLoadTime = number & { readonly _brand: "ChunkLoadTime" }
type CacheHitRatio = number & { readonly _brand: "CacheHitRatio" }

// チャンク座標のブランド型（構造共有の最適化）
interface ChunkCoordinate extends Data.Case {
  readonly x: number
  readonly z: number
}
const ChunkCoordinate = Data.case<ChunkCoordinate>()

// チャンク生成の結果をキャッシュ
export const CachedChunkGeneratorService = Context.GenericTag<{
  readonly generateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly preloadChunks: (coordinates: Chunk.Chunk<ChunkCoordinate>) => Effect.Effect<void, ChunkGenerationError>
  readonly invalidateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void>
  readonly getCacheStats: () => Effect.Effect<Cache.CacheStats>
}>("@minecraft/CachedChunkGeneratorService")

const makeCachedChunkGenerator = Effect.gen(function* () {
  const baseGenerator = yield* ChunkGeneratorService

  // TTL付きキャッシュの作成（最新API使用）
  const chunkCache = yield* Cache.make({
    capacity: 1000, // 最大1000チャンクをキャッシュ
    timeToLive: Duration.minutes(30), // 30分でキャッシュ期限切れ
    lookup: (coordinate: ChunkCoordinate) => baseGenerator.generateChunk(coordinate)
  })

  // アクセス頻度の追跡（Refで共有可変状態管理）
  const accessCount = yield* Ref.make(new Map<string, number>())
  const hitRateMetrics = yield* Ref.make<CacheHitRatio>(0 as CacheHitRatio)

  const getCoordKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

  return CachedChunkGeneratorService.of({
    generateChunk: (coordinate) =>
      Effect.gen(function* () {
        // パターンマッチングによる最適化戦略
        const key = getCoordKey(coordinate)

        // 早期リターンパターン（キャッシュヒット確認）
        const cached = yield* Cache.getOption(chunkCache, coordinate)
        if (Option.isSome(cached)) {
          yield* Ref.update(accessCount, map => {
            const current = map.get(key) || 0
            return new Map(map).set(key, current + 1)
          })
          return cached.value
        }

        // キャッシュミス時の処理
        const result = yield* Cache.get(chunkCache, coordinate)

        // メトリクス更新
        yield* Ref.update(accessCount, map => {
          const current = map.get(key) || 0
          return new Map(map).set(key, current + 1)
        })

        return result
      }),

    preloadChunks: (coordinates) =>
      Effect.gen(function* () {
        // Chunkを使用した効率的なバッチ処理
        yield* Effect.all(
          Chunk.map(coordinates, coord =>
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
      Cache.invalidate(chunkCache, coordinate),

    getCacheStats: () => Cache.cacheStats(chunkCache)
  })
})

export const CachedChunkGeneratorLive = Layer.effect(
  CachedChunkGeneratorService,
  makeCachedChunkGenerator
)

// 階層キャッシュパターン（構造共有とメモ化の最適化）
export const MultiLevelCacheService = Context.GenericTag<{
  readonly get: <K, V>(key: K) => Effect.Effect<Option.Option<V>, never>
  readonly set: <K, V>(key: K, value: V) => Effect.Effect<void>
  readonly getCacheHitRatio: () => Effect.Effect<CacheHitRatio>
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

  // ヒット率追跡
  const cacheHits = yield* Ref.make(0)
  const cacheRequests = yield* Ref.make(0)

  const updateMetrics = (hit: boolean) =>
    Effect.gen(function* () {
      yield* Ref.update(cacheRequests, n => n + 1)
      if (hit) {
        yield* Ref.update(cacheHits, n => n + 1)
      }
    })

  return MultiLevelCacheService.of({
    get: <K, V>(key: K) =>
      Effect.gen(function* () {
        // パターンマッチングによるキャッシュ戦略
        const keyStr = String(key)

        // L1キャッシュから試行（早期リターン）
        const l1Result = yield* Cache.getOption(l1Cache, keyStr)

        // L1ヒットの場合
        if (Option.isSome(l1Result)) {
          yield* updateMetrics(true)
          return l1Result
        }

        // L2キャッシュから試行
        const l2Result = yield* diskCache.get(key)

        // パターンマッチングでL2結果処理
        return yield* Effect.gen(function* () {
          if (Option.isSome(l2Result)) {
            // L1キャッシュに昇格（メモ化の最適化）
            yield* Cache.set(l1Cache, keyStr, l2Result.value)
            yield* updateMetrics(true)
            return l2Result
          } else {
            yield* updateMetrics(false)
            return Option.none()
          }
        })
      }),

    set: <K, V>(key: K, value: V) =>
      Effect.gen(function* () {
        const keyStr = String(key)
        // 両方のキャッシュに保存（構造共有による効率化）
        yield* Effect.all([
          Cache.set(l1Cache, keyStr, value),
          diskCache.set(key, value)
        ], { concurrency: 2 })
      }),

    getCacheHitRatio: () =>
      Effect.gen(function* () {
        const hits = yield* Ref.get(cacheHits)
        const requests = yield* Ref.get(cacheRequests)
        const ratio = requests > 0 ? (hits / requests) : 0
        return ratio as CacheHitRatio
      })
  })
})
```

## Pattern 2: Resource Pooling with Pool

**使用場面**: 高価なリソース（データベース接続、ファイルハンドルなど）の効率的な管理

**実装**:
```typescript
import { Pool, Effect, Queue, Ref, Context, Scope, Data } from "effect"

// ブランド型でパフォーマンス指標を定義
type ConnectionUtilization = number & { readonly _brand: "ConnectionUtilization" }
type PoolEfficiency = number & { readonly _brand: "PoolEfficiency" }

// プール統計情報のデータ構造（構造共有の最適化）
interface PoolStats extends Data.Case {
  readonly totalAcquired: number
  readonly totalReleased: number
  readonly currentActive: number
  readonly errors: number
  readonly utilization: ConnectionUtilization
  readonly efficiency: PoolEfficiency
}
const PoolStats = Data.case<PoolStats>()

// データベース接続プールの実装
export const DatabaseConnectionPoolService = Context.GenericTag<{
  readonly withConnection: <A, E>(
    operation: (connection: DatabaseConnection) => Effect.Effect<A, E>
  ) => Effect.Effect<A, E | ConnectionPoolError>
  readonly getPoolStats: () => Effect.Effect<PoolStats>
  readonly preWarmPool: () => Effect.Effect<void>
}>("@minecraft/DatabaseConnectionPoolService")

const makeDatabaseConnectionPool = Effect.gen(function* () {
  // リソースプールの作成（最新API使用）
  const connectionPool = yield* Pool.make({
    acquire: Effect.gen(function* () {
      yield* Effect.log("Creating new database connection")
      const connection = yield* DatabaseConnection.create()
      yield* connection.ping() // 接続確認
      return connection
    }),
    size: 10, // 最大10接続
    concurrency: 4, // 同時取得数を制限
    targetUtilization: 0.8 // 80%の利用率を目指
  })

  // 統計情報の管理（Refで共有可変状態）
  const stats = yield* Ref.make(PoolStats({
    totalAcquired: 0,
    totalReleased: 0,
    currentActive: 0,
    errors: 0,
    utilization: 0 as ConnectionUtilization,
    efficiency: 1.0 as PoolEfficiency
  }))

  // メトリクス更新関数
  const updateStats = (updater: (s: PoolStats) => PoolStats) =>
    Ref.update(stats, current => {
      const updated = updater(current)
      const utilization = (updated.currentActive / 10) as ConnectionUtilization
      const efficiency = updated.totalReleased > 0
        ? (updated.totalReleased - updated.errors) / updated.totalReleased as PoolEfficiency
        : 1.0 as PoolEfficiency

      return PoolStats({ ...updated, utilization, efficiency })
    })

  return DatabaseConnectionPoolService.of({
    withConnection: <A, E>(
      operation: (connection: DatabaseConnection) => Effect.Effect<A, E>
    ) =>
      Effect.gen(function* () {
        yield* updateStats(s => PoolStats({ ...s, totalAcquired: s.totalAcquired + 1 }))

        // リソースプーリングの最適化
        return yield* Pool.get(connectionPool).pipe(
          Effect.flatMap(connection =>
            Effect.gen(function* () {
              yield* updateStats(s => PoolStats({ ...s, currentActive: s.currentActive + 1 }))

              // リソースの適切な管理
              return yield* Effect.acquireRelease(
                Effect.succeed(connection),
                () => updateStats(s => PoolStats({
                  ...s,
                  currentActive: s.currentActive - 1,
                  totalReleased: s.totalReleased + 1
                }))
              ).pipe(
                Effect.flatMap(operation)
              )
            })
          ),
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* updateStats(s => PoolStats({ ...s, errors: s.errors + 1 }))
              return yield* Effect.fail(error)
            })
          )
        )
      }),

    getPoolStats: () => Ref.get(stats),

    // プールの事前ウォームアップ
    preWarmPool: () =>
      Effect.gen(function* () {
        const warmUpConnections = Array.from({ length: 5 }, () =>
          Pool.get(connectionPool).pipe(
            Effect.flatMap(connection => Effect.succeed(connection))
          )
        )
        yield* Effect.all(warmUpConnections, { concurrency: "unbounded" })
        yield* Effect.log("Pool pre-warming completed")
      })
  })
})

// ファイルハンドルプールの実装（遅延評価とメモ化最適化）
export const FileHandlePoolService = Context.GenericTag<{
  readonly withFile: <A, E>(
    path: string,
    operation: (handle: FileHandle) => Effect.Effect<A, E>
  ) => Effect.Effect<A, E | FilePoolError>
  readonly getPoolMetrics: (path: string) => Effect.Effect<Option.Option<PoolStats>>
}>("@minecraft/FileHandlePoolService")

const makeFileHandlePool = Effect.gen(function* () {
  // ファイルパス別のプール管理（構造共有最適化）
  const pools = yield* Ref.make(new Map<string, Pool.Pool<FileHandle, FileOpenError>>())
  const poolMetrics = yield* Ref.make(new Map<string, PoolStats>())

  // 遅延評価でプール作成を最適化
  const getOrCreatePool = Effect.cached((path: string) =>
    Effect.gen(function* () {
      const currentPools = yield* Ref.get(pools)
      const existing = currentPools.get(path)

      // 早期リターンパターン
      if (existing) {
        return existing
      }

      const newPool = yield* Pool.make({
        acquire: Effect.gen(function* () {
          yield* Effect.log(`Opening file handle for: ${path}`)
          return yield* FileSystem.open(path, "r+")
        }),
        size: 5, // ファイル毎に最大5ハンドル
        concurrency: 2,
        targetUtilization: 0.7
      })

      // メトリクスの初期化
      const initialStats = PoolStats({
        totalAcquired: 0,
        totalReleased: 0,
        currentActive: 0,
        errors: 0,
        utilization: 0 as ConnectionUtilization,
        efficiency: 1.0 as PoolEfficiency
      })

      yield* Ref.update(pools, map => new Map(map).set(path, newPool))
      yield* Ref.update(poolMetrics, map => new Map(map).set(path, initialStats))
      return newPool
    }), Duration.minutes(10) // 10分間キャッシュ
  )

  return FileHandlePoolService.of({
    withFile: <A, E>(
      path: string,
      operation: (handle: FileHandle) => Effect.Effect<A, E>
    ) =>
      Effect.gen(function* () {
        const pool = yield* getOrCreatePool(path)

        // パフォーマンスメトリクスの更新
        yield* Ref.update(poolMetrics, map => {
          const current = map.get(path) || PoolStats({
            totalAcquired: 0, totalReleased: 0, currentActive: 0, errors: 0,
            utilization: 0 as ConnectionUtilization, efficiency: 1.0 as PoolEfficiency
          })
          return new Map(map).set(path, PoolStats({
            ...current,
            totalAcquired: current.totalAcquired + 1
          }))
        })

        return yield* Pool.get(pool).pipe(
          Effect.flatMap(operation),
          Effect.ensuring(
            Ref.update(poolMetrics, map => {
              const current = map.get(path)!
              return new Map(map).set(path, PoolStats({
                ...current,
                totalReleased: current.totalReleased + 1
              }))
            })
          )
        )
      }),

    getPoolMetrics: (path) =>
      Effect.gen(function* () {
        const metrics = yield* Ref.get(poolMetrics)
        return Option.fromNullable(metrics.get(path))
      })
  })
})
```

## Pattern 3: Stream Optimizations

**使用場面**: 大量データの効率的なストリーミング処理

**実装**:
```typescript
import { Stream, Sink, Chunk, Context } from "effect"

// ストリーミングパフォーマンス用のブランド型
type StreamThroughput = number & { readonly _brand: "StreamThroughput" }
type BufferUtilization = number & { readonly _brand: "BufferUtilization" }

// バッチ処理結果（構造共有最適化）
interface ProcessingResult extends Data.Case {
  readonly totalProcessed: number
  readonly errors: ChunkLoadError[]
  readonly success: boolean
  readonly throughput: StreamThroughput
  readonly averageLatency: number
}
const ProcessingResult = Data.case<ProcessingResult>()

// チャンクの効率的なストリーミング読み込み
export const OptimizedChunkStreamService = Context.GenericTag<{
  readonly streamChunksInRadius: (
    center: ChunkCoordinate,
    radius: number
  ) => Stream.Stream<ChunkData, ChunkLoadError>
  readonly processChunkBatch: (
    chunks: Stream.Stream<ChunkData, ChunkLoadError>
  ) => Effect.Effect<ProcessingResult, BatchProcessingError>
  readonly createVirtualScrollStream: (
    viewport: ViewportBounds,
    chunkSize: number
  ) => Stream.Stream<ChunkData, ChunkLoadError>
}>("@minecraft/OptimizedChunkStreamService")

const makeOptimizedChunkStream = Effect.gen(function* () {
  const chunkLoader = yield* ChunkLoaderService
  const chunkProcessor = yield* ChunkProcessorService

  return OptimizedChunkStreamService.of({
    streamChunksInRadius: (center, radius) => {
      // 螺旋状に座標を生成（近い順）
      const coordinates = generateSpiralCoordinates(center, radius)

      return Stream.fromIterable(coordinates).pipe(
        // Streamでの効率的なバッチ処理
        Stream.grouped(8), // 8個ずつバッチ処理
        Stream.mapEffect(coordChunk =>
          Effect.gen(function* () {
            // Chunk操作で効率的なコレクション処理
            const batchResults = yield* Effect.all(
              Chunk.map(coordChunk, coord => {
                const distance = calculateDistance(center, coord)
                const priority = Math.max(1, 10 - Math.floor(distance / 16))

                return chunkLoader.loadChunk(coord).pipe(
                  Effect.timeout(Duration.seconds(30)),
                  Effect.retry(
                    Schedule.exponential("100 millis").pipe(
                      Schedule.compose(Schedule.recurs(3))
                    )
                  ),
                  Effect.either, // エラーをEitherでラップ
                  Effect.tapError(error =>
                    Effect.logError(`Failed to load chunk at ${coord.x},${coord.z}`, error)
                  )
                )
              }),
              { concurrency: 8 } // バッチ内での並列度
            )

            // 成功したチャンクのみを返す（パターンマッチング）
            return Chunk.filterMap(batchResults, result =>
              Either.match(result, {
                onLeft: () => Option.none(),
                onRight: chunk => Option.some(chunk)
              })
            )
          })
        ),
        Stream.flatMap(Stream.fromChunk), // ChunkをStreamに展開

        // バックプレッシャー制御（最新API使用）
        Stream.buffer({ capacity: 32, strategy: "sliding" })
      )
    },

    processChunkBatch: (chunks) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const processedCount = yield* Ref.make(0)
        const errors = yield* Ref.make<ChunkLoadError[]>([])

        const result = yield* chunks.pipe(
          // Streamでの効率的なグルーピング
          Stream.grouped(16),
          Stream.mapEffect(chunkBatch =>
            Effect.gen(function* () {
              const batchStartTime = Date.now()

              // Chunk操作でバッチ処理の最適化
              const batchResults = yield* Effect.all(
                Chunk.map(chunkBatch, chunk =>
                  chunkProcessor.processChunk(chunk).pipe(
                    Effect.either
                  )
                ),
                { concurrency: "unbounded" }
              )

              // 結果の集計（パターンマッチング使用）
              const [successes, failures] = Chunk.partition(batchResults, Either.isRight)
              const successCount = Chunk.size(successes)
              const failureList = Chunk.map(failures, result =>
                Either.isLeft(result) ? result.left : null
              ).pipe(Chunk.filter(x => x !== null))

              yield* Ref.update(processedCount, n => n + successCount)
              yield* Ref.update(errors, errs => [...errs, ...Chunk.toReadonlyArray(failureList)])

              const batchTime = Date.now() - batchStartTime
              yield* Effect.log(
                `Processed batch: ${successCount} success, ${Chunk.size(failureList)} failures in ${batchTime}ms`
              )

              return successCount
            })
          ),
          Stream.runSum
        )

        const totalTime = Date.now() - startTime
        const totalProcessed = yield* Ref.get(processedCount)
        const allErrors = yield* Ref.get(errors)
        const throughput = totalTime > 0 ? (totalProcessed / totalTime * 1000) as StreamThroughput : 0 as StreamThroughput
        const averageLatency = totalProcessed > 0 ? totalTime / totalProcessed : 0

        return ProcessingResult({
          totalProcessed,
          errors: allErrors,
          success: allErrors.length === 0,
          throughput,
          averageLatency
        })
      }),

    // 仮想スクロールのStream実装
    createVirtualScrollStream: (viewport, chunkSize) =>
      Stream.paginate(viewport.startIndex, index => {
        // 表示範囲内のチャンクのみを読み込み
        if (index >= viewport.endIndex) {
          return [null, Option.none()]
        }

        const chunk = loadChunkAtIndex(index)
        const nextIndex = index + chunkSize
        const hasMore = nextIndex < viewport.endIndex

        return [chunk, hasMore ? Option.some(nextIndex) : Option.none()]
      }).pipe(
        Stream.filter(chunk => chunk !== null),
        Stream.buffer({ capacity: 8, strategy: "sliding" }) // スムーズなスクロール
      )
  })
})

// メモリ効率的な大ファイル処理（ストリーミング最適化）
export const streamLargeWorldFile = (filePath: string) => {
  // メモリ使用量監視用の閾値
  const MEMORY_THRESHOLD = 1024 * 1024 * 1024 // 1GB
  const GC_TRIGGER_RATIO = 0.8 // 80%でGCトリガー

  return Stream.fromReadableStream(
    () => FileSystem.createReadStream(filePath),
    error => new FileStreamError({ cause: error })
  ).pipe(
    // チャンク単位での効率的な処理
    Stream.rechunk(1024), // チャンクサイズの最適化
    Stream.mapChunks(chunk =>
      Chunk.map(chunk, parseWorldDataChunk)
    ),

    // ストリーム処理の最適化
    Stream.mapEffect(worldData =>
      Effect.gen(function* () {
        // 各チャンクデータを処理
        const processed = yield* processWorldData(worldData)

        // メモリ使用量の監視と最適化
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const memory = process.memoryUsage()
          const heapUsageRatio = memory.heapUsed / memory.heapTotal

          if (memory.heapUsed > MEMORY_THRESHOLD || heapUsageRatio > GC_TRIGGER_RATIO) {
            yield* Effect.logWarning(
              `High memory usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB (${Math.round(heapUsageRatio * 100)}%)`
            )

            // 適応的なガベージコレクション
            if (global.gc && heapUsageRatio > GC_TRIGGER_RATIO) {
              global.gc()
              yield* Effect.sleep(Duration.millis(10)) // GC後の小休止
            }
          }
        }

        return processed
      }),
      { concurrency: 4 }
    ),

    // 高度なバックプレッシャー制御
    Stream.buffer({ capacity: 16, strategy: "sliding" }),

    // スロットリングでメモリ使用量を制御
    Stream.throttle({
      cost: (chunk: any) => Chunk.size(chunk),
      duration: Duration.millis(100),
      units: 10 // 100msあたり10チャンク
    })
  )
}
```

## Pattern 4: Memory Management with Ref

**使用場面**: メモリリークの防止と効率的なメモリ使用

**実装**:
```typescript
import { Ref, FiberRef, Scope, Data, Queue } from "effect"

// メモリ管理用のブランド型
type MemoryUsage = number & { readonly _brand: "MemoryUsage" }
type CacheEfficiency = number & { readonly _brand: "CacheEfficiency" }

// キャッシュエントリ（構造共有最適化）
interface CacheEntry<V> extends Data.Case {
  readonly value: V
  readonly createdAt: number
  readonly ttl: number
  readonly accessCount: number
  readonly lastAccessed: number
  readonly priority: number // アクセス頻度ベースの優先度
}
const CacheEntry = Data.case<CacheEntry<unknown>>()

// 自動クリーンアップ付きキャッシュ
export const SelfCleaningCacheService = Context.GenericTag<{
  readonly get: <K, V>(key: K) => Effect.Effect<Option.Option<V>>
  readonly set: <K, V>(key: K, value: V, ttl?: Duration.Duration) => Effect.Effect<void>
  readonly cleanup: () => Effect.Effect<number> // 削除された項目数を返す
  readonly getMemoryUsage: () => Effect.Effect<MemoryUsage>
  readonly getCacheEfficiency: () => Effect.Effect<CacheEfficiency>
}>("@minecraft/SelfCleaningCacheService")


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
import { Metric, MetricKeyType, Duration, Data, Chunk } from "effect"

// パフォーマンス測定用のブランド型
type ResponseTime = number & { readonly _brand: "ResponseTime" }
type ThroughputRate = number & { readonly _brand: "ThroughputRate" }
type ConcurrencyLevel = number & { readonly _brand: "ConcurrencyLevel" }

// パフォーマンス監視サービス
export const PerformanceMonitorService = Context.GenericTag<{
  readonly startTiming: (operation: string) => Effect.Effect<PerformanceTimer>
  readonly recordMetric: (name: string, value: number, tags?: Record<string, string>) => Effect.Effect<void>
  readonly getMetrics: () => Effect.Effect<MetricsSnapshot>
  readonly startProfiling: (sampleInterval?: Duration.Duration) => Effect.Effect<ProfilerSession>
  readonly createBenchmark: <A, E>(name: string, effect: Effect.Effect<A, E>) => Effect.Effect<BenchmarkResult<A>, E>
}>("@minecraft/PerformanceMonitorService")

interface PerformanceTimer {
  readonly stop: () => Effect.Effect<ResponseTime> // elapsed time in milliseconds
  readonly lap: () => Effect.Effect<ResponseTime> // intermediate timing
}

// 構造共有最適化されたメトリクススナップショット
interface MetricsSnapshot extends Data.Case {
  readonly counters: Record<string, number>
  readonly histograms: Record<string, HistogramData>
  readonly gauges: Record<string, number>
  readonly timestamp: number
  readonly memoryUsage: MemoryUsage
}
const MetricsSnapshot = Data.case<MetricsSnapshot>()

interface HistogramData extends Data.Case {
  readonly count: number
  readonly mean: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly min: number
  readonly max: number
}
const HistogramData = Data.case<HistogramData>()

// ベンチマーク結果
interface BenchmarkResult<A> extends Data.Case {
  readonly result: A
  readonly duration: ResponseTime
  readonly memoryDelta: MemoryUsage
  readonly gcCount: number
}
const BenchmarkResult = Data.case<BenchmarkResult<unknown>>()

const makePerformanceMonitor = Effect.gen(function* () {
  // メトリクス定義（最新のEffect-TS Metric API使用）
  const chunkLoadTime = Metric.histogram(
    "chunk_load_duration",
    MetricKeyType.Histogram({
      boundaries: Chunk.fromIterable([10, 50, 100, 500, 1000, 5000]) // milliseconds
    })
  )

  const entityCount = Metric.gauge("active_entities", MetricKeyType.Gauge())
  const chunkCacheHitRate = Metric.counter("chunk_cache_hits", MetricKeyType.Counter())
  const throughputMetric = Metric.frequency("operations_per_second")
  const concurrencyMetric = Metric.gauge("active_concurrent_operations", MetricKeyType.Gauge())

  const activeTimers = yield* Ref.make(new Map<string, { startTime: number; lapTimes: number[] }>())
  const customMetrics = yield* Ref.make(new Map<string, number[]>())
  const benchmarkHistory = yield* Ref.make(new Map<string, BenchmarkResult<unknown>[]>())

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