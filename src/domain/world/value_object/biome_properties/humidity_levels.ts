/**
 * HumidityLevels Value Object - 湿度レベル設定
 *
 * 現実的な大気湿度の数学的モデリング
 * 相対湿度・絶対湿度・露点温度の正確な計算
 */

import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'
import { Brand } from 'effect'
import type { Brand as BrandType } from 'effect'

/**
 * 相対湿度Brand型（0%から100%）
 */
export type RelativeHumidity = number & BrandType.Brand<'RelativeHumidity'>

/**
 * 絶対湿度Brand型（g/m³、0から100）
 */
export type AbsoluteHumidity = number & BrandType.Brand<'AbsoluteHumidity'>

/**
 * 露点温度Brand型（-50℃から40℃）
 */
export type DewPoint = number & BrandType.Brand<'DewPoint'>

/**
 * 水蒸気圧Brand型（hPa、0から100）
 */
export type VaporPressure = number & BrandType.Brand<'VaporPressure'>

/**
 * 相対湿度Schema
 */
export const RelativeHumiditySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 100.0),
  Schema.brand('RelativeHumidity'),
  Schema.annotations({
    identifier: 'RelativeHumidity',
    title: 'Relative Humidity',
    description: 'Relative humidity percentage (0% to 100%)',
    examples: [30, 50, 70, 85, 95]
  })
)

/**
 * 絶対湿度Schema
 */
export const AbsoluteHumiditySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 100.0),
  Schema.brand('AbsoluteHumidity'),
  Schema.annotations({
    identifier: 'AbsoluteHumidity',
    title: 'Absolute Humidity',
    description: 'Absolute humidity in grams per cubic meter (0 to 100 g/m³)',
    examples: [5, 10, 15, 25, 35]
  })
)

/**
 * 露点温度Schema
 */
export const DewPointSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-50.0, 40.0),
  Schema.brand('DewPoint'),
  Schema.annotations({
    identifier: 'DewPoint',
    title: 'Dew Point Temperature',
    description: 'Dew point temperature in Celsius (-50°C to 40°C)',
    examples: [-20, -5, 5, 15, 25]
  })
)

/**
 * 水蒸気圧Schema
 */
export const VaporPressureSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 100.0),
  Schema.brand('VaporPressure'),
  Schema.annotations({
    identifier: 'VaporPressure',
    title: 'Water Vapor Pressure',
    description: 'Water vapor pressure in hectopascals (0 to 100 hPa)',
    examples: [5, 10, 20, 35, 50]
  })
)

/**
 * 湿度分類
 */
export const HumidityClassificationSchema = Schema.Literal(
  'arid',         // 乾燥（RH < 30%）
  'semi_arid',    // 半乾燥（RH 30-50%）
  'moderate',     // 適度（RH 50-70%）
  'humid',        // 湿潤（RH 70-85%）
  'very_humid',   // 非常に湿潤（RH 85-95%）
  'saturated'     // 飽和（RH > 95%）
).pipe(
  Schema.annotations({
    title: 'Humidity Classification',
    description: 'Classification of humidity levels based on relative humidity'
  })
)

export type HumidityClassification = typeof HumidityClassificationSchema.Type

/**
 * 降水タイプ
 */
export const PrecipitationTypeSchema = Schema.Literal(
  'none',         // なし
  'drizzle',      // 霧雨
  'light_rain',   // 小雨
  'moderate_rain', // 中雨
  'heavy_rain',   // 大雨
  'snow',         // 雪
  'sleet',        // みぞれ
  'hail',         // 雹
  'fog',          // 霧
  'mist'          // 靄
).pipe(
  Schema.annotations({
    title: 'Precipitation Type',
    description: 'Type of precipitation associated with humidity conditions'
  })
)

export type PrecipitationType = typeof PrecipitationTypeSchema.Type

/**
 * 大気湿度統計
 */
export const AtmosphericHumidityStatsSchema = Schema.Struct({
  // 基本統計
  mean: RelativeHumiditySchema,
  minimum: RelativeHumiditySchema,
  maximum: RelativeHumiditySchema,
  standardDeviation: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 30),
    Schema.annotations({ description: 'Standard deviation of humidity measurements' })
  ),

  // 分位数
  percentiles: Schema.Struct({
    p25: RelativeHumiditySchema,
    p50: RelativeHumiditySchema,  // median
    p75: RelativeHumiditySchema,
    p90: RelativeHumiditySchema,
    p95: RelativeHumiditySchema
  }),

  // 変動特性
  variability: Schema.Struct({
    coefficientOfVariation: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 2),
      Schema.annotations({ description: 'Coefficient of variation (0-2)' })
    ),
    interquartileRange: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100),
      Schema.annotations({ description: 'Interquartile range in humidity percentage' })
    )
  })
}).pipe(
  Schema.annotations({
    identifier: 'AtmosphericHumidityStats',
    title: 'Atmospheric Humidity Statistics',
    description: 'Statistical analysis of atmospheric humidity measurements'
  })
)

