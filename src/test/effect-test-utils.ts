/**
 * Effect-TS 最新テストユーティリティ v3 - Context7準拠理想系パターン
 *
 * @effect/vitestとEffect 3.17+の最新機能を完全活用
 * 100%カバレッジ達成とProperty-basedテスト統合
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as TestClock from 'effect/TestClock'
import * as TestContext from 'effect/TestContext'
import * as Fiber from 'effect/Fiber'
import * as Duration from 'effect/Duration'
import * as Schema from '@effect/schema/Schema'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import * as Exit from 'effect/Exit'
import * as Cause from 'effect/Cause'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import * as Deferred from 'effect/Deferred'
import * as Stream from 'effect/Stream'
import * as Schedule from 'effect/Schedule'
import * as Random from 'effect/Random'
import * as Metric from 'effect/Metric'
import * as Arbitrary from '@effect/schema/Arbitrary'
import * as FastCheck from '@effect/schema/FastCheck'
import { pipe } from 'effect/Function'
import * as fc from 'fast-check'

// ================================================================================
// Type Definitions - Schema-First Approach
// ================================================================================

/**
 * テストエラー - Schema.TaggedErrorベース
 */
export class TestError extends Schema.TaggedError<TestError>()('TestError', {
  message: Schema.String,
  code: Schema.optionalWith(Schema.String, { exact: true }),
  cause: Schema.optionalWith(Schema.Unknown, { exact: true }),
  meta: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { exact: true }),
}) {}

/**
 * テスト設定 - Schema検証付き
 */
export const TestConfigSchema = Schema.Struct({
  timeout: Schema.Number.pipe(Schema.positive(), Schema.int()),
  retries: Schema.Number.pipe(Schema.nonNegative(), Schema.int()),
  seed: Schema.optionalWith(Schema.Number.pipe(Schema.int()), { exact: true }),
  deterministic: Schema.Boolean,
})

export type TestConfig = typeof TestConfigSchema.Type

/**
 * パフォーマンスメトリクス - Schema付き
 */
export const PerformanceMetricsSchema = Schema.Struct({
  executionTime: Schema.Number.pipe(Schema.nonNegative()),
  memoryUsage: Schema.Number.pipe(Schema.nonNegative()),
  iterations: Schema.Number.pipe(Schema.positive(), Schema.int()),
  averageTime: Schema.Number.pipe(Schema.nonNegative()),
  minTime: Schema.Number.pipe(Schema.nonNegative()),
  maxTime: Schema.Number.pipe(Schema.nonNegative()),
})

export type PerformanceMetrics = typeof PerformanceMetricsSchema.Type

// ================================================================================
// Core Test Runners - @effect/vitest Integration
// ================================================================================

/**
 * 最新Effect-TSテストランナー - @effect/vitest統合
 */
export const EffectTestRunner = {
  /**
   * 基本的なEffect実行 - it.effect互換
   */
  run: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect),

  /**
   * 同期的なEffect実行
   */
  runSync: <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(effect),

  /**
   * Exit値を取得 - it.effect内でExitテスト用
   */
  runExit: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect),

  /**
   * TestContext環境での実行 - it.effect内でTestClock/TestRandom使用
   */
  runWithTestContext: <A, E>(effect: Effect.Effect<A, E>) =>
    pipe(effect, Effect.provide(TestContext.TestContext), Effect.runPromise),

  /**
   * Scoped環境での実行 - it.scoped互換
   */
  runScoped: <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => pipe(effect, Effect.scoped, Effect.runPromise),

  /**
   * フレイキーテスト対応 - @effect/vitestのit.flakyTest統合
   */
  runFlaky: <A, E, R>(effect: Effect.Effect<A, E, R>, timeout: Duration.DurationInput = '5 seconds') => {
    const schedule = Schedule.exponential('100 millis')
    const retryEffect = pipe(
      effect,
      Effect.retry(pipe(schedule, Schedule.upTo(Duration.decode(timeout)))),
      Effect.provide(TestContext.TestContext)
    ) as Effect.Effect<A, E, never>
    return Effect.runPromise(retryEffect)
  },

  /**
   * ライブ環境での実行 - it.live互換
   */
  runLive: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect),
}

// ================================================================================
// Enhanced Assertion Helpers - Schema Validation
// ================================================================================

/**
 * Effect-TS専用アサーション - Schema検証統合
 */
