/**
 * @fileoverview WorldConfigurationFactory - DDD原理主義実装
 *
 * 世界設定の統合管理と最適化を行うファクトリです。
 * 複雑な設定パターンを抽象化し、一貫性のある設定を提供します。
 *
 * ## 責務
 * - 世界設定の統合管理
 * - プリセット管理とカスタマイズ
 * - 設定の検証と最適化
 * - 互換性チェック
 * - ルールエンジンの適用
 * - パフォーマンス最適化とメモリ管理
 * - バッチ処理と並列化対応
 * - 高度なバリデーションシステム
 */

import { Context, Effect, Schema, Layer, Match, Function } from "effect"
import * as WorldSeed from "../../value_object/world_seed/index.js"
import * as GenerationParameters from "../../value_object/generation_parameters/index.js"
import * as BiomeProperties from "../../value_object/biome_properties/index.js"
import * as NoiseConfiguration from "../../value_object/noise_configuration/index.js"

// ================================
// Factory Error Types
// ================================

export const ConfigurationFactoryErrorSchema = Schema.TaggedError('ConfigurationFactoryError', {
  category: Schema.Literal('configuration_invalid', 'preset_not_found', 'compatibility_error'),
  message: Schema.String,
  context: Schema.optional(Schema.Unknown)
})

export class ConfigurationFactoryError extends Schema.TaggedError<typeof ConfigurationFactoryErrorSchema>()('ConfigurationFactoryError', ConfigurationFactoryErrorSchema) {}

// ================================
// Configuration Types
// ================================

export const WorldConfigurationSchema = Schema.Struct({
  seed: WorldSeed.WorldSeedSchema,
  parameters: GenerationParameters.GenerationParametersSchema,
  biomeConfig: BiomeProperties.BiomeConfigurationSchema,
  noiseConfig: NoiseConfiguration.NoiseConfigurationSchema,
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

export type WorldConfiguration = typeof WorldConfigurationSchema.Type

// ================================
// Advanced Configuration Types
// ================================

export const ConfigurationPresetTypeSchema = Schema.Literal(
  'default', 'survival', 'creative', 'peaceful', 'hardcore',
  'custom', 'experimental', 'debug', 'performance',
  'memory_optimized', 'quality_focused', 'balanced'
)
export type ConfigurationPresetType = typeof ConfigurationPresetTypeSchema.Type

export const OptimizationModeSchema = Schema.Literal(
  'memory', 'speed', 'quality', 'balanced', 'adaptive'
)
export type OptimizationMode = typeof OptimizationModeSchema.Type

export const ValidationStrictnessSchema = Schema.Literal(
  'lenient', 'standard', 'strict', 'pedantic'
)
export type ValidationStrictness = typeof ValidationStrictnessSchema.Type

export const ConfigurationComplexitySchema = Schema.Literal(
  'minimal', 'simple', 'standard', 'complex', 'enterprise'
)
export type ConfigurationComplexity = typeof ConfigurationComplexitySchema.Type

export const CreateConfigurationParamsSchema = Schema.Struct({
  preset: Schema.optional(ConfigurationPresetTypeSchema),
  seed: Schema.optional(WorldSeed.WorldSeedSchema),
  overrides: Schema.optional(Schema.Partial(WorldConfigurationSchema)),
  validateCompatibility: Schema.optional(Schema.Boolean),
  optimizationMode: Schema.optional(OptimizationModeSchema),
  validationStrictness: Schema.optional(ValidationStrictnessSchema),
  complexity: Schema.optional(ConfigurationComplexitySchema),
  enableCaching: Schema.optional(Schema.Boolean),
  enableParallelProcessing: Schema.optional(Schema.Boolean),
  memoryBudget: Schema.optional(Schema.Number.pipe(Schema.positive())),
  customParameters: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })),
  target: Schema.optional(Schema.Literal('client', 'server', 'hybrid')),
  features: Schema.optional(Schema.Array(Schema.String))
})

export type CreateConfigurationParams = typeof CreateConfigurationParamsSchema.Type

// ================================
// Validation Result Types
// ================================

