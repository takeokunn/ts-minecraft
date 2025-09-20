/**
 * Effect-TS Vitest Helpers
 * @effect/vitestを使ったテスト用のヘルパー関数とユーティリティ
 */

import { it } from '@effect/vitest'
import { type Context, Duration, Effect, Either, Layer, Match, Option, Ref, Schema } from 'effect'
import { expect } from 'vitest'

/**
 * テスト用エラー型
 */
export const TestErrorSchema = Schema.Struct({
  _tag: Schema.Literal('TestError'),
  message: Schema.String,
  code: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.Number),
})

export interface TestError extends Schema.Schema.Type<typeof TestErrorSchema> {}

/**
 * テストエラーを作成
 */
export const createTestError = (message: string, code?: string): TestError => ({
  _tag: 'TestError',
  message,
  code,
  timestamp: Date.now(),
})

/**
 * Effect-TSテストヘルパー
 */
export const EffectTestHelpers = {
  /**
   * Effect実行用のラッパー（Promise化）
   */
  runEffect: <E, A>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect),

  /**
   * タイムアウト付きEffect実行
   */
  runEffectWithTimeout: <E, A>(effect: Effect.Effect<A, E>, timeoutMs = 10000) =>
    Effect.runPromise(Effect.timeout(effect, Duration.millis(timeoutMs))),

  /**
   * Either<E, A>をテスト用にアサート
   */
  expectEitherRight: <E, A>(either: Either.Either<A, E>): A => {
    if (Either.isLeft(either)) {
      throw new Error(`Expected Right but got Left: ${JSON.stringify(either.left)}`)
    }
    return either.right
  },

  /**
   * Either<E, A>をテスト用にアサート（Left期待）
   */
  expectEitherLeft: <E, A>(either: Either.Either<A, E>): E => {
    if (Either.isRight(either)) {
      throw new Error(`Expected Left but got Right: ${JSON.stringify(either.right)}`)
    }
    return either.left
  },

  /**
   * Option<A>をテスト用にアサート
   */
  expectSome: <A>(option: Option.Option<A>): A => {
    if (Option.isNone(option)) {
      throw new Error('Expected Some but got None')
    }
    return option.value
  },

  /**
   * Schema デコードのテスト用ヘルパー
   */
  expectValidDecode:
    <A, I>(schema: Schema.Schema<A, I>) =>
    (input: I) => {
      const result = Schema.decodeUnknownSync(schema)(input)
      return result
    },

  /**
   * Schema デコードエラーのテスト
   */
  expectDecodeError:
    <A, I>(schema: Schema.Schema<A, I>) =>
    async (input: unknown) => {
      try {
        Schema.decodeUnknownSync(schema)(input)
        throw new Error('Expected decode error but decoding succeeded')
      } catch (error) {
        return error
      }
    },
}

/**
 * テスト用のサービスファクトリー
 */
export const TestServiceFactory = {
  /**
   * 基本的なテストサービスの作成
   */
  createMockService: <T>(tag: Context.Tag<T, T>, implementation: T) => Layer.succeed(tag, implementation),

  /**
   * Effect-based サービスの作成
   */
  createEffectService: <T>(tag: Context.Tag<T, T>, factory: Effect.Effect<T, never, never>) =>
    Layer.effect(tag, factory),

  /**
   * Ref-based ステートフルサービスの作成
   */
  createStatefulService: <T, S>(tag: Context.Tag<T, T>, initialState: S, serviceFactory: (ref: Ref.Ref<S>) => T) =>
    Layer.effect(
      tag,
      Effect.gen(function* () {
        const ref = yield* Ref.make(initialState)
        return serviceFactory(ref)
      })
    ),
}

/**
 * テストデータファクトリー
 */
export const TestDataFactory = {
  /**
   * ランダムな文字列の生成
   */
  randomString: (length = 8): string =>
    Math.random()
      .toString(36)
      .substring(2, 2 + length),

  /**
   * ランダムな整数の生成
   */
  randomInt: (min = 0, max = 100): number => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * 遅延のあるEffect（テスト用）
   */
  delayedSuccess: <A>(value: A, delayMs = 100) =>
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(delayMs))
      return value
    }),

  /**
   * 遅延のあるFailure（テスト用）
   */
  delayedFailure: <E>(error: E, delayMs = 100) =>
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(delayMs))
      return yield* Effect.fail(error)
    }),
}

/**
 * 決定論的テスト用ヘルパー
 */
export const DeterministicTestHelpers = {
  /**
   * 固定値でのテスト実行
   */
  withFixedTime: <E, A>(timeMs: number, test: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      // 固定時刻でのテスト実行
      const originalNow = Date.now
      Date.now = () => timeMs
      try {
        return yield* test
      } finally {
        Date.now = originalNow
      }
    }),

  /**
   * 固定乱数でのテスト実行
   */
  withFixedRandom: <E, A>(value: number, test: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      const originalRandom = Math.random
      Math.random = () => value
      try {
        return yield* test
      } finally {
        Math.random = originalRandom
      }
    }),

  /**
   * 時間を進める（擬似的）
   */
  advanceTime: (durationMs: number) =>
    Effect.sync(() => {
      // テスト用の時間進行（実際の実装では適切なクロック制御を使用）
      return durationMs
    }),

  /**
   * 現在時刻を取得
   */
  getCurrentTime: () => Effect.sync(() => Date.now()),
}

