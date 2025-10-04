/**
 * TemperatureRange Value Object - 温度範囲設定
 *
 * 現実的な気候データに基づく温度範囲の数学的モデリング
 * 熱力学的整合性と季節変動の正確な表現
 */

import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'

/**
 * 摂氏温度Brand型（-50℃から60℃）
 */
export type TemperatureCelsius = number & BrandType.Brand<'TemperatureCelsius'>

/**
 * 温度差Brand型（正の数値）
 */
export type TemperatureDelta = number & BrandType.Brand<'TemperatureDelta'>

/**
 * 熱指数Brand型（体感温度、-60℃から80℃）
 */
export type HeatIndex = number & BrandType.Brand<'HeatIndex'>

/**
 * 冷風指数Brand型（風冷指数、-80℃から20℃）
 */
export type WindChillIndex = number & BrandType.Brand<'WindChillIndex'>

/**
 * 摂氏温度Schema
 */
export const TemperatureCelsiusSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-50.0, 60.0),
  Schema.brand('TemperatureCelsius'),
  Schema.annotations({
    identifier: 'TemperatureCelsius',
    title: 'Temperature in Celsius',
    description: 'Temperature in Celsius degrees (-50°C to 60°C)',
    examples: [-40, -10, 0, 20, 35, 50],
  })
)

/**
 * 温度差Schema
 */
export const TemperatureDeltaSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 110.0),
  Schema.brand('TemperatureDelta'),
  Schema.annotations({
    identifier: 'TemperatureDelta',
    title: 'Temperature Difference',
    description: 'Temperature difference in Celsius (0°C to 110°C)',
    examples: [5, 10, 20, 30, 50],
  })
)

/**
 * 熱指数Schema
 */
export const HeatIndexSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-60.0, 80.0),
  Schema.brand('HeatIndex'),
  Schema.annotations({
    identifier: 'HeatIndex',
    title: 'Heat Index',
    description: 'Perceived temperature considering humidity (-60°C to 80°C)',
    examples: [-40, 0, 25, 35, 45],
  })
)

/**
 * 冷風指数Schema
 */
export const WindChillIndexSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-80.0, 20.0),
  Schema.brand('WindChillIndex'),
  Schema.annotations({
    identifier: 'WindChillIndex',
    title: 'Wind Chill Index',
    description: 'Perceived temperature considering wind speed (-80°C to 20°C)',
    examples: [-60, -30, -10, 0, 10],
  })
)

/**
 * 季節タイプ
 */
export const SeasonTypeSchema = Schema.Literal(
  'spring', // 春
  'summer', // 夏
  'autumn', // 秋
  'winter', // 冬
  'wet_season', // 雨季
  'dry_season' // 乾季
).pipe(
  Schema.annotations({
    title: 'Season Type',
    description: 'Type of season affecting temperature patterns',
  })
)

export type SeasonType = typeof SeasonTypeSchema.Type

/**
 * 気候分類
 */
export const ClimateClassificationSchema = Schema.Literal(
  'tropical', // 熱帯
  'arid', // 乾燥帯
  'temperate', // 温帯
  'continental', // 大陸性
  'polar', // 寒帯
  'highland', // 高地
  'mediterranean', // 地中海性
  'oceanic', // 海洋性
  'subarctic', // 亜寒帯
  'desert' // 砂漠
).pipe(
  Schema.annotations({
    title: 'Climate Classification',
    description: 'Köppen climate classification system',
  })
)

export type ClimateClassification = typeof ClimateClassificationSchema.Type

/**
 * 日間温度変化
 */
export const DiurnalTemperatureVariationSchema = Schema.Struct({
  // 最低温度（通常午前6時頃）
  minimum: TemperatureCelsiusSchema,

  // 最高温度（通常午後2-3時頃）
  maximum: TemperatureCelsiusSchema,

  // 平均温度
  average: TemperatureCelsiusSchema,

  // 温度振幅
  amplitude: TemperatureDeltaSchema,

  // ピーク時刻（0-23時）
  peakHour: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 23),
    Schema.annotations({ description: 'Hour of maximum temperature (0-23)' })
  ),

  // 最低時刻（0-23時）
  minimumHour: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 23),
    Schema.annotations({ description: 'Hour of minimum temperature (0-23)' })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DiurnalTemperatureVariation',
    title: 'Daily Temperature Variation',
    description: 'Temperature changes throughout a 24-hour period',
  })
)

