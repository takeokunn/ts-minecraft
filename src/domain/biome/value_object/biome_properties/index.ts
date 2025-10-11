/**
 * Biome Properties Value Object - バレルエクスポート
 *
 * 現実的な環境パラメータの完全実装
 * 生態学・気候学・土壌学に基づく高精度環境モデリング
 */

import { Match, pipe } from 'effect'

// 温度範囲設定
export {
  AltitudeTemperatureEffectSchema,
  BIOME_TEMPERATURE_MAPPING,
  CLIMATE_TEMPERATURE_PRESETS,
  ClimateClassificationSchema,
  CreateTemperatureRangeParamsSchema,
  DiurnalTemperatureVariationSchema,
  HeatIndexSchema,
  makeUnsafeTemperatureCelsius,
  makeUnsafeTemperatureDelta,
  SeasonalTemperatureVariationSchema,
  SeasonTypeSchema,
  TemperatureCelsiusSchema,
  TemperatureDeltaSchema,
  TemperatureRangeErrorSchema,
  TemperatureRangeSchema,
  WindChillIndexSchema,
  type AltitudeTemperatureEffect,
  type ClimateClassification,
  type CreateTemperatureRangeParams,
  type DiurnalTemperatureVariation,
  type HeatIndex,
  type SeasonalTemperatureVariation,
  type SeasonType,
  type TemperatureCelsius,
  type TemperatureDelta,
  type TemperatureRange,
  type TemperatureRangeError,
  type WindChillIndex,
} from './temperature_range'

// 湿度レベル設定
export {
  AbsoluteHumiditySchema,
  AtmosphericHumidityStatsSchema,
  BIOME_HUMIDITY_MAPPING,
  CreateHumidityLevelsParamsSchema,
  DewPointSchema,
  DiurnalHumidityPatternSchema,
  HUMIDITY_PRESETS,
  HumidityClassificationSchema,
  HumidityLevelsErrorSchema,
  HumidityLevelsSchema,
  makeUnsafeAbsoluteHumidity,
  makeUnsafeDewPoint,
  makeUnsafeRelativeHumidity,
  makeUnsafeVaporPressure,
  PrecipitationTypeSchema,
  RelativeHumiditySchema,
  SeasonalHumidityVariationSchema,
  VaporPressureSchema,
  WaterVaporCharacteristicsSchema,
  type AbsoluteHumidity,
  type AtmosphericHumidityStats,
  type CreateHumidityLevelsParams,
  type DewPoint,
  type DiurnalHumidityPattern,
  type HumidityClassification,
  type HumidityLevels,
  type HumidityLevelsError,
  type PrecipitationType,
  type RelativeHumidity,
  type SeasonalHumidityVariation,
  type VaporPressure,
  type WaterVaporCharacteristics,
} from './humidity_levels'

// 植生密度設定
export {
  BiomassSchema,
  BIOME_VEGETATION_MAPPING,
  CoverageRatioSchema,
  CreateVegetationDensityParamsSchema,
  DistributionPatternSchema,
  EnvironmentalResponseSchema,
  GrowthStageSchema,
  makeUnsafeBiomass,
  makeUnsafeCoverageRatio,
  makeUnsafeSpeciesDiversityIndex,
  makeUnsafeVegetationDensity,
  SpeciesDiversityIndexSchema,
  VEGETATION_DENSITY_PRESETS,
  VegetationDensityConfigSchema,
  VegetationDensityErrorSchema,
  VegetationDensitySchema,
  VegetationInteractionSchema,
  VegetationLayerSchema,
  VegetationTypeSchema,
  type Biomass,
  type CoverageRatio,
  type CreateVegetationDensityParams,
  type DistributionPattern,
  type EnvironmentalResponse,
  type GrowthStage,
  type SpeciesDiversityIndex,
  type VegetationDensity,
  type VegetationDensityConfig,
  type VegetationDensityError,
  type VegetationInteraction,
  type VegetationLayer,
  type VegetationType,
} from './vegetation_density'

