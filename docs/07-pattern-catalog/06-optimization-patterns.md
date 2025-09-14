---
title: "パフォーマンス最適化パターン - 高性能ゲーム開発"
description: "Effect-TS環境での性能最適化技法。遅延評価、メモリ最適化、パイプライン処理の実装パターン。"
category: "patterns"
difficulty: "advanced"
tags: ["performance", "optimization", "memory", "lazy-evaluation", "pipeline", "caching"]
prerequisites: ["effect-ts-intermediate", "performance-fundamentals"]
estimated_reading_time: "25分"
dependencies: ["./04-asynchronous-patterns.md"]
status: "complete"
---

# Performance Optimization Patterns

> **最適化パターン**: Effect-TSでの高性能実装パターン

## 概要

Effect-TS環境での性能最適化技法とパターンについて解説します。

## メモリ最適化

### 遅延評価パターン

```typescript
import { Effect, Context, Chunk, HashMap, Schema, Match, Layer } from "effect"
import type { ChunkPosition, ChunkData } from "@minecraft/types"

// Branded型による型安全性
type ChunkPositionKey = Schema.brand<string, "ChunkPositionKey">
const ChunkPositionKey = Schema.String.pipe(Schema.brand("ChunkPositionKey"))

class ChunkLoadError extends Schema.TaggedError<ChunkLoadError>("ChunkLoadError")(
  "ChunkLoadError",
  {
    position: Schema.Unknown,
    reason: Schema.String,
  }
) {}

// HashMap ベースの高効率キャッシュ
interface LazyChunkLoader {
  readonly loadChunk: (
    position: ChunkPosition
  ) => Effect.Effect<ChunkData, ChunkLoadError>
}

const LazyChunkLoader = Context.GenericTag<LazyChunkLoader>("@minecraft/LazyChunkLoader")

const LazyChunkLoaderLive = Layer.effect(
  LazyChunkLoader,
  Effect.gen(function* () {
    // Effect.cachedを使用した計算結果キャッシュ
    const generateCachedChunk = yield* Effect.cached(
      (position: ChunkPosition) =>
        Effect.gen(function* () {
          const chunk = yield* generateChunkData(position)
          return chunk
        }).pipe(
          Effect.mapError((error) => new ChunkLoadError({
            position,
            reason: `Generation failed: ${error}`
          }))
        )
    )

    return {
      loadChunk: (position: ChunkPosition) =>
        pipe(
          position,
          Match.value,
          Match.when(
            (pos) => isValidPosition(pos),
            (pos) => generateCachedChunk(pos)
          ),
          Match.orElse(() =>
            Effect.fail(new ChunkLoadError({
              position,
              reason: "Invalid position"
            }))
          )
        )
    }
  })
)

// ヘルパー関数
const generateChunkData = (position: ChunkPosition): Effect.Effect<ChunkData, Error> =>
  Effect.sync(() => {
    // チャンクデータ生成ロジック
    return new ChunkData({ position, blocks: Chunk.empty() })
  })

const isValidPosition = (position: ChunkPosition): boolean =>
  position.x >= -1000 && position.x <= 1000 &&
  position.z >= -1000 && position.z <= 1000
```

### オブジェクトプール

