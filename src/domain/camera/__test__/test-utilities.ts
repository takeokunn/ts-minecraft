/**
 * Camera Domain - テストヘルパー・ユーティリティ
 *
 * 世界最高峰のテストシステムを支える
 * - 統一されたテストヘルパー関数
 * - Effect-TS特化アサーション
 * - Property-based Testing支援
 * - Performance測定ユーティリティ
 */

import { Brand, Data, Effect, Either, Exit, Match, Option, pipe, Ref, Schema } from 'effect'
import { expect } from '@effect/vitest'
import * as fc from 'fast-check'

// ================================================================================
// Effect-TS Testing Utilities
// ================================================================================

/**
 * Effect成功アサーション
 */
export const expectEffectSuccess = <A, E>(
  effect: Effect.Effect<A, E>,
  assertion?: (value: A) => void
): Effect.Effect<A, E> =>
  pipe(
    effect,
    Effect.tap((value) =>
      Effect.sync(() => {
        expect(value).toBeDefined()
        if (assertion) assertion(value)
      })
    )
  )

/**
 * Effect失敗アサーション
 */
export const expectEffectFailure = <A, E>(
  effect: Effect.Effect<A, E>,
  assertion?: (error: E) => void
): Effect.Effect<E, never> =>
  pipe(
    effect,
    Effect.flip,
    Effect.tap((error) =>
      Effect.sync(() => {
        expect(error).toBeDefined()
        if (assertion) assertion(error)
      })
    )
  )

/**
 * Effect Exit アサーション
 */
export const expectExitSuccess = <A, E>(
  exit: Exit.Exit<A, E>,
  assertion?: (value: A) => void
): Effect.Effect<A, never> =>
  pipe(
    exit,
    Exit.match({
      onSuccess: (value) =>
        Effect.sync(() => {
          expect(Exit.isSuccess(exit)).toBe(true)
          if (assertion) assertion(value)
          return value
        }),
      onFailure: (cause) =>
        Effect.sync(() => {
          expect.fail(`Expected success but got failure: ${cause}`)
        }),
    })
  )

/**
 * Effect Exit 失敗アサーション
 */
export const expectExitFailure = <A, E>(
  exit: Exit.Exit<A, E>,
  assertion?: (cause: Exit.Cause<E>) => void
): Effect.Effect<Exit.Cause<E>, never> =>
  pipe(
    exit,
    Exit.match({
      onSuccess: (value) =>
        Effect.sync(() => {
          expect.fail(`Expected failure but got success: ${value}`)
        }),
      onFailure: (cause) =>
        Effect.sync(() => {
          expect(Exit.isFailure(exit)).toBe(true)
          if (assertion) assertion(cause)
          return cause
        }),
    })
  )

// ================================================================================
// Schema Testing Utilities
// ================================================================================

/**
 * Schema デコード成功アサーション
 */
export const expectSchemaSuccess = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: I,
  assertion?: (value: A) => void
): Effect.Effect<A, Schema.ParseError, R> =>
  pipe(
    Schema.decodeUnknown(schema)(input),
    Effect.tap((value) =>
      Effect.sync(() => {
        if (assertion) assertion(value)
      })
    )
  )

/**
 * Schema デコード失敗アサーション
 */
export const expectSchemaFailure = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: I,
  assertion?: (error: Schema.ParseError) => void
): Effect.Effect<Schema.ParseError, never, R> =>
  pipe(
    Schema.decodeUnknown(schema)(input),
    Effect.flip,
    Effect.tap((error) =>
      Effect.sync(() => {
        expect(error).toBeDefined()
        if (assertion) assertion(error)
      })
    )
  )

/**
 * Brand型検証ヘルパー
 */
export const expectBrandValue = <T extends Brand.Brand<any>>(
  value: T,
  expectedValue: number | string,
  tolerance = 1e-10
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (typeof expectedValue === 'number' && typeof value === 'number') {
      expect(Math.abs(value - expectedValue)).toBeLessThan(tolerance)
    } else {
      expect(value).toBe(expectedValue)
    }
  })

// ================================================================================
// ADT Testing Utilities
// ================================================================================

/**
 * ADT タグ アサーション
 */
