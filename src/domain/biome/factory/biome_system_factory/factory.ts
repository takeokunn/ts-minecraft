/**
 * @fileoverview BiomeSystemFactory - DDD原理主義実装
 *
 * BiomeSystem集約の複雑な生成ロジックを抽象化し、
 * バイオーム分類とエコシステム構築を統合するファクトリです。
 *
 * ## 責務
 * - BiomeSystem集約の構築
 * - 気候モデルの計算と適用
 * - 生態系の組立と管理
 * - バイオーム遷移の設定
 * - 環境バランスの調整
 * - プリセット管理とカスタマイズ
 * - パフォーマンス最適化
 * - 並列処理と大規模データ対応
 */

import type * as BiomeSystem from '@/domain/biome/aggregate/biome_system'
import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import * as Coordinates from '@/domain/biome/value_object/coordinates/index'
import { JsonValueSchema, type JsonRecord } from '@shared/schema/json'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Context, Effect, Function, Layer, Match, Schema } from 'effect'

// ================================
// Factory Error Types
// ================================

export const BiomeFactoryErrorSchema = Schema.TaggedError('BiomeFactoryError', {
  category: Schema.Literal('biome_creation', 'climate_calculation', 'ecosystem_assembly'),
  message: Schema.String,
  context: Schema.optional(Schema.Record({ key: Schema.String, value: JsonValueSchema })),
})

export type BiomeFactoryError = Schema.Schema.Type<typeof BiomeFactoryErrorSchema>

type BiomeFactoryErrorExtras = Partial<Omit<BiomeFactoryError, 'category' | 'message'>>

const makeBiomeFactoryError = (
  category: BiomeFactoryError['category'],
  message: string,
  extras?: BiomeFactoryErrorExtras
): BiomeFactoryError =>
  BiomeFactoryErrorSchema.make({
    category,
    message,
    ...extras,
  })

export const BiomeFactoryError = {
  ...makeErrorFactory(BiomeFactoryErrorSchema),
  biomeCreation: (message: string, extras?: BiomeFactoryErrorExtras) =>
    makeBiomeFactoryError('biome_creation', message, extras),
  climateCalculation: (message: string, extras?: BiomeFactoryErrorExtras) =>
    makeBiomeFactoryError('climate_calculation', message, extras),
  ecosystemAssembly: (message: string, extras?: BiomeFactoryErrorExtras) =>
    makeBiomeFactoryError('ecosystem_assembly', message, extras),
} as const

// ================================
// Factory Parameters
// ================================

// ================================
// Advanced Types
// ================================

export const BiomePresetTypeSchema = Schema.Literal(
  'default',
  'vanilla',
  'amplified',
  'superflat',
  'void',
  'desert_only',
  'ocean_only',
  'forest_only',
  'mountain_only',
  'tropical',
  'arctic',
  'temperate',
  'continental'
)
export type BiomePresetType = typeof BiomePresetTypeSchema.Type

export const PerformanceProfileSchema = Schema.Literal('fast', 'balanced', 'quality', 'ultra')
export type PerformanceProfile = typeof PerformanceProfileSchema.Type

export const OptimizationTargetSchema = Schema.Literal('memory', 'speed', 'quality', 'diversity', 'realism')
export type OptimizationTarget = typeof OptimizationTargetSchema.Type

export const ValidationLevelSchema = Schema.Literal('basic', 'standard', 'strict', 'exhaustive')
export type ValidationLevel = typeof ValidationLevelSchema.Type

export const CreateBiomeSystemParamsSchema = Schema.Struct({
  preset: Schema.optional(BiomePresetTypeSchema),
  climateConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  enableTransitions: Schema.optional(Schema.Boolean),
  ecosystemComplexity: Schema.optional(Schema.Literal('simple', 'complex', 'realistic')),
  seedValue: Schema.optional(Schema.Number),
  performanceProfile: Schema.optional(PerformanceProfileSchema),
  validationLevel: Schema.optional(ValidationLevelSchema),
  enableCaching: Schema.optional(Schema.Boolean),
  parallelProcessing: Schema.optional(Schema.Boolean),
  memoryLimit: Schema.optional(Schema.Number),
  customBiomes: Schema.optional(Schema.Array(BiomeProperties.BiomeTypeSchema)),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: JsonValueSchema,
    })
  ),
})

