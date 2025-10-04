/**
 * 世界最高峰レベル Effect-TS 並行性テスト
 *
 * Effect-TSの高度な並行制御機能に特化したテストスイート
 * - Fiber・並行実行・中断制御
 * - STM（Software Transactional Memory）
 * - Schedule・リトライ戦略
 * - Resource・リソース管理
 */

import { describe, it, expect } from 'vitest'
import {
  Effect,
  TestContext,
  TestClock,
  Duration,
  Fiber,
  Ref,
  Semaphore,
  Queue,
  Stream,
  Schedule,
  Resource,
  Deferred,
  Layer,
  Exit,
  Cause
} from 'effect'
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

// ===== Test Layer Configuration ===== //

const TestLayer = TestContext.TestContext

// ===== Effect-TS Concurrency Tests ===== //

describe('Effect-TS Concurrency Tests', () => {

  describe('Fiber Management & Control', () => {

    it.effect('Fiber並行実行・協調的中断テスト', () =>
      Effect.gen(function* () {
        const results = yield* Ref.make<Array<string>>([])
        const completedFibers = yield* Ref.make(0)

        // 複数Fiberの並行実行
        const fibers = yield* Effect.all(
          Array.from({ length: 10 }, (_, i) =>
            Fiber.fork(
              Effect.gen(function* () {
                const chunkPos: ChunkPosition = { x: i, z: i }
                const operation = ChunkOperations.read(chunkPos)

                // 段階的処理
                yield* Ref.update(results, (arr) => [...arr, `fiber-${i}-start`])
                yield* Effect.sleep(Duration.millis(50 + i * 10))
                yield* Ref.update(results, (arr) => [...arr, `fiber-${i}-processing`])
                yield* Effect.sleep(Duration.millis(30))
                yield* Ref.update(results, (arr) => [...arr, `fiber-${i}-complete`])
                yield* Ref.update(completedFibers, (n) => n + 1)

                return operation
              })
            )
          ),
          { concurrency: 'unbounded' }
        )

        // 一部Fiberの中断テスト
        yield* Fiber.interrupt(fibers[0])
        yield* Fiber.interrupt(fibers[1])

        // 残りFiberの完了待機
        const remainingResults = yield* Effect.all(
          fibers.slice(2).map(Fiber.join),
          { concurrency: 'unbounded' }
        )

        // 結果検証
        const finalResults = yield* Ref.get(results)
        const completed = yield* Ref.get(completedFibers)

        expect(completed).toBe(8) // 10個中2個中断
        expect(remainingResults.length).toBe(8)
        expect(finalResults.length).toBeGreaterThan(16) // 各Fiberで3つのイベント
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('Fiber Supervision・エラー処理テスト', () =>
      Effect.gen(function* () {
        const successCount = yield* Ref.make(0)
        const errorCount = yield* Ref.make(0)

        // 成功・失敗の混在Fiber
        const mixedFibers = yield* Effect.all(
          Array.from({ length: 10 }, (_, i) =>
            Fiber.fork(
              Effect.gen(function* () {
                if (i % 3 === 0) {
                  // 意図的失敗
                  yield* Effect.fail(ChunkErrors.timeout(`operation-${i}`, 1000))
                } else {
                  // 正常処理
                  yield* Effect.sleep(Duration.millis(20))
                  yield* Ref.update(successCount, (n) => n + 1)
                  return ChunkOperations.read({ x: i, z: 0 })
                }
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    yield* Ref.update(errorCount, (n) => n + 1)
                    yield* Effect.logError(`Fiber ${i} failed: ${error._tag}`)
                    return ChunkOperations.read({ x: i, z: 0 }) // 回復処理
                  })
                )
              )
            )
          ),
          { concurrency: 'unbounded' }
        )

        // 全Fiber完了待機
        yield* Effect.all(mixedFibers.map(Fiber.join))

        const finalSuccess = yield* Ref.get(successCount)
        const finalError = yield* Ref.get(errorCount)

        expect(finalSuccess).toBe(7) // 10個中3個失敗
        expect(finalError).toBe(3)
        expect(finalSuccess + finalError).toBe(10)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('Fiber Race・競合制御テスト', () =>
      Effect.gen(function* () {
        const winner = yield* Ref.make<string | null>(null)

        // レース条件テスト
        const raceFibers = [
          Fiber.fork(
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(30))
              yield* Ref.set(winner, 'fiber-slow')
              return 'slow'
            })
          ),
          Fiber.fork(
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(10))
              yield* Ref.set(winner, 'fiber-fast')
              return 'fast'
            })
          ),
          Fiber.fork(
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(20))
              yield* Ref.set(winner, 'fiber-medium')
              return 'medium'
            })
          )
        ]

        const fibers = yield* Effect.all(raceFibers)

        // Race実行（最初に完了したものを取得）
        const raceResult = yield* Fiber.race(fibers[0], Fiber.race(fibers[1], fibers[2]))

        // 勝者確認
        const finalWinner = yield* Ref.get(winner)
        expect(finalWinner).toBe('fiber-fast')
        expect(raceResult).toBe('fast')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Semaphore & Resource Control', () => {

    it.effect('Semaphore並行数制限テスト', () =>
      Effect.gen(function* () {
        const maxConcurrency = 3
        const semaphore = yield* Semaphore.make(maxConcurrency)
        const activeCount = yield* Ref.make(0)
        const maxActiveObserved = yield* Ref.make(0)

        // 大量タスクの並行実行制限
        const tasks = Array.from({ length: 20 }, (_, i) =>
          semaphore.withPermits(1)(
            Effect.gen(function* () {
              // アクティブ数増加
              const current = yield* Ref.updateAndGet(activeCount, (n) => n + 1)
              yield* Ref.update(maxActiveObserved, (max) => Math.max(max, current))

              // 処理シミュレーション
              yield* Effect.sleep(Duration.millis(50))
              const operation = ChunkOperations.read({ x: i, z: 0 })

              // アクティブ数減少
              yield* Ref.update(activeCount, (n) => n - 1)
              return operation
            })
          )
        )

        // 全タスク実行
        const results = yield* Effect.all(tasks, { concurrency: 'unbounded' })

        // 制限効果確認
        const maxObserved = yield* Ref.get(maxActiveObserved)
        const finalActive = yield* Ref.get(activeCount)

        expect(maxObserved).toBeLessThanOrEqual(maxConcurrency)
        expect(finalActive).toBe(0)
        expect(results.length).toBe(20)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('Queue背圧制御・プロデューサー消費者テスト', () =>
      Effect.gen(function* () {
        const queueSize = 5
        const queue = yield* Queue.bounded<ChunkOperation>(queueSize)
        const producedCount = yield* Ref.make(0)
        const consumedCount = yield* Ref.make(0)

        // プロデューサーFiber
        const producer = yield* Fiber.fork(
          Effect.gen(function* () {
            for (let i = 0; i < 20; i++) {
              const operation = ChunkOperations.write(
                { x: i, z: 0 },
                new Uint8Array(CHUNK_VOLUME).fill(i) as ChunkDataBytes,
                {
                  biome: 'test' as const,
                  generationTime: Date.now() as any,
                  lastModified: Date.now() as any,
                  version: 1,
                  checksum: `hash-${i}` as any
                }
              )

              yield* Queue.offer(queue, operation)
              yield* Ref.update(producedCount, (n) => n + 1)
              yield* Effect.sleep(Duration.millis(10))
            }
          })
        )

        // コンシューマーFiber
        const consumer = yield* Fiber.fork(
          Effect.gen(function* () {
            for (let i = 0; i < 20; i++) {
              yield* Queue.take(queue)
              yield* Ref.update(consumedCount, (n) => n + 1)
              yield* Effect.sleep(Duration.millis(25)) // 遅い消費者
            }
          })
        )

        // 完了待機
        yield* Fiber.join(producer)
        yield* Fiber.join(consumer)

        const finalProduced = yield* Ref.get(producedCount)
        const finalConsumed = yield* Ref.get(consumedCount)

        expect(finalProduced).toBe(20)
        expect(finalConsumed).toBe(20)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('Resource管理・自動クリーンアップテスト', () =>
      Effect.gen(function* () {
        const resourceCreated = yield* Ref.make(0)
        const resourceReleased = yield* Ref.make(0)

        // リソースファクトリ
        const createChunkResource = (id: number) =>
          Resource.make(
            Effect.gen(function* () {
              yield* Ref.update(resourceCreated, (n) => n + 1)
              return {
                id,
                data: new Uint8Array(CHUNK_VOLUME).fill(id) as ChunkDataBytes,
                timestamp: Date.now()
              }
            }),
            (resource) =>
              Effect.gen(function* () {
                yield* Ref.update(resourceReleased, (n) => n + 1)
                yield* Effect.logInfo(`Released resource ${resource.id}`)
              })
          )

        // リソース使用パターン
        const useResources = yield* Effect.all(
          Array.from({ length: 5 }, (_, i) =>
            Resource.use(createChunkResource(i), (resource) =>
              Effect.gen(function* () {
                // リソース使用シミュレーション
                yield* Effect.sleep(Duration.millis(30))
                return resource.data.length
              })
            )
          ),
          { concurrency: 3 }
        )

        // リソース管理確認
        const created = yield* Ref.get(resourceCreated)
        const released = yield* Ref.get(resourceReleased)

        expect(created).toBe(5)
        expect(released).toBe(5) // 全リソースが適切に解放
        expect(useResources.every(length => length === CHUNK_VOLUME)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Schedule & Retry Strategies', () => {

    it.effect('高度なSchedule・リトライ戦略テスト', () =>
      Effect.gen(function* () {
        const attemptCounts = yield* Ref.make(new Map<string, number>())

        // 複数のリトライ戦略テスト
        const retryStrategies = [
          {
            name: 'exponential',
            schedule: Schedule.exponential(Duration.millis(10), 2.0).pipe(
              Schedule.compose(Schedule.recurs(3))
            )
          },
          {
            name: 'linear',
            schedule: Schedule.linear(Duration.millis(20)).pipe(
              Schedule.compose(Schedule.recurs(3))
            )
          },
          {
            name: 'fibonacci',
            schedule: Schedule.fibonacci(Duration.millis(5)).pipe(
              Schedule.compose(Schedule.recurs(4))
            )
          }
        ]

        const retryResults = yield* Effect.all(
          retryStrategies.map(({ name, schedule }) =>
            Effect.gen(function* () {
              let attempts = 0

              const operation = Effect.gen(function* () {
                attempts++
                yield* Ref.update(attemptCounts, (map) =>
                  new Map(map.set(name, attempts))
                )

                if (attempts < 3) {
                  yield* Effect.fail(ChunkErrors.network('http://flaky.com', 503))
                }

                return ChunkOperations.read({ x: attempts, z: 0 })
              })

              return yield* operation.pipe(Effect.retry(schedule))
            })
          ),
          { concurrency: 'unbounded' }
        )

        // リトライ回数確認
        const finalCounts = yield* Ref.get(attemptCounts)

        expect(retryResults.length).toBe(3)
        expect(finalCounts.get('exponential')).toBe(3)
        expect(finalCounts.get('linear')).toBe(3)
        expect(finalCounts.get('fibonacci')).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('条件付きSchedule・複雑なリトライロジック', () =>
      Effect.gen(function* () {
        const networkErrors = yield* Ref.make(0)
        const validationErrors = yield* Ref.make(0)
        const successCount = yield* Ref.make(0)

        // エラータイプ別リトライ戦略
        const conditionalRetrySchedule = Schedule.whileInput((error: unknown) => {
          if (error && typeof error === 'object' && '_tag' in error) {
            return error._tag === 'NetworkError' || error._tag === 'TimeoutError'
          }
          return false
        }).pipe(
          Schedule.compose(Schedule.exponential(Duration.millis(50))),
          Schedule.compose(Schedule.recurs(5))
        )

        const operations = [
          // ネットワークエラー（リトライ対象）
          Effect.gen(function* () {
            const attempts = yield* Ref.updateAndGet(networkErrors, (n) => n + 1)
            if (attempts < 3) {
              yield* Effect.fail(ChunkErrors.network('http://unreliable.com', 500))
            }
            yield* Ref.update(successCount, (n) => n + 1)
            return 'network-success'
          }),

          // バリデーションエラー（リトライ非対象）
          Effect.gen(function* () {
            yield* Ref.update(validationErrors, (n) => n + 1)
            yield* Effect.fail(ChunkErrors.validation('field', 'invalid', 'constraint'))
          }),

          // タイムアウトエラー（リトライ対象）
          Effect.gen(function* () {
            const attempts = yield* Ref.updateAndGet(networkErrors, (n) => n + 1)
            if (attempts < 2) {
              yield* Effect.fail(ChunkErrors.timeout('slow-operation', 5000))
            }
            yield* Ref.update(successCount, (n) => n + 1)
            return 'timeout-success'
          })
        ]

        // 並行実行・個別リトライ
        const results = yield* Effect.all(
          operations.map((op) =>
            op.pipe(
              Effect.retry(conditionalRetrySchedule),
              Effect.either
            )
          ),
          { concurrency: 'unbounded' }
        )

        // 結果検証
        const netErrors = yield* Ref.get(networkErrors)
        const valErrors = yield* Ref.get(validationErrors)
        const successes = yield* Ref.get(successCount)

        expect(results[0]._tag).toBe('Right') // ネットワークエラー回復
        expect(results[1]._tag).toBe('Left')  // バリデーションエラー未回復
        expect(results[2]._tag).toBe('Right') // タイムアウトエラー回復
        expect(successes).toBe(2)
        expect(valErrors).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Stream & Flow Control', () => {

    it.effect('高度なStream並行処理・背圧制御', () =>
      Effect.gen(function* () {
        const processedChunks = yield* Ref.make<Array<ChunkPosition>>([])
        const concurrentOperations = yield* Ref.make(0)
        const maxConcurrency = yield* Ref.make(0)

        // 大容量データストリーム
        const chunkPositions = Array.from({ length: 1000 }, (_, i) => ({
          x: i % 100,
          z: Math.floor(i / 100)
        }))

        yield* Stream.fromIterable(chunkPositions).pipe(
          Stream.mapEffect((position) =>
            Effect.gen(function* () {
              // 並行数監視
              const current = yield* Ref.updateAndGet(concurrentOperations, (n) => n + 1)
              yield* Ref.update(maxConcurrency, (max) => Math.max(max, current))

              // チャンク処理シミュレーション
              yield* Effect.sleep(Duration.millis(10 + Math.random() * 20))
              const operation = ChunkOperations.read(position)

              // 処理完了記録
              yield* Ref.update(processedChunks, (arr) => [...arr, position])
              yield* Ref.update(concurrentOperations, (n) => n - 1)

              return operation
            }),
            { concurrency: 50 } // 並行数制限
          ),
          Stream.take(1000),
          Stream.runDrain
        )

        // Stream処理結果検証
        const processed = yield* Ref.get(processedChunks)
        const maxConcur = yield* Ref.get(maxConcurrency)
        const finalConcur = yield* Ref.get(concurrentOperations)

        expect(processed.length).toBe(1000)
        expect(maxConcur).toBeLessThanOrEqual(50) // 並行数制限効果
        expect(finalConcur).toBe(0) // 全処理完了
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('Stream分岐・結合・複雑フロー制御', () =>
      Effect.gen(function* () {
        const readOperations = yield* Ref.make<Array<ChunkOperation>>([])
        const writeOperations = yield* Ref.make<Array<ChunkOperation>>([])
        const errors = yield* Ref.make<Array<string>>([])

        // 混在操作ストリーム
        const mixedOperations = Array.from({ length: 100 }, (_, i) => {
          if (i % 3 === 0) {
            return ChunkOperations.write(
              { x: i, z: 0 },
              new Uint8Array(CHUNK_VOLUME).fill(i) as ChunkDataBytes,
              {
                biome: 'test' as const,
                generationTime: Date.now() as any,
                lastModified: Date.now() as any,
                version: 1,
                checksum: `hash-${i}` as any
              }
            )
          } else if (i % 7 === 0) {
            return ChunkOperations.delete({ x: i, z: 0 })
          } else {
            return ChunkOperations.read({ x: i, z: 0 })
          }
        })

        // Stream分岐処理
        yield* Stream.fromIterable(mixedOperations).pipe(
          Stream.mapEffect((operation) =>
            Effect.gen(function* () {
              switch (operation._tag) {
                case 'Read':
                  yield* Ref.update(readOperations, (arr) => [...arr, operation])
                  return `read-${operation.position.x}`

                case 'Write':
                  yield* Ref.update(writeOperations, (arr) => [...arr, operation])
                  return `write-${operation.position.x}`

                case 'Delete':
                  // 意図的エラー注入
                  if (operation.position.x % 14 === 0) {
                    yield* Ref.update(errors, (arr) => [...arr, `delete-error-${operation.position.x}`])
                    yield* Effect.fail(new Error(`Delete failed for ${operation.position.x}`))
                  }
                  return `delete-${operation.position.x}`

                default:
                  return `unknown-${JSON.stringify(operation)}`
              }
            }).pipe(
              Effect.catchAll((error) =>
                Effect.succeed(`error-handled-${error.message}`)
              )
            ),
            { concurrency: 20 }
          ),
          Stream.runCollect
        )

        // 分岐処理結果検証
        const reads = yield* Ref.get(readOperations)
        const writes = yield* Ref.get(writeOperations)
        const errorList = yield* Ref.get(errors)

        const expectedReads = mixedOperations.filter(op => op._tag === 'Read').length
        const expectedWrites = mixedOperations.filter(op => op._tag === 'Write').length

        expect(reads.length).toBe(expectedReads)
        expect(writes.length).toBe(expectedWrites)
        expect(errorList.length).toBeGreaterThan(0) // エラー処理確認
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Deferred & Synchronization', () => {

    it.effect('Deferred・非同期調整・同期プリミティブ', () =>
      Effect.gen(function* () {
        const readySignal = yield* Deferred.make<void>()
        const results = yield* Ref.make<Array<string>>([])
        const completionSignals = yield* Effect.all(
          Array.from({ length: 5 }, () => Deferred.make<string>())
        )

        // 調整された並行処理
        const coordinatedFibers = yield* Effect.all(
          Array.from({ length: 5 }, (_, i) =>
            Fiber.fork(
              Effect.gen(function* () {
                // 開始シグナル待機
                yield* Deferred.await(readySignal)

                // 段階的処理
                yield* Ref.update(results, (arr) => [...arr, `fiber-${i}-started`])
                yield* Effect.sleep(Duration.millis(50 + i * 10))

                const operation = ChunkOperations.read({ x: i, z: i })
                yield* Ref.update(results, (arr) => [...arr, `fiber-${i}-processed`])

                // 完了シグナル送信
                yield* Deferred.succeed(completionSignals[i], `fiber-${i}-completed`)

                return operation
              })
            )
          ),
          { concurrency: 'unbounded' }
        )

        // 準備時間
        yield* Effect.sleep(Duration.millis(100))

        // 一斉開始
        yield* Deferred.succeed(readySignal, void 0)

        // 段階的完了確認
        for (let i = 0; i < 5; i++) {
          const completion = yield* Deferred.await(completionSignals[i])
          expect(completion).toBe(`fiber-${i}-completed`)
        }

        // 全Fiber完了待機
        const operations = yield* Effect.all(coordinatedFibers.map(Fiber.join))

        // 調整効果確認
        const finalResults = yield* Ref.get(results)
        expect(operations.length).toBe(5)
        expect(finalResults.length).toBe(10) // 各Fiberで2つのイベント

        // 開始順序確認（一斉開始効果）
        const startEvents = finalResults.filter(r => r.includes('started'))
        expect(startEvents.length).toBe(5)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})