export type DiurnalTemperatureVariation = typeof DiurnalTemperatureVariationSchema.Type

/**
 * 季節温度変化
 */
export const SeasonalTemperatureVariationSchema = Schema.Struct({
  // 季節識別
  season: SeasonTypeSchema,

  // 期間（日数）
  durationDays: Schema.Number.pipe(
    Schema.int(),
    Schema.between(30, 180),
    Schema.annotations({ description: 'Duration of season in days' })
  ),

  // 温度統計
  temperatureStats: Schema.Struct({
    mean: TemperatureCelsiusSchema,
    minimum: TemperatureCelsiusSchema,
    maximum: TemperatureCelsiusSchema,
    standardDeviation: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 30),
      Schema.annotations({ description: 'Temperature standard deviation' })
    ),
  }),

  // 変化率（日平均）
  changeRate: Schema.Struct({
    warming: Schema.Number.pipe(
      Schema.between(-2.0, 2.0),
      Schema.annotations({ description: 'Daily warming rate in °C/day' })
    ),
    cooling: Schema.Number.pipe(
      Schema.between(-2.0, 2.0),
      Schema.annotations({ description: 'Daily cooling rate in °C/day' })
    ),
  }),

  // 極値発生確率
  extremeEvents: Schema.Struct({
    heatWaveProbability: Schema.Number.pipe(Schema.between(0, 1)),
    coldSnapProbability: Schema.Number.pipe(Schema.between(0, 1)),
    frostProbability: Schema.Number.pipe(Schema.between(0, 1)),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'SeasonalTemperatureVariation',
    title: 'Seasonal Temperature Variation',
    description: 'Temperature patterns and statistics for a specific season',
  })
)

export type SeasonalTemperatureVariation = typeof SeasonalTemperatureVariationSchema.Type

/**
 * 標高による温度変化
 */