```typescript
import { Effect, Context, Layer, Stream, Chunk, HashMap, Ref, Queue, Semaphore, Schedule, Metric } from "effect"

// Entity型とエラーの定義
type EntityId = Schema.brand<string, "EntityId">
const EntityId = Schema.String.pipe(Schema.brand("EntityId"))

interface Entity {
  readonly id: EntityId
  readonly createdAt: Date
  readonly isActive: boolean
}

class PoolExhaustedError extends Schema.TaggedError<PoolExhaustedError>("PoolExhaustedError")(
  "PoolExhaustedError",
  {
    poolSize: Schema.Number,
    requested: Schema.Number,
  }
) {}

// メトリクス定義
const poolMetrics = {
  acquired: Metric.counter("entity_pool_acquired"),
  released: Metric.counter("entity_pool_released"),
  created: Metric.counter("entity_pool_created"),
  activeEntities: Metric.gauge("entity_pool_active")
}

interface EntityPool {
  readonly acquire: () => Effect.Effect<Entity, PoolExhaustedError>
  readonly release: (entity: Entity) => Effect.Effect<void>
  readonly getMetrics: Effect.Effect<{ active: number; total: number }>
}

const EntityPool = Context.GenericTag<EntityPool>("@minecraft/EntityPool")

const EntityPoolLive = Layer.effect(
  EntityPool,
  Effect.gen(function* () {
    const maxPoolSize = 100
    const semaphore = yield* Semaphore.make(maxPoolSize)
    const availableEntities = yield* Queue.bounded<Entity>(maxPoolSize)
    const activeEntities = yield* Ref.make(HashMap.empty<EntityId, Entity>())

    // プールの事前初期化
    yield* pipe(
      Stream.range(0, 20), // 初期20個のエンティティを生成
      Stream.mapEffect(() => createEntityInternal()),
      Stream.runForeach((entity) => Queue.offer(availableEntities, entity))
    )

    return {
      acquire: Effect.gen(function* () {
        yield* Semaphore.take(semaphore)

        // 利用可能なエンティティがあるか確認
        const maybeEntity = yield* Queue.poll(availableEntities)

        const entity = yield* pipe(
          maybeEntity,
          Match.value,
          Match.when(
            Option.isSome,
            ({ value }) => Effect.succeed(value)
          ),
          Match.orElse(() => createEntityInternal())
        )

        // アクティブエンティティとして登録
        yield* Ref.update(
          activeEntities,
          HashMap.set(entity.id, entity)
        )

        // メトリクス更新
        yield* Metric.increment(poolMetrics.acquired)
        const activeCount = yield* Ref.get(activeEntities).pipe(
          Effect.map(HashMap.size)
        )
        yield* Metric.set(poolMetrics.activeEntities, activeCount)

        return entity
      }).pipe(
        Effect.mapError(() => new PoolExhaustedError({
          poolSize: maxPoolSize,
          requested: 1
        }))
      ),

      release: (entity: Entity) =>
        Effect.gen(function* () {
          // アクティブエンティティから削除
          yield* Ref.update(
            activeEntities,
            HashMap.remove(entity.id)
          )

          // エンティティをリセットしてプールに戻す
          const resetEntity = { ...entity, isActive: false }
          yield* Queue.offer(availableEntities, resetEntity)

          // セマフォ解放
          yield* Semaphore.release(semaphore)

          // メトリクス更新
          yield* Metric.increment(poolMetrics.released)
          const activeCount = yield* Ref.get(activeEntities).pipe(
            Effect.map(HashMap.size)
          )
          yield* Metric.set(poolMetrics.activeEntities, activeCount)
        }),

      getMetrics: Effect.gen(function* () {
        const active = yield* Ref.get(activeEntities).pipe(
          Effect.map(HashMap.size)
        )
        const queueSize = yield* Queue.size(availableEntities)
        return { active, total: active + queueSize }
      })
    }
  })
)

// ヘルパー関数
const createEntityInternal = (): Effect.Effect<Entity> =>
  Effect.gen(function* () {
    const id = yield* Effect.sync(() =>
      EntityId(`entity_${Date.now()}_${Math.random()}`)
    )

    yield* Metric.increment(poolMetrics.created)

    return {
      id,
      createdAt: new Date(),
      isActive: true
    }
  })
```

## CPU最適化

### バッチ処理パターン

