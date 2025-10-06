/**
 * World Domain Value Object - 統合バレルエクスポート
 *
 * DDD原理主義に基づく完全Value Object実装
 * Effect-TS 3.17+ 型安全性・数学的精度・Minecraft互換性の統合
 */

// ワールドシード管理
export {
  SEED_QUALITY_PRESETS,
  SeedConversionParamsSchema,
  SeedEntropySchema,
  SeedErrorSchema,
  SeedGenerationParamsSchema,
  SeedQualitySchema,
  SeedValidationResultSchema,
  // 定数・プリセット
  WORLD_SEED_CONSTANTS,
  // 操作関数（型安全な関数形式）
  WorldSeedOperations,
  // スキーマエクスポート
  WorldSeedSchema,
  type SeedConversionParams,
  type SeedEntropy,
  type SeedError,
  type SeedGenerationParams,
  type SeedQuality,
  type SeedValidationResult,
  // 型エクスポート
  type WorldSeed,
} from './world_seed/index'

// 3D座標系管理
export {
  BLOCK_COORDINATE_LIMITS,
  BlockCoordinateSchema,
  BlockXSchema,
  BlockYSchema,
  BlockZSchema,
  CHUNK_COORDINATE_LIMITS,
  ChunkCoordinateSchema,
  ChunkXSchema,
  ChunkYSchema,
  ChunkZSchema,
  CoordinateErrorSchema,
  // 変換操作
  CoordinateTransforms,
  // 定数・制限値
  WORLD_COORDINATE_LIMITS,
  WorldCoordinateSchema,
  // スキーマエクスポート
  WorldXSchema,
  WorldYSchema,
  WorldZSchema,
  type BlockCoordinate,
  type BlockX,
  type BlockY,
  type BlockZ,
  type ChunkCoordinate,
  type ChunkX,
  type ChunkY,
  type ChunkZ,
  type CoordinateError,
  type WorldCoordinate,
  // 座標型エクスポート
  type WorldX,
  type WorldY,
  type WorldZ,
} from './coordinates/index'

// 世界生成パラメータ
export {
  // 定数・プリセット
  BIOME_DEFAULTS,
  BiomeConfigErrorSchema,
  BiomeConfigurationSchema,
  BiomeElevationSchema,
  BiomeHumiditySchema,
  // スキーマエクスポート
  BiomeTemperatureSchema,
  BorderConfigErrorSchema,
  BorderConfigurationSchema,
  CreateBiomeConfigParamsSchema,
  CreateBorderConfigParamsSchema,
  CreateOreConfigParamsSchema,
  CreateStructureConfigParamsSchema,
  // ファクトリ関数
  GenerationParametersFactory,
  MINECRAFT_WORLD_PRESETS,
  ORE_GENERATION_PRESETS,
  OreAbundanceSchema,
  OreConfigErrorSchema,
  OreConfigurationSchema,
  OreDepthSchema,
  PrecipitationTypeSchema,
  STRUCTURE_DEFAULTS,
  StructureConfigErrorSchema,
  StructureConfigurationSchema,
  StructureDensitySchema,
  StructureSizeSchema,
  StructureSpacingSchema,
  VeinSizeSchema,
  WORLD_BORDER_PRESETS,
  WorldBorderRadiusSchema,
  type BiomeConfigError,
  type BiomeConfiguration,
  type BiomeElevation,
  type BiomeHumidity,
  // バイオーム設定
  type BiomeTemperature,
  type BorderConfigError,
  type BorderConfiguration,
  type CreateBiomeConfigParams,
  type CreateBorderConfigParams,
  type CreateOreConfigParams,
  type CreateStructureConfigParams,
  // 鉱石生成設定
  type OreAbundance,
  type OreConfigError,
  type OreConfiguration,
  type OreDepth,
  type PrecipitationType,
  type StructureConfigError,
  type StructureConfiguration,
  // 構造物生成設定
  type StructureDensity,
  type StructureSize,
  type StructureSpacing,
  type VeinSize,
  // ワールド境界設定
  type WorldBorderRadius,
} from './generation_parameters/index'