export type CreateBiomeSystemParams = typeof CreateBiomeSystemParamsSchema.Type

// ================================
// Validation Types
// ================================

export const ValidationIssueSchema = Schema.Struct({
  level: Schema.Literal('warning', 'error', 'critical'),
  category: Schema.Literal('climate', 'ecosystem', 'performance', 'memory'),
  message: Schema.String,
  location: Schema.optional(Schema.String),
  suggestion: Schema.optional(Schema.String),
})
export type ValidationIssue = typeof ValidationIssueSchema.Type

export const ValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  issues: Schema.Array(ValidationIssueSchema),
  score: Schema.Number.pipe(Schema.between(0, 100)),
  performance: Schema.Struct({
    memoryUsage: Schema.Number,
    processingTime: Schema.Number,
    cacheEfficiency: Schema.Number,
  }),
})
export type ValidationResult = typeof ValidationResultSchema.Type

// ================================
// BiomeSystemFactory Interface
// ================================

export interface BiomeSystemFactory {
  readonly create: (params: CreateBiomeSystemParams) => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly createFromClimate: (
    climate: BiomeProperties.ClimateData
  ) => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly createFromPreset: (preset: BiomePresetType) => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly createBalanced: () => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly createOptimized: (
    performance: PerformanceProfile
  ) => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly createBatch: (
    requests: readonly CreateBiomeSystemParams[]
  ) => Effect.Effect<readonly BiomeSystem.BiomeSystem[], BiomeFactoryError>
  readonly validate: (system: BiomeSystem.BiomeSystem) => Effect.Effect<ValidationResult, BiomeFactoryError>
  readonly optimize: (
    system: BiomeSystem.BiomeSystem,
    target: OptimizationTarget
  ) => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
}

// ================================
// Factory Implementation
// ================================

const createBiomeSystemFactory = (): BiomeSystemFactory => ({
  create: (params: CreateBiomeSystemParams) =>
    Effect.gen(function* () {
      // パラメータ検証
      const validatedParams = yield* validateCreateParams(params)

      // プリセット適用
      const effectiveParams = validatedParams.preset
        ? yield* applyPreset(validatedParams.preset, validatedParams)
        : validatedParams

      // 気候設定の構築
      const climateConfig = effectiveParams.climateConfig ?? BiomeProperties.createDefaultConfiguration()

      // パフォーマンス最適化
      const optimizedConfig = effectiveParams.performanceProfile
        ? yield* optimizeForPerformance(climateConfig, effectiveParams.performanceProfile)
        : climateConfig

      // バイオームシステム作成
      const biomeSystem = yield* Effect.tryPromise({
        try: () =>
          BiomeSystem.create({
            climate: optimizedConfig,
            transitions: effectiveParams.enableTransitions ?? true,
            complexity: effectiveParams.ecosystemComplexity ?? 'complex',
            seed: effectiveParams.seedValue,
            customBiomes: effectiveParams.customBiomes,
          }),
        catch: (error) =>
          BiomeFactoryError.biomeCreation('Failed to create BiomeSystem', {
            context: { params: effectiveParams, error },
          }),
      })

      // 検証実行
      if (effectiveParams.validationLevel) {
        const validation = yield* validateBiomeSystem(biomeSystem, effectiveParams.validationLevel)
        if (!validation.isValid && validation.issues.some((i) => i.level === 'critical')) {
          return yield* Effect.fail(
            BiomeFactoryError.ecosystemAssembly('BiomeSystem validation failed with critical issues', {
              context: { validation },
            })
          )
        }
      }

      return biomeSystem
    }),

  createFromClimate: (climate: BiomeProperties.ClimateData) =>
    Effect.gen(function* () {
      const config = BiomeProperties.createConfigurationFromClimate(climate)
      return yield* createBiomeSystemFactory().create({ climateConfig: config })
    }),

  createFromPreset: (preset: BiomePresetType) =>
    Effect.gen(function* () {
      return yield* createBiomeSystemFactory().create({ preset })
    }),

  createBalanced: () =>
    Effect.gen(function* () {
      return yield* createBiomeSystemFactory().create({
        preset: 'default',
        ecosystemComplexity: 'complex',
        performanceProfile: 'balanced',
        validationLevel: 'standard',
      })
    }),

  createOptimized: (performance: PerformanceProfile) =>
    Effect.gen(function* () {
      return yield* createBiomeSystemFactory().create({
        performanceProfile: performance,
        enableCaching: performance !== 'fast',
        parallelProcessing: performance === 'ultra',
        validationLevel: performance === 'fast' ? 'basic' : 'standard',
      })
    }),

  createBatch: (requests: readonly CreateBiomeSystemParams[]) =>
    Effect.gen(function* () {
      // 並列処理で効率化
      const results = yield* Effect.all(
        requests.map((params) => createBiomeSystemFactory().create(params)),
        { concurrency: 4 }
      )
      return results
    }),

  validate: (system: BiomeSystem.BiomeSystem) => validateBiomeSystem(system, 'standard'),

  optimize: (system: BiomeSystem.BiomeSystem, target: OptimizationTarget) => optimizeBiomeSystem(system, target),
})

