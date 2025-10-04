/**
 * World Domain Value Object - 統合バレルエクスポート
 *
 * DDD原理主義に基づく完全Value Object実装
 * Effect-TS 3.17+ 型安全性・数学的精度・Minecraft互換性の統合
 */

// ワールドシード管理
export {
  // 型エクスポート
  type WorldSeed,
  type SeedEntropy,
  type SeedQuality,
  type SeedGenerationParams,
  type SeedValidationResult,
  type SeedConversionParams,
  type SeedError,

  // スキーマエクスポート
  WorldSeedSchema,
  SeedEntropySchema,
  SeedQualitySchema,
  SeedGenerationParamsSchema,
  SeedValidationResultSchema,
  SeedConversionParamsSchema,
  SeedErrorSchema,

  // 定数・プリセット
  WORLD_SEED_CONSTANTS,
  SEED_QUALITY_PRESETS,

  // 操作関数（型安全な関数形式）
  WorldSeedOperations
} from './world_seed/index.js'

// 3D座標系管理
export {
  // 座標型エクスポート
  type WorldX,
  type WorldY,
  type WorldZ,
  type ChunkX,
  type ChunkY,
  type ChunkZ,
  type BlockX,
  type BlockY,
  type BlockZ,
  type WorldCoordinate,
  type ChunkCoordinate,
  type BlockCoordinate,
  type CoordinateError,

  // スキーマエクスポート
  WorldXSchema,
  WorldYSchema,
  WorldZSchema,
  ChunkXSchema,
  ChunkYSchema,
  ChunkZSchema,
  BlockXSchema,
  BlockYSchema,
  BlockZSchema,
  WorldCoordinateSchema,
  ChunkCoordinateSchema,
  BlockCoordinateSchema,
  CoordinateErrorSchema,

  // 定数・制限値
  WORLD_COORDINATE_LIMITS,
  CHUNK_COORDINATE_LIMITS,
  BLOCK_COORDINATE_LIMITS,

  // 変換操作
  CoordinateTransforms
} from './coordinates/index.js'

// 世界生成パラメータ
export {
  // バイオーム設定
  type BiomeTemperature,
  type BiomeHumidity,
  type BiomeElevation,
  type PrecipitationType,
  type BiomeConfiguration,
  type CreateBiomeConfigParams,
  type BiomeConfigError,

  // 構造物生成設定
  type StructureDensity,
  type StructureSize,
  type StructureSpacing,
  type StructureConfiguration,
  type CreateStructureConfigParams,
  type StructureConfigError,

  // 鉱石生成設定
  type OreAbundance,
  type VeinSize,
  type OreDepth,
  type OreConfiguration,
  type CreateOreConfigParams,
  type OreConfigError,

  // ワールド境界設定
  type WorldBorderRadius,
  type BorderConfiguration,
  type CreateBorderConfigParams,
  type BorderConfigError,

  // スキーマエクスポート
  BiomeTemperatureSchema,
  BiomeHumiditySchema,
  BiomeElevationSchema,
  PrecipitationTypeSchema,
  BiomeConfigurationSchema,
  CreateBiomeConfigParamsSchema,
  BiomeConfigErrorSchema,
  StructureDensitySchema,
  StructureSizeSchema,
  StructureSpacingSchema,
  StructureConfigurationSchema,
  CreateStructureConfigParamsSchema,
  StructureConfigErrorSchema,
  OreAbundanceSchema,
  VeinSizeSchema,
  OreDepthSchema,
  OreConfigurationSchema,
  CreateOreConfigParamsSchema,
  OreConfigErrorSchema,
  WorldBorderRadiusSchema,
  BorderConfigurationSchema,
  CreateBorderConfigParamsSchema,
  BorderConfigErrorSchema,

  // 定数・プリセット
  BIOME_DEFAULTS,
  STRUCTURE_DEFAULTS,
  ORE_GENERATION_PRESETS,
  WORLD_BORDER_PRESETS,
  MINECRAFT_WORLD_PRESETS,

  // ファクトリ関数
  GenerationParametersFactory
} from './generation_parameters/index.js'

