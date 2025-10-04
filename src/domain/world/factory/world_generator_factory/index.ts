/**
 * @fileoverview WorldGeneratorFactory - 統合エクスポート
 *
 * WorldGeneratorFactoryの全機能を統合し、
 * 一貫性のあるAPIを提供します。
 *
 * ## 提供機能
 * - WorldGeneratorFactory: メインファクトリインターフェース
 * - WorldGeneratorBuilder: Fluent APIビルダー
 * - Presets: 事前定義された設定パターン
 * - Validation: 包括的な検証システム
 *
 * ## 使用例
 * ```typescript
 * import { WorldGeneratorFactory } from './world_generator_factory'
 *
 * // ファクトリ使用
 * const factory = yield* WorldGeneratorFactory
 * const generator = yield* factory.createFromPreset({ preset: 'survival' })
 *
 * // ビルダー使用
 * const generator = yield* createBuilder()
 *   .withRandomSeed()
 *   .applyPreset('creative')
 *   .enableStructures()
 *   .optimizeForPerformance()
 *   .build()
 * ```
 */

// ================================
// Core Factory
// ================================

export {
  // Main Factory Interface
  type WorldGeneratorFactory,
  WorldGeneratorFactoryTag,
  WorldGeneratorFactoryLive,

  // Factory Parameters
  type CreateWorldGeneratorParams,
  type CreateFromPresetParams,
  type CreateFromSeedParams,
  type CloneParams,
  type PresetType,

  // Error Types
  FactoryError,
  FactoryErrorSchema,
} from './factory.js'

// ================================
// Builder Pattern
// ================================

export {
  // Builder Interface
  type WorldGeneratorBuilder,
  type BuilderState,
  type ValidationState,

  // Builder Factory Functions
  createBuilder,
  createBuilderFromParams,
  createBuilderFromGenerator,
  createBuilderFromPreset,

  // Common Builder Patterns
  createFastBuilder,
  createQualityBuilder,
  createBalancedBuilder,
  createCustomBuilder,
} from './builder.js'

// ================================
// Presets System
// ================================

export {
  // Preset Types
  type PresetDefinition,
  PresetRegistry,

  // Preset API
  getPreset,
  getPresetParams,
  listPresets,
  listPresetsByCategory,
  getPresetInfo,
  checkPresetCompatibility,
  getRecommendedPreset,
  createCustomPreset,
} from './presets.js'

// ================================
// Validation System
// ================================

export {
  // Validation Types
  type ValidationIssue,
  type ValidationResult,
  type ValidationLevel,
  type ValidationSeverity,
  type ValidationCategory,

  // Validation API
  validateParams,
  validateParamsQuick,
  validateWithPerformanceAnalysis,
} from './validation.js'

// ================================
// Convenience Functions
// ================================

import { Effect, Layer } from "effect"
import { WorldGeneratorFactoryTag, WorldGeneratorFactoryLive } from './factory.js'
import { createBuilder } from './builder.js'
import { getPresetParams } from './presets.js'
import type { PresetType } from './factory.js'
import type * as WorldGenerator from '../../aggregate/world_generator/world_generator.js'

/**
 * 簡単なWorldGenerator作成
 * デフォルト設定で即座にWorldGenerator作成
 */
export const createQuickGenerator = (seed?: string | number): Effect.Effect<WorldGenerator.WorldGenerator, never> =>
  createBuilder()
    .withSeed(seed ?? Math.random() * 1000000)
    .withDefaultParameters()
    .withDefaultBiomes()
    .withDefaultNoise()
    .optimizeForBalance()
    .buildWithDefaults()

/**
 * プリセットベース簡単作成
 */
export const createFromPreset = (preset: PresetType, seed?: string | number): Effect.Effect<WorldGenerator.WorldGenerator, never> =>
  createBuilder()
    .applyPreset(preset)
    .when(seed !== undefined, builder => builder.withSeed(seed!))
    .buildWithDefaults()

/**
 * 開発用高速Generator作成
 */
export const createDevGenerator = (): Effect.Effect<WorldGenerator.WorldGenerator, never> =>
  createBuilder()
    .withRandomSeed()
    .applyPreset('debug')
    .optimizeForDevelopment()
    .enableDebugMode()
    .buildWithDefaults()

/**
 * 品質重視Generator作成
 */
export const createQualityGenerator = (seed?: string | number): Effect.Effect<WorldGenerator.WorldGenerator, never> =>
  createBuilder()
    .withSeed(seed ?? Date.now())
    .applyPreset('survival')
    .optimizeForQuality()
    .enableStructures()
    .enableCaves()
    .enableOres()
    .buildWithDefaults()

/**
 * パフォーマンス重視Generator作成
 */
export const createFastGenerator = (seed?: string | number): Effect.Effect<WorldGenerator.WorldGenerator, never> =>
  createBuilder()
    .withSeed(seed ?? Date.now())
    .applyPreset('creative')
    .optimizeForPerformance()
    .buildWithDefaults()