// ================================
// Builder Pattern
// ================================

export interface BiomeSystemBuilder {
  readonly withPreset: (preset: BiomePresetType) => BiomeSystemBuilder
  readonly withClimate: (config: BiomeProperties.BiomeConfiguration) => BiomeSystemBuilder
  readonly withTransitions: (enable: boolean) => BiomeSystemBuilder
  readonly withComplexity: (level: 'simple' | 'complex' | 'realistic') => BiomeSystemBuilder
  readonly withPerformance: (profile: PerformanceProfile) => BiomeSystemBuilder
  readonly withValidation: (level: ValidationLevel) => BiomeSystemBuilder
  readonly withCaching: (enable: boolean) => BiomeSystemBuilder
  readonly withParallelProcessing: (enable: boolean) => BiomeSystemBuilder
  readonly withMemoryLimit: (limit: number) => BiomeSystemBuilder
  readonly withCustomBiomes: (biomes: readonly BiomeProperties.BiomeType[]) => BiomeSystemBuilder
  readonly withMetadata: (metadata: JsonRecord) => BiomeSystemBuilder
  readonly build: () => Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError>
  readonly buildWithValidation: () => Effect.Effect<
    { system: BiomeSystem.BiomeSystem; validation: ValidationResult },
    BiomeFactoryError
  >
}

// BiomeSystemBuilderImpl クラスは削除されました
// 新しいパターン: Schema + Pure Functions を使用してください
// - builder_state.ts: BiomeSystemBuilderStateSchema, initialBiomeSystemBuilderState
// - builder_functions.ts: withPreset, withClimate, withTransitions, withComplexity, etc., build, buildWithValidation
//
// 使用例:
// import { pipe } from 'effect/Function'
// import * as BuilderState from './builder_state'
// import * as BuilderFunctions from './builder_functions'
//
// const system = yield* pipe(
//   BuilderState.initialBiomeSystemBuilderState,
//   (state) => BuilderFunctions.withPreset(state, 'default'),
//   (state) => BuilderFunctions.withTransitions(state, true),
//   BuilderFunctions.build
// )

export const createBiomeSystemBuilder = (): Effect.Effect<never, BiomeFactoryError> => {
  // Builder interface is deprecated - use pure functions instead
  // Import: import * as BuilderState from './builder_state'
  // Import: import * as BuilderFunctions from './builder_functions'
  //
  // Usage:
  // const system = yield* pipe(
  //   BuilderState.initialBiomeSystemBuilderState,
  //   (state) => BuilderFunctions.withPreset(state, 'default'),
  //   BuilderFunctions.build
  // )
  return Effect.fail(
    BiomeFactoryError.biomeCreation('BiomeSystemBuilder interface is deprecated. Use Schema + pure functions pattern.')
  )
}

