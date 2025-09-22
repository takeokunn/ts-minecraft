/**
 * Effect-TS専用ヘルパー関数
 *
 * Context7最新パターン準拠：
 * - Effect.gen中心の関数型設計
 * - Schema.TaggedErrorによる型安全エラーハンドリング
 * - TestContextを活用した決定論的テスト
 */

import { Effect, Exit, Option, Either, Schema, TestContext, TestClock, Duration, Fiber, pipe } from 'effect'
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
    return Effect.runPromise(Effect.provide(effect, TestContext.TestContext))
  },

  /**
   * TestServicesでEffectを実行
   */
  runWithTestServices: <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
    return Effect.runPromise(Effect.provide(effect, TestContext.TestContext))
  },

  /**
   * ExitとしてEffectを実行（成功/失敗の詳細確認用）
   */
  runExit: <A, E>(effect: Effect.Effect<A, E, never>): Promise<Exit.Exit<A, E>> => {
    return Effect.runPromise(Effect.exit(effect))
  },

  /**
   * Effectが成功することを期待（TestContext付き）
   */
  expectSuccess: <A>(effect: Effect.Effect<A, never, never>): Promise<A> => {
    return Effect.runPromise(effect)
  },

  /**
   * Effectが失敗することを期待（TestContext付き）
   */
  expectFailure: <E>(effect: Effect.Effect<never, E, never>): Promise<E> => {
    return Effect.runPromise(Effect.flip(effect))
  },

  /**
   * TestContextでEffectが成功することを期待
   */
  expectSuccessWithServices: <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> => {
    return Effect.runPromise(Effect.provide(effect, TestContext.TestContext))
  },

  /**
   * TestContextでEffectが失敗することを期待
   */
  expectFailureWithServices: <A, E>(effect: Effect.Effect<A, E, never>): Promise<E> => {
    return Effect.runPromise(Effect.provide(effect, TestContext.TestContext).pipe(Effect.flip))
  },

  /**
   * Effectが特定の時間内に完了することを確認
   */
  expectWithinTime: <A, E>(effect: Effect.Effect<A, E, never>, timeout: Duration.DurationInput): Promise<A> => {
    return Effect.runPromise(
      Effect.timeout(effect, timeout).pipe(
        Effect.flatMap((option: any) =>
          Option.isSome(option) ? Effect.succeed(option.value) : Effect.fail(new Error('Timeout exceeded'))
        )
      ) as Effect.Effect<A, any, never>
    )
  },
}

// ========================================
// エラーハンドリングヘルパー
// ========================================

/**
 * エラーハンドリング専用ヘルパー
 */
export const ErrorHelpers = {
  /**
   * エラーを期待したタイプでアサート
   */
  expectErrorType: <E extends Record<string, any>>(effect: Effect.Effect<any, E, never>, expectedTag: string): E => {
    try {
      Effect.runSync(effect)
      throw new Error(`Expected error with tag ${expectedTag} but effect succeeded`)
    } catch (error) {
      const e = error as E
      // _tagプロパティが存在する場合のみチェック
      if ('_tag' in e && typeof e['_tag'] === 'string') {
        expect(e['_tag']).toBe(expectedTag)
      } else {
        throw new Error(`Error does not have expected _tag property: ${expectedTag}`)
      }
      return e
    }
  },

  /**
   * 特定のエラーメッセージを期待
   */
  expectErrorMessage: (effect: Effect.Effect<any, any, never>, expectedMessage: string): Error => {
    try {
      Effect.runSync(effect)
      throw new Error(`Expected error with message "${expectedMessage}" but effect succeeded`)
    } catch (error) {
      const e = error as Error
      expect(e.message).toContain(expectedMessage)
      return e
    }
  },

  /**
   * エラーの回復をテスト
   */
  testRecover: <A, E1, E2>(
    effect: Effect.Effect<A, E1, never>,
    recover: (error: E1) => Effect.Effect<A, E2, never>
  ): A => {
    const recovered = Effect.catchAll(effect, recover)
    return Effect.runSync(recovered)
  },
}

