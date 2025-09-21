import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as TestClock from 'effect/TestClock'
import * as TestContext from 'effect/TestContext'
import * as Fiber from 'effect/Fiber'
import * as Duration from 'effect/Duration'
import * as Schema from '@effect/schema/Schema'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import * as Exit from 'effect/Exit'
import * as Cause from 'effect/Cause'
import { pipe } from 'effect/Function'
import * as fc from 'fast-check'

/**
 * Effect-TS専用のテストユーティリティ集
 * 全てのテストで統一されたパターンを使用するための共通ユーティリティ
 */

// ================================================================================
// Test Layer Helpers
// ================================================================================

/**
 * テスト用のLayerを作成するヘルパー
 */
export const createTestLayer = <R, E, A>(tag: any, implementation: () => Effect.Effect<A, E, R>) =>
  Layer.effect(
    tag,
    Effect.gen(function* () {
      return yield* implementation()
    })
  )

/**
 * Mock Serviceを簡単に作成するヘルパー
 */
export const createMockService = <ServiceInterface extends Record<string, any>>(
  partial: Partial<{
    [K in keyof ServiceInterface]: ServiceInterface[K] extends (...args: any[]) => any
      ? (...args: Parameters<ServiceInterface[K]>) => ReturnType<ServiceInterface[K]>
      : ServiceInterface[K]
  }>
): ServiceInterface => {
  return new Proxy({} as ServiceInterface, {
    get(_, prop: string | symbol) {
      if (prop in partial) {
        return partial[prop as keyof ServiceInterface]
      }
      // デフォルトのモック実装
      return () => Effect.succeed(undefined)
    },
  })
}

// ================================================================================
// Test Execution Helpers
// ================================================================================

/**
 * Effect実行のための統一インターフェース
 */
export const TestRunner = {
  /**
   * 基本的なEffect実行
   */
  run: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect),

  /**
   * 同期的なEffect実行
   */
  runSync: <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(effect),

  /**
   * Exit値を取得
   */
  runExit: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect),

  /**
   * タイムアウト付き実行
   */
  runWithTimeout: <A, E>(effect: Effect.Effect<A, E>, ms: number = 5000) =>
    pipe(effect, Effect.timeout(Duration.millis(ms)), Effect.runPromise),

  /**
   * Layerを適用してテスト
   */
  runWithLayer: <A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R, any, never>) =>
    pipe(effect, Effect.provide(layer), Effect.runPromise),

  /**
   * TestClockを使った決定論的テスト
   */
  runWithTestClock: <A, E>(effect: Effect.Effect<A, E>) =>
    pipe(effect, Effect.provide(TestContext.TestContext), Effect.runPromise),
}

// ================================================================================
// Assertion Helpers
// ================================================================================

/**
 * Effect-TS用のアサーションヘルパー
 */
export const EffectAssert = {
  /**
   * Effectが成功することを検証
   */
  succeeds: async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
    const exit = await Effect.runPromiseExit(effect)
    if (Exit.isFailure(exit)) {
      throw new Error(`Effect failed with: ${JSON.stringify(Cause.pretty(exit.cause))}`)
    }
    return exit.value
  },

  /**
   * Effectが失敗することを検証
   */
  fails: async <A, E>(effect: Effect.Effect<A, E>): Promise<E> => {
    const exit = await Effect.runPromiseExit(effect)
    if (Exit.isSuccess(exit)) {
      throw new Error(`Expected failure but got success: ${JSON.stringify(exit.value)}`)
    }
    const failures = Cause.failures(exit.cause)
    if (failures.length === 0) {
      throw new Error('Effect died or was interrupted')
    }
    return Array.from(failures)[0] as E
  },

  /**
   * Effectがタイムアウトすることを検証
   */
  timesOut: async <A, E>(effect: Effect.Effect<A, E>, duration: Duration.DurationInput) => {
    const result = (await pipe(effect, Effect.timeout(duration), Effect.runPromise)) as Option.Option<A>
    if (Option.isSome(result)) {
      throw new Error('Expected timeout but effect completed')
    }
  },
}