export const AltitudeTemperatureEffectSchema = Schema.Struct({
  // 基準標高（メートル）
  referenceAltitude: Schema.Number.pipe(
    Schema.between(-500, 9000),
    Schema.annotations({ description: 'Reference altitude in meters' })
  ),

  // 基準温度
  referenceTemperature: TemperatureCelsiusSchema,

  // 気温減率（℃/m）
  lapseRate: Schema.Number.pipe(
    Schema.between(-0.02, 0.01),
    Schema.annotations({ description: 'Temperature lapse rate per meter (°C/m)' })
  ),

  // 湿潤断熱減率
  moistAdiabaticRate: Schema.Number.pipe(
    Schema.between(-0.008, 0.004),
    Schema.annotations({ description: 'Moist adiabatic lapse rate (°C/m)' })
  ).pipe(Schema.optional),

  // 乾燥断熱減率
  dryAdiabaticRate: Schema.Number.pipe(
    Schema.between(-0.012, 0.006),
    Schema.annotations({ description: 'Dry adiabatic lapse rate (°C/m)' })
  ).pipe(Schema.optional),

  // 逆転層設定
  inversionLayer: Schema.Struct({
    enabled: Schema.Boolean,
    baseAltitude: Schema.Number.pipe(Schema.between(0, 3000)),
    topAltitude: Schema.Number.pipe(Schema.between(100, 5000)),
    strength: Schema.Number.pipe(Schema.between(0, 20)),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'AltitudeTemperatureEffect',
    title: 'Altitude Temperature Effect',
    description: 'Temperature variation with altitude (lapse rate effects)',
  })
)

export type AltitudeTemperatureEffect = typeof AltitudeTemperatureEffectSchema.Type

/**
 * 完全温度範囲設定
 */
export const TemperatureRangeSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for temperature range' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for temperature range' })
  ),
  description: Schema.String.pipe(
    Schema.maxLength(500),
    Schema.annotations({ description: 'Detailed description of temperature characteristics' })
  ).pipe(Schema.optional),

  // 気候分類
  climate: ClimateClassificationSchema,

  // 年間温度統計
  annual: Schema.Struct({
    mean: TemperatureCelsiusSchema,
    minimum: TemperatureCelsiusSchema,
    maximum: TemperatureCelsiusSchema,
    range: TemperatureDeltaSchema,
  }),

  // 季節変動
  seasonal: Schema.Array(SeasonalTemperatureVariationSchema).pipe(
    Schema.minItems(2),
    Schema.maxItems(6),
    Schema.annotations({ description: 'Seasonal temperature variations' })
  ),

  // 日変動パターン
  diurnal: DiurnalTemperatureVariationSchema,

  // 標高効果
  altitudeEffect: AltitudeTemperatureEffectSchema.pipe(Schema.optional),

  // 体感温度
  perceivedTemperature: Schema.Struct({
    // 熱指数計算設定
    heatIndex: Schema.Struct({
      enabled: Schema.Boolean,
      humidityThreshold: Schema.Number.pipe(Schema.between(40, 100)),
      temperatureThreshold: TemperatureCelsiusSchema,
    }),

    // 冷風指数計算設定
    windChill: Schema.Struct({
      enabled: Schema.Boolean,
      windSpeedThreshold: Schema.Number.pipe(Schema.between(0, 50)),
      temperatureThreshold: TemperatureCelsiusSchema,
    }),
  }).pipe(Schema.optional),

  // 極値・異常気象
  extremes: Schema.Struct({
    // 記録的高温
    recordHigh: TemperatureCelsiusSchema.pipe(Schema.optional),
    recordHighDate: Schema.String.pipe(Schema.optional),

    // 記録的低温
    recordLow: TemperatureCelsiusSchema.pipe(Schema.optional),
    recordLowDate: Schema.String.pipe(Schema.optional),

    // 異常気象閾値
    heatWaveThreshold: TemperatureCelsiusSchema.pipe(Schema.optional),
    coldWaveThreshold: TemperatureCelsiusSchema.pipe(Schema.optional),

    // 霜・凍結
    frostThreshold: TemperatureCelsiusSchema.pipe(Schema.optional),
    freezingThreshold: TemperatureCelsiusSchema.pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 気候変動効果
  climateChange: Schema.Struct({
    enabled: Schema.Boolean,
    trendPerDecade: Schema.Number.pipe(
      Schema.between(-2.0, 2.0),
      Schema.annotations({ description: 'Temperature trend per decade (°C)' })
    ),
    variabilityChange: Schema.Number.pipe(
      Schema.between(-50, 50),
      Schema.annotations({ description: 'Change in temperature variability (%)' })
    ),
  }).pipe(Schema.optional),

  // 地理的修正因子
  geographical: Schema.Struct({
    // 海洋効果
    oceanicInfluence: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Oceanic influence factor (0-1)' })
    ).pipe(Schema.optional),

    // 大陸効果
    continentalInfluence: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Continental influence factor (0-1)' })
    ).pipe(Schema.optional),

    // 緯度効果
    latitudeEffect: Schema.Number.pipe(
      Schema.between(-90, 90),
      Schema.annotations({ description: 'Latitude in degrees (-90 to 90)' })
    ).pipe(Schema.optional),

    // 局地効果
    localEffects: Schema.Array(
      Schema.Struct({
        type: Schema.Literal('urban_heat', 'cold_air_pooling', 'lake_effect', 'mountain_shadow'),
        strength: Schema.Number.pipe(Schema.between(-10, 10)),
        description: Schema.String,
      })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'TemperatureRange',
    title: 'Complete Temperature Range Configuration',
    description: 'Comprehensive temperature range with realistic climate modeling',
  })
)

export type TemperatureRange = typeof TemperatureRangeSchema.Type

/**
 * 温度範囲作成パラメータ
 */