export type AtmosphericHumidityStats = typeof AtmosphericHumidityStatsSchema.Type

/**
 * 日変動湿度パターン
 */
export const DiurnalHumidityPatternSchema = Schema.Struct({
  // 最高湿度（通常早朝）
  maximum: RelativeHumiditySchema,
  maximumHour: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 23),
    Schema.annotations({ description: 'Hour of maximum humidity (0-23)' })
  ),

  // 最低湿度（通常午後）
  minimum: RelativeHumiditySchema,
  minimumHour: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 23),
    Schema.annotations({ description: 'Hour of minimum humidity (0-23)' })
  ),

  // 平均湿度
  average: RelativeHumiditySchema,

  // 振幅
  amplitude: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 80),
    Schema.annotations({ description: 'Diurnal humidity amplitude (percentage points)' })
  ),

  // 変化パターン
  pattern: Schema.Literal(
    'regular',      // 規則的変化
    'irregular',    // 不規則変化
    'bimodal',      // 二峰性
    'plateau'       // 平坦
  ),

  // 時間別湿度（24時間）
  hourlyValues: Schema.Array(RelativeHumiditySchema).pipe(
    Schema.minItems(24),
    Schema.maxItems(24),
    Schema.annotations({ description: 'Hourly humidity values for 24-hour period' })
  ).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'DiurnalHumidityPattern',
    title: 'Daily Humidity Pattern',
    description: 'Humidity changes throughout a 24-hour period'
  })
)

export type DiurnalHumidityPattern = typeof DiurnalHumidityPatternSchema.Type

/**
 * 季節湿度変動
 */
export const SeasonalHumidityVariationSchema = Schema.Struct({
  // 季節識別
  season: Schema.Literal('spring', 'summer', 'autumn', 'winter', 'wet_season', 'dry_season'),

  // 湿度統計
  humidityStats: AtmosphericHumidityStatsSchema,

  // 降水関連
  precipitation: Schema.Struct({
    probability: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Probability of precipitation (0-1)' })
    ),
    typicalType: PrecipitationTypeSchema,
    intensity: Schema.Literal('none', 'light', 'moderate', 'heavy', 'extreme')
  }),

  // 蒸発散
  evapotranspiration: Schema.Struct({
    potential: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 300),
      Schema.annotations({ description: 'Potential evapotranspiration (mm/month)' })
    ),
    actual: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 300),
      Schema.annotations({ description: 'Actual evapotranspiration (mm/month)' })
    )
  }).pipe(Schema.optional),

  // 土壌水分
  soilMoisture: Schema.Struct({
    availability: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Soil moisture availability (0-1)' })
    ),
    fieldCapacity: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Field capacity ratio (0-1)' })
    ),
    wiltingPoint: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Wilting point ratio (0-1)' })
    )
  }).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'SeasonalHumidityVariation',
    title: 'Seasonal Humidity Variation',
    description: 'Humidity patterns and characteristics for a specific season'
  })
)

export type SeasonalHumidityVariation = typeof SeasonalHumidityVariationSchema.Type

/**
 * 水蒸気特性
 */
export const WaterVaporCharacteristicsSchema = Schema.Struct({
  // 絶対湿度
  absoluteHumidity: AbsoluteHumiditySchema,

  // 水蒸気圧
  vaporPressure: VaporPressureSchema,

  // 飽和水蒸気圧
  saturationVaporPressure: VaporPressureSchema,

  // 露点温度
  dewPoint: DewPointSchema,

  // 湿球温度
  wetBulbTemperature: Schema.Number.pipe(
    Schema.between(-40, 50),
    Schema.annotations({ description: 'Wet bulb temperature in Celsius' })
  ).pipe(Schema.optional),

  // 混合比
  mixingRatio: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 50),
    Schema.annotations({ description: 'Water vapor mixing ratio (g/kg)' })
  ).pipe(Schema.optional),

  // 比湿
  specificHumidity: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 50),
    Schema.annotations({ description: 'Specific humidity (g/kg)' })
  ).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'WaterVaporCharacteristics',
    title: 'Water Vapor Characteristics',
    description: 'Comprehensive water vapor properties and measurements'
  })
)