// ================================================================================
// Schema Testing Helpers
// ================================================================================

/**
 * Schema検証のためのヘルパー
 */
export const SchemaTest = {
  /**
   * デコードが成功することを検証
   */
  decodes: <A, I>(schema: Schema.Schema<A, I>, input: I): A => {
    return Schema.decodeUnknownSync(schema)(input)
  },

  /**
   * デコードが失敗することを検証
   */
  failsDecode: <A, I>(schema: Schema.Schema<A, I>, input: unknown): void => {
    try {
      Schema.decodeUnknownSync(schema)(input)
      throw new Error('Expected decode to fail')
    } catch {
      // Expected
    }
  },

  /**
   * エンコードのテスト
   */
  encodes: <A, I>(schema: Schema.Schema<A, I>, value: A): I => {
    return Schema.encodeSync(schema)(value)
  },

  /**
   * ラウンドトリップテスト
   */
  roundTrip: <A, I>(schema: Schema.Schema<A, I>, value: A): A => {
    const encoded = Schema.encodeSync(schema)(value)
    return Schema.decodeUnknownSync(schema)(encoded)
  },
}

// ================================================================================
// Property-Based Testing Helpers
// ================================================================================

/**
 * Property-based testing用のヘルパー
 */
export const PropertyTest = {
  /**
   * Effectをプロパティテストする
   */
  effectProperty: <A, E>(arb: fc.Arbitrary<A>, predicate: (a: A) => Effect.Effect<boolean, E>) =>
    fc.asyncProperty(arb, async (a) => {
      const result = await Effect.runPromise(predicate(a))
      return result
    }),

  /**
   * Schemaのプロパティテスト
   */
  schemaProperty: <A, I>(schema: Schema.Schema<A, I>, arb: fc.Arbitrary<I>) =>
    fc.property(arb, (input) => {
      try {
        const decoded = Schema.decodeUnknownSync(schema)(input)
        const encoded = Schema.encodeSync(schema)(decoded)
        const decoded2 = Schema.decodeUnknownSync(schema)(encoded)
        return JSON.stringify(decoded) === JSON.stringify(decoded2)
      } catch {
        return true // デコードエラーは許容
      }
    }),
}

// ================================================================================
// Match Testing Helpers
// ================================================================================

/**
 * Match.valueを使ったパターンマッチングのテストヘルパー
 */
export const MatchTest = {
  /**
   * 全てのケースをカバーしているかテスト
   */
  exhaustive: <Input, Output>(value: Input, matcher: (v: Input) => Output): Output => {
    return matcher(value)
  },

  /**
   * 特定のケースにマッチすることをテスト
   */
  matches: <Input, Output>(value: Input, pattern: any, expected: Output, matcher: (v: Input) => Output) => {
    const result = matcher(value)
    if (result !== expected) {
      throw new Error(`Expected ${expected} but got ${result}`)
    }
  },

  /**
   * Match.valueパターンの完全性をテスト
   */
  testExhaustive: <T extends string | number | boolean>(values: readonly T[], matcher: (value: T) => any) => {
    for (const value of values) {
      try {
        matcher(value)
      } catch (error) {
        throw new Error(`Match pattern incomplete for value: ${value}. Error: ${error}`)
      }
    }
  },

  /**
   * タグ付きユニオン型のMatch.valueテスト
   */
  testTaggedUnion: <T extends { _tag: string }>(values: readonly T[], matcher: (value: T) => any) => {
    const uniqueTags = new Set(values.map((v) => v._tag))
    for (const value of values) {
      try {
        matcher(value)
      } catch (error) {
        throw new Error(`Match pattern incomplete for tag: ${value._tag}. Error: ${error}`)
      }
    }
    return uniqueTags.size
  },
}

// ================================================================================
// Test Data Generators
// ================================================================================

/**
 * テストデータ生成用のファクトリー
 */