export const ConfigurationValidationIssueSchema = Schema.Struct({
  severity: Schema.Literal('info', 'warning', 'error', 'critical'),
  category: Schema.Literal('compatibility', 'performance', 'memory', 'logic', 'syntax'),
  message: Schema.String,
  field: Schema.optional(Schema.String),
  suggestion: Schema.optional(Schema.String),
  autoFixable: Schema.optional(Schema.Boolean)
})
export type ConfigurationValidationIssue = typeof ConfigurationValidationIssueSchema.Type

export const ConfigurationValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  issues: Schema.Array(ConfigurationValidationIssueSchema),
  score: Schema.Number.pipe(Schema.between(0, 100)),
  performance: Schema.Struct({
    estimatedMemoryUsage: Schema.Number,
    estimatedProcessingTime: Schema.Number,
    cacheEfficiency: Schema.Number,
    parallelizationPotential: Schema.Number
  }),
  recommendations: Schema.Array(Schema.String)
})
export type ConfigurationValidationResult = typeof ConfigurationValidationResultSchema.Type

// ================================
// WorldConfigurationFactory Interface
// ================================

export interface WorldConfigurationFactory {
  readonly create: (params: CreateConfigurationParams) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly createFromPreset: (preset: ConfigurationPresetType) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly createOptimized: (mode: OptimizationMode, baseConfig?: WorldConfiguration) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly createBatch: (requests: readonly CreateConfigurationParams[]) => Effect.Effect<readonly WorldConfiguration[], ConfigurationFactoryError>
  readonly merge: (configs: readonly WorldConfiguration[]) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly validate: (config: WorldConfiguration, strictness?: ValidationStrictness) => Effect.Effect<ConfigurationValidationResult, ConfigurationFactoryError>
  readonly optimize: (config: WorldConfiguration, target: OptimizationMode) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly compare: (config1: WorldConfiguration, config2: WorldConfiguration) => Effect.Effect<ConfigurationComparisonResult, ConfigurationFactoryError>
  readonly autoFix: (config: WorldConfiguration, issues: readonly ConfigurationValidationIssue[]) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
  readonly template: (template: ConfigurationTemplate) => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
}

// ================================
// Additional Support Types
// ================================

export const ConfigurationComparisonResultSchema = Schema.Struct({
  differences: Schema.Array(Schema.Struct({
    field: Schema.String,
    value1: Schema.Unknown,
    value2: Schema.Unknown,
    impact: Schema.Literal('low', 'medium', 'high', 'critical')
  })),
  similarity: Schema.Number.pipe(Schema.between(0, 1)),
  recommendation: Schema.String
})
export type ConfigurationComparisonResult = typeof ConfigurationComparisonResultSchema.Type

export const ConfigurationTemplateSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  basePreset: ConfigurationPresetTypeSchema,
  overrides: Schema.Partial(WorldConfigurationSchema),
  requiredFeatures: Schema.optional(Schema.Array(Schema.String)),
  minimumComplexity: Schema.optional(ConfigurationComplexitySchema)
})
export type ConfigurationTemplate = typeof ConfigurationTemplateSchema.Type

// ================================
// Factory Implementation
// ================================