// ================================
// Climate Calculator
// ================================

export const calculateClimate = (
  coordinates: readonly Coordinates.WorldCoordinate[],
  baseTemperature: number = 20,
  baseHumidity: number = 50
): Effect.Effect<BiomeProperties.ClimateData, BiomeFactoryError> =>
  Effect.succeed({
    temperature: baseTemperature,
    humidity: baseHumidity,
    rainfall: baseHumidity * 0.8,
    windSpeed: 5,
    seasonality: 0.3,
  })

// ================================
// Ecosystem Assembler
// ================================

export const assembleEcosystem = (
  biomes: readonly BiomeProperties.BiomeType[],
  complexity: 'simple' | 'complex' | 'realistic' = 'complex'
): Effect.Effect<BiomeSystem.EcosystemData, BiomeFactoryError> =>
  Effect.succeed({
    biodiversity: complexity === 'realistic' ? 0.9 : complexity === 'complex' ? 0.7 : 0.5,
    foodChainLevels: complexity === 'realistic' ? 5 : complexity === 'complex' ? 4 : 3,
    speciesCount: biomes.length * (complexity === 'realistic' ? 50 : complexity === 'complex' ? 30 : 15),
    stability: 0.8,
  })

// ================================
// Preset Management
// ================================

const applyPreset = (
  preset: BiomePresetType,
  baseParams: CreateBiomeSystemParams
): Effect.Effect<CreateBiomeSystemParams, BiomeFactoryError> =>
  Function.pipe(
    Match.value(preset),
    Match.when('default', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'complex',
        enableTransitions: true,
        performanceProfile: 'balanced',
      })
    ),
    Match.when('vanilla', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'simple',
        enableTransitions: true,
        performanceProfile: 'fast',
      })
    ),
    Match.when('amplified', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'realistic',
        enableTransitions: true,
        performanceProfile: 'quality',
      })
    ),
    Match.when('superflat', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'simple',
        enableTransitions: false,
        customBiomes: ['plains'],
      })
    ),
    Match.when('void', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'simple',
        enableTransitions: false,
        customBiomes: [],
      })
    ),
    Match.when('desert_only', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'complex',
        enableTransitions: false,
        customBiomes: ['desert', 'desert_hills'],
      })
    ),
    Match.when('ocean_only', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'realistic',
        enableTransitions: true,
        customBiomes: ['ocean', 'deep_ocean', 'frozen_ocean'],
      })
    ),
    Match.when('forest_only', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'realistic',
        enableTransitions: true,
        customBiomes: ['forest', 'birch_forest', 'dark_forest'],
      })
    ),
    Match.when('mountain_only', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'complex',
        enableTransitions: true,
        customBiomes: ['mountains', 'mountain_edge'],
      })
    ),
    Match.when('tropical', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'realistic',
        enableTransitions: true,
        customBiomes: ['jungle', 'jungle_hills', 'bamboo_jungle'],
      })
    ),
    Match.when('arctic', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'complex',
        enableTransitions: true,
        customBiomes: ['ice_plains', 'ice_mountains', 'frozen_river'],
      })
    ),
    Match.when('temperate', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'complex',
        enableTransitions: true,
        customBiomes: ['plains', 'forest', 'hills'],
      })
    ),
    Match.when('continental', () =>
      Effect.succeed({
        ...baseParams,
        ecosystemComplexity: 'realistic',
        enableTransitions: true,
        performanceProfile: 'quality',
      })
    ),
    Match.orElse(() => Effect.fail(BiomeFactoryError.biomeCreation(`Unknown preset: ${preset}`)))
  )

// ================================
// Parameter Validation
// ================================