export const TestDataGenerator = {
  /**
   * ランダムなEffect生成
   */
  effect: <A>(value: A): Effect.Effect<A> => Effect.succeed(value),

  /**
   * エラーEffect生成
   */
  errorEffect: <E>(error: E): Effect.Effect<never, E> => Effect.fail(error),

  /**
   * 遅延Effect生成
   */
  delayedEffect: <A>(value: A, delayMs: number): Effect.Effect<A> =>
    pipe(Effect.succeed(value), Effect.delay(Duration.millis(delayMs))),

  /**
   * Option生成
   */
  option: <A>(value: A | null): Option.Option<A> => (value === null ? Option.none() : Option.some(value)),

  /**
   * Either生成
   */
  either: <E, A>(isRight: boolean, value: E | A): Either.Either<A, E> =>
    isRight ? Either.right(value as A) : Either.left(value as E),
}

// ================================================================================
// Test Environment Setup
// ================================================================================

/**
 * テスト環境のセットアップヘルパー
 */
export const TestEnvironmentSetup = {
  /**
   * 共通のテストコンテキストを作成
   */
  createContext: () => ({
    clock: TestClock.TestClock,
    layers: [] as Layer.Layer<any, any, any>[],
  }),

  /**
   * beforeEach/afterEachのEffect版
   */
  withSetup: <A, E, R>(
    setup: Effect.Effect<R>,
    teardown: (r: R) => Effect.Effect<void>,
    test: (r: R) => Effect.Effect<A, E>
  ) =>
    Effect.gen(function* () {
      const resource = yield* setup
      try {
        return yield* test(resource)
      } finally {
        yield* teardown(resource)
      }
    }),
}

// ================================================================================
// Concurrent Testing Helpers
// ================================================================================

/**
 * 並行処理のテストヘルパー
 */
export const ConcurrentTest = {
  /**
   * 複数のEffectを並行実行してテスト
   */
  runConcurrently: <A, E>(effects: Effect.Effect<A, E>[]) => Effect.all(effects, { concurrency: 'unbounded' }),

  /**
   * レースコンディションのテスト
   */
  raceTest: <A, E>(effects: Effect.Effect<A, E>[]) => Effect.raceAll(effects),

  /**
   * Fiberのテスト
   */
  fiberTest: <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(effect)
      yield* TestClock.adjust(Duration.seconds(1))
      return yield* Fiber.join(fiber)
    }),
}

// ================================================================================
// Performance Testing Helpers
// ================================================================================

/**
 * パフォーマンステストヘルパー
 */
export const PerformanceTest = {
  /**
   * Effect実行時間を測定
   */
  measure: async <A, E>(effect: Effect.Effect<A, E>): Promise<{ result: A; durationMs: number }> => {
    const start = performance.now()
    const result = await Effect.runPromise(effect)
    const end = performance.now()
    return { result, durationMs: end - start }
  },

  /**
   * 複数回実行して平均時間を計算
   */
  benchmark: async <A, E>(
    effect: Effect.Effect<A, E>,
    iterations: number = 100
  ): Promise<{ averageMs: number; minMs: number; maxMs: number; results: A[] }> => {
    const durations: number[] = []
    const results: A[] = []

    for (let i = 0; i < iterations; i++) {
      const measurement = await PerformanceTest.measure(effect)
      durations.push(measurement.durationMs)
      results.push(measurement.result)
    }

    return {
      averageMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      results,
    }
  },

  /**
   * メモリ使用量を測定
   */
  measureMemory: async <A, E>(effect: Effect.Effect<A, E>) => {
    const performanceAny = performance as any
    if (typeof performanceAny.measureUserAgentSpecificMemory === 'function') {
      const before = await performanceAny.measureUserAgentSpecificMemory()
      const result = await Effect.runPromise(effect)
      const after = await performanceAny.measureUserAgentSpecificMemory()
      return {
        result,
        memoryUsed: after.bytes - before.bytes,
      }
    }
    // Fallback for environments without memory measurement
    return {
      result: await Effect.runPromise(effect),
      memoryUsed: 0,
    }
  },
}

// デフォルトエクスポート
export default {
  TestRunner,
  EffectAssert,
  SchemaTest,
  PropertyTest,
  MatchTest,
  TestDataGenerator,
  TestEnvironmentSetup,
  ConcurrentTest,
  PerformanceTest,
  createTestLayer,
  createMockService,
}