// 土壌組成設定
export {
  BIOME_SOIL_MAPPING,
  CreateSoilCompositionParamsSchema,
  ElectricConductivitySchema,
  makeUnsafeElectricConductivity,
  makeUnsafeOrganicMatterContent,
  makeUnsafeParticleRatio,
  makeUnsafeSoilPH,
  OrganicMatterCompositionSchema,
  OrganicMatterContentSchema,
  ParticleRatioSchema,
  ParticleSizeDistributionSchema,
  SOIL_COMPOSITION_PRESETS,
  SoilChemistrySchema,
  SoilCompositionErrorSchema,
  SoilCompositionSchema,
  SoilDrainageSchema,
  SoilPHSchema,
  SoilPhysicalPropertiesSchema,
  SoilStructureSchema,
  SoilTextureSchema,
  type CreateSoilCompositionParams,
  type ElectricConductivity,
  type OrganicMatterComposition,
  type OrganicMatterContent,
  type ParticleRatio,
  type ParticleSizeDistribution,
  type SoilChemistry,
  type SoilComposition,
  type SoilCompositionError,
  type SoilDrainage,
  type SoilPH,
  type SoilPhysicalProperties,
  type SoilStructure,
  type SoilTexture,
} from './soil_composition'

/**
 * バイオーム特性ファクトリ
 */
export const BiomePropertiesFactory = {
  /**
   * 熱帯雨林バイオーム特性作成
   */
  createTropicalRainforest: () => {
    return createTropicalRainforestProperties()
  },

  /**
   * 温帯森林バイオーム特性作成
   */
  createTemperateForest: () => {
    return createTemperateForestProperties()
  },

  /**
   * 砂漠バイオーム特性作成
   */
  createDesert: () => {
    return createDesertProperties()
  },

  /**
   * サバンナバイオーム特性作成
   */
  createSavanna: () => {
    return createSavannaProperties()
  },

  /**
   * ツンドラバイオーム特性作成
   */
  createTundra: () => {
    return createTundraProperties()
  },

  /**
   * 標準気候からバイオーム特性作成
   */
  createFromClimate: (climate: ClimateClassification): BiomePropertiesBundle => {
    return createBiomeFromClimate(climate)
  },

  /**
   * 環境パラメータからバイオーム特性作成
   */
  createFromEnvironment: (params: EnvironmentalParameters): BiomePropertiesBundle => {
    return createBiomeFromEnvironment(params)
  },
} as const

/**
 * バイオーム特性束
 */
export type BiomePropertiesBundle = {
  temperature: TemperatureRange
  humidity: HumidityLevels
  vegetation: VegetationDensityConfig
  soil: SoilComposition
}

/**
 * 環境パラメータ
 */
export type EnvironmentalParameters = {
  latitude: number
  altitude: number
  coastalDistance: number
  meanTemperature: number
  annualPrecipitation: number
  seasonality: 'low' | 'moderate' | 'high'
}

/**
 * バイオーム特性定数
 */
export const BiomePropertiesConstants = {
  /**
   * 標準気候区分温度閾値
   */
  TEMPERATURE_THRESHOLDS: {
    TROPICAL_MIN: 18.0,
    TEMPERATE_RANGE: [-3.0, 18.0],
    BOREAL_RANGE: [-50.0, -3.0],
    POLAR_MAX: -3.0,
  },

  /**
   * 標準降水量分類
   */
  PRECIPITATION_CLASSES: {
    ARID: 250, // < 250mm
    SEMI_ARID: 500, // 250-500mm
    SUBHUMID: 1000, // 500-1000mm
    HUMID: 2000, // 1000-2000mm
    VERY_HUMID: 2000, // > 2000mm
  },

  /**
   * 植生密度基準値
   */
  VEGETATION_BENCHMARKS: {
    DESERT: 0.05,
    GRASSLAND: 0.6,
    FOREST: 0.8,
    RAINFOREST: 1.0,
  },

  /**
   * 土壌pH基準値
   */
  SOIL_PH_RANGES: {
    STRONGLY_ACIDIC: [3.5, 5.0],
    MODERATELY_ACIDIC: [5.0, 6.0],
    SLIGHTLY_ACIDIC: [6.0, 6.8],
    NEUTRAL: [6.8, 7.2],
    SLIGHTLY_ALKALINE: [7.2, 8.0],
    MODERATELY_ALKALINE: [8.0, 9.0],
    STRONGLY_ALKALINE: [9.0, 10.0],
  },
} as const

