/**
 * @fileoverview World Domain Factory Layer - 統合エクスポート
 *
 * World Domainの全Factoryを統合し、一貫性のあるAPIを提供します。
 * DDD原理主義に基づく高品質なオブジェクト生成システムです。
 *
 * ## 提供Factory
 * - WorldGeneratorFactory: WorldGenerator集約の生成
 * - GenerationSessionFactory: GenerationSession集約の生成
 * - BiomeSystemFactory: BiomeSystem集約の生成
 * - WorldConfigurationFactory: 世界設定の統合管理
 *
 * ## 使用例
 * ```typescript
 * import { WorldDomainFactoryLayer } from './factory'
 *
 * const program = Effect.gen(function* () {
 *   // WorldGenerator作成
 *   const worldGenerator = yield* createQuickGenerator()
 *
 *   // GenerationSession作成
 *   const session = yield* createQuickSession(coordinates)
 *
 *   // BiomeSystem作成
 *   const biomeSystem = yield* createDefaultBiomeSystem()
 *
 *   // 統合設定作成
 *   const config = yield* createQuickConfiguration()
 * })
 *
 * Effect.provide(program, WorldDomainFactoryLayer)
 * ```
 */

// ================================
// WorldGeneratorFactory
// ================================

export {
  checkPresetCompatibility,
  createBalancedBuilder,
  createBuilder,
  createBuilderFromGenerator,
  createBuilderFromParams,
  createBuilderFromPreset,
  createCustomBuilder,
  createCustomPreset,
  createDevGenerator,
  createFastBuilder,
  createFastGenerator,
  createFromPreset as createGeneratorFromPreset,
  createQualityBuilder,
  createQualityGenerator,
  // Convenience Functions
  createQuickGenerator,
  // Error Types
  FactoryError,
  getPreset,
  getPresetInfo,
  getPresetParams,
  getRecommendedPreset,
  listPresets,
  listPresetsByCategory,
  validateParams,
  validateParamsQuick,
  validateWithPerformanceAnalysis,
  WorldGeneratorFactoryCompleteLayer,
  WorldGeneratorFactoryLive,
  WorldGeneratorFactoryTag,
  type CloneParams,
  type CreateFromPresetParams,
  type CreateFromSeedParams,
  // Parameters & Types
  type CreateWorldGeneratorParams,
  // Presets System
  type PresetDefinition,
  type PresetType,
  // Validation System
  type ValidationIssue,
  type ValidationLevel,
  type ValidationResult,
  // Builder Pattern
  type WorldGeneratorBuilder,
  // Main Factory
  type WorldGeneratorFactory,
} from './world_generator_factory/index.js'

// ================================
// GenerationSessionFactory
// ================================

export {
  createAdaptiveSession,
  createAreaSession,
  createBatchSession,
  createConfigurationBuilder,
  createConfigurationBuilderForProfile,
  createExplorationSession,
  createOptimizedConfiguration,
  createQualitySession,
  // Convenience Functions
  createQuickSession,
  createResilientSession,
  createSessionBuilder,
  createSessionBuilderForArea,
  createSessionBuilderForCoordinates,
  createSessionBuilderFromTemplate,
  createFromTemplate as createSessionFromTemplate,
  createSingleChunkSession,
  createStreamingSession,
  detectHardwareSpec,
  GenerationSessionFactoryCompleteLayer,
  GenerationSessionFactoryLive,
  GenerationSessionFactoryTag,
  getCurrentLoadCondition,
  getTemplate,
  listTemplates,
  searchTemplates,
  // Error Types
  SessionFactoryError,
  SessionTemplateResolverLive,
  // Configuration Management
  type ConfigurationProfile,
  type CreateBatchSessionParams,
  type CreateFromTemplateParams,
  // Parameters & Types
  type CreateSessionParams,
  // Builder Pattern
  type GenerationSessionBuilder,
  // Main Factory
  type GenerationSessionFactory,
  type HardwareSpec,
  type LoadCondition,
  type OptimizationParams,
  type RecoverSessionParams,
  type SessionConfigurationBuilder,
  // Template System
  type SessionTemplateDefinition,
  type SessionTemplateResolver,
  type SessionTemplateType,
  type TemplateResolutionResult,
} from './generation_session_factory/index.js'

// ================================
// BiomeSystemFactory
// ================================

export {
  assembleEcosystem,
  // Error Types
  BiomeFactoryError,
  BiomeSystemFactoryLive,
  BiomeSystemFactoryTag,
  // Helper Functions
  calculateClimate,
  createBiomeSystemBuilder,
  // Convenience Functions
  createDefaultBiomeSystem,
  createSimpleBiomeSystem,
  // Builder Pattern
  type BiomeSystemBuilder,
  // Main Factory
  type BiomeSystemFactory,
  // Parameters & Types
  type CreateBiomeSystemParams,
} from './biome_system_factory/index.js'

// ================================
// WorldConfigurationFactory
// ================================

export {
  // Error Types
  ConfigurationFactoryError,
  // Convenience Functions
  createQuickConfiguration,
  createWorldConfigurationBuilder,
  WorldConfigurationFactoryLive,
  WorldConfigurationFactoryTag,
  WorldConfigurationSchema,
  type CreateConfigurationParams,
  // Configuration Types
  type WorldConfiguration,
  // Builder Pattern
  type WorldConfigurationBuilder,
  // Main Factory
  type WorldConfigurationFactory,
} from './world_configuration_factory/index.js'

// ================================
// Layer Integration
// ================================

