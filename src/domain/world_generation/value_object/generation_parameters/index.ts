/**
 * Generation Parameters Value Object - バレルエクスポート
 *
 * Minecraft互換パラメータの完全実装
 * 生成システムの設定値と制約管理
 */

// バイオーム設定
export {
  BiomeConfigErrorSchema,
  BiomeConfigSchema,
  BiomeTypeSchema,
  ClimateZoneSchema,
  CreateBiomeConfigParamsSchema,
  ElevationSchema,
  HumiditySchema,
  PrecipitationSchema,
  TemperatureSchema,
  VegetationDensitySchema,
  makeUnsafeElevation,
  makeUnsafeHumidity,
  makeUnsafePrecipitation,
  makeUnsafeTemperature,
  makeUnsafeVegetationDensity,
  type BiomeConfig,
  type BiomeConfigError,
  type BiomeType,
  type ClimateZone,
  type CreateBiomeConfigParams,
  type Elevation,
  type Humidity,
  type Precipitation,
  type Temperature,
  type VegetationDensity,
} from './biome_config'

// 構造物密度設定
export {
  CreateStructureDensityParamsSchema,
  DENSITY_PRESETS,
  DensityValueSchema,
  GenerationConditionSchema,
  OverallStructureDensitySchema,
  ProbabilityValueSchema,
  SpacingValueSchema,
  StructureDensityConfigSchema,
  StructureDensityErrorSchema,
  StructureSizeSchema,
  StructureTypeSchema,
  makeUnsafeDensityValue,
  type CreateStructureDensityParams,
  type DensityValue,
  type GenerationCondition,
  type OverallStructureDensity,
  type ProbabilityValue,
  type SpacingValue,
  type StructureDensityConfig,
  type StructureDensityError,
  type StructureSize,
  type StructureType,
} from './structure_density'

// 鉱石分布設定
export {
  ConcentrationSchema,
  CreateOreDistributionParamsSchema,
  DepthDistributionSchema,
  DepthSchema,
  DistributionPatternSchema,
  GeologicalEnvironmentSchema,
  ORE_DISTRIBUTION_PRESETS,
  OreDistributionConfigSchema,
  OreDistributionErrorSchema,
  OreTypeSchema,
  OverallOreDistributionSchema,
  RaritySchema,
  VeinSizeSchema,
  type Concentration,
  type CreateOreDistributionParams,
  type Depth,
  type DepthDistribution,
  type DistributionPattern,
  type GeologicalEnvironment,
  type OreDistributionConfig,
  type OreDistributionError,
  type OreType,
  type OverallOreDistribution,
  type Rarity,
  type VeinSize,
} from './biome_config'

// 機能フラグ設定
export {
  ConditionOperatorSchema,
  CreateFeatureFlagsParamsSchema,
  FeatureCategorySchema,
  FeatureConditionSchema,
  FeatureFlagConfigSchema,
  FeatureFlagsErrorSchema,
  FeatureFlagsSchema,
  FeatureStateSchema,
  FlagPrioritySchema,
  PerformanceImpactSchema,
  STANDARD_FEATURE_FLAGS,
  VersionNumberSchema,
  type ConditionOperator,
  type CreateFeatureFlagsParams,
  type FeatureCategory,
  type FeatureCondition,
  type FeatureFlagConfig,
  type FeatureFlags,
  type FeatureFlagsError,
  type FeatureState,
  type FlagPriority,
  type PerformanceImpact,
  type VersionNumber,
} from './biome_config'

/**
 * 生成パラメータファクトリ
 */
export const GenerationParametersFactory = {
  /**
   * デフォルトバイオーム設定作成
   */
  createDefaultBiomeConfig: (type: BiomeType): BiomeConfig => {
    // 各バイオームタイプのデフォルト値を定義
    const defaults = getDefaultBiomeSettings(type)
    return defaults
  },

  /**
   * 標準構造物密度設定作成
   */
  createStandardStructureDensity: (preset: keyof typeof DENSITY_PRESETS): OverallStructureDensity => {
    const presetConfig = DENSITY_PRESETS[preset]
    return createStructureDensityFromPreset(presetConfig)
  },

  /**
   * 現実的鉱石分布設定作成
   */
  createRealisticOreDistribution: (): OverallOreDistribution => {
    return createRealisticOreConfig()
  },

  /**
   * 開発環境機能フラグ作成
   */
  createDevelopmentFeatureFlags: (): FeatureFlags => {
    return createDevelopmentFlags()
  },
} as const