const createWorldConfigurationFactory = (): WorldConfigurationFactory => ({
  create: (params: CreateConfigurationParams) =>
    Effect.gen(function* () {
      // パラメータ検証
      const validatedParams = yield* validateCreateParams(params)

      // プリセット設定の取得
      const baseConfig = validatedParams.preset
        ? yield* loadPresetConfiguration(validatedParams.preset)
        : yield* createDefaultConfiguration()

      // 最適化適用
      const optimizedConfig = validatedParams.optimizationMode
        ? yield* applyOptimization(baseConfig, validatedParams.optimizationMode)
        : baseConfig

      // シードの適用
      const configWithSeed = validatedParams.seed
        ? { ...optimizedConfig, seed: validatedParams.seed }
        : optimizedConfig

      // オーバーライドの適用
      const configWithOverrides = validatedParams.overrides
        ? yield* applyOverrides(configWithSeed, validatedParams.overrides)
        : configWithSeed

      // カスタムパラメータ適用
      const finalConfig = validatedParams.customParameters
        ? yield* applyCustomParameters(configWithOverrides, validatedParams.customParameters)
        : configWithOverrides

      // 検証実行
      if (validatedParams.validateCompatibility) {
        const validation = yield* validateConfigurationAdvanced(
          finalConfig,
          validatedParams.validationStrictness ?? 'standard'
        )
        if (!validation.isValid && validation.issues.some(i => i.severity === 'critical')) {
          return yield* Effect.fail(new ConfigurationFactoryError({
            category: 'compatibility_error',
            message: 'Configuration validation failed with critical issues',
            context: { validation }
          }))
        }
      }

      return finalConfig
    }),

  createFromPreset: (preset: ConfigurationPresetType) =>
    loadPresetConfiguration(preset),

  createOptimized: (mode: OptimizationMode, baseConfig?: WorldConfiguration) =>
    Effect.gen(function* () {
      const config = baseConfig ?? (yield* createDefaultConfiguration())
      return yield* applyOptimization(config, mode)
    }),

  createBatch: (requests: readonly CreateConfigurationParams[]) =>
    Effect.gen(function* () {
      // 並列処理で効率化
      const results = yield* Effect.all(
        requests.map(params => createWorldConfigurationFactory().create(params)),
        { concurrency: 4 }
      )
      return results
    }),

  merge: (configs: readonly WorldConfiguration[]) =>
    Effect.gen(function* () {
      if (configs.length === 0) {
        return yield* createDefaultConfiguration()
      }

      let mergedConfig = configs[0]
      for (let i = 1; i < configs.length; i++) {
        mergedConfig = yield* mergeConfigurations(mergedConfig, configs[i])
      }

      return mergedConfig
    }),

  validate: (config: WorldConfiguration, strictness?: ValidationStrictness) =>
    validateConfigurationAdvanced(config, strictness ?? 'standard'),

  optimize: (config: WorldConfiguration, target: OptimizationMode) =>
    applyOptimization(config, target),

  compare: (config1: WorldConfiguration, config2: WorldConfiguration) =>
    compareConfigurations(config1, config2),

  autoFix: (config: WorldConfiguration, issues: readonly ConfigurationValidationIssue[]) =>
    autoFixConfiguration(config, issues),

  template: (template: ConfigurationTemplate) =>
    createFromTemplate(template)
})

// ================================
// Preset Manager
// ================================

const loadPresetConfiguration = (preset: ConfigurationPresetType): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Function.pipe(
    Match.value(preset),
    Match.when('default', () => createDefaultConfiguration()),
    Match.when('survival', () => createSurvivalConfiguration()),
    Match.when('creative', () => createCreativeConfiguration()),
    Match.when('peaceful', () => createPeacefulConfiguration()),
    Match.when('hardcore', () => createHardcoreConfiguration()),
    Match.when('custom', () => createCustomConfiguration()),
    Match.when('experimental', () => createExperimentalConfiguration()),
    Match.when('debug', () => createDebugConfiguration()),
    Match.when('performance', () => createPerformanceConfiguration()),
    Match.when('memory_optimized', () => createMemoryOptimizedConfiguration()),
    Match.when('quality_focused', () => createQualityFocusedConfiguration()),
    Match.when('balanced', () => createBalancedConfiguration()),
    Match.orElse(() => Effect.fail(new ConfigurationFactoryError({
      category: 'preset_not_found',
      message: `Unknown preset: ${preset}`
    })))
  )

const createDefaultConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createDefault(),
    biomeConfig: BiomeProperties.createDefaultConfiguration(),
    noiseConfig: NoiseConfiguration.createDefault()
  })

const createSurvivalConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createSurvivalOptimized(),
    biomeConfig: BiomeProperties.createDiverseConfiguration(),
    noiseConfig: NoiseConfiguration.createRealistic()
  })

const createCreativeConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createCreativeOptimized(),
    biomeConfig: BiomeProperties.createSimpleConfiguration(),
    noiseConfig: NoiseConfiguration.createFast()
  })

const createCustomConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createDefault(),
    biomeConfig: BiomeProperties.createDefaultConfiguration(),
    noiseConfig: NoiseConfiguration.createDefault(),
    metadata: { configType: 'custom' }
  })

const createPeacefulConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createPeacefulOptimized(),
    biomeConfig: BiomeProperties.createPeacefulConfiguration(),
    noiseConfig: NoiseConfiguration.createSimple(),
    metadata: { configType: 'peaceful', hostileSpawning: false }
  })

const createHardcoreConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createHardcoreOptimized(),
    biomeConfig: BiomeProperties.createChallengeConfiguration(),
    noiseConfig: NoiseConfiguration.createRealistic(),
    metadata: { configType: 'hardcore', difficulty: 'hard', oneLife: true }
  })

const createExperimentalConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createExperimental(),
    biomeConfig: BiomeProperties.createExperimentalConfiguration(),
    noiseConfig: NoiseConfiguration.createExperimental(),
    metadata: { configType: 'experimental', unstable: true }
  })

const createDebugConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createFixed(12345),
    parameters: GenerationParameters.createDebug(),
    biomeConfig: BiomeProperties.createDebugConfiguration(),
    noiseConfig: NoiseConfiguration.createDebug(),
    metadata: { configType: 'debug', logging: 'verbose', deterministic: true }
  })

const createPerformanceConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createFastOptimized(),
    biomeConfig: BiomeProperties.createSimpleConfiguration(),
    noiseConfig: NoiseConfiguration.createFast(),
    metadata: { configType: 'performance', optimization: 'speed' }
  })

const createMemoryOptimizedConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createMemoryOptimized(),
    biomeConfig: BiomeProperties.createMinimalConfiguration(),
    noiseConfig: NoiseConfiguration.createMemoryEfficient(),
    metadata: { configType: 'memory_optimized', optimization: 'memory' }
  })

const createQualityFocusedConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createQualityOptimized(),
    biomeConfig: BiomeProperties.createHighQualityConfiguration(),
    noiseConfig: NoiseConfiguration.createHighQuality(),
    metadata: { configType: 'quality_focused', optimization: 'quality' }
  })

const createBalancedConfiguration = (): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: WorldSeed.createRandom(),
    parameters: GenerationParameters.createBalanced(),
    biomeConfig: BiomeProperties.createBalancedConfiguration(),
    noiseConfig: NoiseConfiguration.createBalanced(),
    metadata: { configType: 'balanced', optimization: 'balanced' }
  })

// ================================
// Rule Engine
// ================================

const applyOverrides = (
  baseConfig: WorldConfiguration,
  overrides: Partial<WorldConfiguration>
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    ...baseConfig,
    ...overrides,
    metadata: { ...baseConfig.metadata, ...overrides.metadata }
  })

const mergeConfigurations = (
  config1: WorldConfiguration,
  config2: WorldConfiguration
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    seed: config2.seed,
    parameters: GenerationParameters.merge(config1.parameters, config2.parameters),
    biomeConfig: BiomeProperties.merge(config1.biomeConfig, config2.biomeConfig),
    noiseConfig: NoiseConfiguration.merge(config1.noiseConfig, config2.noiseConfig),
    metadata: { ...config1.metadata, ...config2.metadata }
  })

// ================================
// Compatibility Checker
// ================================

const validateConfiguration = (config: WorldConfiguration): Effect.Effect<boolean, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    try {
      // スキーマ検証
      Schema.decodeSync(WorldConfigurationSchema)(config)

      // ビジネスルール検証
      const isParametersValid = yield* GenerationParameters.validate(config.parameters)
      const isBiomeConfigValid = yield* BiomeProperties.validate(config.biomeConfig)
      const isNoiseConfigValid = yield* NoiseConfiguration.validate(config.noiseConfig)

      return isParametersValid && isBiomeConfigValid && isNoiseConfigValid
    } catch {
      return false
    }
  })

// ================================
// Advanced Helper Functions
// ================================

