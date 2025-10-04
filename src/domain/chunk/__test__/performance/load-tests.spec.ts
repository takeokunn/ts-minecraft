/**
 * 世界最高峰レベル Chunk Domain パフォーマンステスト
 *
 * 高負荷・大量処理・並行性に特化したパフォーマンステストスイート
 * - スループット・レイテンシ測定
 * - メモリ使用量・リーク検証
 * - 並行性制限・背圧制御テスト
 * - リアルタイムメトリクス測定
 */

import { describe, it, expect } from 'vitest'
import { Effect, TestContext, TestClock, Duration, Ref, Fiber, Stream, Metric, Layer } from 'effect'
import { ChunkArbitraries } from '../property/arbitraries/chunk-arbitraries'
import {
  ChunkStates,
  ChunkOperations,
  ChunkErrors,
  type ChunkState,
  type ChunkOperation,
  type ChunkDataBytes,
  CHUNK_VOLUME
} from '../../types/core'
import type { ChunkPosition } from '../../value_object/chunk_position/types'

// ===== Performance Test Configuration ===== //

const PERFORMANCE_TIMEOUT = 60000 // 60秒
const HIGH_VOLUME_COUNT = 10000   // 高負荷テスト件数
const STRESS_TEST_COUNT = 100000  // ストレステスト件数
const CONCURRENT_LIMIT = 1000     // 並行実行制限

// ===== Performance Monitoring Services ===== //

/**
 * PerformanceMonitor - リアルタイムパフォーマンス監視
 */
class PerformanceMonitor extends Effect.Service<PerformanceMonitor>()('PerformanceMonitor', {
  effect: Effect.gen(function* () {
    const metrics = yield* Ref.make({
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Number.MAX_SAFE_INTEGER,
      memoryPeakUsage: 0,
      startTime: Date.now()
    })

    return {
      recordOperation: (latency: number, success: boolean) =>
        Effect.gen(function* () {
          yield* Ref.update(metrics, (m) => ({
            ...m,
            totalOperations: m.totalOperations + 1,
            successfulOperations: success ? m.successfulOperations + 1 : m.successfulOperations,
            failedOperations: success ? m.failedOperations : m.failedOperations + 1,
            totalLatency: m.totalLatency + latency,
            maxLatency: Math.max(m.maxLatency, latency),
            minLatency: Math.min(m.minLatency, latency)
          }))
        }),

      recordMemoryUsage: () =>
        Effect.gen(function* () {
          const memoryUsage = process.memoryUsage().heapUsed
          yield* Ref.update(metrics, (m) => ({
            ...m,
            memoryPeakUsage: Math.max(m.memoryPeakUsage, memoryUsage)
          }))
        }),

      getMetrics: () => Ref.get(metrics),

      getAverageLatency: () =>
        Effect.gen(function* () {
          const m = yield* Ref.get(metrics)
          return m.totalOperations > 0 ? m.totalLatency / m.totalOperations : 0
        }),

      getThroughput: () =>
        Effect.gen(function* () {
          const m = yield* Ref.get(metrics)
          const elapsed = Date.now() - m.startTime
          return elapsed > 0 ? (m.totalOperations / elapsed) * 1000 : 0 // ops/sec
        }),

      reset: () =>
        Effect.gen(function* () {
          yield* Ref.set(metrics, {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            totalLatency: 0,
            maxLatency: 0,
            minLatency: Number.MAX_SAFE_INTEGER,
            memoryPeakUsage: 0,
            startTime: Date.now()
          })
        })
    }
  })
}) {}

/**
 * LoadBalancer - 負荷分散・背圧制御
 */
class LoadBalancer extends Effect.Service<LoadBalancer>()('LoadBalancer', {
  effect: Effect.gen(function* () {
    const activeConnections = yield* Ref.make(0)
    const maxConnections = 1000
    const requestQueue = yield* Ref.make<Array<ChunkOperation>>([])

    return {
      submitOperation: (operation: ChunkOperation) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(activeConnections)
          if (current >= maxConnections) {
            // 背圧制御: キューに追加
            yield* Ref.update(requestQueue, (queue) => [...queue, operation])
            yield* Effect.sleep(Duration.millis(10)) // 背圧遅延
          } else {
            yield* Ref.update(activeConnections, (n) => n + 1)
          }
          return operation
        }),

      completeOperation: () =>
        Effect.gen(function* () {
          yield* Ref.update(activeConnections, (n) => Math.max(0, n - 1))

          // キューからの処理再開
          const queue = yield* Ref.get(requestQueue)
          if (queue.length > 0) {
            yield* Ref.update(requestQueue, (q) => q.slice(1))
            return queue[0]
          }
          return null
        }),

      getActiveConnections: () => Ref.get(activeConnections),
      getQueueLength: () => Effect.map(Ref.get(requestQueue), (q) => q.length),
      clear: () => Effect.all([
        Ref.set(activeConnections, 0),
        Ref.set(requestQueue, [])
      ])
    }
  })
}) {}