/**
 * バイオーム特性検証
 */
export const BiomePropertiesValidation = {
  /**
   * 環境パラメータの整合性検証
   */
  validateEnvironmentalConsistency: (bundle: BiomePropertiesBundle): boolean => {
    // 温度と植生の整合性
    const tempMean = bundle.temperature.annual.mean
    const vegDensity = bundle.vegetation.overall.totalDensity

    // 高温地域での高密度植生（熱帯雨林等）
    if (tempMean > 20 && vegDensity > 0.8) {
      return bundle.humidity.annual.mean > 70
    }

    // 低温地域での植生制限
    if (tempMean < 0 && vegDensity > 0.5) {
      return false
    }

    // 湿度と土壌の整合性
    const humidity = bundle.humidity.annual.mean
    const soilOM = bundle.soil.organicMatter.totalOrganicMatter

    // 高湿度地域での有機物蓄積
    if (humidity > 80 && soilOM < 0.03) {
      return false
    }

    return true
  },

  /**
   * 気候分類との整合性確認
   */
  validateClimateClassification: (bundle: BiomePropertiesBundle, expectedClimate: ClimateClassification): boolean => {
    const temp = bundle.temperature.annual.mean
    const precip = bundle.humidity.annual.mean

    return pipe(
      Match.value(expectedClimate),
      Match.when('tropical', () => temp > 18 && precip > 60),
      Match.when('arid', () => precip < 30),
      Match.when('temperate', () => temp >= -3 && temp <= 18),
      Match.when('polar', () => temp < -3),
      Match.orElse(() => true)
    )
  },

  /**
   * 生態学的キャリング・キャパシティ検証
   */
  validateCarryingCapacity: (vegetation: VegetationDensityConfig): boolean => {
    const totalBiomass = vegetation.overall.totalBiomass
    const maxCapacity = vegetation.carryingCapacity.maxBiomass

    return totalBiomass <= maxCapacity
  },
} as const

/**
 * 型ガード
 */
export const BiomePropertiesTypeGuards = {
  /**
   * TemperatureRangeの型ガード
   */
  isTemperatureRange: (value: unknown): value is TemperatureRange => {
    return typeof value === 'object' && value !== null && 'climate' in value && 'annual' in value && 'seasonal' in value
  },

  /**
   * HumidityLevelsの型ガード
   */
  isHumidityLevels: (value: unknown): value is HumidityLevels => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'classification' in value &&
      'annual' in value &&
      'waterVapor' in value
    )
  },

  /**
   * VegetationDensityConfigの型ガード
   */
  isVegetationDensityConfig: (value: unknown): value is VegetationDensityConfig => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'overall' in value &&
      'layers' in value &&
      'carryingCapacity' in value
    )
  },

  /**
   * SoilCompositionの型ガード
   */
  isSoilComposition: (value: unknown): value is SoilComposition => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'particleDistribution' in value &&
      'chemistry' in value &&
      'physicalProperties' in value
    )
  },
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function createTropicalRainforestProperties(): BiomePropertiesBundle {
  const temperaturePreset = CLIMATE_TEMPERATURE_PRESETS.TROPICAL
  const humidityPreset = HUMIDITY_PRESETS.TROPICAL_RAINFOREST
  const vegetationPreset = VEGETATION_DENSITY_PRESETS.TROPICAL_RAINFOREST
  const soilPreset = SOIL_COMPOSITION_PRESETS.LOAMY_SOIL

  return {
    temperature: createTemperatureFromPreset(temperaturePreset),
    humidity: createHumidityFromPreset(humidityPreset),
    vegetation: createVegetationFromPreset(vegetationPreset),
    soil: createSoilFromPreset(soilPreset),
  }
}

