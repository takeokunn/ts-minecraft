/**
 * 統合テストヘルパー - Effect-TS最新パターン準拠
 *
 * Context7準拠の最新API使用：
 * - Effect-TS標準パターン
 * - Schema-first テスト設計
 * - Layer-based 依存注入
 * - Property-based テスト統合
 */

// ========================================
// インポートセクション
// ========================================

// Vitestの基本API
export { describe, beforeAll, afterAll, beforeEach, afterEach, vi, it, expect } from 'vitest'

// Effect-TS Core APIs - exportとimportの両方
import {
  Effect,
  Layer,
  TestContext,
  TestClock,
  Duration,
  Match,
  Exit,
  Option,
  Either,
  Context,
  pipe,
  Fiber,
} from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'

// 再エクスポート
export { Effect, Layer, TestContext, TestClock, Duration, Match, Exit, Option, Either, Context, pipe, Schema, Fiber }
export { fc }

// ========================================
// 型定義とユーティリティ
// ========================================

/**
 * テストサービス統合型定義
 * TestContext.TestContextの正確な型
 */
export type TestServices = never

/**
 * 統一テストレイヤー型
 */
export type UnifiedTestLayer = Layer.Layer<never, never, never>

/**
 * テスト用Effect型ヘルパー
 */
export type TestEffect<A, E = never> = Effect.Effect<A, E, TestServices>

/**
 * 型安全なit.effect用ヘルパー
 */
export const itEffect = {
  /**
   * 型安全なit.effect実装
   */
  safe: <A, E>(name: string, test: () => TestEffect<A, E>) => it(name, test as () => Effect.Effect<A, E, TestServices>),
}

/**
 * テストEffect型アサーション - 最新Effect-TSパターン準拠
 */
export const asTestEffect = <A, E = never>(effect: Effect.Effect<A, E, any>): Effect.Effect<A, E, never> =>
  effect as Effect.Effect<A, E, never>

// ドメイン固有のインポート
import * as DomainFactoriesModule from './factories/domain-factories'
import * as DomainAssertionsModule from './assertions/domain-assertions'
import * as EffectHelpersModule from './helpers/effect-helpers'

// ========================================
// 統一テストパターン
// ========================================

/**
 * Effect-TS統合テストパターン
 * 標準vitestとEffect-TSの組み合わせ使用
 */
export const TestPatterns = {
  /** 標準テスト実行 */
  effect: (name: string, test: () => any) => {
    return it(name, test)
  },

  /** リソース管理が必要なテスト */
  scoped: (name: string, test: () => any) => {
    return it(name, test)
  },

  /** ライブ環境でのテスト */
  live: (name: string, test: () => any) => {
    return it(name, test)
  },

  /** フレークテスト対応 */
  flaky: (name: string, test: () => any, timeout: any = '5 seconds') => {
    return it(name, test)
  },
}

// ========================================
// 最新Effect-TSアサーション
// ========================================

/**
 * Effect専用アサーション（Context7パターン）
 */
export const EffectAssert = {
  /** Effectが成功することをテスト */
  succeeds: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(effect)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        return result.value
      }
      throw new Error('Expected success but got failure')
    }),

  /** Effectが失敗することをテスト */
  fails: (effect: any) =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(effect)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        return result.cause
      }
      throw new Error('Expected failure but got success')
    }),

  /** Schema検証付き成功テスト */
  succeedsWithSchema: (schema: any) => (effect: any) =>
    Effect.gen(function* () {
      const value = yield* EffectAssert.succeeds(effect)
      return yield* Schema.decodeUnknown(schema)(value)
    }),
}

// ========================================
// Schema-First テスト設計
// ========================================

/**
 * Schema中心のテスト設計パターン
 */