export type WaterVaporCharacteristics = typeof WaterVaporCharacteristicsSchema.Type

/**
 * 完全湿度レベル設定
 */
export const HumidityLevelsSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for humidity configuration' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for humidity levels' })
  ),
  description: Schema.String.pipe(
    Schema.maxLength(500),
    Schema.annotations({ description: 'Detailed description of humidity characteristics' })
  ).pipe(Schema.optional),

  // 湿度分類
  classification: HumidityClassificationSchema,

  // 年間湿度統計
  annual: AtmosphericHumidityStatsSchema,

  // 季節変動
  seasonal: Schema.Array(SeasonalHumidityVariationSchema).pipe(
    Schema.minItems(2),
    Schema.maxItems(6),
    Schema.annotations({ description: 'Seasonal humidity variations' })
  ),

  // 日変動パターン
  diurnal: DiurnalHumidityPatternSchema,

  // 水蒸気特性
  waterVapor: WaterVaporCharacteristicsSchema,

  // 気圧効果
  pressureEffects: Schema.Struct({
    // 気圧（hPa）
    atmosphericPressure: Schema.Number.pipe(
      Schema.between(800, 1100),
      Schema.annotations({ description: 'Atmospheric pressure in hectopascals' })
    ),

    // 標高補正
    altitudeCorrection: Schema.Boolean,

    // 気圧変動による湿度変化
    pressureHumidityCoefficient: Schema.Number.pipe(
      Schema.between(-0.5, 0.5),
      Schema.annotations({ description: 'Humidity change per hPa pressure change' })
    )
  }).pipe(Schema.optional),

  // 風の影響
  windEffects: Schema.Struct({
    // 風速（m/s）
    windSpeed: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 50),
      Schema.annotations({ description: 'Wind speed in meters per second' })
    ),

    // 風向き
    windDirection: Schema.Number.pipe(
      Schema.between(0, 360),
      Schema.annotations({ description: 'Wind direction in degrees (0-360)' })
    ).pipe(Schema.optional),

    // 風による乾燥効果
    dryingEffect: Schema.Number.pipe(
      Schema.between(0, 2),
      Schema.annotations({ description: 'Wind drying effect multiplier' })
    ),

    // 海風・陸風効果
    landSeaBreeze: Schema.Struct({
      enabled: Schema.Boolean,
      moistureTransport: Schema.Number.pipe(Schema.between(0, 1)),
      timingOffset: Schema.Number.pipe(Schema.between(0, 12))
    }).pipe(Schema.optional)
  }).pipe(Schema.optional),

  // 凝結・降水条件
  condensation: Schema.Struct({
    // 雲形成閾値
    cloudFormationThreshold: RelativeHumiditySchema,

    // 降水開始閾値
    precipitationThreshold: RelativeHumiditySchema,

    // 霧形成条件
    fogFormation: Schema.Struct({
      humidityThreshold: RelativeHumiditySchema,
      temperatureDewPointDifference: Schema.Number.pipe(
        Schema.between(0, 5),
        Schema.annotations({ description: 'Max temperature-dew point difference for fog' })
      ),
      windSpeedLimit: Schema.Number.pipe(
        Schema.between(0, 10),
        Schema.annotations({ description: 'Maximum wind speed for fog formation' })
      )
    }).pipe(Schema.optional),

    // 露・霜形成
    dewFrostFormation: Schema.Struct({
      dewPointThreshold: DewPointSchema,
      radiativeCooling: Schema.Boolean,
      surfaceType: Schema.Literal('grass', 'pavement', 'water', 'soil')
    }).pipe(Schema.optional)
  }).pipe(Schema.optional),

  // 健康・快適性指標
  comfortIndex: Schema.Struct({
    // 体感湿度
    perceivedHumidity: RelativeHumiditySchema,

    // 不快指数
    discomfortIndex: Schema.Number.pipe(
      Schema.between(50, 100),
      Schema.annotations({ description: 'Discomfort index (50-100)' })
    ).pipe(Schema.optional),

    // THI（Temperature-Humidity Index）
    temperatureHumidityIndex: Schema.Number.pipe(
      Schema.between(40, 100),
      Schema.annotations({ description: 'Temperature-Humidity Index' })
    ).pipe(Schema.optional),

    // カビ・細菌リスク
    microbiologyRisk: Schema.Literal('low', 'moderate', 'high', 'extreme').pipe(Schema.optional)
  }).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'HumidityLevels',
    title: 'Complete Humidity Levels Configuration',
    description: 'Comprehensive humidity levels with atmospheric modeling'
  })
)