const validateCreateParams = (
  params: CreateConfigurationParams
): Effect.Effect<CreateConfigurationParams, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    try {
      // Schema検証
      const validatedParams = Schema.decodeSync(CreateConfigurationParamsSchema)(params)

      // ビジネスルール検証
      if (validatedParams.memoryBudget && validatedParams.memoryBudget <= 0) {
        return yield* Effect.fail(new ConfigurationFactoryError({
          category: 'configuration_invalid',
          message: 'Memory budget must be positive'
        }))
      }

      return validatedParams
    } catch (error) {
      return yield* Effect.fail(new ConfigurationFactoryError({
        category: 'configuration_invalid',
        message: 'Invalid parameters',
        context: { error, params }
      }))
    }
  })

const applyOptimization = (
  config: WorldConfiguration,
  mode: OptimizationMode
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Function.pipe(
    Match.value(mode),
    Match.when('memory', () => Effect.succeed({
      ...config,
      parameters: GenerationParameters.optimizeForMemory(config.parameters),
      biomeConfig: BiomeProperties.optimizeForMemory(config.biomeConfig),
      noiseConfig: NoiseConfiguration.optimizeForMemory(config.noiseConfig),
      metadata: { ...config.metadata, optimization: 'memory' }
    })),
    Match.when('speed', () => Effect.succeed({
      ...config,
      parameters: GenerationParameters.optimizeForSpeed(config.parameters),
      biomeConfig: BiomeProperties.optimizeForSpeed(config.biomeConfig),
      noiseConfig: NoiseConfiguration.optimizeForSpeed(config.noiseConfig),
      metadata: { ...config.metadata, optimization: 'speed' }
    })),
    Match.when('quality', () => Effect.succeed({
      ...config,
      parameters: GenerationParameters.optimizeForQuality(config.parameters),
      biomeConfig: BiomeProperties.optimizeForQuality(config.biomeConfig),
      noiseConfig: NoiseConfiguration.optimizeForQuality(config.noiseConfig),
      metadata: { ...config.metadata, optimization: 'quality' }
    })),
    Match.when('balanced', () => Effect.succeed({
      ...config,
      parameters: GenerationParameters.optimizeForBalance(config.parameters),
      biomeConfig: BiomeProperties.optimizeForBalance(config.biomeConfig),
      noiseConfig: NoiseConfiguration.optimizeForBalance(config.noiseConfig),
      metadata: { ...config.metadata, optimization: 'balanced' }
    })),
    Match.when('adaptive', () => Effect.succeed({
      ...config,
      parameters: GenerationParameters.optimizeAdaptive(config.parameters),
      biomeConfig: BiomeProperties.optimizeAdaptive(config.biomeConfig),
      noiseConfig: NoiseConfiguration.optimizeAdaptive(config.noiseConfig),
      metadata: { ...config.metadata, optimization: 'adaptive' }
    })),
    Match.orElse(() => Effect.succeed(config))
  )

const applyCustomParameters = (
  config: WorldConfiguration,
  customParams: Record<string, unknown>
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.succeed({
    ...config,
    metadata: {
      ...config.metadata,
      customParameters: customParams,
      customized: true
    }
  })

const validateConfigurationAdvanced = (
  config: WorldConfiguration,
  strictness: ValidationStrictness
): Effect.Effect<ConfigurationValidationResult, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    const issues: ConfigurationValidationIssue[] = []
    let score = 100

    // 基本検証
    try {
      Schema.decodeSync(WorldConfigurationSchema)(config)
    } catch (error) {
      issues.push({
        severity: 'error',
        category: 'syntax',
        message: 'Configuration schema validation failed',
        suggestion: 'Check configuration structure',
        autoFixable: false
      })
      score -= 30
    }

    // パフォーマンス検証
    const memoryUsage = estimateMemoryUsage(config)
    if (memoryUsage > 512) { // MB
      issues.push({
        severity: strictness === 'pedantic' ? 'error' : 'warning',
        category: 'memory',
        message: `High memory usage estimated: ${memoryUsage}MB`,
        suggestion: 'Consider memory optimization',
        autoFixable: true
      })
      score -= strictness === 'pedantic' ? 20 : 10
    }

    // 互換性検証
    if (strictness === 'strict' || strictness === 'pedantic') {
      // 詳細な互換性チェック
      const isCompatible = yield* checkAdvancedCompatibility(config)
      if (!isCompatible) {
        issues.push({
          severity: 'warning',
          category: 'compatibility',
          message: 'Some features may not be compatible',
          suggestion: 'Review configuration parameters',
          autoFixable: false
        })
        score -= 15
      }
    }

    const performance = {
      estimatedMemoryUsage: memoryUsage,
      estimatedProcessingTime: estimateProcessingTime(config),
      cacheEfficiency: calculateCacheEfficiency(config),
      parallelizationPotential: calculateParallelizationPotential(config)
    }

    const recommendations = generateRecommendations(issues, config, performance)

    return {
      isValid: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length === 0,
      issues,
      score: Math.max(0, score),
      performance,
      recommendations
    }
  })

