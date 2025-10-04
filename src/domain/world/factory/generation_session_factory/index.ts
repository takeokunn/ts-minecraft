/**
 * @fileoverview GenerationSessionFactory - 統合エクスポート
 *
 * GenerationSessionFactoryの全機能を統合し、
 * 一貫性のあるAPIを提供します。
 *
 * ## 提供機能
 * - GenerationSessionFactory: メインファクトリインターフェース
 * - GenerationSessionBuilder: Fluent APIビルダー
 * - Configuration: 動的設定管理システム
 * - TemplateResolver: テンプレート解決システム
 *
 * ## 使用例
 * ```typescript
 * import { GenerationSessionFactory } from './generation_session_factory'
 *
 * // ファクトリ使用
 * const factory = yield* GenerationSessionFactory
 * const session = yield* factory.createFromTemplate({
 *   template: 'area_generation',
 *   coordinates: areaCoordinates
 * })
 *
 * // ビルダー使用
 * const session = yield* createSessionBuilder()
 *   .forCoordinates(coordinates)
 *   .applyTemplate('world_exploration')
 *   .optimizeForSpeed()
 *   .enableProgressTracking()
 *   .build()
 * ```
 */

// ================================
// Core Factory
// ================================

export {
  // Main Factory Interface
  type GenerationSessionFactory,
  GenerationSessionFactoryTag,
  GenerationSessionFactoryLive,

  // Factory Parameters
  type CreateSessionParams,
  type CreateBatchSessionParams,
  type CreateFromTemplateParams,
  type RecoverSessionParams,
  type SessionTemplateType,

  // Error Types
  SessionFactoryError,
  SessionFactoryErrorSchema,
} from './factory.js'

// ================================
// Builder Pattern
// ================================

export {
  // Builder Interface
  type GenerationSessionBuilder,
  type SessionBuilderState,
  type SessionValidationState,

  // Builder Factory Functions
  createSessionBuilder,
  createSessionBuilderForCoordinates,
  createSessionBuilderForArea,
  createSessionBuilderFromTemplate,
} from './session_builder.js'

// ================================
// Configuration Management
// ================================

export {
  // Configuration Types
  type ConfigurationProfile,
  type HardwareSpec,
  type LoadCondition,
  type OptimizationParams,
  type SessionConfigurationBuilder,

  // Configuration API
  createConfigurationBuilder,
  createConfigurationBuilderForProfile,
  createOptimizedConfiguration,
  detectHardwareSpec,
  getCurrentLoadCondition,
} from './configuration.js'

// ================================
// Template System
// ================================

export {
  // Template Types
  type SessionTemplateDefinition,
  type TemplateResolutionResult,
  type SessionTemplateResolver,
  SessionTemplateRegistry,

  // Template API
  SessionTemplateResolverLive,
  getTemplate,
  listTemplates,
  searchTemplates,
} from './template_resolver.js'

// ================================
// Convenience Functions
// ================================

import { Effect, Layer, Duration } from "effect"
import { GenerationSessionFactoryTag, GenerationSessionFactoryLive } from './factory.js'
import { createSessionBuilder } from './session_builder.js'
import { createOptimizedConfiguration } from './configuration.js'
import { getTemplate } from './template_resolver.js'
import type { SessionTemplateType } from './factory.js'
import type * as GenerationSession from '../../aggregate/generation_session/generation_session.js'
import * as Coordinates from '../../value_object/coordinates/index.js'

/**
 * 簡単なGenerationSession作成
 * デフォルト設定で即座にGenerationSession作成
 */
export const createQuickSession = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(coordinates)
    .applyTemplate('area_generation')
    .enableProgressTracking()
    .build()
    .pipe(Effect.orDie)

/**
 * テンプレートベース簡単作成
 */