export const expectADTTag = <T extends { _tag: string }>(
  adt: T,
  expectedTag: T['_tag']
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    expect(adt._tag).toBe(expectedTag)
  })

/**
 * ADT Match exhaustive テスト
 */
export const testMatchExhaustive = <T extends { _tag: string }, R>(
  adt: T,
  matcher: (value: T) => R
): Effect.Effect<R, never> =>
  Effect.sync(() => {
    const result = matcher(adt)
    expect(result).toBeDefined()
    return result
  })

/**
 * 全ADTパターンテスト
 */
export const testAllADTPatterns = <T extends { _tag: string }>(
  variants: readonly T[],
  handler: (variant: T) => Effect.Effect<void, never>
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (const variant of variants) {
      yield* handler(variant)
    }
  })

// ================================================================================
// Property-based Testing Utilities
// ================================================================================

/**
 * FastCheck Property ラッパー
 */
export const fcProperty = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<boolean, any>
): fc.AsyncProperty<[T]> =>
  fc.asyncProperty(arbitrary, async (value: T) => {
    const result = await Effect.runPromise(predicate(value))
    return result
  })

/**
 * FastCheck Assert ラッパー
 */
export const fcAssert = <T>(
  property: fc.AsyncProperty<[T]>,
  parameters?: fc.Parameters<[T]>
): Effect.Effect<void, never> =>
  Effect.promise(async () => {
    await fc.assert(property, parameters)
  })

/**
 * 複数Arbitrary組み合わせ
 */
export const combineArbitraries = <T extends readonly unknown[]>(
  ...arbitraries: { [K in keyof T]: fc.Arbitrary<T[K]> }
): fc.Arbitrary<T> => fc.tuple(...arbitraries)

/**
 * 条件付きArbitrary
 */
export const conditionalArbitrary = <T>(
  arbitrary: fc.Arbitrary<T>,
  condition: (value: T) => boolean,
  maxAttempts = 1000
): fc.Arbitrary<T> => arbitrary.filter(condition)

/**
 * Property-based バリデーションテスト
 */
export const propertyValidationTest = <T, U, E>(
  arbitrary: fc.Arbitrary<T>,
  validator: (input: T) => Effect.Effect<U, E>,
  predicate: (input: T, output: U) => boolean,
  numRuns = 100
): Effect.Effect<void, never> =>
  fcAssert(
    fcProperty(arbitrary, (input: T) =>
      pipe(
        validator(input),
        Effect.map((output) => predicate(input, output)),
        Effect.catchAll(() => Effect.succeed(false))
      )
    ),
    { numRuns }
  )

// ================================================================================
// Performance Testing Utilities
// ================================================================================

/**
 * 実行時間測定
 */
export const measureTime = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<[A, number], E, R> =>
  Effect.gen(function* () {
    const start = yield* Effect.sync(() => performance.now())
    const result = yield* effect
    const end = yield* Effect.sync(() => performance.now())
    return [result, end - start]
  })

/**
 * パフォーマンス期待値アサーション
 */
export const expectPerformance = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  maxTimeMs: number
): Effect.Effect<A, E, R> =>
  pipe(
    measureTime(effect),
    Effect.tap(([result, duration]) =>
      Effect.sync(() => {
        expect(duration).toBeLessThan(maxTimeMs)
      })
    ),
    Effect.map(([result]) => result)
  )

/**
 * 並行性能テスト
 */
export const concurrentPerformanceTest = <A, E, R>(
  effects: readonly Effect.Effect<A, E, R>[],
  expectedMaxTime: number,
  concurrency: number | 'unbounded' = 'unbounded'
): Effect.Effect<readonly A[], E, R> =>
  pipe(
    measureTime(Effect.all(effects, { concurrency })),
    Effect.tap(([results, duration]) =>
      Effect.sync(() => {
        expect(duration).toBeLessThan(expectedMaxTime)
        expect(results).toHaveLength(effects.length)
      })
    ),
    Effect.map(([results]) => results)
  )

/**
 * メモリ使用量測定
 */
export const measureMemory = (): Effect.Effect<NodeJS.MemoryUsage, never> =>
  Effect.sync(() => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage()
    }
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    }
  })

/**
 * メモリリークテスト
 */