// ノイズ設定
export {
  // ノイズ基本設定
  type Frequency,
  type Amplitude,
  type Lacunarity,
  type Persistence,
  type Octaves,
  type Scale,
  type NoiseType,
  type Interpolation,
  type NoiseDimension,
  type NoiseQuality,
  type BasicNoiseSettings,
  type AdvancedNoiseSettings,
  type CreateNoiseSettingsParams,
  type NoiseSettingsError,

  // オクターブ設定
  type OctaveIndex,
  type Weight,
  type Phase,
  type OctaveType,
  type IndividualOctaveConfig,
  type CompleteOctaveConfig,
  type OctaveCombination,
  type CreateOctaveConfigParams,
  type OctaveConfigError,

  // 周波数帯域設定
  type FrequencyValue,
  type Bandwidth,
  type Gain,
  type QFactor,
  type FilterType,
  type FrequencyBandClass,
  type IndividualFrequencyBand,
  type FrequencyBandCollection,
  type CreateFrequencyBandsParams,
  type FrequencyBandsError,

  // 振幅カーブ設定
  type NormalizedTime,
  type ControlPointValue,
  type CurveTension,
  type SmoothingStrength,
  type CurveType,
  type ControlPoint,
  type CurveSegment,
  type AmplitudeCurve,
  type CreateAmplitudeCurveParams,
  type AmplitudeCurveError,

  // スキーマエクスポート
  FrequencySchema,
  AmplitudeSchema,
  LacunaritySchema,
  PersistenceSchema,
  OctavesSchema,
  ScaleSchema,
  NoiseTypeSchema,
  InterpolationSchema,
  NoiseDimensionSchema,
  NoiseQualitySchema,
  BasicNoiseSettingsSchema,
  AdvancedNoiseSettingsSchema,
  CreateNoiseSettingsParamsSchema,
  NoiseSettingsErrorSchema,

  OctaveIndexSchema,
  WeightSchema,
  PhaseSchema,
  OctaveTypeSchema,
  IndividualOctaveConfigSchema,
  CompleteOctaveConfigSchema,
  OctaveCombinationSchema,
  CreateOctaveConfigParamsSchema,
  OctaveConfigErrorSchema,

  FrequencyValueSchema,
  BandwidthSchema,
  GainSchema,
  QFactorSchema,
  FilterTypeSchema,
  FrequencyBandClassSchema,
  IndividualFrequencyBandSchema,
  FrequencyBandCollectionSchema,
  CreateFrequencyBandsParamsSchema,
  FrequencyBandsErrorSchema,

  NormalizedTimeSchema,
  ControlPointValueSchema,
  CurveTensionSchema,
  SmoothingStrengthSchema,
  CurveTypeSchema,
  ControlPointSchema,
  CurveSegmentSchema,
  AmplitudeCurveSchema,
  CreateAmplitudeCurveParamsSchema,
  AmplitudeCurveErrorSchema,

  // 定数・プリセット
  NOISE_PRESETS,
  OCTAVE_PRESETS,
  OCTAVE_OPTIMIZATION_HINTS,
  FREQUENCY_BAND_PRESETS,
  TERRAIN_FREQUENCY_MAPPING,
  AMPLITUDE_CURVE_PRESETS,
  TERRAIN_AMPLITUDE_MAPPING,

  // ファクトリ・検証・型ガード
  NoiseConfigurationFactory,
  NoiseConfigurationConstants,
  NoiseConfigurationValidation,
  NoiseConfigurationTypeGuards
} from './noise_configuration/index.js'