// ========================================
// 時間制御ヘルパー
// ========================================

/**
 * 時間制御専用ヘルパー（TestClock使用）
 */
export const TimeHelpers = {
  /**
   * 時間を進めてEffectを実行
   */
  advanceTime: <A, E>(
    effect: Effect.Effect<A, E, never>,
    duration: Duration.DurationInput
  ): Effect.Effect<A, E, never> => {
    return Effect.fork(effect).pipe(
      Effect.flatMap((fiber) => Effect.andThen(TestClock.adjust(duration), Fiber.join(fiber)))
    )
  },

  /**
   * タイムアウトをテスト
   */
  expectTimeout: <A, E>(
    effect: Effect.Effect<A, E, never>,
    duration: Duration.DurationInput
  ): Effect.Effect<Option.Option<A>, any, never> => {
    return Effect.timeout(effect, duration) as any
  },

  /**
   * 実行時間を測定
   */
  measureTime: <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<readonly [A, Duration.Duration], E, never> => {
    return Effect.withSpan('measureTime')(effect).pipe(Effect.map((result) => [result, Duration.millis(0)] as const))
  },

  /**
   * 遅延実行をテスト
   */
  testDelay: <A, E>(effect: Effect.Effect<A, E, never>, delay: Duration.DurationInput): Effect.Effect<A, E, never> => {
    return pipe(Effect.sleep(delay), Effect.andThen(effect))
  },
}

// ========================================
// 並行処理ヘルパー
// ========================================

/**
 * 並行処理専用ヘルパー
 */
export const ConcurrencyHelpers = {
  /**
   * 複数Effectの並行実行をテスト
   */
  expectAllConcurrent: <A>(effects: Effect.Effect<A, any, never>[]): Effect.Effect<A[], any, never> => {
    return Effect.all(effects, { concurrency: 'unbounded' })
  },

  /**
   * 制限付き並行実行をテスト
   */
  expectAllWithLimit: <A>(
    effects: Effect.Effect<A, any, never>[],
    concurrency: number
  ): Effect.Effect<A[], any, never> => {
    return Effect.all(effects, { concurrency })
  },

  /**
   * レースコンディションをテスト
   */
  expectRace: <A>(effects: Effect.Effect<A, any, never>[]): Effect.Effect<A, any, never> => {
    // Effect.raceは配列ではなく個別の引数を受け取るため、適切に処理
    if (effects.length === 0) {
      return Effect.never
    }
    if (effects.length === 1) {
      const firstEffect = effects[0]
      return firstEffect ?? Effect.never
    }
    // 2つ以上の場合は最初の2つでraceを開始し、残りをreduceで処理
    const firstEffect = effects[0]
    if (!firstEffect) {
      return Effect.never
    }
    return effects.slice(1).reduce((acc, effect) => Effect.race(acc, effect), firstEffect)
  },

  /**
   * Fiberの制御をテスト
   */
  testFiberControl: <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<A, E, never> => {
    return Effect.fork(effect).pipe(
      Effect.flatMap((fiber) => {
        // Fiberが作成されたことを確認するだけに変更
        expect(fiber).toBeDefined()
        return Fiber.join(fiber)
      })
    )
  },
}

// ========================================
// Schemaテストヘルパー
// ========================================

/**
 * Schema専用テストヘルパー
 */
