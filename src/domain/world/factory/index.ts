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
 * import { WorldDomainFactoryLayer } from '@domain/world/factory'
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
} from './world_generator_factory/index'

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
} from './generation_session_factory/index'

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
} from './biome_system_factory/index'

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
} from './world_configuration_factory/index'

// ================================
// Layer Integration
// ================================

export * from './layer'

import { Layer } from 'effect'
import { BiomeSystemFactoryLive } from './biome_system_factory/index'
import { GenerationSessionFactoryLive } from './generation_session_factory/index'
import { WorldConfigurationFactoryLive } from './world_configuration_factory/index'
import { WorldGeneratorFactoryLive } from './world_generator_factory/index'

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

export * from './helpers'

// ================================
// Testing Utilities
// ================================

// Exported from ./layer

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
// (Exported from helpers.ts)

// ================================
// Re-export Common Types
// ================================

export type {
  BiomeSystem,
  GenerationSession,
  // From aggregates
  WorldGenerator,
} from '@domain/world/aggregate'

export type {
  BiomeConfiguration,
  GenerationParameters,
  NoiseConfiguration,
  // From value objects
  WorldSeed,
} from '@domain/world/value_object'