```typescript
import { Effect, Context, Stream, Chunk, Schedule, Duration, Metric, Layer } from "effect"

// バッチ処理設定
interface BatchConfig {
  readonly maxBatchSize: number
  readonly maxLatency: Duration.Duration
  readonly concurrency: number
}

// メトリクス定義
const batchMetrics = {
  itemsProcessed: Metric.counter("batch_items_processed"),
  batchesProcessed: Metric.counter("batches_processed"),
  processingDuration: Metric.histogram("batch_processing_duration_ms"),
  batchSize: Metric.histogram("batch_size")
}

class BatchProcessingError extends Schema.TaggedError<BatchProcessingError>("BatchProcessingError")(
  "BatchProcessingError",
  {
    batchSize: Schema.Number,
    errors: Schema.Array(Schema.Unknown),
  }
) {}

interface BatchProcessor {
  readonly processBatch: <A, B>(
    items: Chunk.Chunk<A>,
    processor: (item: A) => Effect.Effect<B, Error>
  ) => Effect.Effect<Chunk.Chunk<B>, BatchProcessingError>

  readonly processStream: <A, B>(
    stream: Stream.Stream<A>,
    processor: (item: A) => Effect.Effect<B, Error>,
    config?: Partial<BatchConfig>
  ) => Stream.Stream<B, BatchProcessingError>
}

const BatchProcessor = Context.GenericTag<BatchProcessor>("@minecraft/BatchProcessor")

const BatchProcessorLive = Layer.effect(
  BatchProcessor,
  Effect.gen(function* () {
    const defaultConfig: BatchConfig = {
      maxBatchSize: 50,
      maxLatency: Duration.millis(100),
      concurrency: 4 // CPUコア数に基づいた調整
    }

    return {
      processBatch: <A, B>(
        items: Chunk.Chunk<A>,
        processor: (item: A) => Effect.Effect<B, Error>
      ) =>
        Effect.gen(function* () {
          const startTime = Date.now()
          const batchSize = Chunk.size(items)

          yield* Metric.set(batchMetrics.batchSize, batchSize)

          // Chunkを使用した効率的な並行処理
          const results = yield* Effect.all(
            Chunk.map(items, processor),
            { concurrency: defaultConfig.concurrency }
          ).pipe(
            Effect.mapError((errors) => new BatchProcessingError({
              batchSize,
              errors: Array.isArray(errors) ? errors : [errors]
            })),
            Effect.timed
          )

          // メトリクス記録
          const [duration, processedItems] = results
          yield* Metric.increment(batchMetrics.batchesProcessed)
          yield* Metric.incrementBy(batchMetrics.itemsProcessed, batchSize)
          yield* Metric.set(
            batchMetrics.processingDuration,
            Duration.toMillis(duration)
          )

          return processedItems
        }),

      processStream: <A, B>(
        stream: Stream.Stream<A>,
        processor: (item: A) => Effect.Effect<B, Error>,
        config: Partial<BatchConfig> = {}
      ) => {
        const finalConfig = { ...defaultConfig, ...config }

        return stream.pipe(
          // Stream.groupedWithinでバッチ処理
          Stream.groupedWithin(finalConfig.maxBatchSize, finalConfig.maxLatency),
          Stream.mapEffect((batch) =>
            pipe(
              batch,
              (chunk) => Effect.all(
                Chunk.map(chunk, processor),
                { concurrency: finalConfig.concurrency }
              )
            ).pipe(
              Effect.mapError((errors) => new BatchProcessingError({
                batchSize: Chunk.size(batch),
                errors: Array.isArray(errors) ? errors : [errors]
              }))
            )
          ),
          Stream.flatMap(Stream.fromChunk)
        )
      }
    }
  })
)
```

### 並列処理最適化