// バイオーム特性
export {
  // 温度範囲設定
  type TemperatureCelsius,
  type TemperatureDelta,
  type HeatIndex,
  type WindChillIndex,
  type SeasonType,
  type ClimateClassification,
  type DiurnalTemperatureVariation,
  type SeasonalTemperatureVariation,
  type AltitudeTemperatureEffect,
  type TemperatureRange,
  type CreateTemperatureRangeParams,
  type TemperatureRangeError,

  // 湿度レベル設定
  type RelativeHumidity,
  type AbsoluteHumidity,
  type DewPoint,
  type VaporPressure,
  type HumidityClassification,
  type PrecipitationType as BiomePrecipitationType,
  type AtmosphericHumidityStats,
  type DiurnalHumidityPattern,
  type SeasonalHumidityVariation,
  type WaterVaporCharacteristics,
  type HumidityLevels,
  type CreateHumidityLevelsParams,
  type HumidityLevelsError,

  // 植生密度設定
  type VegetationDensity,
  type Biomass,
  type CoverageRatio,
  type SpeciesDiversityIndex,
  type VegetationType,
  type GrowthStage,
  type DistributionPattern,
  type VegetationLayer,
  type VegetationInteraction,
  type EnvironmentalResponse,
  type VegetationDensityConfig,
  type CreateVegetationDensityParams,
  type VegetationDensityError,

  // 土壌組成設定
  type ParticleRatio,
  type SoilPH,
  type OrganicMatterContent,
  type ElectricConductivity,
  type SoilTexture,
  type SoilDrainage,
  type SoilStructure,
  type ParticleSizeDistribution,
  type SoilChemistry,
  type OrganicMatterComposition,
  type SoilPhysicalProperties,
  type SoilComposition,
  type CreateSoilCompositionParams,
  type SoilCompositionError,

  // 統合バイオーム特性
  type BiomePropertiesBundle,
  type EnvironmentalParameters,

  // スキーマエクスポート（温度）
  TemperatureCelsiusSchema,
  TemperatureDeltaSchema,
  HeatIndexSchema,
  WindChillIndexSchema,
  SeasonTypeSchema,
  ClimateClassificationSchema,
  DiurnalTemperatureVariationSchema,
  SeasonalTemperatureVariationSchema,
  AltitudeTemperatureEffectSchema,
  TemperatureRangeSchema,
  CreateTemperatureRangeParamsSchema,
  TemperatureRangeErrorSchema,

  // スキーマエクスポート（湿度）
  RelativeHumiditySchema,
  AbsoluteHumiditySchema,
  DewPointSchema,
  VaporPressureSchema,
  HumidityClassificationSchema,
  PrecipitationTypeSchema,
  AtmosphericHumidityStatsSchema,
  DiurnalHumidityPatternSchema,
  SeasonalHumidityVariationSchema,
  WaterVaporCharacteristicsSchema,
  HumidityLevelsSchema,
  CreateHumidityLevelsParamsSchema,
  HumidityLevelsErrorSchema,

  // スキーマエクスポート（植生）
  VegetationDensitySchema,
  BiomassSchema,
  CoverageRatioSchema,
  SpeciesDiversityIndexSchema,
  VegetationTypeSchema,
  GrowthStageSchema,
  DistributionPatternSchema,
  VegetationLayerSchema,
  VegetationInteractionSchema,
  EnvironmentalResponseSchema,
  VegetationDensityConfigSchema,
  CreateVegetationDensityParamsSchema,
  VegetationDensityErrorSchema,

  // スキーマエクスポート（土壌）
  ParticleRatioSchema,
  SoilPHSchema,
  OrganicMatterContentSchema,
  ElectricConductivitySchema,
  SoilTextureSchema,
  SoilDrainageSchema,
  SoilStructureSchema,
  ParticleSizeDistributionSchema,
  SoilChemistrySchema,
  OrganicMatterCompositionSchema,
  SoilPhysicalPropertiesSchema,
  SoilCompositionSchema,
  CreateSoilCompositionParamsSchema,
  SoilCompositionErrorSchema,

  // 定数・プリセット
  CLIMATE_TEMPERATURE_PRESETS,
  BIOME_TEMPERATURE_MAPPING,
  HUMIDITY_PRESETS,
  BIOME_HUMIDITY_MAPPING,
  VEGETATION_DENSITY_PRESETS,
  BIOME_VEGETATION_MAPPING,
  SOIL_COMPOSITION_PRESETS,
  BIOME_SOIL_MAPPING,

  // ファクトリ・検証・型ガード
  BiomePropertiesFactory,
  BiomePropertiesConstants,
  BiomePropertiesValidation,
  BiomePropertiesTypeGuards
} from './biome_properties/index.js'

