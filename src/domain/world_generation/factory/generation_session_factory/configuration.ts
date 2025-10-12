/**
 * @fileoverview GenerationSession Configuration Management
 *
 * GenerationSessionの設定管理システムです。
 * 複雑な設定パターンを型安全に管理し、
 * 動的な設定変更と最適化を提供します。
 *
 * ## 主要機能
 * - 設定テンプレートシステム
 * - 動的設定最適化
 * - 設定検証と競合解決
 * - パフォーマンス調整
 * - 環境適応型設定
 */

import type * as GenerationSession from '@domain/world_generation/aggregate/generation_session'
import { Effect, Schema } from 'effect'
import type { SessionFactoryError } from './index'

// ================================
// Configuration Types
// ================================

/**
 * 設定プロファイル
 */
export type ConfigurationProfile =
  | 'development'
  | 'testing'
  | 'staging'
  | 'production'
  | 'high_performance'
  | 'memory_constrained'
  | 'low_latency'
  | 'batch_processing'

/**
 * ハードウェア仕様
 */
export const HardwareSpecSchema = Schema.Struct({
  cpuCores: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  memoryMB: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  storageSpeedMBps: Schema.Number.pipe(Schema.greaterThan(0)),
  networkLatencyMs: Schema.Number.pipe(Schema.greaterThan(0)),
  hasSSE: Schema.Boolean,
  hasSIMD: Schema.Boolean,
})

export type HardwareSpec = typeof HardwareSpecSchema.Type

/**
 * 負荷状況
 */
export const LoadConditionSchema = Schema.Struct({
  currentCpuUsage: Schema.Number.pipe(Schema.between(0, 100)),
  currentMemoryUsage: Schema.Number.pipe(Schema.between(0, 100)),
  activeConnections: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  queuedRequests: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  networkThroughput: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})

export type LoadCondition = typeof LoadConditionSchema.Type

/**
 * 設定最適化パラメータ
 */
export const OptimizationParamsSchema = Schema.Struct({
  profile: Schema.Literal(
    'development',
    'testing',
    'staging',
    'production',
    'high_performance',
    'memory_constrained',
    'low_latency',
    'batch_processing'
  ),
  hardwareSpec: Schema.optional(HardwareSpecSchema),
  loadCondition: Schema.optional(LoadConditionSchema),
  prioritizeFor: Schema.optional(Schema.Literal('speed', 'memory', 'stability', 'quality')),
  constraints: Schema.optional(
    Schema.Struct({
      maxMemoryMB: Schema.Number,
      maxCpuUsage: Schema.Number,
      maxConcurrentOperations: Schema.Number,
      maxExecutionTimeMs: Schema.Number,
    })
  ),
})

export type OptimizationParams = typeof OptimizationParamsSchema.Type

// ================================
// Configuration Builder
// ================================

export interface SessionConfigurationBuilder {
  /**
   * プロファイルベース設定適用
   */
  readonly applyProfile: (profile: ConfigurationProfile) => SessionConfigurationBuilder

  /**
   * ハードウェア適応設定
   */
  readonly adaptToHardware: (spec: HardwareSpec) => SessionConfigurationBuilder

  /**
   * 負荷状況適応設定
   */
  readonly adaptToLoad: (condition: LoadCondition) => SessionConfigurationBuilder

  /**
   * カスタム並行設定
   */
  readonly withConcurrency: (maxChunks: number, batchSize: number) => SessionConfigurationBuilder

  /**
   * タイムアウト設定
   */
  readonly withTimeouts: (chunk: number, session: number, shutdown?: number) => SessionConfigurationBuilder

  /**
   * 再試行設定
   */
  readonly withRetry: (
    maxAttempts: number,
    strategy: 'linear' | 'exponential' | 'constant',
    baseDelay: number,
    maxDelay?: number
  ) => SessionConfigurationBuilder

  /**
   * 優先度設定
   */
  readonly withPriority: (enableQueuing: boolean, threshold?: number, weight?: number) => SessionConfigurationBuilder

  /**
   * 制約適用
   */
  readonly withConstraints: (constraints: OptimizationParams['constraints']) => SessionConfigurationBuilder

  /**
   * 最適化適用
   */
  readonly optimize: (params: OptimizationParams) => Effect.Effect<SessionConfigurationBuilder, SessionFactoryError>

  /**
   * 設定構築
   */
  readonly build: () => Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError>
}

// ================================
// Configuration Builder Implementation
// ================================

// SessionConfigurationBuilderImpl クラスは削除されました
// 新しいパターン: Schema + Pure Functions を使用してください
// - configuration_builder_state.ts: SessionConfigurationBuilderStateSchema, initialSessionConfigurationBuilderState
// - configuration_builder_functions.ts: applyProfile, adaptToHardware, adaptToLoad, withConcurrency, withTimeouts, withRetry, withPriority, withConstraints, optimize, build
//
// 使用例:
// import { pipe } from 'effect/Function'
// import * as BuilderState from './configuration_builder_state'
// import * as BuilderFunctions from './configuration_builder_functions'
//
// const config = yield* pipe(
//   BuilderState.initialSessionConfigurationBuilderState,
//   (state) => BuilderFunctions.applyProfile(state, 'production'),
//   (state) => BuilderFunctions.withConcurrency(state, 8, 16),
//   BuilderFunctions.build
// )

// ================================
// Factory Functions
// ================================

/**
 * 新しい設定ビルダー作成
 */
export const createConfigurationBuilder = (): SessionConfigurationBuilder => new SessionConfigurationBuilderImpl()

/**
 * プロファイルベース設定ビルダー作成
 */
export const createConfigurationBuilderForProfile = (profile: ConfigurationProfile): SessionConfigurationBuilder =>
  new SessionConfigurationBuilderImpl().applyProfile(profile)

/**
 * 最適化パラメータベース設定作成
 */
export const createOptimizedConfiguration = (
  params: OptimizationParams
): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> =>
  Effect.gen(function* () {
    const builder = yield* createConfigurationBuilder().optimize(params)
    return yield* builder.build()
  })

/**
 * ハードウェア仕様検出
 */
export const detectHardwareSpec = (): Effect.Effect<HardwareSpec, SessionFactoryError> =>
  Effect.sync(() => ({
    cpuCores: Math.max(1, navigator.hardwareConcurrency || 4),
    memoryMB: 4096, // デフォルト値、実際の検出が困難
    storageSpeedMBps: 100, // デフォルト値
    networkLatencyMs: 50, // デフォルト値
    hasSSE: true, // 仮定
    hasSIMD: true, // 仮定
  }))

/**
 * 現在の負荷状況取得
 */
export const getCurrentLoadCondition = (): Effect.Effect<LoadCondition, SessionFactoryError> =>
  Effect.sync(() => ({
    currentCpuUsage: 30, // デフォルト値、実際の測定が困難
    currentMemoryUsage: 40, // デフォルト値
    activeConnections: 0, // デフォルト値
    queuedRequests: 0, // デフォルト値
    networkThroughput: 0, // デフォルト値
  }))

// ================================
// Exports
// ================================

export {
  type ConfigurationProfile,
  type HardwareSpec,
  type LoadCondition,
  type OptimizationParams,
  type SessionConfigurationBuilder,
}
