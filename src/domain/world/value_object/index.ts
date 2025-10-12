/**
 * World Domain Value Object - 統合バレルエクスポート
 *
 * DDD原理主義に基づく完全Value Object実装
 * Effect-TS 3.17+ 型安全性・数学的精度・Minecraft互換性の統合
 */

import { Either, Match, Option, pipe } from 'effect'

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
  AdvancedNoiseSettingsSchema,
  AMPLITUDE_CURVE_PRESETS,
  AmplitudeCurveErrorSchema,
  AmplitudeCurveSchema,
  AmplitudeSchema,
  asFilterType,
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
  FilterTypeSchema,
  FREQUENCY_BAND_PRESETS,
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
  // makeUnsafe関数
  makeUnsafeAmplitude,
  makeUnsafeBandwidth,
  makeUnsafeControlPointValue,
  makeUnsafeFrequency,
  makeUnsafeFrequencyValue,
  makeUnsafeGain,
  makeUnsafeLacunarity,
  makeUnsafeNormalizedTime,
  makeUnsafeOctaveIndex,
  makeUnsafeOctaves,
  makeUnsafePersistence,
  makeUnsafePhase,
  makeUnsafeQFactor,
  makeUnsafeScale,
  makeUnsafeWeight,
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
  OctavesSchema,
  OctaveTypeSchema,
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
  type Octaves,
  type OctaveType,
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
  BiomassSchema,
  BIOME_HUMIDITY_MAPPING,
  BIOME_SOIL_MAPPING,
  BIOME_TEMPERATURE_MAPPING,
  BIOME_VEGETATION_MAPPING,
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
  HeatIndexSchema,
  HUMIDITY_PRESETS,
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
  SeasonalHumidityVariationSchema,
  SeasonalTemperatureVariationSchema,
  SeasonTypeSchema,
  SOIL_COMPOSITION_PRESETS,
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
  VaporPressureSchema,
  VEGETATION_DENSITY_PRESETS,
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
  type SeasonalHumidityVariation,
  type SeasonalTemperatureVariation,
  type SeasonType,
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

type GenerationParametersConfig = ReturnType<typeof GenerationParametersFactory.createMinecraftDefault> & {
  readonly structures?: { readonly density?: number }
}

type WorldBorderConfig = Readonly<Record<keyof typeof WORLD_COORDINATE_LIMITS, number>>

export type WorldConfiguration = {
  readonly seed: WorldSeed
  readonly coordinates: {
    readonly spawn: WorldCoordinate
    readonly worldBorder: WorldBorderConfig
  }
  readonly generation: GenerationParametersConfig
  readonly noise: AdvancedNoiseSettings
  readonly biome: BiomePropertiesBundle
}

/**
 * World Value Object 統合ファクトリ
 */