```typescript
import { Effect, Context, Chunk, Stream, Duration, Metric, Schedule, Layer, Ref, FiberRef } from "effect"

// システム情報とパフォーマンス監視
interface SystemInfo {
  readonly coreCount: number
  readonly memoryLimit: number
  readonly isWebWorkerAvailable: boolean
}

// パフォーマンス メトリクス
const chunkMetrics = {
  chunksProcessed: Metric.counter("chunks_processed"),
  processingTime: Metric.histogram("chunk_processing_time_ms"),
  concurrentTasks: Metric.gauge("concurrent_chunk_tasks"),
  throughput: Metric.gauge("chunks_per_second"),
  memoryUsage: Metric.gauge("chunk_processor_memory_mb")
}

class ChunkProcessingError extends Schema.TaggedError<ChunkProcessingError>("ChunkProcessingError")(
  "ChunkProcessingError",
  {
    chunkId: Schema.String,
    reason: Schema.String,
  }
) {}

interface OptimizedChunkProcessor {
  readonly processChunks: (
    chunks: Chunk.Chunk<ChunkData>
  ) => Effect.Effect<Chunk.Chunk<ProcessedChunk>, ChunkProcessingError>

  readonly processChunkStream: (
    stream: Stream.Stream<ChunkData>
  ) => Stream.Stream<ProcessedChunk, ChunkProcessingError>

  readonly getSystemInfo: Effect.Effect<SystemInfo>
}

const OptimizedChunkProcessor = Context.GenericTag<OptimizedChunkProcessor>("@minecraft/OptimizedChunkProcessor")

const OptimizedChunkProcessorLive = Layer.effect(
  OptimizedChunkProcessor,
  Effect.gen(function* () {
    // システム情報の動的取得
    const systemInfo = yield* Effect.sync((): SystemInfo => ({
      coreCount: typeof navigator !== "undefined"
        ? (navigator.hardwareConcurrency || 4)
        : 4,
      memoryLimit: typeof performance !== "undefined"
        ? (performance as any).memory?.jsHeapSizeLimit || 1000000000
        : 1000000000,
      isWebWorkerAvailable: typeof Worker !== "undefined"
    }))

    const concurrentTasks = yield* Ref.make(0)

    // 適応的同時実行制御
    const adaptiveConcurrency = yield* Effect.gen(function* () {
      const currentLoad = yield* Ref.get(concurrentTasks)
      const memoryPressure = yield* getMemoryPressure()

      return pipe(
        systemInfo.coreCount,
        Match.value,
        Match.when(
          (cores) => memoryPressure > 0.8,
          (cores) => Math.max(1, Math.floor(cores * 0.5))
        ),
        Match.when(
          (cores) => currentLoad > cores * 2,
          (cores) => Math.max(1, cores - 1)
        ),
        Match.orElse((cores) => cores)
      )
    })

    return {
      processChunks: (chunks: Chunk.Chunk<ChunkData>) =>
        Effect.gen(function* () {
          const startTime = yield* Effect.sync(() => Date.now())
          const chunkCount = Chunk.size(chunks)

          yield* Ref.update(concurrentTasks, (n) => n + chunkCount)
          yield* Metric.set(chunkMetrics.concurrentTasks, chunkCount)

          const concurrency = yield* adaptiveConcurrency

          // Effect.allWithConcurrencyによる最適化された並行処理
          const results = yield* Effect.all(
            Chunk.map(chunks, (chunk) =>
              processChunkWithMetrics(chunk).pipe(
                Effect.tapDefect(() =>
                  Ref.update(concurrentTasks, (n) => n - 1)
                )
              )
            ),
            { concurrency }
          ).pipe(
            Effect.ensuring(
              Ref.update(concurrentTasks, (n) => n - chunkCount)
            )
          )

          // パフォーマンス メトリクス記録
          const endTime = yield* Effect.sync(() => Date.now())
          const duration = endTime - startTime

          yield* Metric.incrementBy(chunkMetrics.chunksProcessed, chunkCount)
          yield* Metric.set(chunkMetrics.processingTime, duration)
          yield* Metric.set(
            chunkMetrics.throughput,
            chunkCount / (duration / 1000)
          )

          return results
        }),

      processChunkStream: (stream: Stream.Stream<ChunkData>) =>
        stream.pipe(
          // バッチ処理による効率化
          Stream.groupedWithin(10, Duration.millis(50)),
          Stream.mapEffect((batch) =>
            Effect.gen(function* () {
              const concurrency = yield* adaptiveConcurrency
              return yield* Effect.all(
                Chunk.map(batch, processChunkWithMetrics),
                { concurrency }
              )
            })
          ),
          Stream.flatMap(Stream.fromChunk),
          // バックプレッシャー制御
          Stream.buffer({ capacity: 32 })
        ),

      getSystemInfo: Effect.succeed(systemInfo)
    }
  })
)

// ヘルパー関数
const processChunkWithMetrics = (chunk: ChunkData): Effect.Effect<ProcessedChunk, ChunkProcessingError> =>
  Effect.gen(function* () {
    const startTime = yield* Effect.sync(() => performance.now())

    const processed = yield* processChunkInternal(chunk).pipe(
      Effect.mapError((error) => new ChunkProcessingError({
        chunkId: chunk.id,
        reason: String(error)
      }))
    )

    const endTime = yield* Effect.sync(() => performance.now())
    yield* Metric.set(chunkMetrics.processingTime, endTime - startTime)

    return processed
  })

const processChunkInternal = (chunk: ChunkData): Effect.Effect<ProcessedChunk, Error> =>
  Effect.succeed({
    id: chunk.id,
    processedAt: new Date(),
    blocks: Chunk.map(chunk.blocks, processBlock)
  })

const processBlock = (block: Block): ProcessedBlock => ({
  ...block,
  processed: true,
  timestamp: Date.now()
})

const getMemoryPressure = (): Effect.Effect<number> =>
  Effect.sync(() => {
    if (typeof performance !== "undefined" && (performance as any).memory) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit
    }
    return 0.5 // デフォルト値
  })
```

## I/O最適化

### 接続プール