// ノイズ設定
export {
  AMPLITUDE_CURVE_PRESETS,
  AdvancedNoiseSettingsSchema,
  AmplitudeCurveErrorSchema,
  AmplitudeCurveSchema,
  AmplitudeSchema,
  BandwidthSchema,
  BasicNoiseSettingsSchema,
  CompleteOctaveConfigSchema,
  ControlPointSchema,
  ControlPointValueSchema,
  CreateAmplitudeCurveParamsSchema,
  CreateFrequencyBandsParamsSchema,
  CreateNoiseSettingsParamsSchema,
  CreateOctaveConfigParamsSchema,
  CurveSegmentSchema,
  CurveTensionSchema,
  CurveTypeSchema,
  FREQUENCY_BAND_PRESETS,
  FilterTypeSchema,
  FrequencyBandClassSchema,
  FrequencyBandCollectionSchema,
  FrequencyBandsErrorSchema,
  // スキーマエクスポート
  FrequencySchema,
  FrequencyValueSchema,
  GainSchema,
  IndividualFrequencyBandSchema,
  IndividualOctaveConfigSchema,
  InterpolationSchema,
  LacunaritySchema,
  // 定数・プリセット
  NOISE_PRESETS,
  NoiseConfigurationConstants,
  // ファクトリ・検証・型ガード
  NoiseConfigurationFactory,
  NoiseConfigurationTypeGuards,
  NoiseConfigurationValidation,
  NoiseDimensionSchema,
  NoiseQualitySchema,
  NoiseSettingsErrorSchema,
  NoiseTypeSchema,
  NormalizedTimeSchema,
  OCTAVE_OPTIMIZATION_HINTS,
  OCTAVE_PRESETS,
  OctaveCombinationSchema,
  OctaveConfigErrorSchema,
  OctaveIndexSchema,
  OctaveTypeSchema,
  OctavesSchema,
  PersistenceSchema,
  PhaseSchema,
  QFactorSchema,
  ScaleSchema,
  SmoothingStrengthSchema,
  TERRAIN_AMPLITUDE_MAPPING,
  TERRAIN_FREQUENCY_MAPPING,
  WeightSchema,
  type AdvancedNoiseSettings,
  type Amplitude,
  type AmplitudeCurve,
  type AmplitudeCurveError,
  type Bandwidth,
  type BasicNoiseSettings,
  type CompleteOctaveConfig,
  type ControlPoint,
  type ControlPointValue,
  type CreateAmplitudeCurveParams,
  type CreateFrequencyBandsParams,
  type CreateNoiseSettingsParams,
  type CreateOctaveConfigParams,
  type CurveSegment,
  type CurveTension,
  type CurveType,
  type FilterType,
  // ノイズ基本設定
  type Frequency,
  type FrequencyBandClass,
  type FrequencyBandCollection,
  type FrequencyBandsError,
  // 周波数帯域設定
  type FrequencyValue,
  type Gain,
  type IndividualFrequencyBand,
  type IndividualOctaveConfig,
  type Interpolation,
  type Lacunarity,
  type NoiseDimension,
  type NoiseQuality,
  type NoiseSettingsError,
  type NoiseType,
  // 振幅カーブ設定
  type NormalizedTime,
  type OctaveCombination,
  type OctaveConfigError,
  // オクターブ設定
  type OctaveIndex,
  type OctaveType,
  type Octaves,
  type Persistence,
  type Phase,
  type QFactor,
  type Scale,
  type SmoothingStrength,
  type Weight,
} from './noise_configuration/index'

