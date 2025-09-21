/**
 * 統合テストヘルパー - vitest/@effect 最新パターン準拠
 *
 * Context7準拠の最新API使用：
 * - `it.effect()` パターンの統一
 * - Schema-first テスト設計
 * - Layer-based 依存注入
 * - Property-based テスト統合
 */

// ========================================
// Core Test APIs - 最重要エクスポート
// ========================================

export { it, expect, describe, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
export { it as itEffect } from '@effect/vitest'

// ========================================
// Effect-TS Core APIs
// ========================================

export * as Effect from 'effect/Effect'
export * as Layer from 'effect/Layer'
export * as Schema from '@effect/schema/Schema'
export * as TestContext from 'effect/TestContext'
export * as TestClock from 'effect/TestClock'
export * as TestRandom from 'effect/TestRandom'
export * as Duration from 'effect/Duration'
export * as Match from 'effect/Match'
export * as Exit from 'effect/Exit'
export * as Option from 'effect/Option'
export * as Either from 'effect/Either'
export * as Context from 'effect/Context'
export { pipe } from 'effect/Function'

// ========================================
// 統一テストパターン
// ========================================

/**
 * Effect-TS統合テストパターン
 * Context7推奨のit.effect()ベースAPI
 */
export const TestPatterns = {
  /** 標準テスト実行（TestContext使用） */
  effect: <A, E>(
    name: string,
    test: () => Effect.Effect<A, E, never>
  ) => {
    return itEffect(name, test)
  },

  /** リソース管理が必要なテスト */
  scoped: <A, E>(
    name: string,
    test: () => Effect.Effect<A, E, never>
  ) => {
    return itEffect.scoped(name, test)
  },

  /** ライブ環境でのテスト */
  live: <A, E>(
    name: string,
    test: () => Effect.Effect<A, E, never>
  ) => {
    return itEffect.live(name, test)
  },

  /** フレークテスト対応 */
  flaky: <A, E>(
    name: string,
    test: () => Effect.Effect<A, E, never>,
    timeout: Duration.DurationInput = "5 seconds"
  ) => {
    return itEffect(name, () =>
      itEffect.flakyTest(test(), timeout)
    )
  }
}

// ========================================
// 最新Effect-TSアサーション
// ========================================

/**
 * Effect専用アサーション（Context7パターン）
 */
export const EffectAssert = {
  /** Effectが成功することをテスト */
  succeeds: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(effect)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        return result.value
      }
      throw new Error('Expected success but got failure')
    }),

  /** Effectが失敗することをテスト */
  fails: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(effect)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        return result.cause
      }
      throw new Error('Expected failure but got success')
    }),

  /** Schema検証付き成功テスト */
  succeedsWithSchema: <A>(schema: Schema.Schema<A>) =>
    <E>(effect: Effect.Effect<A, E, never>) =>
      Effect.gen(function* () {
        const value = yield* EffectAssert.succeeds(effect)
        return yield* Schema.decodeUnknown(schema)(value)
      })
}

// ========================================
// Schema-First テスト設計
// ========================================

/**
 * Schema中心のテスト設計パターン
 */
export const SchemaTest = {
  /** Schemaの往復変換テスト */
  roundTrip: <A, I>(schema: Schema.Schema<A, I>) =>
    (value: A) =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encode(schema)(value)
        const decoded = yield* Schema.decodeUnknown(schema)(encoded)
        expect(decoded).toEqual(value)
        return decoded
      }),

  /** Schema検証テスト */
  validates: <A>(schema: Schema.Schema<A>) =>
    (input: unknown) =>
      Effect.gen(function* () {
        return yield* Schema.decodeUnknown(schema)(input)
      }),

  /** Schema不変条件テスト */
  invariant: <A>(schema: Schema.Schema<A>, predicate: (value: A) => boolean) =>
    (input: unknown) =>
      Effect.gen(function* () {
        const result = yield* Effect.either(Schema.decodeUnknown(schema)(input))
        return pipe(
          result,
          Either.match({
            onLeft: () => true, // 無効な入力は条件を満たすとみなす
            onRight: predicate
          })
        )
      })
}

// ========================================
// Layer-based テスト環境
// ========================================

/**
 * 依存注入テスト環境
 */
export const TestLayers = {
  /** テスト用決定論的環境 */
  deterministic: TestContext.TestContext,

  /** 複数レイヤーの組み合わせ */
  merge: (...layers: Layer.Layer<any, any, any>[]) =>
    layers.reduce((acc, layer) => Layer.merge(acc, layer)),

  /** モックサービスレイヤー作成 */
  mock: <T>(tag: Context.Tag<T, T>, implementation: T) =>
    Layer.succeed(tag, implementation)
}

// ========================================
// Performance & Timing Tests
// ========================================

/**
 * パフォーマンステスト（TestClock使用）
 */
export const PerformanceTest = {
  /** 実行時間測定 */
  measureTime: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.gen(function* () {
      const start = yield* Effect.sync(() => performance.now())
      const result = yield* effect
      const end = yield* Effect.sync(() => performance.now())
      return { result, duration: end - start }
    }),

  /** タイムアウトテスト */
  timeout: <A, E>(
    effect: Effect.Effect<A, E, never>,
    duration: Duration.DurationInput
  ) =>
    Effect.gen(function* () {
      return yield* Effect.timeout(effect, duration)
    }),

  /** 時間制御テスト */
  timeControl: <A, E>(
    effect: Effect.Effect<A, E, never>,
    advance: Duration.DurationInput
  ) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(effect)
      yield* TestClock.adjust(advance)
      return yield* Effect.join(fiber)
    })
}

// ========================================
// ドメインファクトリー統合
// ========================================

export { DomainFactories } from './factories/domain-factories'
export {
  ChunkFactory,
  WorldFactory,
  EntityFactory,
  BlockFactory,
  CoordinateFactory,
  RandomFactory,
} from './factories/domain-factories'

// ========================================
// ドメインアサーション統合
// ========================================

export { DomainAssertions } from './assertions/domain-assertions'
export {
  ChunkAssertions,
  WorldAssertions,
  EntityAssertions,
  BlockAssertions,
  PerformanceAssertions,
  ValidationAssertions,
} from './assertions/domain-assertions'

// ========================================
// Effect-TS ヘルパー統合
// ========================================

export { EffectHelpers } from './helpers/effect-helpers'

// ========================================
// 統一エクスポートオブジェクト
// ========================================

/**
 * すべてのテストヘルパーを統合したオブジェクト
 * 最もクリーンなAPI
 */
export const UnifiedTestHelpers = {
  // テストパターン
  Pattern: TestPatterns,

  // アサーション
  Assert: EffectAssert,
  Schema: SchemaTest,

  // 環境・レイヤー
  Layer: TestLayers,

  // パフォーマンス
  Performance: PerformanceTest,

  // ドメインヘルパー
  Factories: DomainFactories,
  Assertions: DomainAssertions,
} as const

// デフォルトエクスポート
export default UnifiedTestHelpers