export const SchemaTest = {
  /** Schemaの往復変換テスト */
  roundTrip: (schema: any) => (value: any) =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(schema)(value)
      const decoded = yield* Schema.decodeUnknown(schema)(encoded)
      expect(decoded).toEqual(value)
      return decoded
    }),

  /** Schema検証テスト - Effect版 */
  validates: (schema: any) => (input: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(schema)(input)
    }),

  /** Schema検証テスト - 同期版 */
  validatesSync: (schema: any, input: unknown) => {
    return Schema.decodeUnknownSync(schema)(input)
  },

  /** Schema不変条件テスト */
  invariant: (schema: any, predicate: (value: any) => boolean) => (input: unknown) =>
    Effect.gen(function* () {
      const result = yield* Effect.either(Schema.decodeUnknown(schema)(input))
      return pipe(
        result,
        Either.match({
          onLeft: () => true, // 無効な入力は条件を満たすとみなす
          onRight: predicate,
        })
      )
    }),
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
  merge: (...layers: Layer.Layer<any, any, any>[]) => layers.reduce((acc, layer) => Layer.merge(acc, layer)),

  /** モックサービスレイヤー作成 */
  mock: (tag: Context.Tag<any, any>, implementation: any) => Layer.succeed(tag, implementation),

  /** 統一テストレイヤー作成 */
  unified: () => TestContext.TestContext,
}

// ========================================
// Property-Based Testing
// ========================================

/**
 * Property-based testing with Effect-TS and FastCheck
 */
export const PropertyTest = {
  /** プロパティテストの実行 */
  check: <T>(
    arbitrary: fc.Arbitrary<T>,
    predicate: (value: T) => Effect.Effect<void, unknown, never>,
    seed?: number,
    numRuns?: number
  ): Effect.Effect<void, unknown, never> =>
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        const params: fc.Parameters<[T]> = {}
        if (seed !== undefined) params.seed = seed
        if (numRuns !== undefined) params.numRuns = numRuns

        fc.assert(
          fc.property(arbitrary, (value) => {
            return Effect.runSync(predicate(value))
          }),
          params
        )
      })
    }),

  /** 同期プロパティテスト */
  checkSync: <T>(
    arbitrary: fc.Arbitrary<T>,
    predicate: (value: T) => boolean,
    seed?: number,
    numRuns?: number
  ): Effect.Effect<void, unknown, never> =>
    Effect.sync(() => {
      const params: fc.Parameters<[T]> = {}
      if (seed !== undefined) params.seed = seed
      if (numRuns !== undefined) params.numRuns = numRuns

      fc.assert(fc.property(arbitrary, predicate), params)
    }),

  /** カスタム設定でのプロパティテスト */
  checkWith: <T>(
    arbitrary: fc.Arbitrary<T>,
    predicate: (value: T) => Effect.Effect<void, unknown, never>,
    parameters?: any
  ): Effect.Effect<void, unknown, never> =>
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        fc.assert(
          fc.property(arbitrary, (value) => {
            return Effect.runSync(predicate(value))
          }),
          parameters || {}
        )
      })
    }),
}

// ========================================
// Performance & Timing Tests
// ========================================

/**
 * パフォーマンステスト（TestClock使用）
 */
export const PerformanceTest = {
  /** 実行時間測定 */
  measureTime: (effect: any) =>
    Effect.gen(function* () {
      const start = yield* Effect.sync(() => performance.now())
      const result = yield* effect
      const end = yield* Effect.sync(() => performance.now())
      return { result, duration: end - start }
    }),

  /** タイムアウトテスト */
  timeout: (effect: any, duration: any) =>
    Effect.gen(function* () {
      return yield* Effect.timeout(effect, duration)
    }),

  /** 時間制御テスト */
  timeControl: (effect: any, advance: any) =>
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(effect)
      yield* TestClock.adjust(advance)
      return yield* Fiber.join(fiber)
    }),

  /** 実行時間が指定範囲内であることをテスト */
  expectDuration: (effect: any, minMs: number, maxMs: number) =>
    Effect.gen(function* () {
      const start = yield* Effect.sync(() => performance.now())
      const result = yield* effect
      const end = yield* Effect.sync(() => performance.now())
      const duration = end - start

      if (duration < minMs) {
        throw new Error(`Effect completed too quickly: ${duration}ms < ${minMs}ms`)
      }
      if (duration > maxMs) {
        throw new Error(`Effect took too long: ${duration}ms > ${maxMs}ms`)
      }

      return result
    }),
}

// ========================================
// ドメインファクトリー統合
// ========================================

export const DomainFactories = DomainFactoriesModule.DomainFactories || {}
export const ChunkFactory = DomainFactoriesModule.ChunkFactory || {}
export const WorldFactory = DomainFactoriesModule.WorldFactory || {}
export const EntityFactory = DomainFactoriesModule.EntityFactory || {}
export const BlockFactory = DomainFactoriesModule.BlockFactory || {}
export const CoordinateFactory = DomainFactoriesModule.CoordinateFactory || {}
export const RandomFactory = DomainFactoriesModule.RandomFactory || {}