const validateCreateParams = (
  params: CreateBiomeSystemParams
): Effect.Effect<CreateBiomeSystemParams, BiomeFactoryError> =>
  Effect.gen(function* () {
    // Schema検証
    const validatedParams = yield* Schema.decode(CreateBiomeSystemParamsSchema)(params).pipe(
      Effect.mapError((error) =>
        BiomeFactoryError.biomeCreation('Schema validation failed', { context: { error } })
      )
    )

    // ビジネスルール検証
    if (validatedParams.memoryLimit && validatedParams.memoryLimit < 0) {
      return yield* Effect.fail(BiomeFactoryError.biomeCreation('Memory limit must be non-negative'))
    }

    if (validatedParams.customBiomes && validatedParams.customBiomes.length > 50) {
      return yield* Effect.fail(BiomeFactoryError.biomeCreation('Too many custom biomes (max: 50)'))
    }

    return validatedParams
  })

// ================================
// Performance Optimization
// ================================

const optimizeForPerformance = (
  config: BiomeProperties.BiomeConfiguration,
  profile: PerformanceProfile
): Effect.Effect<BiomeProperties.BiomeConfiguration, BiomeFactoryError> =>
  Function.pipe(
    Match.value(profile),
    Match.when('fast', () =>
      Effect.succeed({
        ...config,
        detailLevel: 'low',
        cacheEnabled: false,
        parallelProcessing: false,
      })
    ),
    Match.when('balanced', () =>
      Effect.succeed({
        ...config,
        detailLevel: 'medium',
        cacheEnabled: true,
        parallelProcessing: true,
      })
    ),
    Match.when('quality', () =>
      Effect.succeed({
        ...config,
        detailLevel: 'high',
        cacheEnabled: true,
        parallelProcessing: true,
      })
    ),
    Match.when('ultra', () =>
      Effect.succeed({
        ...config,
        detailLevel: 'ultra',
        cacheEnabled: true,
        parallelProcessing: true,
        advancedFeatures: true,
      })
    ),
    Match.orElse(() => Effect.succeed(config))
  )

// ================================
// Validation System
// ================================

const validateBiomeSystem = (
  system: BiomeSystem.BiomeSystem,
  level: ValidationLevel
): Effect.Effect<ValidationResult, BiomeFactoryError> =>
  Effect.gen(function* () {
    const issues: ValidationIssue[] = []
    let score = 100

    // 基本検証
    if (!system.climate) {
      issues.push({
        level: 'error',
        category: 'climate',
        message: 'Climate data is missing',
        suggestion: 'Provide valid climate configuration',
      })
      score -= 30
    }

    if (!system.ecosystem) {
      issues.push({
        level: 'error',
        category: 'ecosystem',
        message: 'Ecosystem data is missing',
        suggestion: 'Configure ecosystem parameters',
      })
      score -= 25
    }

    // レベル別詳細検証
    if (level === 'standard' || level === 'strict' || level === 'exhaustive') {
      // パフォーマンス検証
      const memoryUsage = estimateMemoryUsage(system)
      if (memoryUsage > 100) {
        // MB
        issues.push({
          level: 'warning',
          category: 'memory',
          message: `High memory usage: ${memoryUsage}MB`,
          suggestion: 'Consider reducing complexity or enabling optimization',
        })
        score -= 10
      }

      // 生態系バランス検証
      if (system.ecosystem?.biodiversity < 0.3) {
        issues.push({
          level: 'warning',
          category: 'ecosystem',
          message: 'Low biodiversity detected',
          suggestion: 'Increase ecosystem complexity',
        })
        score -= 5
      }
    }

    if (level === 'strict' || level === 'exhaustive') {
      // 気候一貫性検証
      if (system.climate?.temperature > 30 && system.climate?.humidity < 0.2) {
        issues.push({
          level: 'warning',
          category: 'climate',
          message: 'Inconsistent climate parameters',
          suggestion: 'Adjust temperature-humidity relationship',
        })
        score -= 8
      }
    }

    if (level === 'exhaustive') {
      // 詳細パフォーマンス分析
      const processingTime = yield* measureProcessingTime(system)
      const cacheEfficiency = calculateCacheEfficiency(system)

      return {
        isValid: issues.filter((i) => i.level === 'error' || i.level === 'critical').length === 0,
        issues,
        score: Math.max(0, score),
        performance: {
          memoryUsage: estimateMemoryUsage(system),
          processingTime,
          cacheEfficiency,
        },
      }
    }

    return {
      isValid: issues.filter((i) => i.level === 'error' || i.level === 'critical').length === 0,
      issues,
      score: Math.max(0, score),
      performance: {
        memoryUsage: estimateMemoryUsage(system),
        processingTime: 0,
        cacheEfficiency: 0,
      },
    }
  })