export const CreateTemperatureRangeParamsSchema = Schema.Struct({
  climate: ClimateClassificationSchema.pipe(Schema.optional),
  latitude: Schema.Number.pipe(Schema.between(-90, 90)).pipe(Schema.optional),
  altitude: Schema.Number.pipe(Schema.between(-500, 9000)).pipe(Schema.optional),
  continentality: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.optional),
  customSeasons: Schema.Array(SeasonTypeSchema).pipe(Schema.optional),
})

export type CreateTemperatureRangeParams = typeof CreateTemperatureRangeParamsSchema.Type

/**
 * 温度範囲エラー型
 */
export const TemperatureRangeErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidTemperatureRange'),
    minimum: Schema.Number,
    maximum: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SeasonalInconsistency'),
    season: SeasonTypeSchema,
    conflict: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PhysicallyImpossible'),
    parameter: Schema.String,
    value: Schema.Number,
    physicalLimit: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ClimateClassificationMismatch'),
    climate: ClimateClassificationSchema,
    temperatureCharacteristic: Schema.String,
    expectedRange: Schema.String,
    actualValue: Schema.Number,
    message: Schema.String,
  }),
])

export type TemperatureRangeError = typeof TemperatureRangeErrorSchema.Type

/**
 * 標準気候プリセット
 */
export const CLIMATE_TEMPERATURE_PRESETS = {
  TROPICAL: {
    description: 'Tropical climate (hot and humid)',
    annual: { mean: 26, minimum: 18, maximum: 35, range: 17 },
    seasonalVariation: 5, // low seasonal variation
    diurnalVariation: 12,
  },
  ARID: {
    description: 'Arid/desert climate (hot and dry)',
    annual: { mean: 24, minimum: -5, maximum: 48, range: 53 },
    seasonalVariation: 20, // moderate seasonal variation
    diurnalVariation: 25, // high diurnal variation
  },
  TEMPERATE: {
    description: 'Temperate climate (moderate temperatures)',
    annual: { mean: 12, minimum: -10, maximum: 30, range: 40 },
    seasonalVariation: 25, // high seasonal variation
    diurnalVariation: 10,
  },
  CONTINENTAL: {
    description: 'Continental climate (extreme seasonal variation)',
    annual: { mean: 6, minimum: -35, maximum: 35, range: 70 },
    seasonalVariation: 40, // very high seasonal variation
    diurnalVariation: 15,
  },
  POLAR: {
    description: 'Polar climate (very cold)',
    annual: { mean: -15, minimum: -45, maximum: 10, range: 55 },
    seasonalVariation: 30, // high seasonal variation
    diurnalVariation: 5, // low diurnal variation
  },
  HIGHLAND: {
    description: 'Highland climate (altitude-modified)',
    annual: { mean: 8, minimum: -20, maximum: 25, range: 45 },
    seasonalVariation: 20,
    diurnalVariation: 18, // high diurnal variation due to thin air
    altitudeFactor: -0.0065, // standard lapse rate
  },
} as const

/**
 * バイオーム温度マッピング
 */
export const BIOME_TEMPERATURE_MAPPING = {
  FROZEN_OCEAN: { mean: -2, range: 8, climate: 'polar' },
  ICE_SPIKES: { mean: -8, range: 12, climate: 'polar' },
  SNOWY_TUNDRA: { mean: -5, range: 15, climate: 'polar' },
  SNOWY_TAIGA: { mean: 2, range: 20, climate: 'subarctic' },
  COLD_OCEAN: { mean: 5, range: 10, climate: 'temperate' },
  MOUNTAINS: { mean: 8, range: 25, climate: 'highland' },
  TAIGA: { mean: 8, range: 22, climate: 'continental' },
  FOREST: { mean: 15, range: 20, climate: 'temperate' },
  PLAINS: { mean: 18, range: 25, climate: 'temperate' },
  OCEAN: { mean: 20, range: 12, climate: 'oceanic' },
  WARM_OCEAN: { mean: 24, range: 8, climate: 'tropical' },
  DESERT: { mean: 28, range: 35, climate: 'arid' },
  SAVANNA: { mean: 26, range: 15, climate: 'tropical' },
  JUNGLE: { mean: 27, range: 8, climate: 'tropical' },
} as const