```typescript
import {
  Effect, Context, Layer, Stream, Queue, Semaphore, Schedule,
  Metric, Duration, Chunk, HashMap, Ref
} from "effect"

// データベース接続とプール設定
interface DatabaseConfig {
  readonly minConnections: number
  readonly maxConnections: number
  readonly connectionTimeout: Duration.Duration
  readonly idleTimeout: Duration.Duration
  readonly healthCheckInterval: Duration.Duration
}

interface Connection {
  readonly id: string
  readonly createdAt: Date
  readonly lastUsed: Date
  readonly isHealthy: boolean
}

class ConnectionPoolError extends Schema.TaggedError<ConnectionPoolError>("ConnectionPoolError")(
  "ConnectionPoolError",
  {
    reason: Schema.String,
    poolState: Schema.Unknown,
  }
) {}

class DatabaseQueryError extends Schema.TaggedError<DatabaseQueryError>("DatabaseQueryError")(
  "DatabaseQueryError",
  {
    query: Schema.String,
    connectionId: Schema.String,
    cause: Schema.Unknown,
  }
) {}

// プール メトリクス
const poolMetrics = {
  activeConnections: Metric.gauge("db_active_connections"),
  waitingQueries: Metric.gauge("db_waiting_queries"),
  queryDuration: Metric.histogram("db_query_duration_ms"),
  connectionAcquireTime: Metric.histogram("db_connection_acquire_time_ms"),
  healthChecks: Metric.counter("db_health_checks"),
  failedHealthChecks: Metric.counter("db_failed_health_checks")
}

interface DatabasePool {
  readonly withConnection: <R, E, A>(
    f: (conn: Connection) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | ConnectionPoolError, R>

  readonly withTransaction: <R, E, A>(
    f: (conn: Connection) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | ConnectionPoolError, R>

  readonly streamQuery: <T>(
    query: string,
    batchSize?: number
  ) => Stream.Stream<T, DatabaseQueryError>

  readonly getPoolStats: Effect.Effect<{
    active: number
    idle: number
    waiting: number
  }>
}

const DatabasePool = Context.GenericTag<DatabasePool>("@minecraft/DatabasePool")

const DatabasePoolLive = Layer.effect(
  DatabasePool,
  Effect.gen(function* () {
    const config: DatabaseConfig = {
      minConnections: 2,
      maxConnections: 10,
      connectionTimeout: Duration.seconds(30),
      idleTimeout: Duration.minutes(5),
      healthCheckInterval: Duration.seconds(60)
    }

    const semaphore = yield* Semaphore.make(config.maxConnections)
    const availableConnections = yield* Queue.bounded<Connection>(config.maxConnections)
    const activeConnections = yield* Ref.make(HashMap.empty<string, Connection>())
    const waitingQueries = yield* Ref.make(0)

    // 初期接続プールの作成
    yield* pipe(
      Stream.range(0, config.minConnections - 1),
      Stream.mapEffect(() => createConnection()),
      Stream.runForeach((conn) => Queue.offer(availableConnections, conn))
    )

    // ヘルスチェックと接続管理のバックグラウンドタスク
    yield* Effect.fork(
      pipe(
        Stream.repeatEffect(
          healthCheckAndCleanup(availableConnections, activeConnections, config)
        ),
        Stream.schedule(Schedule.spaced(config.healthCheckInterval)),
        Stream.runDrain
      )
    )

    return {
      withConnection: <R, E, A>(
        f: (conn: Connection) => Effect.Effect<A, E, R>
      ) =>
        Effect.gen(function* () {
          const acquireStart = yield* Effect.sync(() => Date.now())
          yield* Ref.update(waitingQueries, (n) => n + 1)
          yield* Metric.incrementBy(poolMetrics.waitingQueries, 1)

          // セマフォによる同時接続数制御
          yield* Semaphore.take(semaphore)

          try {
            // 利用可能な接続を取得またはnew作成
            const connection = yield* pipe(
              Queue.poll(availableConnections),
              Effect.flatMap(
                Match.value,
                Match.when(
                  Option.isSome,
                  ({ value }) => Effect.succeed(value)
                ),
                Match.orElse(() => createConnection())
              )
            )

            const acquireEnd = yield* Effect.sync(() => Date.now())
            yield* Metric.set(
              poolMetrics.connectionAcquireTime,
              acquireEnd - acquireStart
            )

            // アクティブ接続として登録
            yield* Ref.update(
              activeConnections,
              HashMap.set(connection.id, connection)
            )

            yield* Ref.update(waitingQueries, (n) => n - 1)

            const result = yield* f(connection).pipe(
              Effect.timed,
              Effect.map(([duration, result]) => {
                Effect.sync(() =>
                  Metric.set(poolMetrics.queryDuration, Duration.toMillis(duration))
                ).pipe(Effect.runFork)
                return result
              })
            )

            return result
          } finally {
            // 接続をプールに戻す
            yield* Ref.update(
              activeConnections,
              HashMap.remove(connection.id)
            )

            const updatedConnection = {
              ...connection,
              lastUsed: new Date()
            }

            yield* Queue.offer(availableConnections, updatedConnection)
            yield* Semaphore.release(semaphore)

            // メトリクス更新
            const activeCount = yield* Ref.get(activeConnections).pipe(
              Effect.map(HashMap.size)
            )
            yield* Metric.set(poolMetrics.activeConnections, activeCount)
          }
        }).pipe(
          Effect.mapError((error) => new ConnectionPoolError({
            reason: String(error),
            poolState: { active: 0, idle: 0, waiting: 0 }
          }))
        ),

      withTransaction: <R, E, A>(
        f: (conn: Connection) => Effect.Effect<A, E, R>
      ) =>
        Effect.gen(function* () {
          return yield* Effect.acquireUseRelease(
            beginTransaction,
            (transactionalConn) => f(transactionalConn),
            (transactionalConn, exit) =>
              Effect.if(exit._tag === "Success", {
                onTrue: () => commitTransaction(transactionalConn),
                onFalse: () => rollbackTransaction(transactionalConn)
              })
          )
        }),

      streamQuery: <T>(
        query: string,
        batchSize: number = 100
      ) =>
        Stream.fromEffect(
          Effect.gen(function* () {
            const connection = yield* acquireConnection()
            return executeStreamQuery<T>(connection, query, batchSize)
          })
        ).pipe(
          Stream.flatten,
          Stream.mapError((error) => new DatabaseQueryError({
            query,
            connectionId: "stream",
            cause: error
          }))
        ),

      getPoolStats: Effect.gen(function* () {
        const active = yield* Ref.get(activeConnections).pipe(
          Effect.map(HashMap.size)
        )
        const idle = yield* Queue.size(availableConnections)
        const waiting = yield* Ref.get(waitingQueries)

        return { active, idle, waiting }
      })
    }
  })
)

// ヘルパー関数
const createConnection = (): Effect.Effect<Connection> =>
  Effect.sync(() => ({
    id: `conn_${Date.now()}_${Math.random()}`,
    createdAt: new Date(),
    lastUsed: new Date(),
    isHealthy: true
  }))

const healthCheckAndCleanup = (
  availableConnections: Queue.Queue<Connection>,
  activeConnections: Ref.Ref<HashMap.HashMap<string, Connection>>,
  config: DatabaseConfig
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Metric.increment(poolMetrics.healthChecks)

    // アイドル接続の健全性チェック
    const queueSize = yield* Queue.size(availableConnections)
    const connections = yield* Effect.all(
      Array.from({ length: queueSize }, () => Queue.take(availableConnections))
    )

    const healthyConnections = yield* Effect.all(
      connections.map((conn) =>
        isConnectionHealthy(conn).pipe(
          Effect.map((healthy) => ({ conn, healthy }))
        )
      )
    )

    // 健全な接続をプールに戻し、不健全な接続は破棄
    yield* Effect.all(
      healthyConnections.map(({ conn, healthy }) =>
        healthy
          ? Queue.offer(availableConnections, conn)
          : Effect.sync(() => {
              Metric.increment(poolMetrics.failedHealthChecks).pipe(Effect.runFork)
            })
      )
    )
  })

const isConnectionHealthy = (conn: Connection): Effect.Effect<boolean> =>
  Effect.succeed(conn.isHealthy && Date.now() - conn.lastUsed.getTime() < 300000)

const beginTransaction = Effect.succeed({} as Connection)
const commitTransaction = (conn: Connection) => Effect.void
const rollbackTransaction = (conn: Connection) => Effect.void

const executeStreamQuery = <T>(
  connection: Connection,
  query: string,
  batchSize: number
): Stream.Stream<T, Error> =>
  Stream.fromIterable([]) // 実装は省略

const acquireConnection = (): Effect.Effect<Connection> =>
  Effect.succeed({} as Connection) // 実装は省略
```

## 関連項目

- [非同期パターン](./04-asynchronous-patterns.md)
- [パフォーマンス最適化](../../03-guides/03-performance-optimization.md)
- [Effect-TSパターン](../01-architecture/06-effect-ts-patterns.md)