/**
 * パラメータ定数
 */
export const GenerationParametersConstants = {
  /**
   * 温度範囲
   */
  TEMPERATURE: {
    ARCTIC: -30,
    COLD: 0,
    TEMPERATE: 20,
    WARM: 30,
    HOT: 40,
  },

  /**
   * 湿度レベル
   */
  HUMIDITY: {
    ARID: 0.1,
    DRY: 0.3,
    MODERATE: 0.5,
    HUMID: 0.7,
    SATURATED: 0.9,
  },

  /**
   * 標準標高
   */
  ELEVATION: {
    SEA_LEVEL: 64,
    HILLS: 128,
    MOUNTAINS: 256,
    PEAKS: 320,
    DEEP_OCEAN: -32,
  },

  /**
   * 構造物間隔
   */
  STRUCTURE_SPACING: {
    DENSE: 8,
    NORMAL: 16,
    SPARSE: 32,
    RARE: 64,
  },

  /**
   * 鉱石深度
   */
  ORE_DEPTHS: {
    SURFACE: 64,
    SHALLOW: 32,
    MEDIUM: 0,
    DEEP: -32,
    BEDROCK: -60,
  },
} as const

/**
 * 型ガード
 */
export const GenerationParametersTypeGuards = {
  /**
   * バイオーム設定の型ガード
   */
  isBiomeConfig: (value: unknown): value is BiomeConfig => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'climate' in value &&
      'terrain' in value &&
      'ecosystem' in value
    )
  },

  /**
   * 構造物密度設定の型ガード
   */
  isStructureDensityConfig: (value: unknown): value is StructureDensityConfig => {
    return typeof value === 'object' && value !== null && 'type' in value && 'density' in value && 'spacing' in value
  },

  /**
   * 機能フラグの型ガード
   */
  isFeatureFlags: (value: unknown): value is FeatureFlags => {
    return typeof value === 'object' && value !== null && 'globalSettings' in value && 'flags' in value
  },
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function getDefaultBiomeSettings(type: BiomeType): BiomeConfig {
  // 実際の実装では各バイオームタイプに応じた詳細設定を返す
  // ここでは簡略化のため基本構造のみ
  return {
    type,
    name: type.replace('_', ' '),
    climate: {
      zone: 'temperate',
      temperature: makeUnsafeTemperature(20),
      humidity: makeUnsafeHumidity(0.5),
      precipitation: makeUnsafePrecipitation(500),
    },
    terrain: {
      baseElevation: makeUnsafeElevation(64),
      elevationVariance: 32,
      roughness: 0.5,
    },
    ecosystem: {
      vegetationDensity: makeUnsafeVegetationDensity(0.5),
      primaryVegetation: ['grass', 'trees'],
      animalDensity: 0.3,
      foodChainComplexity: 0.5,
    },
    resources: {
      oreFrequency: {},
      specialBlocks: [],
    },
    structures: {
      villages: 0.1,
      dungeons: 0.05,
      temples: 0.01,
      strongholds: 0.001,
    },
    minecraft: {
      precipitationType: 'rain',
    },
  }
}

function createStructureDensityFromPreset(
  presetConfig: (typeof DENSITY_PRESETS)[keyof typeof DENSITY_PRESETS]
): OverallStructureDensity {
  // プリセットから構造物密度設定を生成
  return {
    globalMultiplier: makeUnsafeDensityValue(presetConfig.globalMultiplier),
    maxStructuresPerChunk: 5,
    structures: {},
    version: '1.0.0',
  }
}

function createRealisticOreConfig(): OverallOreDistribution {
  // 現実的な鉱石分布設定を生成
  return {
    globalMultiplier: 1.0,
    ores: {},
    geologicalLayers: [],
  }
}

function createDevelopmentFlags(): FeatureFlags {
  // 開発環境向け機能フラグを生成
  return {
    globalSettings: {
      enabled: true,
      strictMode: false,
      logLevel: 'debug',
      cacheEnabled: true,
      validationEnabled: true,
    },
    flags: {},
  }
}