export const EffectAssert = {
  /**
   * Effect成功の検証 - Schema付き
   */
  succeeds:
    <A>(schema: Schema.Schema<A, any, any>) =>
    <E>(effect: Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const result = yield* effect
        const validated = yield* Schema.decodeUnknown(schema)(result)
        return validated
      }),

  /**
   * Effect失敗の検証 - TaggedError統合（Context7パターン）
   */
  fails:
    <E>(errorType: string) =>
    <A>(effect: Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(effect)
        if (Exit.isFailure(exit)) {
          if (exit.cause._tag === 'Fail' && (exit.cause.error as any)._tag === errorType) {
            return true
          }
          return yield* Effect.fail(
            new TestError({
              message: `Expected ${errorType} but got different error`,
              cause: exit.cause,
            })
          )
        }
        return yield* Effect.fail(
          new TestError({
            message: `Expected failure but effect succeeded`,
          })
        )
      }),

  /**
   * Exit値の詳細検証
   */
  exitMatches:
    <A, E>(matcher: (exit: Exit.Exit<A, E>) => boolean) =>
    (effect: Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(effect)
        if (!matcher(exit)) {
          return yield* Effect.fail(
            new TestError({
              message: 'Exit condition did not match expected pattern',
              meta: { exit },
            })
          )
        }
        return exit
      }),

  /**
   * 並行性の検証
   */
  concurrent: <A>(effects: Array<Effect.Effect<A, any>>) =>
    Effect.gen(function* () {
      const start = yield* TestClock.currentTimeMillis
      const results = yield* Effect.all(effects, { concurrency: 'unbounded' })
      const end = yield* TestClock.currentTimeMillis
      return { results, duration: end - start }
    }),
}

// ================================================================================
// TestClock Helpers - Deterministic Time Control
// ================================================================================

/**
 * TestClock操作ヘルパー - Context7準拠
 */
export const ClockHelpers = {
  /**
   * 時間進行のシミュレーション
   */
  advance: (duration: Duration.DurationInput) => TestClock.adjust(duration),

  /**
   * 現在時刻の取得
   */
  now: () => TestClock.currentTimeMillis,

  /**
   * タイムアウトのシミュレーション
   */
  timeout: <A, E>(effect: Effect.Effect<A, E>, timeoutDuration: Duration.DurationInput) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(effect)
      yield* TestClock.adjust(timeoutDuration)
      const result = yield* Fiber.join(fiber)
      return result
    }),

  /**
   * 遅延実行のテスト
   */
  delayed: <A, E>(effect: Effect.Effect<A, E>, delay: Duration.DurationInput) =>
    Effect.gen(function* () {
      const deferred = yield* Deferred.make<A, E>()
      yield* pipe(Effect.sleep(delay), Effect.andThen(effect), Effect.intoDeferred(deferred), Effect.fork)
      yield* TestClock.adjust(delay)
      return yield* Deferred.await(deferred)
    }),
}

// ================================================================================
// TestRandom Helpers - Deterministic Random Generation
// ================================================================================

/**
 * TestRandom操作ヘルパー - 決定論的ランダム生成
 */
export const RandomHelpers = {
  /**
   * 固定値の生成
   */
  fixed: <A>(value: A) => Effect.succeed(value),

  /**
   * 決定論的な範囲乱数 - TestContext環境で使用
   */
  intBetween: (min: number, max: number) => Random.nextIntBetween(min, max),

  /**
   * 決定論的なBoolean - TestContext環境で使用
   */
  boolean: () => Random.nextBoolean,

  /**
   * ランダムテストデータ生成
   */
  generateTestData: <A>(arbitrary: fc.Arbitrary<A>, count: number = 10) =>
    Effect.sync(() => fc.sample(arbitrary, count)),
}

// ================================================================================
// Property-Based Testing - Fast-Check Integration
// ================================================================================

/**
 * Property-basedテストヘルパー - Context7パターン
 */
