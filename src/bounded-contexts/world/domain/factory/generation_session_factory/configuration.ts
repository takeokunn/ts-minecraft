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

import { Effect, Schema, Match, Function, Duration, Option } from "effect"
import type * as GenerationSession from "../../aggregate/generation_session/generation-session.js"
import type { SessionFactoryError } from "./factory.js"

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
  hasSIMD: Schema.Boolean
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
  networkThroughput: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))
})

export type LoadCondition = typeof LoadConditionSchema.Type

/**
 * 設定最適化パラメータ
 */
export const OptimizationParamsSchema = Schema.Struct({
  profile: Schema.Literal('development', 'testing', 'staging', 'production', 'high_performance', 'memory_constrained', 'low_latency', 'batch_processing'),
  hardwareSpec: Schema.optional(HardwareSpecSchema),
  loadCondition: Schema.optional(LoadConditionSchema),
  prioritizeFor: Schema.optional(Schema.Literal('speed', 'memory', 'stability', 'quality')),
  constraints: Schema.optional(Schema.Struct({
    maxMemoryMB: Schema.Number,
    maxCpuUsage: Schema.Number,
    maxConcurrentOperations: Schema.Number,
    maxExecutionTimeMs: Schema.Number
  }))
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
  readonly withPriority: (
    enableQueuing: boolean,
    threshold?: number,
    weight?: number
  ) => SessionConfigurationBuilder

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

class SessionConfigurationBuilderImpl implements SessionConfigurationBuilder {
  constructor(
    private readonly config: Partial<GenerationSession.SessionConfiguration> = {}
  ) {}

  applyProfile(profile: ConfigurationProfile): SessionConfigurationBuilder {
    const profileConfig = Function.pipe(
      Match.value(profile),
      Match.when('development', () => this.createDevelopmentProfile()),
      Match.when('testing', () => this.createTestingProfile()),
      Match.when('staging', () => this.createStagingProfile()),
      Match.when('production', () => this.createProductionProfile()),
      Match.when('high_performance', () => this.createHighPerformanceProfile()),
      Match.when('memory_constrained', () => this.createMemoryConstrainedProfile()),
      Match.when('low_latency', () => this.createLowLatencyProfile()),
      Match.when('batch_processing', () => this.createBatchProcessingProfile()),
      Match.orElse(() => this.createProductionProfile())
    )

    return new SessionConfigurationBuilderImpl({
      ...this.config,
      ...profileConfig
    })
  }

  adaptToHardware(spec: HardwareSpec): SessionConfigurationBuilder {
    // CPU コア数に基づく並行性調整
    const optimalConcurrency = Math.min(spec.cpuCores * 2, 16)

    // メモリ量に基づくバッチサイズ調整
    const optimalBatchSize = Math.min(Math.floor(spec.memoryMB / 100), 64)

    // ストレージ速度に基づくタイムアウト調整
    const baseTimeout = spec.storageSpeedMBps > 500 ? 15000 : 30000

    return new SessionConfigurationBuilderImpl({
      ...this.config,
      maxConcurrentChunks: optimalConcurrency,
      chunkBatchSize: optimalBatchSize,
      timeoutPolicy: {
        chunkTimeoutMs: baseTimeout,
        sessionTimeoutMs: baseTimeout * 20,
        gracefulShutdownMs: Math.min(5000, baseTimeout / 3),
        ...this.config.timeoutPolicy
      }
    })
  }

  adaptToLoad(condition: LoadCondition): SessionConfigurationBuilder {
    // CPU 使用率に基づく並行性動的調整
    const cpuAdjustment = 1 - (condition.currentCpuUsage / 100) * 0.5
    const memoryAdjustment = 1 - (condition.currentMemoryUsage / 100) * 0.3

    const adjustment = Math.min(cpuAdjustment, memoryAdjustment)

    const adjustedConcurrency = Math.max(1,
      Math.floor((this.config.maxConcurrentChunks ?? 4) * adjustment)
    )

    // ネットワーク遅延に基づくタイムアウト調整
    const timeoutMultiplier = Math.max(1, condition.networkLatencyMs / 100)

    return new SessionConfigurationBuilderImpl({
      ...this.config,
      maxConcurrentChunks: adjustedConcurrency,
      timeoutPolicy: {
        chunkTimeoutMs: Math.floor((this.config.timeoutPolicy?.chunkTimeoutMs ?? 30000) * timeoutMultiplier),
        sessionTimeoutMs: Math.floor((this.config.timeoutPolicy?.sessionTimeoutMs ?? 600000) * timeoutMultiplier),
        gracefulShutdownMs: this.config.timeoutPolicy?.gracefulShutdownMs ?? 5000,
        ...this.config.timeoutPolicy
      }
    })
  }

  withConcurrency(maxChunks: number, batchSize: number): SessionConfigurationBuilder {
    return new SessionConfigurationBuilderImpl({
      ...this.config,
      maxConcurrentChunks: Math.max(1, Math.min(16, maxChunks)),
      chunkBatchSize: Math.max(1, Math.min(64, batchSize))
    })
  }

  withTimeouts(chunk: number, session: number, shutdown?: number): SessionConfigurationBuilder {
    return new SessionConfigurationBuilderImpl({
      ...this.config,
      timeoutPolicy: {
        chunkTimeoutMs: Math.max(1000, chunk),
        sessionTimeoutMs: Math.max(chunk * 2, session),
        gracefulShutdownMs: shutdown ?? Math.min(5000, chunk / 2)
      }
    })
  }

  withRetry(
    maxAttempts: number,
    strategy: 'linear' | 'exponential' | 'constant',
    baseDelay: number,
    maxDelay?: number
  ): SessionConfigurationBuilder {
    return new SessionConfigurationBuilderImpl({
      ...this.config,
      retryPolicy: {
        maxAttempts: Math.max(1, Math.min(10, maxAttempts)),
        backoffStrategy: strategy,
        baseDelayMs: Math.max(100, baseDelay),
        maxDelayMs: maxDelay ?? Math.max(baseDelay * 10, 30000)
      }
    })
  }

  withPriority(
    enableQueuing: boolean,
    threshold: number = 5,
    weight: number = 2.0
  ): SessionConfigurationBuilder {
    return new SessionConfigurationBuilderImpl({
      ...this.config,
      priorityPolicy: {
        enablePriorityQueuing: enableQueuing,
        priorityThreshold: Math.max(1, Math.min(10, threshold)),
        highPriorityWeight: Math.max(1.0, Math.min(10.0, weight))
      }
    })
  }

  withConstraints(constraints: OptimizationParams['constraints']): SessionConfigurationBuilder {
    if (!constraints) return this

    // 制約に基づく設定調整
    const maxConcurrency = constraints.maxConcurrentOperations
      ? Math.min(this.config.maxConcurrentChunks ?? 4, constraints.maxConcurrentOperations)
      : this.config.maxConcurrentChunks

    const chunkTimeout = constraints.maxExecutionTimeMs
      ? Math.min(this.config.timeoutPolicy?.chunkTimeoutMs ?? 30000, constraints.maxExecutionTimeMs / 10)
      : this.config.timeoutPolicy?.chunkTimeoutMs

    return new SessionConfigurationBuilderImpl({
      ...this.config,
      maxConcurrentChunks: maxConcurrency,
      timeoutPolicy: {
        ...this.config.timeoutPolicy,
        chunkTimeoutMs: chunkTimeout ?? 30000,
        sessionTimeoutMs: this.config.timeoutPolicy?.sessionTimeoutMs ?? 600000,
        gracefulShutdownMs: this.config.timeoutPolicy?.gracefulShutdownMs ?? 5000
      }
    })
  }

  optimize(params: OptimizationParams): Effect.Effect<SessionConfigurationBuilder, SessionFactoryError> {
    return Effect.gen(function* () {
      let builder = this.applyProfile(params.profile)

      // ハードウェア適応
      if (params.hardwareSpec) {
        builder = builder.adaptToHardware(params.hardwareSpec)
      }

      // 負荷適応
      if (params.loadCondition) {
        builder = builder.adaptToLoad(params.loadCondition)
      }

      // 優先化適用
      if (params.prioritizeFor) {
        builder = yield* this.applyPrioritization(builder, params.prioritizeFor)
      }

      // 制約適用
      if (params.constraints) {
        builder = builder.withConstraints(params.constraints)
      }

      return builder
    }.bind(this))
  }

  build(): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> {
    return Effect.succeed({
      maxConcurrentChunks: this.config.maxConcurrentChunks ?? 4,
      chunkBatchSize: this.config.chunkBatchSize ?? 8,
      retryPolicy: this.config.retryPolicy ?? {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 10000
      },
      timeoutPolicy: this.config.timeoutPolicy ?? {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 600000,
        gracefulShutdownMs: 5000
      },
      priorityPolicy: this.config.priorityPolicy ?? {
        enablePriorityQueuing: false,
        priorityThreshold: 5,
        highPriorityWeight: 2.0
      }
    })
  }

  // プロファイル作成メソッド群
  private createDevelopmentProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 2,
      chunkBatchSize: 4,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelayMs: 500,
        maxDelayMs: 2000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 60000,
        sessionTimeoutMs: 300000,
        gracefulShutdownMs: 10000
      }
    }
  }

  private createTestingProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 1,
      chunkBatchSize: 1,
      retryPolicy: {
        maxAttempts: 1,
        backoffStrategy: 'constant',
        baseDelayMs: 100,
        maxDelayMs: 100
      },
      timeoutPolicy: {
        chunkTimeoutMs: 10000,
        sessionTimeoutMs: 60000,
        gracefulShutdownMs: 1000
      }
    }
  }

  private createStagingProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 4,
      chunkBatchSize: 8,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 5000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 600000,
        gracefulShutdownMs: 5000
      }
    }
  }

  private createProductionProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 4,
      chunkBatchSize: 8,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 10000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 600000,
        gracefulShutdownMs: 5000
      },
      priorityPolicy: {
        enablePriorityQueuing: true,
        priorityThreshold: 7,
        highPriorityWeight: 3.0
      }
    }
  }

  private createHighPerformanceProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 16,
      chunkBatchSize: 32,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelayMs: 200,
        maxDelayMs: 1000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 10000,
        sessionTimeoutMs: 300000,
        gracefulShutdownMs: 2000
      }
    }
  }

  private createMemoryConstrainedProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 1,
      chunkBatchSize: 2,
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        baseDelayMs: 2000,
        maxDelayMs: 30000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 60000,
        sessionTimeoutMs: 1800000,
        gracefulShutdownMs: 15000
      }
    }
  }

  private createLowLatencyProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 8,
      chunkBatchSize: 1,
      retryPolicy: {
        maxAttempts: 1,
        backoffStrategy: 'constant',
        baseDelayMs: 50,
        maxDelayMs: 50
      },
      timeoutPolicy: {
        chunkTimeoutMs: 5000,
        sessionTimeoutMs: 30000,
        gracefulShutdownMs: 500
      }
    }
  }

  private createBatchProcessingProfile(): Partial<GenerationSession.SessionConfiguration> {
    return {
      maxConcurrentChunks: 8,
      chunkBatchSize: 64,
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        baseDelayMs: 5000,
        maxDelayMs: 60000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 120000,
        sessionTimeoutMs: 3600000,
        gracefulShutdownMs: 30000
      }
    }
  }

  // 優先化適用
  private applyPrioritization(
    builder: SessionConfigurationBuilder,
    prioritizeFor: 'speed' | 'memory' | 'stability' | 'quality'
  ): Effect.Effect<SessionConfigurationBuilder, SessionFactoryError> {
    return Function.pipe(
      Match.value(prioritizeFor),
      Match.when('speed', () => Effect.succeed(
        builder
          .withConcurrency(16, 32)
          .withTimeouts(5000, 60000, 1000)
          .withRetry(1, 'constant', 100)
      )),
      Match.when('memory', () => Effect.succeed(
        builder
          .withConcurrency(1, 2)
          .withTimeouts(60000, 1800000, 15000)
          .withRetry(5, 'exponential', 2000, 30000)
      )),
      Match.when('stability', () => Effect.succeed(
        builder
          .withConcurrency(2, 4)
          .withTimeouts(45000, 900000, 10000)
          .withRetry(5, 'exponential', 2000, 30000)
          .withPriority(true, 3, 4.0)
      )),
      Match.when('quality', () => Effect.succeed(
        builder
          .withConcurrency(1, 1)
          .withTimeouts(120000, 3600000, 30000)
          .withRetry(3, 'exponential', 3000, 60000)
      )),
      Match.orElse(() => Effect.succeed(builder))
    )
  }
}

// ================================
// Factory Functions
// ================================

/**
 * 新しい設定ビルダー作成
 */
export const createConfigurationBuilder = (): SessionConfigurationBuilder =>
  new SessionConfigurationBuilderImpl()

/**
 * プロファイルベース設定ビルダー作成
 */
export const createConfigurationBuilderForProfile = (
  profile: ConfigurationProfile
): SessionConfigurationBuilder =>
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
    hasSIMD: true // 仮定
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
    networkThroughput: 0 // デフォルト値
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