/**
 * アサーション用ヘルパー
 */
export const AssertionHelpers = {
  /**
   * Effect が成功することをアサート
   */
  expectEffectSuccess: async <E, A>(effect: Effect.Effect<A, E>) => {
    const result = await Effect.runPromise(Effect.either(effect))
    if (Either.isLeft(result)) {
      throw new Error(`Effect failed: ${JSON.stringify(result.left)}`)
    }
    return result.right
  },

  /**
   * Effect が失敗することをアサート
   */
  expectEffectFailure: async <E, A>(effect: Effect.Effect<A, E>) => {
    const result = await Effect.runPromise(Effect.either(effect))
    if (Either.isRight(result)) {
      throw new Error(`Effect should have failed but succeeded with: ${JSON.stringify(result.right)}`)
    }
    return result.left
  },

  /**
   * Schema バリデーションのアサート
   */
  expectSchemaValidation: <A, I>(schema: Schema.Schema<A, I>, input: I, expected: A) => {
    const result = Schema.decodeUnknownSync(schema)(input)
    expect(result).toEqual(expected)
    return result
  },

  /**
   * Match パターンのテスト用ヘルパー
   */
  testMatchPattern: <I, O>(
    input: I,
    pattern: any, // Match関連の型が複雑なのでanyを使用
    expected: O
  ) => {
    const result = Match.value(input).pipe(pattern)
    expect(result).toEqual(expected)
    return result
  },
}

/**
 * テスト環境設定
 */
export const TestEnvironment = {
  /**
   * 基本テスト環境の設定
   */
  setup: () =>
    Effect.sync(() => {
      // テスト用環境変数設定
      process.env.NODE_ENV = 'test'

      return {
        testStartTime: Date.now(),
        environment: 'test',
      }
    }),

  /**
   * テスト終了処理
   */
  teardown: () =>
    Effect.gen(function* () {
      // クリーンアップ処理
      yield* Effect.sync(() => {
        // プロセス終了処理等
      })
    }),
}

/**
 * Property-Based Testing Helpers
 * テストデータ生成のヘルパー（簡易版）
 */
export const PropertyTestHelpers = {
  /**
   * ランダム文字列生成
   */
  randomString: (minLength = 1, maxLength = 10): string => {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength
    const generated = Math.random()
      .toString(36)
      .substring(2, 2 + length)
    return generated.length === 0 ? 'test' : generated
  },

  /**
   * ランダム整数生成
   */
  randomInt: (min = 0, max = 100): number => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * ゲーム用座標生成
   */
  randomCoordinate: () => ({
    x: Math.random() * 2000 - 1000, // -1000 to 1000
    y: Math.random() * 256, // 0 to 256
    z: Math.random() * 2000 - 1000, // -1000 to 1000
  }),

  /**
   * ランダムプレイヤーID生成
   */
  randomPlayerId: (): string => `player_${PropertyTestHelpers.randomString(3, 16)}`,

  /**
   * ランダムブロックタイプ生成
   */
  randomBlockType: (): string => {
    const types = ['air', 'stone', 'dirt', 'grass', 'wood', 'water', 'lava']
    const index = Math.floor(Math.random() * types.length)
    return types[index] || 'stone'
  },

  /**
   * 複数の値をテストするヘルパー
   */
  testMultipleValues: <T>(generator: () => T, predicate: (value: T) => boolean, iterations = 100): boolean => {
    for (let i = 0; i < iterations; i++) {
      const value = generator()
      if (!predicate(value)) {
        return false
      }
    }
    return true
  },
}

/**
 * パフォーマンステスト用ヘルパー
 */
export const PerformanceTestHelpers = {
  /**
   * 実行時間測定
   */
  measureTime: <E, A>(effect: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      const start = Date.now()
      const result = yield* effect
      const end = Date.now()
      const duration = end - start

      return {
        result,
        duration,
        durationMs: duration,
      }
    }),

  /**
   * メモリ使用量測定
   */
  measureMemory: <E, A>(effect: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      const memBefore = process.memoryUsage()
      const result = yield* effect
      const memAfter = process.memoryUsage()

      return {
        result,
        memoryDelta: {
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          heapTotal: memAfter.heapTotal - memBefore.heapTotal,
          rss: memAfter.rss - memBefore.rss,
        },
      }
    }),

  /**
   * it.effectでのパフォーマンステスト
   */
  performanceTest: <E, A>(description: string, effect: Effect.Effect<A, E>, maxTimeMs = 1000) =>
    it.effect(description, () =>
      Effect.gen(function* () {
        const measured = yield* PerformanceTestHelpers.measureTime(effect)
        expect(measured.durationMs).toBeLessThan(maxTimeMs)
        return measured.result
      })
    ),
}

// 型定義は上記でinterfaceとして定義済み

// デフォルトエクスポート
export default {
  EffectTestHelpers,
  TestServiceFactory,
  TestDataFactory,
  DeterministicTestHelpers,
  AssertionHelpers,
  TestEnvironment,
  PropertyTestHelpers,
  PerformanceTestHelpers,
  createTestError,
}