function createTemperateForestProperties(): BiomePropertiesBundle {
  const temperaturePreset = CLIMATE_TEMPERATURE_PRESETS.TEMPERATE
  const humidityPreset = HUMIDITY_PRESETS.TEMPERATE_FOREST
  const vegetationPreset = VEGETATION_DENSITY_PRESETS.TEMPERATE_FOREST
  const soilPreset = SOIL_COMPOSITION_PRESETS.LOAMY_SOIL

  return {
    temperature: createTemperatureFromPreset(temperaturePreset),
    humidity: createHumidityFromPreset(humidityPreset),
    vegetation: createVegetationFromPreset(vegetationPreset),
    soil: createSoilFromPreset(soilPreset),
  }
}

function createDesertProperties(): BiomePropertiesBundle {
  const temperaturePreset = CLIMATE_TEMPERATURE_PRESETS.ARID
  const humidityPreset = HUMIDITY_PRESETS.DESERT
  const vegetationPreset = VEGETATION_DENSITY_PRESETS.SPARSE_DESERT
  const soilPreset = SOIL_COMPOSITION_PRESETS.SANDY_SOIL

  return {
    temperature: createTemperatureFromPreset(temperaturePreset),
    humidity: createHumidityFromPreset(humidityPreset),
    vegetation: createVegetationFromPreset(vegetationPreset),
    soil: createSoilFromPreset(soilPreset),
  }
}

function createSavannaProperties(): BiomePropertiesBundle {
  const temperaturePreset = CLIMATE_TEMPERATURE_PRESETS.TROPICAL
  const humidityPreset = HUMIDITY_PRESETS.MEDITERRANEAN
  const vegetationPreset = VEGETATION_DENSITY_PRESETS.SAVANNA
  const soilPreset = SOIL_COMPOSITION_PRESETS.SANDY_SOIL

  return {
    temperature: createTemperatureFromPreset(temperaturePreset),
    humidity: createHumidityFromPreset(humidityPreset),
    vegetation: createVegetationFromPreset(vegetationPreset),
    soil: createSoilFromPreset(soilPreset),
  }
}

function createTundraProperties(): BiomePropertiesBundle {
  const temperaturePreset = CLIMATE_TEMPERATURE_PRESETS.POLAR
  const humidityPreset = HUMIDITY_PRESETS.POLAR
  const vegetationPreset = VEGETATION_DENSITY_PRESETS.ALPINE_TUNDRA
  const soilPreset = SOIL_COMPOSITION_PRESETS.PEAT_SOIL

  return {
    temperature: createTemperatureFromPreset(temperaturePreset),
    humidity: createHumidityFromPreset(humidityPreset),
    vegetation: createVegetationFromPreset(vegetationPreset),
    soil: createSoilFromPreset(soilPreset),
  }
}

function createBiomeFromClimate(climate: ClimateClassification): BiomePropertiesBundle {
  return pipe(
    Match.value(climate),
    Match.when('tropical', () => createTropicalRainforestProperties()),
    Match.when('arid', () => createDesertProperties()),
    Match.when('temperate', () => createTemperateForestProperties()),
    Match.when('polar', () => createTundraProperties()),
    Match.orElse(() => createTemperateForestProperties())
  )
}

