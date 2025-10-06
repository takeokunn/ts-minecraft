/**
 * 世界最高峰レベル Chunk Domain テストレイヤー
 *
 * テスト環境統合レイヤー・モック・ヘルパー
 * - 統一テストレイヤー構成
 * - モックサービス実装
 * - テストヘルパー関数群
 * - Effect-TS統合テストサポート
 */

import { Clock, Duration, Effect, Layer, Random, Ref, TestClock, TestContext } from 'effect'
import type { ChunkDataBytes, ChunkError, ChunkOperation, ChunkState, LoadProgress, RetryCount } from '../../types/core'
import { ChunkErrors, ChunkOperations, ChunkStates } from '../../types/core'
import type { ChunkPosition } from '../../value_object/chunk_position/types'

// ===== Test Configuration ===== //

export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000,
  CHUNK_VOLUME: 16 * 16 * 384,
  MAX_RETRY_COUNT: 5,
  DEFAULT_CHUNK_SIZE: 16,
  DEFAULT_CHUNK_HEIGHT: 384,
} as const

// ===== Mock Service Implementations ===== //

/**
 * MockChunkDataGenerator - テスト用チャンクデータ生成
 */
export class MockChunkDataGenerator extends Effect.Service<MockChunkDataGenerator>()('MockChunkDataGenerator', {
  effect: Effect.succeed({
    generateEmptyChunk: (): ChunkDataBytes => new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME).fill(0) as ChunkDataBytes,

    generateRandomChunk: (seed?: number): Effect.Effect<ChunkDataBytes, never> =>
      Effect.gen(function* () {
        if (seed !== undefined) {
          yield* Random.setSeed(seed)
        }
        const data = new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME)
        for (let i = 0; i < data.length; i++) {
          const randomValue = yield* Random.nextIntBetween(0, 256)
          data[i] = randomValue
        }
        return data as ChunkDataBytes
      }),

    generatePatternChunk: (pattern: number): ChunkDataBytes =>
      new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME).fill(pattern % 256) as ChunkDataBytes,

    generateNoiseChunk: (frequency: number = 0.1): Effect.Effect<ChunkDataBytes, never> =>
      Effect.gen(function* () {
        const data = new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME)
        for (let i = 0; i < data.length; i++) {
          const noise = Math.sin(i * frequency) * 127 + 128
          data[i] = Math.floor(Math.abs(noise)) % 256
        }
        return data as ChunkDataBytes
      }),

    generateCheckerboardChunk: (): ChunkDataBytes => {
      const data = new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME)
      for (let i = 0; i < data.length; i++) {
        const x = i % 16
        const z = Math.floor((i % (16 * 16)) / 16)
        const y = Math.floor(i / (16 * 16))
        data[i] = ((x + y + z) % 2) * 255
      }
      return data as ChunkDataBytes
    },
  }),
}) {}

/**
 * MockTimeProvider - テスト用時間プロバイダ
 */
export class MockTimeProvider extends Effect.Service<MockTimeProvider>()('MockTimeProvider', {
  effect: Effect.gen(function* () {
    const clock = yield* Clock.Clock
    const initialTime = yield* clock.currentTimeMillis
    const baseTime = yield* Ref.make(initialTime)

    return {
      now: (): Effect.Effect<number, never> => Ref.get(baseTime),

      advanceTime: (milliseconds: number): Effect.Effect<void, never> =>
        Ref.update(baseTime, (time) => time + milliseconds),

      setTime: (timestamp: number): Effect.Effect<void, never> => Ref.set(baseTime, timestamp),

      resetTime: (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const clock = yield* Clock.Clock
          const now = yield* clock.currentTimeMillis
          yield* Ref.set(baseTime, now)
        }),
    }
  }),
}) {}

/**
 * MockMetricsCollector - テスト用メトリクス収集
 */