import { Layer } from 'effect'
import { BiomeSystemFactoryLive } from './biome_system_factory/index.js'
import { GenerationSessionFactoryLive } from './generation_session_factory/index.js'
import { WorldConfigurationFactoryLive } from './world_configuration_factory/index.js'
import { WorldGeneratorFactoryLive } from './world_generator_factory/index.js'

/**
 * World Domain Factory統合Layer
 * 全てのFactoryを統合した単一のLayerです。
 */
export const WorldDomainFactoryLayer = Layer.mergeAll(
  WorldGeneratorFactoryLive,
  GenerationSessionFactoryLive,
  BiomeSystemFactoryLive,
  WorldConfigurationFactoryLive
)

/**
 * 設定可能なFactory Layer
 */
export interface WorldFactoryConfig {
  readonly enableWorldGenerator: boolean
  readonly enableGenerationSession: boolean
  readonly enableBiomeSystem: boolean
  readonly enableWorldConfiguration: boolean
  readonly enableValidation: boolean
  readonly enableMetrics: boolean
}

export const defaultWorldFactoryConfig: WorldFactoryConfig = {
  enableWorldGenerator: true,
  enableGenerationSession: true,
  enableBiomeSystem: true,
  enableWorldConfiguration: true,
  enableValidation: true,
  enableMetrics: true,
}

/**
 * 設定可能なFactory Layer作成
 */
export const createWorldDomainFactoryLayer = (
  config: Partial<WorldFactoryConfig> = {}
): Layer.Layer<never, never, any> => {
  const finalConfig = { ...defaultWorldFactoryConfig, ...config }

  const layers: Layer.Layer<never, never, any>[] = []

  if (finalConfig.enableWorldGenerator) {
    layers.push(WorldGeneratorFactoryLive)
  }

  if (finalConfig.enableGenerationSession) {
    layers.push(GenerationSessionFactoryLive)
  }

  if (finalConfig.enableBiomeSystem) {
    layers.push(BiomeSystemFactoryLive)
  }

  if (finalConfig.enableWorldConfiguration) {
    layers.push(WorldConfigurationFactoryLive)
  }

  return Layer.mergeAll(...layers)
}

// ================================
// Convenience Workflows
// ================================

import { Effect } from 'effect'
import type * as Coordinates from '../value_object/coordinates/index.js'
import { createDefaultBiomeSystem } from './biome_system_factory/index.js'
import { createQuickSession } from './generation_session_factory/index.js'
import { createQuickConfiguration } from './world_configuration_factory/index.js'
import { createQuickGenerator } from './world_generator_factory/index.js'

/**
 * 完全な世界生成セットアップ
 * Generator + Session + BiomeSystem + Configuration
 */
export const createCompleteWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
    biomeSystem: any
    configuration: any
  },
  never
> =>
  Effect.gen(function* () {
    // 並列でFactoryを実行
    const [generator, session, biomeSystem, configuration] = yield* Effect.all([
      createQuickGenerator(),
      createQuickSession(coordinates),
      createDefaultBiomeSystem(),
      createQuickConfiguration(),
    ])

    return {
      generator,
      session,
      biomeSystem,
      configuration,
    }
  })

/**
 * 高速世界生成セットアップ
 * パフォーマンス重視
 */
export const createFastWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
  },
  never
> =>
  Effect.gen(function* () {
    const [generator, session] = yield* Effect.all([createFastGenerator(), createExplorationSession(coordinates)])

    return { generator, session }
  })

/**
 * 品質重視世界生成セットアップ
 * 最高品質の生成
 */
export const createQualityWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
    biomeSystem: any
  },
  never
> =>
  Effect.gen(function* () {
    const [generator, session, biomeSystem] = yield* Effect.all([
      createQualityGenerator(),
      createQualitySession(coordinates),
      createDefaultBiomeSystem(),
    ])

    return { generator, session, biomeSystem }
  })

// ================================
// Testing Utilities
// ================================

/**
 * テスト用Factory Layer
 */
export const createTestWorldFactoryLayer = () =>
  Layer.mergeAll(
    Layer.succeed(WorldGeneratorFactoryTag, {} as any),
    Layer.succeed(GenerationSessionFactoryTag, {} as any),
    Layer.succeed(BiomeSystemFactoryTag, {} as any),
    Layer.succeed(WorldConfigurationFactoryTag, {} as any)
  )

// ================================
// Version Information
// ================================

export const WORLD_DOMAIN_FACTORY_VERSION = '1.0.0'
export const SUPPORTED_FACTORY_TYPES = [
  'WorldGeneratorFactory',
  'GenerationSessionFactory',
  'BiomeSystemFactory',
  'WorldConfigurationFactory',
] as const

export const FACTORY_LAYER_FEATURES = [
  'DDD Factory Pattern',
  'Builder Pattern Support',
  'Template System',
  'Configuration Management',
  'Validation System',
  'Performance Optimization',
  'Error Recovery',
  'Type Safety',
] as const

// ================================
// Factory Summary
// ================================

/**
 * Factory統計情報取得
 */
export const getFactoryStatistics = (): Effect.Effect<
  {
    factoryCount: number
    builderCount: number
    templateCount: number
    presetCount: number
  },
  never
> =>
  Effect.succeed({
    factoryCount: SUPPORTED_FACTORY_TYPES.length,
    builderCount: 4, // 各FactoryにBuilder
    templateCount: 7, // SessionTemplateの数
    presetCount: 10, // WorldGeneratorPresetの数
  })

// ================================
// Re-export Common Types
// ================================

export type {
  BiomeSystem,
  GenerationSession,
  // From aggregates
  WorldGenerator,
} from '../aggregate/index.js'

export type {
  BiomeConfiguration,
  GenerationParameters,
  NoiseConfiguration,
  // From value objects
  WorldSeed,
} from '../value_object/index.js'