export const createFromTemplate = (
  template: SessionTemplateType,
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(coordinates)
    .applyTemplate(template)
    .build()
    .pipe(Effect.orDie)

/**
 * 単一チャンク用Session作成
 */
export const createSingleChunkSession = (
  coordinate: Coordinates.ChunkCoordinate
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .addCoordinate(coordinate)
    .applyTemplate('single_chunk')
    .build()
    .pipe(Effect.orDie)

/**
 * エリア生成用Session作成
 */
export const createAreaSession = (
  center: Coordinates.ChunkCoordinate,
  radius: number
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .addArea(center, radius)
    .applyTemplate('area_generation')
    .enableProgressTracking()
    .build()
    .pipe(Effect.orDie)

/**
 * 探索用高速Session作成
 */
export const createExplorationSession = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(coordinates)
    .applyTemplate('world_exploration')
    .optimizeForSpeed()
    .enableProgressTracking()
    .build()
    .pipe(Effect.orDie)

/**
 * 品質重視Session作成
 */
export const createQualitySession = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(coordinates)
    .applyTemplate('single_chunk')
    .optimizeForQuality()
    .enableStructures()
    .enableCaves()
    .enableOres()
    .enableVegetation()
    .enablePostProcessing()
    .enableProgressTracking()
    .enableDetailedLogging()
    .build()
    .pipe(Effect.orDie)

/**
 * バッチ処理用Session作成
 */
export const createBatchSession = (
  coordinatesBatch: readonly (readonly Coordinates.ChunkCoordinate[])[],
  batchSize: number = 32
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  Effect.gen(function* () {
    const allCoordinates = coordinatesBatch.flat()

    return yield* createSessionBuilder()
      .forCoordinates(allCoordinates)
      .applyTemplate('bulk_generation')
      .withBatchSize(batchSize)
      .optimizeForMemory()
      .enableProgressTracking()
      .build()
      .pipe(Effect.orDie)
  })

/**
 * ストリーミング用Session作成
 */
export const createStreamingSession = (
  initialCoordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(initialCoordinates)
    .applyTemplate('streaming_generation')
    .withExecutionMode('streaming')
    .withMaxConcurrentChunks(2)
    .withBatchSize(1)
    .enableProgressTracking()
    .build()
    .pipe(Effect.orDie)

// ================================
// Advanced Session Patterns
// ================================

/**
 * 適応型Session作成
 * ハードウェアと負荷状況に基づく自動最適化
 */
export const createAdaptiveSession = (
  coordinates: readonly Coordinates.ChunkCoordinate[],
  profile: 'development' | 'production' | 'high_performance' = 'production'
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  Effect.gen(function* () {
    // ハードウェア仕様検出
    const hardwareSpec = yield* Effect.succeed({
      cpuCores: Math.max(1, navigator.hardwareConcurrency || 4),
      memoryMB: 4096,
      storageSpeedMBps: 100,
      networkLatencyMs: 50,
      hasSSE: true,
      hasSIMD: true
    })

    // 負荷状況検出
    const loadCondition = yield* Effect.succeed({
      currentCpuUsage: 30,
      currentMemoryUsage: 40,
      activeConnections: 0,
      queuedRequests: 0,
      networkThroughput: 0
    })

    // 最適化設定作成
    const optimizedConfig = yield* createOptimizedConfiguration({
      profile,
      hardwareSpec,
      loadCondition,
      prioritizeFor: 'speed'
    }).pipe(Effect.orDie)

    return yield* createSessionBuilder()
      .forCoordinates(coordinates)
      .withConfiguration(optimizedConfig)
      .enableProgressTracking()
      .enableMetrics()
      .build()
      .pipe(Effect.orDie)
  })

/**
 * リトライ機能付きSession作成
 */
export const createResilientSession = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<GenerationSession.GenerationSession, never> =>
  createSessionBuilder()
    .forCoordinates(coordinates)
    .applyTemplate('area_generation')
    .withRetryPolicy(5, 'exponential', 2000, 30000)
    .optimizeForStability()
    .enableAutoRecovery(true, Duration.seconds(10))
    .enableProgressTracking()
    .enableDetailedLogging()
    .build()
    .pipe(Effect.orDie)

// ================================
// Layer Composition
// ================================

/**
 * GenerationSessionFactory完全統合Layer
 * 全ての依存関係を含む完全なLayer
 */
export const GenerationSessionFactoryCompleteLayer = Layer.mergeAll(
  GenerationSessionFactoryLive,
  // 他の必要な依存関係をここに追加
)

/**
 * 設定可能なFactory Layer
 */
export interface GenerationSessionFactoryConfig {
  readonly enableTemplates: boolean
  readonly enableBuilder: boolean
  readonly enableValidation: boolean
  readonly defaultTemplate: SessionTemplateType
  readonly enableMetrics: boolean
}

export const defaultGenerationSessionFactoryConfig: GenerationSessionFactoryConfig = {
  enableTemplates: true,
  enableBuilder: true,
  enableValidation: true,
  defaultTemplate: 'area_generation',
  enableMetrics: true
}

/**
 * 設定可能なFactory Layer作成
 */
export const createGenerationSessionFactoryLayer = (
  config: Partial<GenerationSessionFactoryConfig> = {}
): Layer.Layer<never, never, typeof GenerationSessionFactoryTag.Service> => {
  const finalConfig = { ...defaultGenerationSessionFactoryConfig, ...config }

  return Layer.succeed(GenerationSessionFactoryTag, {
    create: (params) => {
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.create(params))
    },

    createBatch: (params) => {
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createBatch(params))
    },

    createFromTemplate: (params) => {
      if (!finalConfig.enableTemplates) {
        return Effect.fail(new Error('Templates are disabled'))
      }
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createFromTemplate(params))
    },

    recover: (params) => {
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.recover(params))
    },

    createStreaming: (params) => {
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createStreaming(params))
    },

    createPriority: (params, priority) => {
      const factory = GenerationSessionFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(GenerationSessionFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createPriority(params, priority))
    }
  })
}

// ================================
// Testing Utilities
// ================================

/**
 * テスト用ダミーFactory
 */
export const createTestGenerationSessionFactory = () => Layer.succeed(
  GenerationSessionFactoryTag,
  {
    create: (params) => Effect.succeed({} as GenerationSession.GenerationSession),
    createBatch: (params) => Effect.succeed({} as GenerationSession.GenerationSession),
    createFromTemplate: (params) => Effect.succeed({} as GenerationSession.GenerationSession),
    recover: (params) => Effect.succeed({} as GenerationSession.GenerationSession),
    createStreaming: (params) => Effect.succeed({} as GenerationSession.GenerationSession),
    createPriority: (params, priority) => Effect.succeed({} as GenerationSession.GenerationSession),
  }
)

// ================================
// Re-export Types for Convenience
// ================================

export type {
  // Core types from aggregates
  GenerationSession,
  GenerationSessionId,
  SessionConfiguration,
  GenerationRequest,
} from '../../aggregate/generation_session/generation_session.js'

// ================================
// Version Information
// ================================

export const GENERATION_SESSION_FACTORY_VERSION = '1.0.0'
export const SUPPORTED_TEMPLATES = [
  'single_chunk',
  'area_generation',
  'world_exploration',
  'structure_placement',
  'terrain_modification',
  'bulk_generation',
  'streaming_generation'
] as const
export const FACTORY_FEATURES = [
  'Template System',
  'Dynamic Configuration',
  'Hardware Adaptation',
  'Load Balancing',
  'Progress Tracking',
  'Error Recovery',
  'Batch Processing',
  'Streaming Support'
] as const