export class MockMetricsCollector extends Effect.Service<MockMetricsCollector>()('MockMetricsCollector', {
  effect: Effect.gen(function* () {
    const metrics = yield* Ref.make({
      operationCounts: new Map<string, number>(),
      latencies: new Array<{ operation: string; latency: number }>(),
      errors: new Array<{ error: ChunkError; timestamp: number }>(),
      memoryUsage: new Array<{ timestamp: number; usage: number }>(),
    })

    return {
      recordOperation: (operation: string, latency: number): Effect.Effect<void, never> =>
        Ref.update(metrics, (m) => ({
          ...m,
          operationCounts: new Map(m.operationCounts.set(operation, (m.operationCounts.get(operation) || 0) + 1)),
          latencies: [...m.latencies, { operation, latency }],
        })),

      recordError: (error: ChunkError): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const clock = yield* Clock.Clock
          const now = yield* clock.currentTimeMillis

          yield* Ref.update(metrics, (m) => ({
            ...m,
            errors: [...m.errors, { error, timestamp: now }],
          }))
        }),

      recordMemoryUsage: (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const clock = yield* Clock.Clock
          const now = yield* clock.currentTimeMillis

          yield* Ref.update(metrics, (m) => ({
            ...m,
            memoryUsage: [
              ...m.memoryUsage,
              {
                timestamp: now,
                usage: process.memoryUsage().heapUsed,
              },
            ],
          }))
        }),

      getMetrics: (): Effect.Effect<typeof metrics extends Ref.Ref<infer T> ? T : never, never> => Ref.get(metrics),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(metrics, {
          operationCounts: new Map(),
          latencies: [],
          errors: [],
          memoryUsage: [],
        }),
    }
  }),
}) {}

// ===== Test Helper Functions ===== //

/**
 * チャンクテストデータ生成ヘルパー
 */
export const ChunkTestHelpers = {
  /**
   * テスト用チャンク位置生成
   */
  createTestPosition: (x: number = 0, z: number = 0): ChunkPosition => ({ x, z }),

  /**
   * テスト用チャンクメタデータ生成
   */
  createTestMetadata: (overrides: Partial<any> = {}): Effect.Effect<any, never> =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock
      const now = yield* clock.currentTimeMillis

      return {
        biome: 'test-biome' as const,
        generationTime: now as any,
        lastModified: now as any,
        version: 1,
        checksum: 'test-checksum' as any,
        ...overrides,
      }
    }),

  /**
   * テスト用チャンク状態セット生成
   */
  createTestStateSet: (): Effect.Effect<Array<ChunkState>, never> =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock
      const now = yield* clock.currentTimeMillis
      const metadata = yield* ChunkTestHelpers.createTestMetadata()

      return [
        ChunkStates.unloaded(),
        ChunkStates.loading(50 as LoadProgress),
        ChunkStates.loaded(new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME).fill(42) as ChunkDataBytes, metadata),
        ChunkStates.failed('test error', 1 as RetryCount),
        ChunkStates.dirty(
          new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME).fill(123) as ChunkDataBytes,
          {
            id: 'test-change-id' as any,
            blocks: [],
            timestamp: now as any,
          },
          metadata
        ),
      ]
    }),

  /**
   * テスト用チャンク操作セット生成
   */
  createTestOperationSet: (): Effect.Effect<Array<ChunkOperation>, never> =>
    Effect.gen(function* () {
      const position = ChunkTestHelpers.createTestPosition(10, 20)
      const data = new Uint8Array(TEST_CONSTANTS.CHUNK_VOLUME).fill(255) as ChunkDataBytes
      const metadata = yield* ChunkTestHelpers.createTestMetadata()

      return [
        ChunkOperations.read(position),
        ChunkOperations.write(position, data, metadata),
        ChunkOperations.delete(position),
        ChunkOperations.validate(position, 'test-checksum'),
        ChunkOperations.optimize(position, { _tag: 'Memory' as const } as any),
        ChunkOperations.serialize(data, { _tag: 'Binary' as const } as any, metadata),
      ]
    }),

  /**
   * テスト用エラーセット生成
   */
  createTestErrorSet: (): Array<ChunkError> => [
    ChunkErrors.validation('test-field', 'invalid-value', 'test-constraint'),
    ChunkErrors.bounds({ x: 1000000, y: 0, z: 0 }, { min: -100000, max: 100000 }),
    ChunkErrors.serialization('test-format', new Error('test serialization error')),
    ChunkErrors.corruption('hash1', 'hash2'),
    ChunkErrors.timeout('test-operation', 5000),
    ChunkErrors.network('http://test.com/chunks', 404),
  ],
} as const