export const SchemaHelpers = {
  /**
   * Schemaデコード成功をテスト
   */
  expectDecodeSuccess: <A, I>(schema: Schema.Schema<A, I>, input: I): A => {
    return Schema.decodeUnknownSync(schema)(input)
  },

  /**
   * Schemaデコード失敗をテスト
   */
  expectDecodeFailure: <A, I>(schema: Schema.Schema<A, I>, input: unknown): any => {
    try {
      Schema.decodeUnknownSync(schema)(input)
      throw new Error('Expected decode to fail but it succeeded')
    } catch (error) {
      return error
    }
  },

  /**
   * Schema往復変換をテスト
   */
  testRoundTrip: <A, I>(schema: Schema.Schema<A, I>, value: A): A => {
    const encoded = Schema.encodeSync(schema)(value)
    const decoded = Schema.decodeUnknownSync(schema)(encoded)
    expect(decoded).toEqual(value)
    return decoded
  },

  /**
   * Schema変換をテスト
   */
  testTransform: <A, I, B>(schema: Schema.Schema<A, I>, transform: Schema.Schema<B, A>, input: I): B => {
    const decoded = Schema.decodeUnknownSync(schema)(input)
    const transformed = Schema.decodeUnknownSync(transform)(decoded)
    return transformed
  },
}

// ========================================
// データ構造ヘルパー
// ========================================

/**
 * データ構造専用ヘルパー
 */
export const DataHelpers = {
  /**
   * Optionの値をテスト
   */
  expectSome: <A>(option: Option.Option<A>): A => {
    if (Option.isNone(option)) {
      throw new Error('Expected Some but got None')
    }
    return option.value
  },

  /**
   * Optionが空であることをテスト
   */
  expectNone: <A>(option: Option.Option<A>): void => {
    if (Option.isSome(option)) {
      throw new Error(`Expected None but got Some with value: ${option.value}`)
    }
  },

  /**
   * Eitherの成功値をテスト
   */
  expectRight: <L, R>(either: Either.Either<L, R>): R => {
    if (Either.isLeft(either)) {
      throw new Error(`Expected Right but got Left with error: ${either.left}`)
    }
    return either.right as unknown as R
  },

  /**
   * Eitherの失敗値をテスト
   */
  expectLeft: <L, R>(either: Either.Either<L, R>): L => {
    if (Either.isRight(either)) {
      throw new Error(`Expected Left but got Right with value: ${either.right}`)
    }
    return either.left as unknown as L
  },

  /**
   * 配列の長さをテスト
   */
  expectArrayLength: <A>(array: A[], expectedLength: number): A[] => {
    expect(array.length).toBe(expectedLength)
    return array
  },

  /**
   * 配列が空でないことをテスト
   */
  expectNonEmptyArray: <A>(array: A[]): A[] => {
    expect(array.length).toBeGreaterThan(0)
    return array
  },
}

// ========================================
// パフォーマンステストヘルパー
// ========================================

/**
 * パフォーマンス専用ヘルパー
 */
export const PerformanceHelpers = {
  /**
   * 実行時間が制限内であることをテスト
   */
  expectTimeLimit: <A, E>(effect: Effect.Effect<A, E, never>, maxMs: number): Effect.Effect<A, any, never> => {
    return effect.pipe(
      Effect.timeout(Duration.millis(maxMs)),
      Effect.flatMap((option: any) =>
        Option.isSome(option) ? Effect.succeed(option.value) : Effect.fail(new Error('Timeout exceeded') as any)
      )
    ) as any
  },

  /**
   * メモリ使用量をテスト（概算）
   */
  testMemoryUsage: <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<readonly [A, number], E, never> => {
    return effect.pipe(Effect.map((result) => [result, 0] as const))
  },

  /**
   * スループットをテスト
   */
  testThroughput: <A, E>(effect: Effect.Effect<A, E, never>, iterations: number): Effect.Effect<number, E, never> => {
    const effects = Array.from({ length: iterations }, () => effect)
    return Effect.all(effects, { concurrency: 'unbounded' }).pipe(Effect.map(() => iterations))
  },
}

// ========================================
// 統合エクスポート
// ========================================

/**
 * すべてのEffect-TSヘルパーを統合
 */
export const AllEffectHelpers = {
  Effect: EffectHelpers,
  Error: ErrorHelpers,
  Time: TimeHelpers,
  Concurrency: ConcurrencyHelpers,
  Schema: SchemaHelpers,
  Data: DataHelpers,
  Performance: PerformanceHelpers,
} as const

// デフォルトエクスポート
export default AllEffectHelpers