// ================================
// Layer Composition
// ================================

/**
 * WorldGeneratorFactory完全統合Layer
 * 全ての依存関係を含む完全なLayer
 */
export const WorldGeneratorFactoryCompleteLayer = Layer.mergeAll(
  WorldGeneratorFactoryLive,
  // 他の必要な依存関係をここに追加
)

/**
 * 設定可能なFactory Layer
 */
export interface WorldGeneratorFactoryConfig {
  readonly enablePresets: boolean
  readonly enableValidation: boolean
  readonly enableBuilder: boolean
  readonly defaultPreset: PresetType
}

export const defaultWorldGeneratorFactoryConfig: WorldGeneratorFactoryConfig = {
  enablePresets: true,
  enableValidation: true,
  enableBuilder: true,
  defaultPreset: 'default'
}

/**
 * 設定可能なFactory Layer作成
 */
export const createWorldGeneratorFactoryLayer = (
  config: Partial<WorldGeneratorFactoryConfig> = {}
): Layer.Layer<never, never, typeof WorldGeneratorFactoryTag.Service> => {
  const finalConfig = { ...defaultWorldGeneratorFactoryConfig, ...config }

  return Layer.succeed(WorldGeneratorFactoryTag, {
    create: (params) => {
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.create(params))
    },

    createFromPreset: (params) => {
      if (!finalConfig.enablePresets) {
        return Effect.fail(new Error('Presets are disabled'))
      }
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createFromPreset(params))
    },

    createFromSeed: (params) => {
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createFromSeed(params))
    },

    clone: (params) => {
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.clone(params))
    },

    createBatch: (configs) => {
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createBatch(configs))
    },

    createValidated: (params, validationLevel) => {
      if (!finalConfig.enableValidation) {
        // 検証スキップして直接作成
        const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
          Effect.provide(WorldGeneratorFactoryTag, layer)
        ))
        return Effect.flatMap(factory, service => service.create(params))
      }
      const factory = WorldGeneratorFactoryLive.pipe(Layer.build, Effect.flatMap(layer =>
        Effect.provide(WorldGeneratorFactoryTag, layer)
      ))
      return Effect.flatMap(factory, service => service.createValidated(params, validationLevel))
    }
  })
}

// ================================
// Testing Utilities
// ================================

/**
 * テスト用ダミーFactory
 * テスト環境での使用専用
 */
export const createTestWorldGeneratorFactory = () => Layer.succeed(
  WorldGeneratorFactoryTag,
  {
    create: (params) => Effect.succeed({} as WorldGenerator.WorldGenerator),
    createFromPreset: (params) => Effect.succeed({} as WorldGenerator.WorldGenerator),
    createFromSeed: (params) => Effect.succeed({} as WorldGenerator.WorldGenerator),
    clone: (params) => Effect.succeed({} as WorldGenerator.WorldGenerator),
    createBatch: (configs) => Effect.succeed([]),
    createValidated: (params, level) => Effect.succeed({} as WorldGenerator.WorldGenerator),
  }
)

/**
 * モックFactory作成
 * テスト時の特定動作を制御
 */
export const createMockWorldGeneratorFactory = (
  mockImplementation: Partial<typeof WorldGeneratorFactoryTag.Service>
) => Layer.succeed(
  WorldGeneratorFactoryTag,
  {
    create: mockImplementation.create ?? (() => Effect.succeed({} as WorldGenerator.WorldGenerator)),
    createFromPreset: mockImplementation.createFromPreset ?? (() => Effect.succeed({} as WorldGenerator.WorldGenerator)),
    createFromSeed: mockImplementation.createFromSeed ?? (() => Effect.succeed({} as WorldGenerator.WorldGenerator)),
    clone: mockImplementation.clone ?? (() => Effect.succeed({} as WorldGenerator.WorldGenerator)),
    createBatch: mockImplementation.createBatch ?? (() => Effect.succeed([])),
    createValidated: mockImplementation.createValidated ?? (() => Effect.succeed({} as WorldGenerator.WorldGenerator)),
  }
)

// ================================
// Re-export Types for Convenience
// ================================

export type {
  // Core types from aggregates
  WorldGenerator,
  WorldGeneratorId,
  GenerationContext,
  GenerateChunkCommand,
  UpdateSettingsCommand,
} from '../../aggregate/world_generator/world_generator.js'

// ================================
// Version Information
// ================================

export const WORLD_GENERATOR_FACTORY_VERSION = '1.0.0'
export const SUPPORTED_MINECRAFT_VERSIONS = ['1.20+', '1.21+'] as const
export const FACTORY_FEATURES = [
  'Fluent API Builder',
  'Comprehensive Presets',
  'Advanced Validation',
  'Performance Analysis',
  'Batch Generation',
  'Custom Configuration'
] as const