export const WorldValueObjectFactory = {
  /**
   * Minecraftデフォルトワールド作成
   */
  createMinecraftDefault: (): WorldConfiguration => {
    const world: WorldConfiguration = {
      seed: WorldSeedOperations.generateRandomSeed(),
      coordinates: {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: GenerationParametersFactory.createMinecraftDefault(),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createTemperateForest(),
    }

    return world
  },

  /**
   * カスタムワールド作成
   */
  createCustomWorld: (params: CustomWorldParams): WorldConfiguration => {
    const world: WorldConfiguration = {
      seed: params.seed ?? WorldSeedOperations.generateRandomSeed(),
      coordinates: params.coordinates ?? {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: params.generation ?? GenerationParametersFactory.createMinecraftDefault(),
      noise: params.noise ?? NoiseConfigurationFactory.createTerrainNoise(),
      biome: params.biome ?? BiomePropertiesFactory.createTemperateForest(),
    }

    return world
  },

  /**
   * 地形タイプ別ワールド作成
   */
  createByTerrainType: (terrainType: TerrainType): WorldConfiguration =>
    pipe(
      Match.value(terrainType),
      Match.when('flat', () => createFlatWorld()),
      Match.when('amplified', () => createAmplifiedWorld()),
      Match.when('large_biomes', () => createLargeBiomesWorld()),
      Match.when('island', () => createIslandWorld()),
      Match.orElse(() => WorldValueObjectFactory.createMinecraftDefault())
    ),

  /**
   * 気候帯別ワールド作成
   */
  createByClimate: (climate: ClimateClassification): WorldConfiguration => {
    const world: WorldConfiguration = {
      seed: WorldSeedOperations.generateRandomSeed(),
      coordinates: {
        spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
        worldBorder: WORLD_COORDINATE_LIMITS,
      },
      generation: GenerationParametersFactory.createForClimate(climate),
      noise: NoiseConfigurationFactory.createTerrainNoise(),
      biome: BiomePropertiesFactory.createFromClimate(climate),
    }

    return world
  },
} as const

/**
 * カスタムワールド作成パラメータ
 */
export type CustomWorldParams = {
  readonly seed?: WorldSeed
  readonly coordinates?: {
    readonly spawn: WorldCoordinate
    readonly worldBorder: WorldBorderConfig
  }
  readonly generation?: GenerationParametersConfig
  readonly noise?: AdvancedNoiseSettings
  readonly biome?: BiomePropertiesBundle
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
  validateCompleteWorld: (world: WorldConfiguration): boolean =>
    pipe(
      Either.try({
        try: () => ({
          coordinatesValid: CoordinateTransforms.isValidWorldCoordinate(world.coordinates.spawn),
          noiseValid: NoiseConfigurationValidation.validateNoiseSettings(world.noise),
          biomeValid: BiomePropertiesValidation.validateEnvironmentalConsistency(world.biome),
        }),
        catch: (error) => error,
      }),
      Either.getOrElse(() => ({
        coordinatesValid: false,
        noiseValid: false,
        biomeValid: false,
      })),
      ({ coordinatesValid, noiseValid, biomeValid }) => coordinatesValid && noiseValid && biomeValid
    ),

  /**
   * 世界シードの複合検証
   */
  validateSeedCompatibility: (seed: WorldSeed, generation: GenerationParametersConfig): boolean => {
    // シードと生成パラメータの互換性確認
    const seedQuality = WorldSeedOperations.evaluateQuality(seed)
    return seedQuality.overallScore > 0.5
  },

  /**
   * パフォーマンス影響度評価
   */
  evaluatePerformanceImpact: (world: WorldConfiguration): PerformanceImpact => {
    const contributions = [
      pipe(
        Match.value(world.noise.octaves),
        Match.when((octaves) => octaves > 8, () => 0.3),
        Match.orElse(() => 0)
      ),
      pipe(
        Match.value(world.noise.quality),
        Match.when('ultra', () => 0.2),
        Match.orElse(() => 0)
      ),
      pipe(
        Match.value(world.biome.vegetation.layers.length),
        Match.when((layers) => layers > 5, () => 0.2),
        Match.orElse(() => 0)
      ),
      pipe(
        Match.value(world.biome.soil.horizons?.length ?? 0),
        Match.when((horizons) => horizons > 3, () => 0.1),
        Match.orElse(() => 0)
      ),
      pipe(
        Match.value(world.generation.structures?.density ?? 0),
        Match.when((density) => density > 0.8, () => 0.2),
        Match.orElse(() => 0)
      ),
    ]

    const complexity = contributions.reduce((sum, weight) => sum + weight, 0)

    const level = pipe(
      Match.value(complexity),
      Match.when((value): value is number => value < 0.3, () => 'low' as const),
      Match.when((value) => value < 0.6, () => 'medium' as const),
      Match.orElse(() => 'high' as const)
    )

    return {
      level,
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
  isCompleteWorldConfiguration: (value: unknown): value is WorldConfiguration => {
    const validated = pipe(
      value,
      Option.fromPredicate(
        (candidate): candidate is Partial<WorldConfiguration> & Record<string, unknown> =>
          typeof candidate === 'object' && candidate !== null
      ),
      Option.filter(
        (
          candidate
        ): candidate is Partial<WorldConfiguration> & {
          seed: WorldSeed
          coordinates: WorldConfiguration['coordinates']
          generation: WorldConfiguration['generation']
          noise: WorldConfiguration['noise']
          biome: WorldConfiguration['biome']
        } =>
          candidate.seed !== undefined &&
          candidate.coordinates !== undefined &&
          candidate.generation !== undefined &&
          candidate.noise !== undefined &&
          candidate.biome !== undefined
      ),
      Option.filter((candidate) => CoordinateTransforms.isValidWorldCoordinate(candidate.coordinates.spawn)),
      Option.filter((candidate) => candidate.coordinates.worldBorder !== undefined),
      Option.filter((candidate) => {
        const borderKeys = Object.keys(WORLD_COORDINATE_LIMITS) as Array<keyof typeof WORLD_COORDINATE_LIMITS>
        const record = candidate.coordinates
          .worldBorder as Partial<Record<keyof typeof WORLD_COORDINATE_LIMITS, number>> | undefined
        return record !== undefined && borderKeys.every((key) => typeof record[key] === 'number')
      }),
      Option.filter((candidate) => typeof candidate.noise === 'object' && candidate.noise !== null),
      Option.filter((candidate) => typeof candidate.biome === 'object' && candidate.biome !== null),
      Option.filter((candidate) => typeof candidate.generation === 'object' && candidate.generation !== null),
      Option.filter((candidate) => WorldValueObjectValidation.validateCompleteWorld(candidate as WorldConfiguration)),
      Option.map((candidate) => candidate as WorldConfiguration)
    )

    return Option.isSome(validated)
  },
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function createFlatWorld(): WorldConfiguration {
  const world: WorldConfiguration = {
    seed: WorldSeedOperations.fromString('flat_world'),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 4, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createFlat(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: makeUnsafeAmplitude(0.1) },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }

  return world
}

function createAmplifiedWorld(): WorldConfiguration {
  const world: WorldConfiguration = {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 128, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createAmplified(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), amplitude: makeUnsafeAmplitude(500) },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }

  return world
}

function createLargeBiomesWorld(): WorldConfiguration {
  const world: WorldConfiguration = {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: WORLD_COORDINATE_LIMITS,
    },
    generation: GenerationParametersFactory.createLargeBiomes(),
    noise: { ...NoiseConfigurationFactory.createTerrainNoise(), scale: makeUnsafeScale(4.0) },
    biome: BiomePropertiesFactory.createTemperateForest(),
  }

  return world
}

function createIslandWorld(): WorldConfiguration {
  const world: WorldConfiguration = {
    seed: WorldSeedOperations.generateRandomSeed(),
    coordinates: {
      spawn: CoordinateTransforms.createWorldCoordinate(0, 64, 0),
      worldBorder: { ...WORLD_COORDINATE_LIMITS, MAX_X: 10000, MAX_Z: 10000, MIN_X: -10000, MIN_Z: -10000 },
    },
    generation: GenerationParametersFactory.createIsland(),
    noise: NoiseConfigurationFactory.createTerrainNoise(),
    biome: BiomePropertiesFactory.createTropicalRainforest(),
  }

  return world
}

function generatePerformanceRecommendations(complexity: number): string[] {
  const templates: ReadonlyArray<{ threshold: number; tips: ReadonlyArray<string> }> = [
    {
      threshold: 0.7,
      tips: [
        'ノイズオクターブ数を8以下に削減することを推奨',
        '植生レイヤー数を5以下に制限することを推奨',
      ],
    },
    {
      threshold: 0.5,
      tips: [
        'ノイズ品質を"standard"以下に設定することを推奨',
        '構造物密度を0.8以下に調整することを推奨',
      ],
    },
    {
      threshold: 0.3,
      tips: ['バックグラウンド処理の活用を検討', 'チャンク読み込み最適化の実装を推奨'],
    },
  ]

  return templates.filter(({ threshold }) => complexity > threshold).flatMap(({ tips }) => tips.slice())
}