/**
 * MemoryStressTest - メモリ負荷テスト
 */
class MemoryStressTest extends Effect.Service<MemoryStressTest>()('MemoryStressTest', {
  effect: Effect.gen(function* () {
    const allocatedChunks = yield* Ref.make<Array<ChunkDataBytes>>([])

    return {
      allocateChunks: (count: number) =>
        Effect.gen(function* () {
          const chunks = Array.from({ length: count }, (_, i) =>
            new Uint8Array(CHUNK_VOLUME).fill(i % 256) as ChunkDataBytes
          )
          yield* Ref.update(allocatedChunks, (existing) => [...existing, ...chunks])
          return chunks.length
        }),

      deallocateChunks: (count: number) =>
        Effect.gen(function* () {
          yield* Ref.update(allocatedChunks, (chunks) =>
            chunks.slice(Math.min(count, chunks.length))
          )
        }),

      getAllocatedCount: () =>
        Effect.map(Ref.get(allocatedChunks), (chunks) => chunks.length),

      getMemoryUsage: () =>
        Effect.sync(() => process.memoryUsage()),

      simulateMemoryPressure: (intensity: number) =>
        Effect.gen(function* () {
          const pressure = Math.min(Math.max(intensity, 0), 1)
          const chunkCount = Math.floor(pressure * 1000)
          yield* this.allocateChunks(chunkCount)
          yield* Effect.sleep(Duration.millis(100))
          yield* this.deallocateChunks(Math.floor(chunkCount * 0.8))
        }),

      clear: () => Ref.set(allocatedChunks, [])
    }
  })
}) {}

// ===== Test Layer Setup ===== //

const PerformanceTestLayer = Layer.mergeAll(
  PerformanceMonitor.Default,
  LoadBalancer.Default,
  MemoryStressTest.Default,
  TestContext.TestContext
)

// ===== Performance Tests ===== //