// ================================
// Optimization Functions
// ================================

const optimizeBiomeSystem = (
  system: BiomeSystem.BiomeSystem,
  target: OptimizationTarget
): Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError> =>
  Function.pipe(
    Match.value(target),
    Match.when('memory', () =>
      Effect.succeed({
        ...system,
        cacheStrategy: 'minimal',
        detailLevel: 'low',
      })
    ),
    Match.when('speed', () =>
      Effect.succeed({
        ...system,
        parallelProcessing: true,
        cacheStrategy: 'aggressive',
      })
    ),
    Match.when('quality', () =>
      Effect.succeed({
        ...system,
        detailLevel: 'high',
        advancedFeatures: true,
      })
    ),
    Match.when('diversity', () =>
      Effect.succeed({
        ...system,
        biomeVariations: 'maximum',
        transitionComplexity: 'high',
      })
    ),
    Match.when('realism', () =>
      Effect.succeed({
        ...system,
        physicsAccuracy: 'high',
        climateModel: 'advanced',
      })
    ),
    Match.orElse(() => Effect.succeed(system))
  )

// ================================
// Helper Functions
// ================================

const estimateMemoryUsage = (system: BiomeSystem.BiomeSystem): number => {
  // メモリ使用量推定（MB）
  const biomeCount = system.biomes?.length ?? 0
  const transitionCount = system.transitions?.length ?? 0
  const baseUsage = 10 // ベース使用量
  const biomeUsage = biomeCount * 2 // バイオームあたり2MB
  const transitionUsage = transitionCount * 0.5 // 遷移あたり0.5MB
  return baseUsage + biomeUsage + transitionUsage
}

const measureProcessingTime = (system: BiomeSystem.BiomeSystem): Effect.Effect<number> =>
  Effect.gen(function* () {
    // 処理時間測定（ミリ秒）
    const start = performance.now()
    // 実際の処理時間をシミュレート
    yield* Effect.sleep(1)
    const end = performance.now()
    return end - start
  })

const calculateCacheEfficiency = (system: BiomeSystem.BiomeSystem): number => {
  // キャッシュ効率計算（0-1）
  if (!system.cacheEnabled) return 0
  // 簡単な効率計算
  const biomeCount = system.biomes?.length ?? 0
  return Math.min(0.95, 0.5 + biomeCount * 0.01)
}

// ================================
// Context.GenericTag
// ================================

export const BiomeSystemFactoryTag = Context.GenericTag<BiomeSystemFactory>(
  '@minecraft/domain/world/factory/BiomeSystemFactory'
)

// ================================
// Layer Implementation
// ================================

export const BiomeSystemFactoryLive = Layer.succeed(BiomeSystemFactoryTag, createBiomeSystemFactory())

// ================================
// Exports
// ================================

export {
  // Schemas
  BiomePresetTypeSchema,
  OptimizationTargetSchema,
  PerformanceProfileSchema,
  ValidationIssueSchema,
  ValidationLevelSchema,
  ValidationResultSchema,
  // Advanced Types
  type BiomePresetType,
  type BiomeSystemBuilder,
  type BiomeSystemFactory,
  // Main Types
  type CreateBiomeSystemParams,
  type OptimizationTarget,
  type PerformanceProfile,
  type ValidationIssue,
  type ValidationLevel,
  type ValidationResult,
}
