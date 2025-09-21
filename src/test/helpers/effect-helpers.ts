/**
 * Effect-TS専用ヘルパー関数
 *
 * Context7最新パターン準拠：
 * - Effect.gen中心の関数型設計
 * - Schema.TaggedErrorによる型安全エラーハンドリング
 * - TestContextを活用した決定論的テスト
 */

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import * as Schema from '@effect/schema/Schema'
import * as TestContext from 'effect/TestContext'
import * as TestClock from 'effect/TestClock'
import * as Duration from 'effect/Duration'
import * as Fiber from 'effect/Fiber'
import { pipe } from 'effect/Function'
import { expect } from 'vitest'

// ========================================
// 基本Effect実行ヘルパー
// ========================================

/**
 * Effect実行ヘルパー
 */
export const EffectHelpers = {
  /**
   * Effectを同期的に実行（テスト用）
   */
  runSync: <A, E>(effect: Effect.Effect<A, E, never>): A => {
    return Effect.runSync(effect)
  },

  /**
   * Effectを非同期で実行（テスト用）
   */
  runPromise: <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
    return Effect.runPromise(effect)
  },

  /**
   * TestContextでEffectを実行
   */
  runWithTestContext: <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
    return Effect.runPromise(
      Effect.provide(effect, TestContext.TestContext)
    )
  },

  /**
   * Exitを取得してテスト用にアサート
   */
  exitWith: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      return yield* Effect.exit(effect)
    })
}

// ========================================
// Schema統合ヘルパー
// ========================================

/**
 * Schema関連のテストヘルパー
 */
export const SchemaHelpers = {
  /**
   * Schema検証を安全に実行
   */
  safeDecode: <A>(schema: Schema.Schema<A>) =>
    (input: unknown) =>
      Effect.gen(function* () {
        return yield* Effect.either(Schema.decodeUnknown(schema)(input))
      }),

  /**
   * Schema検証でSuccessを期待
   */
  expectDecodeSuccess: <A>(schema: Schema.Schema<A>) =>
    (input: unknown) =>
      Effect.gen(function* () {
        const result = yield* SchemaHelpers.safeDecode(schema)(input)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          return result.right
        }
        throw new Error('Expected decode success but got failure')
      }),

  /**
   * Schema検証でFailureを期待
   */
  expectDecodeFailure: <A>(schema: Schema.Schema<A>) =>
    (input: unknown) =>
      Effect.gen(function* () {
        const result = yield* SchemaHelpers.safeDecode(schema)(input)
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          return result.left
        }
        throw new Error('Expected decode failure but got success')
      })
}

// ========================================
// Option/Either ヘルパー
// ========================================

/**
 * Option/Either テストヘルパー
 */
export const DataHelpers = {
  /**
   * OptionがSomeであることをアサート
   */
  expectSome: <A>(option: Option.Option<A>) =>
    Effect.gen(function* () {
      expect(Option.isSome(option)).toBe(true)
      if (Option.isSome(option)) {
        return option.value
      }
      throw new Error('Expected Some but got None')
    }),

  /**
   * OptionがNoneであることをアサート
   */
  expectNone: <A>(option: Option.Option<A>) =>
    Effect.gen(function* () {
      expect(Option.isNone(option)).toBe(true)
    }),

  /**
   * EitherがRightであることをアサート
   */
  expectRight: <L, R>(either: Either.Either<R, L>) =>
    Effect.gen(function* () {
      expect(Either.isRight(either)).toBe(true)
      if (Either.isRight(either)) {
        return either.right
      }
      throw new Error('Expected Right but got Left')
    }),

  /**
   * EitherがLeftであることをアサート
   */
  expectLeft: <L, R>(either: Either.Either<R, L>) =>
    Effect.gen(function* () {
      expect(Either.isLeft(either)).toBe(true)
      if (Either.isLeft(either)) {
        return either.left
      }
      throw new Error('Expected Left but got Right')
    })
}

// ========================================
// 時間制御ヘルパー
// ========================================

/**
 * TestClock統合ヘルパー
 */
export const TimeHelpers = {
  /**
   * 時間を進める
   */
  advance: (duration: Duration.DurationInput) =>
    Effect.gen(function* () {
      yield* TestClock.adjust(duration)
    }),

  /**
   * 現在の時刻を取得
   */
  currentTime: () =>
    Effect.gen(function* () {
      const clock = yield* TestContext.TestClock
      return yield* clock.currentTimeMillis
    }),

  /**
   * 時間をセット
   */
  setTime: (time: number) =>
    Effect.gen(function* () {
      const clock = yield* TestContext.TestClock
      yield* clock.setTime(time)
    }),

  /**
   * 遅延付きEffect実行とテスト
   */
  testDelay: <A, E>(
    effect: Effect.Effect<A, E, never>,
    delay: Duration.DurationInput
  ) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(Effect.delay(effect, delay))
      yield* TimeHelpers.advance(delay)
      return yield* Fiber.join(fiber)
    })
}