export const memoryLeakTest = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  iterations: number,
  maxIncreaseBytes: number
): Effect.Effect<void, E, R> =>
  Effect.gen(function* () {
    const initialMemory = yield* measureMemory()

    for (let i = 0; i < iterations; i++) {
      yield* effect
    }

    // ガベージコレクション強制実行
    yield* Effect.sync(() => {
      if (typeof global !== 'undefined' && (global as any).gc) {
        ;(global as any).gc()
      }
    })

    yield* Effect.sleep('100 millis') // GC完了待ち

    const finalMemory = yield* measureMemory()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

    yield* Effect.sync(() => {
      expect(memoryIncrease).toBeLessThan(maxIncreaseBytes)
    })
  })

// ================================================================================
// Mock & Fixture Utilities
// ================================================================================

/**
 * テスト用Refカウンター
 */
export const createTestCounter = (): Effect.Effect<{
  increment: Effect.Effect<void, never>
  decrement: Effect.Effect<void, never>
  get: Effect.Effect<number, never>
  reset: Effect.Effect<void, never>
}, never> =>
  Effect.gen(function* () {
    const counter = yield* Ref.make(0)

    return {
      increment: Ref.update(counter, (n) => n + 1),
      decrement: Ref.update(counter, (n) => n - 1),
      get: Ref.get(counter),
      reset: Ref.set(counter, 0),
    }
  })

/**
 * テスト用状態管理
 */
export const createTestState = <T>(initialValue: T): Effect.Effect<{
  set: (value: T) => Effect.Effect<void, never>
  get: Effect.Effect<T, never>
  update: (f: (current: T) => T) => Effect.Effect<void, never>
  reset: Effect.Effect<void, never>
}, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.make(initialValue)

    return {
      set: (value: T) => Ref.set(state, value),
      get: Ref.get(state),
      update: (f: (current: T) => T) => Ref.update(state, f),
      reset: Ref.set(state, initialValue),
    }
  })

/**
 * モック関数実行カウンター
 */
export const createMockWithCounter = <T extends readonly unknown[], R>(
  implementation: (...args: T) => R
): Effect.Effect<{
  mock: (...args: T) => Effect.Effect<R, never>
  getCallCount: Effect.Effect<number, never>
  getLastCall: Effect.Effect<T | null, never>
  reset: Effect.Effect<void, never>
}, never> =>
  Effect.gen(function* () {
    const callCount = yield* Ref.make(0)
    const lastCall = yield* Ref.make<T | null>(null)

    const mock = (...args: T) =>
      Effect.gen(function* () {
        yield* Ref.update(callCount, (n) => n + 1)
        yield* Ref.set(lastCall, args)
        return implementation(...args)
      })

    return {
      mock,
      getCallCount: Ref.get(callCount),
      getLastCall: Ref.get(lastCall),
      reset: Effect.gen(function* () {
        yield* Ref.set(callCount, 0)
        yield* Ref.set(lastCall, null)
      }),
    }
  })

// ================================================================================
// Debugging & Logging Utilities
// ================================================================================

/**
 * テスト用ログ出力
 */
export const testLog = (message: string, data?: unknown): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (process.env.TEST_DEBUG === 'true') {
      console.log(`[TEST] ${message}`, data ? JSON.stringify(data, null, 2) : '')
    }
  })

/**
 * Effect値のデバッグ出力
 */
export const debugEffect = <A, E, R>(label: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.tap((value) => testLog(`${label} - Success`, value)),
    Effect.tapError((error) => testLog(`${label} - Error`, error))
  )

/**
 * スタックトレース付きアサーション失敗
 */
export const assertionFailure = (message: string, details?: unknown): Effect.Effect<never, never> =>
  Effect.sync(() => {
    const error = new Error(message)
    if (details) {
      console.error('Assertion failure details:', details)
    }
    console.error('Stack trace:', error.stack)
    expect.fail(message)
  })

// ================================================================================
// Test Data Generators
// ================================================================================

/**
 * ランダムID生成
 */
export const generateTestId = (prefix = 'test'): Effect.Effect<string, never> =>
  Effect.sync(() => `${prefix}-${Math.random().toString(36).substr(2, 9)}`)

/**
 * テストデータファクトリー
 */