function createBiomeFromEnvironment(params: EnvironmentalParameters): BiomePropertiesBundle {
  // 簡略的な環境パラメータからの推定
  const { meanTemperature, annualPrecipitation } = params

  if (meanTemperature > 18 && annualPrecipitation > 1500) {
    return createTropicalRainforestProperties()
  } else if (annualPrecipitation < 250) {
    return createDesertProperties()
  } else if (meanTemperature < -3) {
    return createTundraProperties()
  } else {
    return createTemperateForestProperties()
  }
}

// 簡略的なプリセット→オブジェクト変換ヘルパー
function createTemperatureFromPreset(preset: any): TemperatureRange {
  return {
    id: 'temp_range_generated',
    name: preset.description,
    climate: 'temperate',
    annual: {
      mean: makeUnsafeTemperatureCelsius(preset.annual.mean),
      minimum: makeUnsafeTemperatureCelsius(preset.annual.minimum),
      maximum: makeUnsafeTemperatureCelsius(preset.annual.maximum),
      range: makeUnsafeTemperatureDelta(preset.annual.range),
    },
    seasonal: [],
    diurnal: {
      minimum: makeUnsafeTemperatureCelsius(preset.annual.mean - 5),
      maximum: makeUnsafeTemperatureCelsius(preset.annual.mean + 5),
      average: makeUnsafeTemperatureCelsius(preset.annual.mean),
      amplitude: makeUnsafeTemperatureDelta(10),
      peakHour: 14,
      minimumHour: 6,
    },
    environmentalResponse: {
      temperatureResponse: {
        optimalRange: { minimum: preset.annual.mean - 10, maximum: preset.annual.mean + 10 },
        toleranceRange: { minimum: preset.annual.minimum, maximum: preset.annual.maximum },
        growthCurve: 'bell_curve',
      },
      moistureResponse: {
        optimalMoisture: 0.6,
        droughtTolerance: 0.3,
        floodTolerance: 0.2,
        waterUseEfficiency: 5.0,
      },
      lightResponse: {
        lightRequirement: 'intermediate',
        lightSaturationPoint: 800,
        lightCompensationPoint: 20,
      },
      soilResponse: {
        pHOptimal: 6.5,
        pHTolerance: { minimum: 5.5, maximum: 7.5 },
        nutrientRequirement: 'moderate',
        saltTolerance: 0.3,
      },
    },
  }
}

function createHumidityFromPreset(preset: any): HumidityLevels {
  return {
    id: 'humidity_generated',
    name: preset.description,
    classification: preset.classification,
    annual: {
      mean: makeUnsafeRelativeHumidity(preset.annual.mean),
      minimum: makeUnsafeRelativeHumidity(preset.annual.minimum),
      maximum: makeUnsafeRelativeHumidity(preset.annual.maximum),
      standardDeviation: 10,
      percentiles: {
        p25: makeUnsafeRelativeHumidity(preset.annual.mean - 15),
        p50: makeUnsafeRelativeHumidity(preset.annual.mean),
        p75: makeUnsafeRelativeHumidity(preset.annual.mean + 15),
        p90: makeUnsafeRelativeHumidity(preset.annual.mean + 20),
        p95: makeUnsafeRelativeHumidity(preset.annual.mean + 25),
      },
      variability: {
        coefficientOfVariation: 0.2,
        interquartileRange: 30,
      },
    },
    seasonal: [],
    diurnal: {
      maximum: makeUnsafeRelativeHumidity(preset.annual.mean + 20),
      maximumHour: 6,
      minimum: makeUnsafeRelativeHumidity(preset.annual.mean - 20),
      minimumHour: 14,
      average: makeUnsafeRelativeHumidity(preset.annual.mean),
      amplitude: 40,
      pattern: 'regular',
    },
    waterVapor: {
      absoluteHumidity: makeUnsafeAbsoluteHumidity(15),
      vaporPressure: makeUnsafeVaporPressure(20),
      saturationVaporPressure: makeUnsafeVaporPressure(25),
      dewPoint: makeUnsafeDewPoint(10),
    },
  }
}