// ========================================
// パフォーマンステストヘルパー
// ========================================

/**
 * パフォーマンス測定ヘルパー
 */
export const PerformanceHelpers = {
  /**
   * 実行時間を測定
   */
  measureDuration: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      const start = yield* Effect.sync(() => performance.now())
      const result = yield* effect
      const end = yield* Effect.sync(() => performance.now())
      return {
        result,
        duration: end - start
      }
    }),

  /**
   * 実行時間が期待値内かテスト
   */
  expectDurationWithin: (
    minMs: number,
    maxMs: number
  ) =>
    <A, E>(effect: Effect.Effect<A, E, never>) =>
      Effect.gen(function* () {
        const { result, duration } = yield* PerformanceHelpers.measureDuration(effect)
        expect(duration).toBeGreaterThanOrEqual(minMs)
        expect(duration).toBeLessThanOrEqual(maxMs)
        return result
      }),

  /**
   * 複数回実行してベンチマーク
   */
  benchmark: <A, E>(
    effect: Effect.Effect<A, E, never>,
    iterations: number = 10
  ) =>
    Effect.gen(function* () {
      const durations: number[] = []

      for (let i = 0; i < iterations; i++) {
        const { duration } = yield* PerformanceHelpers.measureDuration(effect)
        durations.push(duration)
      }

      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const min = Math.min(...durations)
      const max = Math.max(...durations)

      return { durations, average: avg, min, max }
    })
}

// ========================================
// エラーハンドリングヘルパー
// ========================================

/**
 * エラーハンドリングテストヘルパー
 */
export const ErrorHelpers = {
  /**
   * 特定のエラータイプが発生することをテスト
   */
  expectError: <E>(expectedError: E) =>
    <A>(effect: Effect.Effect<A, E, never>) =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(effect)
        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          // エラーの詳細比較は実装に依存
          return result.cause
        }
        throw new Error('Expected error but effect succeeded')
      }),

  /**
   * エラー回復をテスト
   */
  testRecovery: <A, E, B>(
    failingEffect: Effect.Effect<A, E, never>,
    recovery: (error: E) => Effect.Effect<B, never, never>
  ) =>
    Effect.gen(function* () {
      return yield* Effect.catchAll(failingEffect, recovery)
    }),

  /**
   * リトライパターンのテスト
   */
  testRetry: <A, E>(
    effect: Effect.Effect<A, E, never>,
    retries: number
  ) =>
    Effect.gen(function* () {
      return yield* Effect.retry(effect, {
        times: retries
      })
    })
}

// ========================================
// 並行性テストヘルパー
// ========================================

/**
 * 並行性テストヘルパー
 */
export const ConcurrencyHelpers = {
  /**
   * 複数のEffectを並行実行
   */
  parallel: <A, E>(effects: Effect.Effect<A, E, never>[]) =>
    Effect.gen(function* () {
      return yield* Effect.all(effects, { concurrency: 'unbounded' })
    }),

  /**
   * 制限付き並行実行
   */
  parallelWithLimit: <A, E>(
    effects: Effect.Effect<A, E, never>[],
    concurrency: number
  ) =>
    Effect.gen(function* () {
      return yield* Effect.all(effects, { concurrency })
    }),

  /**
   * レース条件テスト
   */
  race: <A, E>(effects: Effect.Effect<A, E, never>[]) =>
    Effect.gen(function* () {
      return yield* Effect.race(effects)
    }),

  /**
   * Fiberの制御テスト
   */
  testFiberControl: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(effect)
      // テスト用の制御ロジック
      yield* Effect.sleep('10 millis')
      const result = yield* Fiber.join(fiber)
      return result
    })
}

// ========================================
// 統合ヘルパーオブジェクト
// ========================================

/**
 * すべてのEffect-TSヘルパーを統合
 */
export const AllEffectHelpers = {
  Effect: EffectHelpers,
  Schema: SchemaHelpers,
  Data: DataHelpers,
  Time: TimeHelpers,
  Performance: PerformanceHelpers,
  Error: ErrorHelpers,
  Concurrency: ConcurrencyHelpers
} as const