// バイオーム特性
export {
  AbsoluteHumiditySchema,
  AltitudeTemperatureEffectSchema,
  AtmosphericHumidityStatsSchema,
  BIOME_HUMIDITY_MAPPING,
  BIOME_SOIL_MAPPING,
  BIOME_TEMPERATURE_MAPPING,
  BIOME_VEGETATION_MAPPING,
  BiomassSchema,
  BiomePropertiesConstants,
  // ファクトリ・検証・型ガード
  BiomePropertiesFactory,
  BiomePropertiesTypeGuards,
  BiomePropertiesValidation,
  // 定数・プリセット
  CLIMATE_TEMPERATURE_PRESETS,
  ClimateClassificationSchema,
  CoverageRatioSchema,
  CreateHumidityLevelsParamsSchema,
  CreateSoilCompositionParamsSchema,
  CreateTemperatureRangeParamsSchema,
  CreateVegetationDensityParamsSchema,
  DewPointSchema,
  DistributionPatternSchema,
  DiurnalHumidityPatternSchema,
  DiurnalTemperatureVariationSchema,
  ElectricConductivitySchema,
  EnvironmentalResponseSchema,
  GrowthStageSchema,
  HUMIDITY_PRESETS,
  HeatIndexSchema,
  HumidityClassificationSchema,
  HumidityLevelsErrorSchema,
  HumidityLevelsSchema,
  OrganicMatterCompositionSchema,
  OrganicMatterContentSchema,
  // スキーマエクスポート（土壌）
  ParticleRatioSchema,
  ParticleSizeDistributionSchema,
  PrecipitationTypeSchema,
  // スキーマエクスポート（湿度）
  RelativeHumiditySchema,
  SOIL_COMPOSITION_PRESETS,
  SeasonTypeSchema,
  SeasonalHumidityVariationSchema,
  SeasonalTemperatureVariationSchema,
  SoilChemistrySchema,
  SoilCompositionErrorSchema,
  SoilCompositionSchema,
  SoilDrainageSchema,
  SoilPHSchema,
  SoilPhysicalPropertiesSchema,
  SoilStructureSchema,
  SoilTextureSchema,
  SpeciesDiversityIndexSchema,
  // スキーマエクスポート（温度）
  TemperatureCelsiusSchema,
  TemperatureDeltaSchema,
  TemperatureRangeErrorSchema,
  TemperatureRangeSchema,
  VEGETATION_DENSITY_PRESETS,
  VaporPressureSchema,
  VegetationDensityConfigSchema,
  VegetationDensityErrorSchema,
  // スキーマエクスポート（植生）
  VegetationDensitySchema,
  VegetationInteractionSchema,
  VegetationLayerSchema,
  VegetationTypeSchema,
  WaterVaporCharacteristicsSchema,
  WindChillIndexSchema,
  type AbsoluteHumidity,
  type AltitudeTemperatureEffect,
  type AtmosphericHumidityStats,
  type Biomass,
  type PrecipitationType as BiomePrecipitationType,
  // 統合バイオーム特性
  type BiomePropertiesBundle,
  type ClimateClassification,
  type CoverageRatio,
  type CreateHumidityLevelsParams,
  type CreateSoilCompositionParams,
  type CreateTemperatureRangeParams,
  type CreateVegetationDensityParams,
  type DewPoint,
  type DistributionPattern,
  type DiurnalHumidityPattern,
  type DiurnalTemperatureVariation,
  type ElectricConductivity,
  type EnvironmentalParameters,
  type EnvironmentalResponse,
  type GrowthStage,
  type HeatIndex,
  type HumidityClassification,
  type HumidityLevels,
  type HumidityLevelsError,
  type OrganicMatterComposition,
  type OrganicMatterContent,
  // 土壌組成設定
  type ParticleRatio,
  type ParticleSizeDistribution,
  // 湿度レベル設定
  type RelativeHumidity,
  type SeasonType,
  type SeasonalHumidityVariation,
  type SeasonalTemperatureVariation,
  type SoilChemistry,
  type SoilComposition,
  type SoilCompositionError,
  type SoilDrainage,
  type SoilPH,
  type SoilPhysicalProperties,
  type SoilStructure,
  type SoilTexture,
  type SpeciesDiversityIndex,
  // 温度範囲設定
  type TemperatureCelsius,
  type TemperatureDelta,
  type TemperatureRange,
  type TemperatureRangeError,
  type VaporPressure,
  // 植生密度設定
  type VegetationDensity,
  type VegetationDensityConfig,
  type VegetationDensityError,
  type VegetationInteraction,
  type VegetationLayer,
  type VegetationType,
  type WaterVaporCharacteristics,
  type WindChillIndex,
} from './biome_properties/index'

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
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: GenerationParametersFactory.createMinecraftDefault(),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createTemperateForest(),
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
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: params.generation || GenerationParametersFactory.createMinecraftDefault(),
      noise: params.noise || NoiseConfigurationFactory.createTerrainNoise(),
      biome: params.biome || BiomePropertiesFactory.createTemperateForest(),
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
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: GenerationParametersFactory.createForClimate(climate),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createFromClimate(climate),
    }
  },
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
    BUILD: '2024-001',
  },

  /**
   * 数学的定数
   */
  MATHEMATICAL: {
    PI: Math.PI,
    E: Math.E,
    GOLDEN_RATIO: (1 + Math.sqrt(5)) / 2,
    SQRT_2: Math.sqrt(2),
    SQRT_3: Math.sqrt(3),
  },

  /**
   * 地球物理定数
   */
  GEOPHYSICAL: {
    EARTH_RADIUS_KM: 6371,
    GRAVITY_MS2: 9.80665,
    STEFAN_BOLTZMANN: 5.670374419e-8,
    AVOGADRO: 6.02214076e23,
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
    CLOUD_LEVEL: 192,
  },
} as const

/**
 * World Value Object 統合検証
 */
export const WorldValueObjectValidation = {
  /**
   * 完全ワールド設定の整合性検証
   */
  validateCompleteWorld: (world: any): boolean =>
    pipe(
      Effect.try({
        try: () => {
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
        },
        catch: () => false as const,
      }),
      Effect.runSync
    ),

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
      recommendations: generatePerformanceRecommendations(complexity),
    }
  },
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
    return typeof value === 'object' && value !== null && 'x' in value && 'y' in value && 'z' in value
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
  },
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function createFlatWorld(): any {
  return {
    seed: WorldSeedOperations.fromString('flat_world'),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 4, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createFlat(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: 0.1 as Amplitude },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }
}

function createAmplifiedWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 128, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createAmplified(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: 500 as Amplitude },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }
}

function createLargeBiomesWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createLargeBiomes(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), scale: 4.0 as Scale },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }
}

function createIslandWorld(): any {
  return {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: { ...WORLD_COORDINATE_LIMITS, MAX_X: 10000, MAX_Z: 10000, MIN_X: -10000, MIN_Z: -10000 },
    },
    generation: GenerationParametersFactory.createIsland(),
    noise: NoiseConfigurationFactory.createTerrainNoise(),
    biome: BiomePropertiesFactory.createTropicalRainforest(),
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