function createVegetationFromPreset(preset: any): VegetationDensityConfig {
  return {
    id: 'vegetation_generated',
    name: preset.description,
    overall: {
      totalDensity: makeUnsafeVegetationDensity(preset.density),
      totalBiomass: makeUnsafeBiomass(preset.biomass),
      totalCoverage: makeUnsafeCoverageRatio(preset.coverage),
      speciesDiversity: makeUnsafeSpeciesDiversityIndex(preset.diversity),
    },
    layers: [
      {
        id: 'primary_layer',
        name: 'Primary vegetation',
        type: 'trees',
        height: { minimum: 0, maximum: 30, average: 15 },
        density: makeUnsafeVegetationDensity(preset.density),
        coverage: makeUnsafeCoverageRatio(preset.coverage),
        biomass: makeUnsafeBiomass(preset.biomass),
        distribution: { pattern: 'random' },
      },
    ],
    environmentalResponse: {
      temperatureResponse: {
        optimalRange: { minimum: 15, maximum: 25 },
        toleranceRange: { minimum: -10, maximum: 40 },
        growthCurve: 'bell_curve',
      },
      moistureResponse: {
        optimalMoisture: 0.6,
        droughtTolerance: 0.3,
        floodTolerance: 0.2,
        waterUseEfficiency: 5.0,
      },
      lightResponse: {
        lightRequirement: 'intermediate',
        lightSaturationPoint: 800,
        lightCompensationPoint: 20,
      },
      soilResponse: {
        pHOptimal: 6.5,
        pHTolerance: { minimum: 5.5, maximum: 7.5 },
        nutrientRequirement: 'moderate',
      },
    },
    carryingCapacity: {
      maxBiomass: makeUnsafeBiomass(preset.biomass * 1.5),
      maxDensity: makeUnsafeVegetationDensity(preset.density * 1.2),
      limitingFactors: ['light', 'water', 'nutrients'],
      growthRate: 0.1,
      carryingCapacityModel: 'logistic',
    },
  }
}

function createSoilFromPreset(preset: any): SoilComposition {
  return {
    id: 'soil_generated',
    name: preset.description,
    particleDistribution: {
      coarseSand: makeUnsafeParticleRatio(preset.particles?.sand * 0.4 || 0.2),
      mediumSand: makeUnsafeParticleRatio(preset.particles?.sand * 0.4 || 0.2),
      fineSand: makeUnsafeParticleRatio(preset.particles?.sand * 0.2 || 0.1),
      silt: makeUnsafeParticleRatio(preset.particles?.silt || 0.3),
      clay: makeUnsafeParticleRatio(preset.particles?.clay || 0.2),
      total: 1.0,
    },
    chemistry: {
      pH: makeUnsafeSoilPH(preset.pH),
      electricConductivity: makeUnsafeElectricConductivity(1.0),
      cationExchangeCapacity: 15,
      baseSaturation: 75,
      macronutrients: {
        nitrogen: 1000,
        phosphorus: 50,
        potassium: 200,
      },
    },
    organicMatter: {
      totalOrganicMatter: makeUnsafeOrganicMatterContent(preset.organicMatter),
      organicCarbon: preset.organicMatter * 58,
      carbonNitrogenRatio: 12,
      decompositionStage: 'well_decomposed',
    },
    physicalProperties: {
      texture: preset.texture,
      structure: { type: 'granular', grade: 'moderate', size: 'medium' },
      density: { bulk: 1.3, particle: 2.65 },
      porosity: { total: 0.5, macroporosity: 0.2, microporosity: 0.3 },
      waterCharacteristics: {
        fieldCapacity: 0.25,
        wiltingPoint: 0.12,
        availableWater: 0.13,
        saturatedConductivity: 10,
      },
      drainage: preset.drainage,
      permeability: 'moderate',
    },
  }
}