describe('Chunk Domain Performance Tests', () => {

  describe('Throughput & Latency Tests', () => {

    it.effect('高スループット処理テスト', () =>
      Effect.gen(function* () {
        const monitor = yield* PerformanceMonitor
        const loadBalancer = yield* LoadBalancer

        yield* monitor.reset()

        const operationCount = 5000
        const operations = Array.from({ length: operationCount }, (_, i) =>
          ChunkOperations.read({ x: i % 100, z: Math.floor(i / 100) })
        )

        const startTime = Date.now()

        // 高並行処理実行
        yield* Effect.all(
          operations.map((operation) =>
            Effect.gen(function* () {
              const opStart = Date.now()
              yield* loadBalancer.submitOperation(operation)

              // 操作シミュレーション
              yield* simulateChunkOperation(operation)
              yield* loadBalancer.completeOperation()

              const opEnd = Date.now()
              yield* monitor.recordOperation(opEnd - opStart, true)
            })
          ),
          { concurrency: 100 }
        )

        const endTime = Date.now()
        const totalTime = endTime - startTime

        // パフォーマンス検証
        const throughput = yield* monitor.getThroughput()
        const avgLatency = yield* monitor.getAverageLatency()
        const metrics = yield* monitor.getMetrics()

        expect(throughput).toBeGreaterThan(100) // 100 ops/sec以上
        expect(avgLatency).toBeLessThan(100)    // 100ms未満
        expect(metrics.successfulOperations).toBe(operationCount)
        expect(metrics.failedOperations).toBe(0)
        expect(totalTime).toBeLessThan(30000)   // 30秒以内
      }).pipe(Effect.provide(PerformanceTestLayer), Effect.timeout(Duration.millis(PERFORMANCE_TIMEOUT)))
    )

    it.effect('レイテンシ分布分析テスト', () =>
      Effect.gen(function* () {
        const monitor = yield* PerformanceMonitor
        yield* monitor.reset()

        const operationCount = 1000
        const latencies: number[] = []

        // 異なる負荷パターンでの操作実行
        for (let i = 0; i < operationCount; i++) {
          const opStart = Date.now()

          // 負荷変動シミュレーション
          const loadFactor = Math.sin(i / 100) * 0.5 + 0.5 // 0-1の周期的変動
          const delay = Math.floor(loadFactor * 50) // 0-50msの遅延

          yield* Effect.sleep(Duration.millis(delay))
          yield* simulateChunkOperation(ChunkOperations.read({ x: i, z: 0 }))

          const opEnd = Date.now()
          const latency = opEnd - opStart
          latencies.push(latency)
          yield* monitor.recordOperation(latency, true)
        }

        // レイテンシ統計分析
        latencies.sort((a, b) => a - b)
        const p50 = latencies[Math.floor(latencies.length * 0.5)]
        const p90 = latencies[Math.floor(latencies.length * 0.9)]
        const p95 = latencies[Math.floor(latencies.length * 0.95)]
        const p99 = latencies[Math.floor(latencies.length * 0.99)]

        const metrics = yield* monitor.getMetrics()

        // パフォーマンス指標検証
        expect(p50).toBeLessThan(100)  // P50 < 100ms
        expect(p90).toBeLessThan(200)  // P90 < 200ms
        expect(p95).toBeLessThan(300)  // P95 < 300ms
        expect(p99).toBeLessThan(500)  // P99 < 500ms
        expect(metrics.maxLatency).toBeLessThan(1000) // Max < 1s
      }).pipe(Effect.provide(PerformanceTestLayer))
    )
  })

  describe('Memory Performance Tests', () => {

    it.effect('メモリ使用量・リーク検証テスト', () =>
      Effect.gen(function* () {
        const memoryStress = yield* MemoryStressTest
        const monitor = yield* PerformanceMonitor

        yield* memoryStress.clear()

        const initialMemory = yield* memoryStress.getMemoryUsage()

        // 段階的メモリ負荷
        const phases = [
          { chunks: 100, label: 'light load' },
          { chunks: 500, label: 'medium load' },
          { chunks: 1000, label: 'heavy load' },
          { chunks: 2000, label: 'stress load' }
        ]

        for (const phase of phases) {
          // メモリ割り当て
          yield* memoryStress.allocateChunks(phase.chunks)
          yield* monitor.recordMemoryUsage()

          // 操作実行
          yield* Effect.all(
            Array.from({ length: phase.chunks / 10 }, (_, i) =>
              simulateChunkOperation(ChunkOperations.read({ x: i, z: 0 }))
            ),
            { concurrency: 10 }
          )

          const currentMemory = yield* memoryStress.getMemoryUsage()
          const allocatedCount = yield* memoryStress.getAllocatedCount()

          expect(allocatedCount).toBeGreaterThan(0)
          expect(currentMemory.heapUsed).toBeGreaterThan(initialMemory.heapUsed)

          // メモリ解放
          yield* memoryStress.deallocateChunks(phase.chunks)
        }

        // 最終メモリ確認（リーク検証）
        yield* memoryStress.clear()
        yield* Effect.sleep(Duration.millis(100)) // GC待機

        const finalMemory = yield* memoryStress.getMemoryUsage()
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

        // メモリリーク閾値: 50MB未満
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      }).pipe(Effect.provide(PerformanceTestLayer))
    )

    it.effect('メモリプレッシャー下でのパフォーマンス', () =>
      Effect.gen(function* () {
        const memoryStress = yield* MemoryStressTest
        const monitor = yield* PerformanceMonitor

        yield* monitor.reset()

        // 背景メモリプレッシャー
        const pressureFiber = yield* Fiber.fork(
          Effect.forever(
            memoryStress.simulateMemoryPressure(0.7).pipe(
              Effect.delay(Duration.millis(100))
            )
          )
        )

        // プレッシャー下での操作実行
        const operationCount = 500
        const operations = Array.from({ length: operationCount }, (_, i) =>
          ChunkOperations.write(
            { x: i % 50, z: Math.floor(i / 50) },
            new Uint8Array(CHUNK_VOLUME).fill(i % 256) as ChunkDataBytes,
            {
              biome: 'test' as const,
              generationTime: Date.now() as any,
              lastModified: Date.now() as any,
              version: 1,
              checksum: `hash-${i}` as any
            }
          )
        )

        yield* Effect.all(
          operations.map((operation) =>
            Effect.gen(function* () {
              const start = Date.now()
              yield* simulateChunkOperation(operation)
              const end = Date.now()
              yield* monitor.recordOperation(end - start, true)
            })
          ),
          { concurrency: 20 }
        )

        // プレッシャー停止
        yield* Fiber.interrupt(pressureFiber)

        // パフォーマンス検証
        const avgLatency = yield* monitor.getAverageLatency()
        const throughput = yield* monitor.getThroughput()
        const metrics = yield* monitor.getMetrics()

        expect(avgLatency).toBeLessThan(500)  // プレッシャー下でも500ms未満
        expect(throughput).toBeGreaterThan(10) // 最低限のスループット
        expect(metrics.successfulOperations).toBe(operationCount)
      }).pipe(Effect.provide(PerformanceTestLayer))
    )
  })

  describe('Concurrency Performance Tests', () => {

    it.effect('並行性制限・背圧制御テスト', () =>
      Effect.gen(function* () {
        const loadBalancer = yield* LoadBalancer
        const monitor = yield* PerformanceMonitor

        yield* loadBalancer.clear()
        yield* monitor.reset()

        // 大量リクエスト投入
        const requestCount = 5000
        const operations = Array.from({ length: requestCount }, (_, i) =>
          ChunkOperations.read({ x: i % 100, z: Math.floor(i / 100) })
        )

        // 並行投入
        const submissionFiber = yield* Fiber.fork(
          Effect.all(
            operations.map((operation) =>
              loadBalancer.submitOperation(operation)
            ),
            { concurrency: 'unbounded' }
          )
        )

        // 処理Fiber
        const processingFiber = yield* Fiber.fork(
          Effect.forever(
            Effect.gen(function* () {
              const start = Date.now()
              yield* simulateChunkOperation(operations[0]) // 代表操作
              const completed = yield* loadBalancer.completeOperation()
              const end = Date.now()

              if (completed) {
                yield* monitor.recordOperation(end - start, true)
              }
              yield* Effect.sleep(Duration.millis(1))
            })
          )
        )

        // 一定時間実行
        yield* Effect.sleep(Duration.seconds(10))

        // 停止
        yield* Fiber.interrupt(submissionFiber)
        yield* Fiber.interrupt(processingFiber)

        // 背圧制御効果確認
        const activeConnections = yield* loadBalancer.getActiveConnections()
        const queueLength = yield* loadBalancer.getQueueLength()
        const metrics = yield* monitor.getMetrics()

        expect(activeConnections).toBeLessThanOrEqual(1000) // 制限内
        expect(metrics.totalOperations).toBeGreaterThan(100) // 最低処理数
      }).pipe(Effect.provide(PerformanceTestLayer))
    )

    it.effect('Fiber競合・リソース競合テスト', () =>
      Effect.gen(function* () {
        const monitor = yield* PerformanceMonitor
        const sharedResource = yield* Ref.make(0)

        yield* monitor.reset()

        const fiberCount = 100
        const operationsPerFiber = 50

        // 競合Fiber群
        const competingFibers = Array.from({ length: fiberCount }, (_, fiberIndex) =>
          Fiber.fork(
            Effect.gen(function* () {
              for (let i = 0; i < operationsPerFiber; i++) {
                const start = Date.now()

                // 共有リソースへの競合アクセス
                yield* Ref.update(sharedResource, (n) => n + 1)
                yield* simulateChunkOperation(
                  ChunkOperations.read({ x: fiberIndex, z: i })
                )

                const end = Date.now()
                yield* monitor.recordOperation(end - start, true)
                yield* Effect.yieldNow() // 協調的マルチタスキング
              }
            })
          )
        )

        const fibers = yield* Effect.all(competingFibers)

        // 全Fiber完了待機
        yield* Effect.all(fibers.map(Fiber.join))

        // 競合結果検証
        const finalValue = yield* Ref.get(sharedResource)
        const metrics = yield* monitor.getMetrics()

        expect(finalValue).toBe(fiberCount * operationsPerFiber) // データ一貫性
        expect(metrics.successfulOperations).toBe(fiberCount * operationsPerFiber)
        expect(metrics.failedOperations).toBe(0)
      }).pipe(Effect.provide(PerformanceTestLayer))
    )
  })

  describe('Stream Performance Tests', () => {

    it.effect('大容量Streamパフォーマンステスト', () =>
      Effect.gen(function* () {
        const monitor = yield* PerformanceMonitor
        yield* monitor.reset()

        const streamSize = 10000
        const batchSize = 100

        // 大容量Stream処理
        const processed = yield* Stream.range(0, streamSize).pipe(
          Stream.map((i) => ChunkOperations.read({ x: i % 100, z: Math.floor(i / 100) })),
          Stream.batch(batchSize),
          Stream.mapEffect((batch) =>
            Effect.gen(function* () {
              const start = Date.now()
              yield* Effect.all(
                batch.map(simulateChunkOperation),
                { concurrency: batchSize }
              )
              const end = Date.now()
              yield* monitor.recordOperation(end - start, true)
              return batch.length
            })
          ),
          Stream.runFold(0, (acc, count) => acc + count)
        )

        // Stream処理結果検証
        expect(processed).toBe(streamSize)

        const metrics = yield* monitor.getMetrics()
        const throughput = yield* monitor.getThroughput()

        expect(throughput).toBeGreaterThan(100) // 100 ops/sec以上
        expect(metrics.successfulOperations).toBeGreaterThan(0)
      }).pipe(Effect.provide(PerformanceTestLayer))
    )
  })
})

// ===== Helper Functions ===== //

/**
 * チャンク操作シミュレーション
 */
const simulateChunkOperation = (operation: ChunkOperation): Effect.Effect<void, never> => {
  return Effect.gen(function* () {
    // 操作に応じた処理時間シミュレーション
    const baseDelay = operation._tag === 'Write' ? 10 : 5
    const randomDelay = Math.random() * 5
    yield* Effect.sleep(Duration.millis(baseDelay + randomDelay))
  })
}