/**
 * World Value Object 統合ファクトリ
 */
export const WorldValueObjectFactory = {
  /**
   * Minecraftデフォルトワールド作成
   */
  createMinecraftDefault: () => {
    return {
      seed: WorldSeedOperations.generateRandomSeed(),
      coordinates: {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS
      },
      generation: GenerationParametersFactory.createMinecraftDefault(),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createTemperateForest()
    }
  },

  /**
   * カスタムワールド作成
   */
  createCustomWorld: (params: CustomWorldParams) => {
    return {
      seed: params.seed || WorldSeedOperations.generateRandomSeed(),
      coordinates: params.coordinates || {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS
      },
      generation: params.generation || GenerationParametersFactory.createMinecraftDefault(),
      noise: params.noise || NoiseConfigurationFactory.createTerrainNoise(),
      biome: params.biome || BiomePropertiesFactory.createTemperateForest()
    }
  },

  /**
   * 地形タイプ別ワールド作成
   */
  createByTerrainType: (terrainType: TerrainType) => {
    switch (terrainType) {
      case 'flat':
        return createFlatWorld()
      case 'amplified':
        return createAmplifiedWorld()
      case 'large_biomes':
        return createLargeBiomesWorld()
      case 'island':
        return createIslandWorld()
      default:
        return WorldValueObjectFactory.createMinecraftDefault()
    }
  },

  /**
   * 気候帯別ワールド作成
   */
  createByClimate: (climate: ClimateClassification) => {
    return {
      seed: WorldSeedOperations.generateRandomSeed(),
      coordinates: {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS
      },
      generation: GenerationParametersFactory.createForClimate(climate),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createFromClimate(climate)
    }
  }
} as const

/**
 * カスタムワールド作成パラメータ
 */
export type CustomWorldParams = {
  seed?: WorldSeed
  coordinates?: {
    spawn: WorldCoordinate
    worldBorder: typeof WORLD_COORDINATE_LIMITS
  }
  generation?: any // GenerationParameters型（実装済み）
  noise?: AdvancedNoiseSettings
  biome?: BiomePropertiesBundle
}

/**
 * 地形タイプ
 */
export type TerrainType = 'default' | 'flat' | 'amplified' | 'large_biomes' | 'island'

/**
 * World Value Object 統合定数
 */
export const WorldValueObjectConstants = {
  /**
   * Version情報
   */
  VERSION: {
    MAJOR: 1,
    MINOR: 0,
    PATCH: 0,
    BUILD: '2024-001'
  },

  /**
   * 数学的定数
   */
  MATHEMATICAL: {
    PI: Math.PI,
    E: Math.E,
    GOLDEN_RATIO: (1 + Math.sqrt(5)) / 2,
    SQRT_2: Math.sqrt(2),
    SQRT_3: Math.sqrt(3)
  },

  /**
   * 地球物理定数
   */
  GEOPHYSICAL: {
    EARTH_RADIUS_KM: 6371,
    GRAVITY_MS2: 9.80665,
    STEFAN_BOLTZMANN: 5.670374419e-8,
    AVOGADRO: 6.02214076e23
  },

  /**
   * Minecraft固有定数
   */
  MINECRAFT: {
    BLOCK_SIZE_M: 1.0,
    CHUNK_SIZE_BLOCKS: 16,
    WORLD_HEIGHT_BLOCKS: 384,
    BEDROCK_LEVEL: -64,
    SEA_LEVEL: 63,
    CLOUD_LEVEL: 192
  }
} as const

/**
 * World Value Object 統合検証
 */