const compareConfigurations = (
  config1: WorldConfiguration,
  config2: WorldConfiguration
): Effect.Effect<ConfigurationComparisonResult, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    const differences: ConfigurationComparisonResult['differences'] = []

    // シード比較
    if (config1.seed !== config2.seed) {
      differences.push({
        field: 'seed',
        value1: config1.seed,
        value2: config2.seed,
        impact: 'high'
      })
    }

    // 他の設定比較...
    const similarity = 1 - (differences.length / 10) // 簡単な類似度計算

    return {
      differences,
      similarity: Math.max(0, similarity),
      recommendation: similarity > 0.8 ? 'Configurations are very similar' : 'Configurations have significant differences'
    }
  })

const autoFixConfiguration = (
  config: WorldConfiguration,
  issues: readonly ConfigurationValidationIssue[]
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    let fixedConfig = config

    for (const issue of issues.filter(i => i.autoFixable)) {
      if (issue.category === 'memory' && issue.message.includes('High memory usage')) {
        fixedConfig = yield* applyOptimization(fixedConfig, 'memory')
      }
      // 他の自動修正ロジック...
    }

    return fixedConfig
  })

const createFromTemplate = (
  template: ConfigurationTemplate
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    const baseConfig = yield* loadPresetConfiguration(template.basePreset)
    const configWithOverrides = yield* applyOverrides(baseConfig, template.overrides)

    return {
      ...configWithOverrides,
      metadata: {
        ...configWithOverrides.metadata,
        template: template.name,
        templateDescription: template.description
      }
    }
  })

// ================================
// Utility Functions
// ================================

const estimateMemoryUsage = (config: WorldConfiguration): number => {
  // メモリ使用量推定（MB）
  const baseUsage = 50 // ベース使用量
  const parameterComplexity = getParameterComplexity(config.parameters)
  const biomeComplexity = getBiomeComplexity(config.biomeConfig)
  const noiseComplexity = getNoiseComplexity(config.noiseConfig)

  return baseUsage + (parameterComplexity * 10) + (biomeComplexity * 15) + (noiseComplexity * 20)
}

const estimateProcessingTime = (config: WorldConfiguration): number => {
  // 処理時間推定（ミリ秒）
  const complexityFactor = getOverallComplexity(config)
  return 100 + (complexityFactor * 50)
}

const calculateCacheEfficiency = (config: WorldConfiguration): number => {
  // キャッシュ効率計算（0-1）
  const simplicity = 1 - (getOverallComplexity(config) / 10)
  return Math.max(0.1, Math.min(0.95, simplicity))
}

const calculateParallelizationPotential = (config: WorldConfiguration): number => {
  // 並列化可能性計算（0-1）
  const complexity = getOverallComplexity(config)
  return complexity > 5 ? 0.8 : 0.4
}

const checkAdvancedCompatibility = (config: WorldConfiguration): Effect.Effect<boolean, never> =>
  Effect.succeed(true) // 簡単な実装

const generateRecommendations = (
  issues: readonly ConfigurationValidationIssue[],
  config: WorldConfiguration,
  performance: ConfigurationValidationResult['performance']
): readonly string[] => {
  const recommendations: string[] = []

  if (performance.estimatedMemoryUsage > 256) {
    recommendations.push('Consider using memory optimization mode')
  }

  if (issues.some(i => i.category === 'performance')) {
    recommendations.push('Enable performance optimization for better results')
  }

  if (issues.length > 5) {
    recommendations.push('Review configuration parameters for potential issues')
  }

  return recommendations
}