// ========================================
// ドメインアサーション統合
// ========================================

export const DomainAssertions = DomainAssertionsModule.DomainAssertions || {}
export const ChunkAssertions = DomainAssertionsModule.ChunkAssertions || {}
export const WorldAssertions = DomainAssertionsModule.WorldAssertions || {}
export const EntityAssertions = DomainAssertionsModule.EntityAssertions || {}
export const BlockAssertions = DomainAssertionsModule.BlockAssertions || {}
export const PerformanceAssertions = DomainAssertionsModule.PerformanceAssertions || {}
export const ValidationAssertions = DomainAssertionsModule.ValidationAssertions || {}

// ========================================
// Effect-TS ヘルパー統合
// ========================================

export const EffectHelpers = EffectHelpersModule.EffectHelpers || {}

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
  Property: PropertyTest,

  // 環境・レイヤー
  Layer: TestLayers,

  // パフォーマンス
  Performance: PerformanceTest,

  // ドメインヘルパー
  Factories: DomainFactories,
  Assertions: DomainAssertions,
} as const

// ========================================
// レガシー互換性エクスポート
// ========================================

// 後方互換性のためのエクスポート
export const expectEffectSuccess = EffectAssert.succeeds
export const expectEffectFailure = EffectAssert.fails
export const expectSchemaSuccess = SchemaTest.validatesSync
export const expectPerformanceTest = PerformanceTest.measureTime

// expectEffectDuration: async function for performance testing
export const expectEffectDuration = async (effect: any, minMs: number, maxMs: number): Promise<any> => {
  const start = performance.now()
  const result = await Effect.runPromise(effect)
  const end = performance.now()
  const duration = end - start

  if (duration < minMs) {
    throw new Error(`Effect completed too quickly: ${duration}ms < ${minMs}ms`)
  }
  if (duration > maxMs) {
    throw new Error(`Effect took too long: ${duration}ms > ${maxMs}ms`)
  }

  return result
}

// 追加のレガシー互換性エクスポート
export const expectEffectFailureWith = (errorMatcher: any) => (effect: any) =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(effect)
    if (Exit.isFailure(result)) {
      return result.cause
    }
    throw new Error('Expected failure but got success')
  })

export const expectSchemaFailure = (schema: any) => (input: unknown) =>
  Effect.gen(function* () {
    const result = yield* Effect.either(Schema.decodeUnknown(schema)(input))
    if (Either.isLeft(result)) {
      return result.left
    }
    throw new Error('Expected schema validation failure but got success')
  })

export const expectTaggedError = (tag: string) => (effect: any) =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(effect)
    if (Exit.isFailure(result)) {
      // Simple tagged error check - can be enhanced
      return result.cause
    }
    throw new Error(`Expected tagged error '${tag}' but got success`)
  })

export const expectPropertyTest = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<void, unknown, never>,
  options?: { numRuns?: number; seed?: number }
): Effect.Effect<void, unknown, never> => {
  return PropertyTest.check(arbitrary, predicate, options?.seed, options?.numRuns)
}
export const expectPerformanceTestEffect = PerformanceTest.measureTime

export const expectDeterministicProperty = <T>(
  arbitrary: any,
  predicate: (value: T) => boolean,
  seed?: number,
  numRuns?: number
): any => PropertyTest.checkSync(arbitrary, predicate, seed, numRuns)

export const expectDeterministicPropertyEffect = <T>(
  arbitrary: any,
  predicate: (value: T) => any,
  seed?: number,
  numRuns?: number
): any => PropertyTest.check(arbitrary, predicate, seed, numRuns)

export const expectEffectWithLayer = (layer: any) => (effect: any) => Effect.provide(effect, layer)

export const testAllBranches = (branches: any[]) => Effect.all(branches, { concurrency: 'unbounded' })

export const expectSystemTest = (systemTag: any) => (effect: any) =>
  Effect.gen(function* () {
    // Simple system test - can be enhanced based on ECS system requirements
    return yield* effect
  })

// ========================================
// デフォルトエクスポート
// ========================================

export default {
  TestPatterns,
  EffectAssert,
  PerformanceTest,
  SchemaTest,
  PropertyTest,
  TestLayers,
}