/**
 * Effect-TS テストヘルパー
 */
export const EffectTestHelpers = {
  /**
   * Effect実行時間測定
   */
  measureExecutionTime: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<{ result: A; duration: number }, E, R> =>
    Effect.gen(function* () {
      const start = yield* TestClock.currentTimeMillis
      const result = yield* effect
      const end = yield* TestClock.currentTimeMillis
      return { result, duration: end - start }
    }),

  /**
   * メモリ使用量測定
   */
  measureMemoryUsage: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<{ result: A; memoryDelta: number }, E, R> =>
    Effect.gen(function* () {
      const initialMemory = process.memoryUsage().heapUsed
      const result = yield* effect
      const finalMemory = process.memoryUsage().heapUsed
      return { result, memoryDelta: finalMemory - initialMemory }
    }),

  /**
   * 並行実行テストヘルパー
   */
  testConcurrency: <A, E, R>(
    effects: Array<Effect.Effect<A, E, R>>,
    maxConcurrency: number = 10
  ): Effect.Effect<Array<A>, E, R> => Effect.all(effects, { concurrency: maxConcurrency }),

  /**
   * タイムアウトテストヘルパー
   */
  testWithTimeout: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    timeoutMs: number = TEST_CONSTANTS.DEFAULT_TIMEOUT
  ): Effect.Effect<A, E | Error, R> => effect.pipe(Effect.timeout(Duration.millis(timeoutMs))),

  /**
   * リトライテストヘルパー
   */
  testWithRetry: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    maxRetries: number = TEST_CONSTANTS.MAX_RETRY_COUNT
  ): Effect.Effect<A, E, R> => effect.pipe(Effect.retry({ times: maxRetries })),
} as const

/**
 * アサーションヘルパー
 */
export const AssertionHelpers = {
  /**
   * チャンク状態アサーション
   */
  assertChunkState: (state: ChunkState, expectedTag: ChunkState['_tag']): void => {
    if (state._tag !== expectedTag) {
      throw new Error(`Expected chunk state ${expectedTag}, got ${state._tag}`)
    }
  },

  /**
   * チャンク操作アサーション
   */
  assertChunkOperation: (operation: ChunkOperation, expectedTag: ChunkOperation['_tag']): void => {
    if (operation._tag !== expectedTag) {
      throw new Error(`Expected chunk operation ${expectedTag}, got ${operation._tag}`)
    }
  },

  /**
   * チャンクエラーアサーション
   */
  assertChunkError: (error: ChunkError, expectedTag: ChunkError['_tag']): void => {
    if (error._tag !== expectedTag) {
      throw new Error(`Expected chunk error ${expectedTag}, got ${error._tag}`)
    }
  },

  /**
   * パフォーマンスアサーション
   */
  assertPerformance: (duration: number, maxDuration: number, operation: string = 'operation'): void => {
    if (duration > maxDuration) {
      throw new Error(`${operation} took ${duration}ms, expected less than ${maxDuration}ms`)
    }
  },

  /**
   * メモリ使用量アサーション
   */
  assertMemoryUsage: (memoryDelta: number, maxMemoryIncrease: number, operation: string = 'operation'): void => {
    if (memoryDelta > maxMemoryIncrease) {
      throw new Error(
        `${operation} increased memory by ${memoryDelta} bytes, expected less than ${maxMemoryIncrease} bytes`
      )
    }
  },
} as const

// ===== Unified Test Layer ===== //

/**
 * 統一テストレイヤー - 全テストで使用する標準構成
 */
export const ChunkTestLayer = Layer.mergeAll(
  MockChunkDataGenerator.Default,
  MockTimeProvider.Default,
  MockMetricsCollector.Default,
  TestContext.TestContext
)

/**
 * 最小テストレイヤー - 軽量テスト用
 */
export const ChunkMinimalTestLayer = Layer.mergeAll(TestContext.TestContext)

/**
 * パフォーマンステストレイヤー - パフォーマンステスト専用
 */
export const ChunkPerformanceTestLayer = Layer.mergeAll(
  MockChunkDataGenerator.Default,
  MockTimeProvider.Default,
  MockMetricsCollector.Default,
  TestContext.TestContext
)

// ===== Export All ===== //

export * from './test-layer-exports'