export const WorldValueObjectValidation = {
  /**
   * 完全ワールド設定の整合性検証
   */
  validateCompleteWorld: (world: any): boolean => {
    try {
      // 座標系の妥当性
      if (!CoordinateTransforms.isValidWorldCoordinate(world.coordinates.spawn)) {
        return false
      }

      // ノイズ設定の妥当性
      if (!NoiseConfigurationValidation.validateNoiseSettings(world.noise)) {
        return false
      }

      // バイオーム特性の整合性
      if (!BiomePropertiesValidation.validateEnvironmentalConsistency(world.biome)) {
        return false
      }

      return true
    } catch {
      return false
    }
  },

  /**
   * 世界シードの複合検証
   */
  validateSeedCompatibility: (seed: WorldSeed, generation: any): boolean => {
    // シードと生成パラメータの互換性確認
    const seedQuality = WorldSeedOperations.evaluateQuality(seed)
    return seedQuality.overallScore > 0.5
  },

  /**
   * パフォーマンス影響度評価
   */
  evaluatePerformanceImpact: (world: any): PerformanceImpact => {
    let complexity = 0

    // ノイズ複雑度
    if (world.noise.octaves > 8) complexity += 0.3
    if (world.noise.quality === 'ultra') complexity += 0.2

    // バイオーム複雑度
    if (world.biome.vegetation.layers.length > 5) complexity += 0.2
    if (world.biome.soil.horizons?.length > 3) complexity += 0.1

    // 構造物密度
    if (world.generation?.structures?.density > 0.8) complexity += 0.2

    return {
      level: complexity < 0.3 ? 'low' : complexity < 0.6 ? 'medium' : 'high',
      score: complexity,
      recommendations: generatePerformanceRecommendations(complexity)
    }
  }
} as const

/**
 * パフォーマンス影響度
 */
export type PerformanceImpact = {
  level: 'low' | 'medium' | 'high'
  score: number
  recommendations: string[]
}

/**
 * 統合型ガード
 */
export const WorldValueObjectTypeGuards = {
  /**
   * WorldSeedの型ガード
   */
  isWorldSeed: (value: unknown): value is WorldSeed => {
    return typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647
  },

  /**
   * WorldCoordinateの型ガード
   */
  isWorldCoordinate: (value: unknown): value is WorldCoordinate => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      'y' in value &&
      'z' in value
    )
  },

  /**
   * CompleteWorldConfigurationの型ガード
   */
  isCompleteWorldConfiguration: (value: unknown): value is any => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'seed' in value &&
      'coordinates' in value &&
      'generation' in value &&
      'noise' in value &&
      'biome' in value
    )
  }
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function createFlatWorld(): any {
  return {
    seed: WorldSeedOperations.fromString('flat_world'),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 4, 0),
      worldBorder: WORLD_COORDINATE_LIMITS
    },
    generation: GenerationParametersFactory.createFlat(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: 0.1 as Amplitude },
    biome: BiomePropertiesFactory.createTemperateForest()
  }
}

function createAmplifiedWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 128, 0),
      worldBorder: WORLD_COORDINATE_LIMITS
    },
    generation: GenerationParametersFactory.createAmplified(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: 500 as Amplitude },
    biome: BiomePropertiesFactory.createTemperateForest()
  }
}

function createLargeBiomesWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: WORLD_COORDINATE_LIMITS
    },
    generation: GenerationParametersFactory.createLargeBiomes(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), scale: 4.0 as Scale },
    biome: BiomePropertiesFactory.createTemperateForest()
  }
}

function createIslandWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: { ...WORLD_COORDINATE_LIMITS, MAX_X: 10000, MAX_Z: 10000, MIN_X: -10000, MIN_Z: -10000 }
    },
    generation: GenerationParametersFactory.createIsland(),
    noise: NoiseConfigurationFactory.createTerrainNoise(),
    biome: BiomePropertiesFactory.createTropicalRainforest()
  }
}

function generatePerformanceRecommendations(complexity: number): string[] {
  const recommendations: string[] = []

  if (complexity > 0.7) {
    recommendations.push('ノイズオクターブ数を8以下に削減することを推奨')
    recommendations.push('植生レイヤー数を5以下に制限することを推奨')
  }

  if (complexity > 0.5) {
    recommendations.push('ノイズ品質を"standard"以下に設定することを推奨')
    recommendations.push('構造物密度を0.8以下に調整することを推奨')
  }

  if (complexity > 0.3) {
    recommendations.push('バックグラウンド処理の活用を検討')
    recommendations.push('チャンク読み込み最適化の実装を推奨')
  }

  return recommendations
}