export type HumidityLevels = typeof HumidityLevelsSchema.Type

/**
 * 湿度レベル作成パラメータ
 */
export const CreateHumidityLevelsParamsSchema = Schema.Struct({
  classification: HumidityClassificationSchema.pipe(Schema.optional),
  latitude: Schema.Number.pipe(Schema.between(-90, 90)).pipe(Schema.optional),
  coastalDistance: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
  elevation: Schema.Number.pipe(Schema.between(-500, 9000)).pipe(Schema.optional),
  seasonalVariation: Schema.Literal('low', 'moderate', 'high').pipe(Schema.optional),
  precipitationPattern: Schema.Literal('even', 'seasonal', 'monsoon', 'arid').pipe(Schema.optional)
})

export type CreateHumidityLevelsParams = typeof CreateHumidityLevelsParamsSchema.Type

/**
 * 湿度レベルエラー型
 */
export const HumidityLevelsErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidHumidityRange'),
    minimum: Schema.Number,
    maximum: Schema.Number,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('ThermodynamicInconsistency'),
    temperature: Schema.Number,
    humidity: Schema.Number,
    dewPoint: Schema.Number,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('SeasonalLogicError'),
    season: Schema.String,
    parameter: Schema.String,
    conflict: Schema.String,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('PhysicalLimitExceeded'),
    parameter: Schema.String,
    value: Schema.Number,
    physicalLimit: Schema.Number,
    message: Schema.String
  })
])

export type HumidityLevelsError = typeof HumidityLevelsErrorSchema.Type

/**
 * 標準湿度プリセット
 */
export const HUMIDITY_PRESETS = {
  DESERT: {
    description: 'Arid desert conditions',
    classification: 'arid',
    annual: { mean: 25, minimum: 10, maximum: 45 },
    diurnalVariation: 35, // high variation due to lack of moisture buffer
    seasonalVariation: 15
  },
  TEMPERATE_FOREST: {
    description: 'Temperate forest conditions',
    classification: 'moderate',
    annual: { mean: 65, minimum: 40, maximum: 85 },
    diurnalVariation: 20,
    seasonalVariation: 25
  },
  TROPICAL_RAINFOREST: {
    description: 'Tropical rainforest conditions',
    classification: 'very_humid',
    annual: { mean: 88, minimum: 75, maximum: 98 },
    diurnalVariation: 15, // low variation due to abundant moisture
    seasonalVariation: 10
  },
  MEDITERRANEAN: {
    description: 'Mediterranean climate',
    classification: 'moderate',
    annual: { mean: 60, minimum: 35, maximum: 80 },
    diurnalVariation: 25,
    seasonalVariation: 30 // dry summers, wet winters
  },
  POLAR: {
    description: 'Polar/arctic conditions',
    classification: 'moderate',
    annual: { mean: 70, minimum: 50, maximum: 95 },
    diurnalVariation: 10,
    seasonalVariation: 20
  },
  COASTAL: {
    description: 'Coastal oceanic conditions',
    classification: 'humid',
    annual: { mean: 75, minimum: 60, maximum: 90 },
    diurnalVariation: 15, // moderated by ocean
    seasonalVariation: 15
  }
} as const

/**
 * バイオーム湿度マッピング
 */
export const BIOME_HUMIDITY_MAPPING = {
  DESERT: { mean: 25, range: 35, classification: 'arid' },
  SAVANNA: { mean: 45, range: 40, classification: 'semi_arid' },
  PLAINS: { mean: 60, range: 30, classification: 'moderate' },
  FOREST: { mean: 70, range: 25, classification: 'humid' },
  TAIGA: { mean: 65, range: 30, classification: 'moderate' },
  JUNGLE: { mean: 85, range: 20, classification: 'very_humid' },
  SWAMP: { mean: 90, range: 15, classification: 'saturated' },
  MUSHROOM_ISLAND: { mean: 80, range: 20, classification: 'humid' },
  OCEAN: { mean: 75, range: 20, classification: 'humid' },
  FROZEN_OCEAN: { mean: 70, range: 25, classification: 'moderate' },
  MOUNTAINS: { mean: 55, range: 35, classification: 'moderate' },
  ICE_SPIKES: { mean: 65, range: 30, classification: 'moderate' }
} as const