export const createTestDataFactory = <T>(factory: () => T) => ({
  create: (): Effect.Effect<T, never> => Effect.sync(factory),
  createMany: (count: number): Effect.Effect<readonly T[], never> =>
    Effect.all(Array.from({ length: count }, () => Effect.sync(factory))),
})

/**
 * 遅延実行ヘルパー
 */
export const delay = (ms: number): Effect.Effect<void, never> => Effect.sleep(`${ms} millis`)

/**
 * 条件待ち
 */
export const waitUntil = <E, R>(
  condition: Effect.Effect<boolean, E, R>,
  maxWaitMs = 5000,
  checkIntervalMs = 100
): Effect.Effect<void, E | 'timeout', R> =>
  Effect.gen(function* () {
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
      const result = yield* condition
      if (result) return

      yield* delay(checkIntervalMs)
    }

    return yield* Effect.fail('timeout' as const)
  })

// ================================================================================
// Type-safe Test Configuration
// ================================================================================

/**
 * テスト設定
 */
export interface TestConfig {
  readonly timeout: number
  readonly retries: number
  readonly debugMode: boolean
  readonly fastCheckRuns: number
  readonly performanceThresholdMs: number
  readonly memoryThresholdBytes: number
}

export const defaultTestConfig: TestConfig = {
  timeout: 30000,
  retries: 0,
  debugMode: false,
  fastCheckRuns: 100,
  performanceThresholdMs: 1000,
  memoryThresholdBytes: 50 * 1024 * 1024, // 50MB
}

/**
 * テスト設定の適用
 */
export const withTestConfig = <A, E, R>(
  config: Partial<TestConfig>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  const fullConfig = { ...defaultTestConfig, ...config }

  return pipe(
    effect,
    config.debugMode ? Effect.tap((value) => testLog('Test result', value)) : Effect.identity,
    Effect.timeout(`${fullConfig.timeout} millis`)
  )
}

// ================================================================================
// Comprehensive Test Suite Builder
// ================================================================================

/**
 * 包括的テストスイート構築
 */
export const buildTestSuite = <T>(config: {
  name: string
  arbitraries: Record<string, fc.Arbitrary<any>>
  validators: Record<string, (input: any) => Effect.Effect<any, any>>
  assertions: Record<string, (input: any, output: any) => boolean>
  performance?: Record<string, (input: any) => Effect.Effect<any, any>>
  integration?: Record<string, Effect.Effect<any, any>>
}) => ({
  propertyTests: Object.entries(config.arbitraries).map(([name, arbitrary]) => ({
    name: `${config.name} - ${name} property test`,
    test: () =>
      fcAssert(
        fcProperty(arbitrary, (value) =>
          pipe(
            config.validators[name]?.(value) ?? Effect.succeed(value),
            Effect.map((output) => config.assertions[name]?.(value, output) ?? true),
            Effect.catchAll(() => Effect.succeed(false))
          )
        )
      ),
  })),

  performanceTests: config.performance
    ? Object.entries(config.performance).map(([name, effect]) => ({
        name: `${config.name} - ${name} performance test`,
        test: () => expectPerformance(effect(null), defaultTestConfig.performanceThresholdMs),
      }))
    : [],

  integrationTests: config.integration
    ? Object.entries(config.integration).map(([name, effect]) => ({
        name: `${config.name} - ${name} integration test`,
        test: () => effect,
      }))
    : [],
})

export default {
  expectEffectSuccess,
  expectEffectFailure,
  expectExitSuccess,
  expectExitFailure,
  expectSchemaSuccess,
  expectSchemaFailure,
  expectBrandValue,
  expectADTTag,
  testMatchExhaustive,
  testAllADTPatterns,
  fcProperty,
  fcAssert,
  combineArbitraries,
  conditionalArbitrary,
  propertyValidationTest,
  measureTime,
  expectPerformance,
  concurrentPerformanceTest,
  measureMemory,
  memoryLeakTest,
  createTestCounter,
  createTestState,
  createMockWithCounter,
  testLog,
  debugEffect,
  assertionFailure,
  generateTestId,
  createTestDataFactory,
  delay,
  waitUntil,
  defaultTestConfig,
  withTestConfig,
  buildTestSuite,
}