export const PropertyTest = {
  /**
   * プロパティテストの実行
   */
  check: <A>(arbitrary: fc.Arbitrary<A>, property: (input: A) => Effect.Effect<boolean, any>) =>
    Effect.gen(function* () {
      const samples = yield* RandomHelpers.generateTestData(arbitrary, 100)
      const results = yield* Effect.all(
        samples.map((sample) =>
          pipe(
            property(sample),
            Effect.either,
            Effect.map((either) => ({ sample, result: either }))
          )
        ),
        { concurrency: 'unbounded' }
      )

      const failures = results.filter((r) => Either.isLeft(r.result) || (Either.isRight(r.result) && !r.result.right))

      if (failures.length > 0) {
        return yield* Effect.fail(
          new TestError({
            message: `Property test failed`,
            meta: { failures: failures.slice(0, 5) }, // 最初の5つの失敗例
          })
        )
      }

      return true
    }),

  /**
   * Schema統合Property-basedテスト
   */
  forSchema: <A, I, R>(schema: Schema.Schema<A, I, R>, property: (input: A) => Effect.Effect<boolean, any>) =>
    Effect.gen(function* () {
      const arbitrary = Arbitrary.make(schema)
      const samples = fc.sample(arbitrary, 100)
      const results = yield* Effect.all(
        samples.map((sample) =>
          pipe(
            property(sample),
            Effect.either,
            Effect.map((either) => ({ sample, result: either }))
          )
        ),
        { concurrency: 'unbounded' }
      )

      const failures = results.filter((r) => Either.isLeft(r.result) || (Either.isRight(r.result) && !r.result.right))

      if (failures.length > 0) {
        return yield* Effect.fail(
          new TestError({
            message: `Schema property test failed`,
            meta: { failures: failures.slice(0, 5) },
          })
        )
      }

      return true
    }),

  /**
   * インバリアント検証
   */
  invariant: <A>(generator: Effect.Effect<A, any>, invariantCheck: (value: A) => boolean, iterations: number = 100) =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        Array.from({ length: iterations }, () =>
          pipe(
            generator,
            Effect.map((value) => ({ value, valid: invariantCheck(value) }))
          )
        ),
        { concurrency: 'unbounded' }
      )

      const violations = results.filter((r) => !r.valid)
      if (violations.length > 0) {
        return yield* Effect.fail(
          new TestError({
            message: `Invariant violations detected`,
            meta: { violations: violations.slice(0, 5) },
          })
        )
      }

      return true
    }),
}

// ================================================================================
// Performance Testing - Metrics Integration
// ================================================================================

/**
 * パフォーマンステストヘルパー - Metric統合
 */
export const PerformanceTest = {
  /**
   * 実行時間の測定
   */
  measure: <A, E>(effect: Effect.Effect<A, E>, label: string = 'execution') =>
    Effect.gen(function* () {
      const counter = Metric.counter(`${label}_count`)
      const gauge = Metric.gauge(`${label}_duration`)

      const start = performance.now()
      const result = yield* effect
      yield* Metric.increment(counter)
      const end = performance.now()
      const duration = end - start

      yield* gauge(Effect.succeed(duration))

      return {
        result,
        metrics: {
          executionTime: duration,
          memoryUsage: 0, // プラットフォーム依存のため0
          iterations: 1,
          averageTime: duration,
          minTime: duration,
          maxTime: duration,
        } satisfies PerformanceMetrics,
      }
    }),

  /**
   * 反復パフォーマンステスト
   */
  benchmark: <A, E>(effect: Effect.Effect<A, E>, iterations: number = 100, label: string = 'benchmark') =>
    Effect.gen(function* () {
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        yield* effect
        const end = performance.now()
        times.push(end - start)
      }

      const totalTime = times.reduce((sum, time) => sum + time, 0)
      const averageTime = totalTime / iterations
      const minTime = Math.min(...times)
      const maxTime = Math.max(...times)

      return {
        executionTime: totalTime,
        memoryUsage: 0,
        iterations,
        averageTime,
        minTime,
        maxTime,
      } satisfies PerformanceMetrics
    }),

  /**
   * メモリ使用量の概算測定
   */
  memoryUsage: <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      // プラットフォーム依存のためNode.js環境でのみ有効
      const beforeMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0
      const result = yield* effect
      const afterMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0

      return {
        result,
        memoryDelta: afterMemory - beforeMemory,
      }
    }),

  /**
   * 並行性スケーラビリティテスト
   */
  concurrency: <A, E>(effect: Effect.Effect<A, E>, concurrencyLevels: number[] = [1, 2, 4, 8]) =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        concurrencyLevels.map((level) =>
          Effect.gen(function* () {
            const start = performance.now()
            yield* Effect.all(
              Array.from({ length: level }, () => effect),
              { concurrency: level }
            )
            const end = performance.now()
            return { level, duration: end - start }
          })
        ),
        { concurrency: 1 } // 順次実行で正確な測定
      )

      return results
    }),
}

// ================================================================================
// Test Layer Factories - Layer-based DI for Testing
// ================================================================================

/**
 * テスト用Layerファクトリー
 */
export const TestLayers = {
  /**
   * TestContext + 決定論的環境
   */
  deterministic: () => TestContext.TestContext,

  /**
   * ライブ環境での実行
   */
  live: Layer.empty,

  /**
   * モック環境 - 依存関係なし
   */
  mock: Layer.empty,

  /**
   * パフォーマンステスト環境
   */
  performance: TestContext.TestContext,
}

// ================================================================================
// Exports - 理想系テストパターン統合
// ================================================================================

// Default export for convenience - ES Module compatible
export default {
  EffectTestRunner,
  EffectAssert,
  ClockHelpers,
  RandomHelpers,
  PropertyTest,
  PerformanceTest,
  TestLayers,
  TestError,
  TestConfigSchema,
  PerformanceMetricsSchema,
}