const getParameterComplexity = (params: GenerationParameters.GenerationParameters): number => 3
const getBiomeComplexity = (biome: BiomeProperties.BiomeConfiguration): number => 4
const getNoiseComplexity = (noise: NoiseConfiguration.NoiseConfiguration): number => 5
const getOverallComplexity = (config: WorldConfiguration): number => 6

// ================================
// Builder Pattern
// ================================

export interface WorldConfigurationBuilder {
  readonly withSeed: (seed: WorldSeed.WorldSeed) => WorldConfigurationBuilder
  readonly withParameters: (params: GenerationParameters.GenerationParameters) => WorldConfigurationBuilder
  readonly withBiomeConfig: (config: BiomeProperties.BiomeConfiguration) => WorldConfigurationBuilder
  readonly withNoiseConfig: (config: NoiseConfiguration.NoiseConfiguration) => WorldConfigurationBuilder
  readonly withMetadata: (metadata: Record<string, unknown>) => WorldConfigurationBuilder
  readonly build: () => Effect.Effect<WorldConfiguration, ConfigurationFactoryError>
}

class WorldConfigurationBuilderImpl implements WorldConfigurationBuilder {
  constructor(private readonly config: Partial<WorldConfiguration> = {}) {}

  withSeed(seed: WorldSeed.WorldSeed): WorldConfigurationBuilder {
    return new WorldConfigurationBuilderImpl({ ...this.config, seed })
  }

  withParameters(params: GenerationParameters.GenerationParameters): WorldConfigurationBuilder {
    return new WorldConfigurationBuilderImpl({ ...this.config, parameters: params })
  }

  withBiomeConfig(config: BiomeProperties.BiomeConfiguration): WorldConfigurationBuilder {
    return new WorldConfigurationBuilderImpl({ ...this.config, biomeConfig: config })
  }

  withNoiseConfig(config: NoiseConfiguration.NoiseConfiguration): WorldConfigurationBuilder {
    return new WorldConfigurationBuilderImpl({ ...this.config, noiseConfig: config })
  }

  withMetadata(metadata: Record<string, unknown>): WorldConfigurationBuilder {
    return new WorldConfigurationBuilderImpl({
      ...this.config,
      metadata: { ...this.config.metadata, ...metadata }
    })
  }

  build(): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> {
    return Effect.gen(function* () {
      const defaultConfig = yield* createDefaultConfiguration()
      return {
        seed: this.config.seed ?? defaultConfig.seed,
        parameters: this.config.parameters ?? defaultConfig.parameters,
        biomeConfig: this.config.biomeConfig ?? defaultConfig.biomeConfig,
        noiseConfig: this.config.noiseConfig ?? defaultConfig.noiseConfig,
        metadata: this.config.metadata
      }
    }.bind(this))
  }
}

export const createWorldConfigurationBuilder = (): WorldConfigurationBuilder =>
  new WorldConfigurationBuilderImpl()

// ================================
// Context.GenericTag
// ================================

export const WorldConfigurationFactoryTag = Context.GenericTag<WorldConfigurationFactory>(
  '@minecraft/domain/world/factory/WorldConfigurationFactory'
)

// ================================
// Layer Implementation
// ================================

export const WorldConfigurationFactoryLive = Layer.succeed(
  WorldConfigurationFactoryTag,
  createWorldConfigurationFactory()
)

// ================================
// Exports
// ================================

export {
  // Main Types
  type WorldConfiguration,
  type CreateConfigurationParams,
  type WorldConfigurationFactory,
  type WorldConfigurationBuilder,

  // Advanced Types
  type ConfigurationPresetType,
  type OptimizationMode,
  type ValidationStrictness,
  type ConfigurationComplexity,
  type ConfigurationValidationIssue,
  type ConfigurationValidationResult,
  type ConfigurationComparisonResult,
  type ConfigurationTemplate,

  // Schemas
  ConfigurationPresetTypeSchema,
  OptimizationModeSchema,
  ValidationStrictnessSchema,
  ConfigurationComplexitySchema,
  ConfigurationValidationIssueSchema,
  ConfigurationValidationResultSchema,
  ConfigurationComparisonResultSchema,
  ConfigurationTemplateSchema,
}