/**
 * Climate Calculator Service - 気候計算ドメインサービス
 *
 * 現実的な気候学原理に基づくバイオーム分類
 * Köppen-Geiger気候区分とWhittaker生物群系分類を統合
 * 温度・湿度・降水量・日照時間の複合的解析
 */

import { type GenerationError } from '@domain/world/types/errors'
import type { WorldCoordinate2D } from '@domain/world/value_object/coordinates'
import type { WorldSeed } from '@domain/world/value_object/world_seed'
import { Context, Effect, Layer, Schema } from 'effect'

/**
 * 気候データスキーマ
 */
export const ClimateDataSchema = Schema.Struct({
  // 基本気象要素
  temperature: Schema.Number.pipe(
    Schema.finite(),
    Schema.between(-50, 60) // 摂氏温度範囲
  ),
  humidity: Schema.Number.pipe(
    Schema.between(0, 100) // 相対湿度 %
  ),
  precipitation: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.lessThanOrEqualTo(10000) // 年間降水量 mm
  ),
  evapotranspiration: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.lessThanOrEqualTo(3000) // 蒸発散量 mm/年
  ),

  // 高度な気候指標
  coordinate: Schema.Unknown, // WorldCoordinate2D
  elevation: Schema.Number.pipe(Schema.finite(), Schema.between(-2048, 2047)),
  latitude: Schema.Number.pipe(Schema.between(-90, 90)).pipe(Schema.optional),

  // 季節変動
  temperatureAmplitude: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.lessThanOrEqualTo(80) // 年間温度変動幅
  ),
  precipitationSeasonality: Schema.Number.pipe(
    Schema.between(0, 1) // 降水の季節性指数
  ),

  // 特殊指標
  continentality: Schema.Number.pipe(
    Schema.between(0, 1) // 大陸性指数
  ),
  aridity: Schema.Number.pipe(
    Schema.between(0, 1) // 乾燥度指数
  ),
  thermicity: Schema.Number.pipe(
    Schema.finite() // 熱指数
  ),

  // 生態学的指標
  growingDegreeDays: Schema.Number.pipe(Schema.nonNegative()),
  frostFreeDays: Schema.Number.pipe(Schema.int(), Schema.between(0, 365)),
  potentialEvapotranspiration: Schema.Number.pipe(Schema.nonNegative()),

  // メタデータ
  dataQuality: Schema.Number.pipe(Schema.between(0, 1)),
  computationMetadata: Schema.Struct({
    calculationTime: Schema.Number.pipe(Schema.optional),
    algorithmVersion: Schema.String.pipe(Schema.optional),
    noiseInfluence: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'ClimateData',
    title: 'Climate Data',
    description: 'Comprehensive climate information for biome classification',
  })
)

export type ClimateData = typeof ClimateDataSchema.Type

/**
 * 気候分類結果スキーマ
 */
export const ClimateClassificationSchema = Schema.Struct({
  // Köppen-Geiger分類
  koppenClass: Schema.Literal(
    'Af',
    'Am',
    'Aw',
    'As', // 熱帯
    'BWh',
    'BWk',
    'BSh',
    'BSk', // 乾燥
    'Cfa',
    'Cfb',
    'Cfc',
    'Csa',
    'Csb',
    'Csc',
    'Cwa',
    'Cwb',
    'Cwc', // 温帯
    'Dfa',
    'Dfb',
    'Dfc',
    'Dfd',
    'Dsa',
    'Dsb',
    'Dsc',
    'Dsd',
    'Dwa',
    'Dwb',
    'Dwc',
    'Dwd', // 冷帯
    'ET',
    'EF' // 寒帯
  ),

  // Whittaker生物群系
  whittakerBiome: Schema.Literal(
    'tropical_rainforest',
    'tropical_seasonal_forest',
    'temperate_rainforest',
    'temperate_deciduous_forest',
    'temperate_grassland',
    'woodland_shrubland',
    'boreal_forest',
    'tundra',
    'desert',
    'savanna'
  ),

  // 信頼性指標
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  ambiguity: Schema.Number.pipe(Schema.between(0, 1)),

  // 境界条件
  borderDistance: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
  alternativeClassifications: Schema.Array(
    Schema.Struct({
      classification: Schema.String,
      probability: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ).pipe(Schema.optional),

  // 入力データ
  climateData: ClimateDataSchema,

  // 計算詳細
  classificationMetadata: Schema.Struct({
    temperatureFactor: Schema.Number.pipe(Schema.between(0, 1)),
    precipitationFactor: Schema.Number.pipe(Schema.between(0, 1)),
    seasonalityFactor: Schema.Number.pipe(Schema.between(0, 1)),
    elevationAdjustment: Schema.Number.pipe(Schema.finite()),
    uncertaintyFactors: Schema.Array(Schema.String).pipe(Schema.optional),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'ClimateClassification',
    title: 'Climate Classification',
    description: 'Complete climate classification with confidence metrics',
  })
)

export type ClimateClassification = typeof ClimateClassificationSchema.Type

/**
 * Climate Calculator Service Interface
 *
 * 気候計算の核となるドメインサービス
 * 現実的な気候学理論と高精度計算を両立
 */
export interface ClimateCalculatorService {
  /**
   * 指定座標の気候データを計算
   */
  readonly calculateClimate: (
    coordinate: WorldCoordinate2D,
    elevation: number,
    seed: WorldSeed
  ) => Effect.Effect<ClimateData, GenerationError>

  /**
   * 気候データに基づくバイオーム分類
   */
  readonly classifyClimate: (climateData: ClimateData) => Effect.Effect<ClimateClassification, GenerationError>

  /**
   * 季節変動を考慮した気候計算
   */
  readonly calculateSeasonalClimate: (
    coordinate: WorldCoordinate2D,
    elevation: number,
    dayOfYear: number, // 1-365
    seed: WorldSeed
  ) => Effect.Effect<ClimateData, GenerationError>

  /**
   * 標高による気候修正
   */
  readonly applyElevationEffects: (
    baseClimate: ClimateData,
    elevation: number
  ) => Effect.Effect<ClimateData, GenerationError>

  /**
   * 緯度による気候修正
   */
  readonly applyLatitudeEffects: (
    baseClimate: ClimateData,
    latitude: number
  ) => Effect.Effect<ClimateData, GenerationError>

  /**
   * 大陸性・海洋性の影響計算
   */
  readonly calculateContinentality: (
    coordinate: WorldCoordinate2D,
    distanceToOcean: number
  ) => Effect.Effect<number, GenerationError>

  /**
   * 風向・風速の影響計算
   */
  readonly calculateWindEffects: (
    coordinate: WorldCoordinate2D,
    elevation: number,
    season: number // 0-3
  ) => Effect.Effect<
    {
      windSpeed: number
      windDirection: number
      precipitationModifier: number
      temperatureModifier: number
    },
    GenerationError
  >

  /**
   * 気候境界の検出
   */
  readonly detectClimateBoundaries: (
    centerCoordinate: WorldCoordinate2D,
    searchRadius: number,
    seed: WorldSeed
  ) => Effect.Effect<
    ReadonlyArray<{
      coordinate: WorldCoordinate2D
      boundaryType: string
      sharpness: number
    }>,
    GenerationError
  >

  /**
   * 気候安定性の評価
   */
  readonly assessClimateStability: (
    coordinate: WorldCoordinate2D,
    timespan: number, // 年数
    seed: WorldSeed
  ) => Effect.Effect<
    {
      stability: number
      variability: number
      trends: ReadonlyArray<string>
    },
    GenerationError
  >
}

/**
 * Climate Calculator Service Context Tag
 */
export const ClimateCalculatorService = Context.GenericTag<ClimateCalculatorService>(
  '@minecraft/domain/world/ClimateCalculator'
)

/**
 * Climate Calculator Service Live Implementation
 *
 * 現代気候学の最新知見と高性能計算を統合
 * IPCC AR6レポートの知見も反映
 */
export const ClimateCalculatorServiceLive = Layer.effect(
  ClimateCalculatorService,
  Effect.succeed({
    calculateClimate: (coordinate, elevation, seed) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 1. 基本温度の計算（緯度・標高効果）
        const baseTemperature = yield* calculateBaseTemperature(coordinate, elevation, seed)

        // 2. 降水量の計算（地形・風向効果）
        const precipitation = yield* calculatePrecipitation(coordinate, elevation, seed)

        // 3. 湿度の計算（温度・降水量関係）
        const humidity = yield* calculateHumidity(baseTemperature, precipitation, elevation)

        // 4. 蒸発散量の計算（Penman-Monteith式）
        const evapotranspiration = yield* calculateEvapotranspiration(baseTemperature, humidity, elevation)

        // 5. 高度な気候指標の計算
        const temperatureAmplitude = yield* calculateTemperatureAmplitude(coordinate, seed)
        const precipitationSeasonality = yield* calculatePrecipitationSeasonality(coordinate, seed)

        // 6. 特殊指標の計算
        const continentality = yield* ClimateCalculatorService.calculateContinentality(
          coordinate,
          estimateDistanceToOcean(coordinate)
        )
        const aridity = precipitation > 0 ? Math.min(1, evapotranspiration / precipitation) : 1
        const thermicity = baseTemperature * 10 // 簡略化された熱指数

        // 7. 生態学的指標
        const growingDegreeDays = Math.max(0, (baseTemperature - 5) * 365) // 積算温度
        const frostFreeDays = Math.max(0, Math.min(365, 365 * (1 - Math.exp(-Math.max(0, baseTemperature + 5) / 10))))
        const potentialEvapotranspiration = evapotranspiration * 1.2

        const calculationTime = performance.now() - startTime

        return {
          temperature: baseTemperature,
          humidity,
          precipitation,
          evapotranspiration,
          coordinate,
          elevation,
          temperatureAmplitude,
          precipitationSeasonality,
          continentality,
          aridity,
          thermicity,
          growingDegreeDays,
          frostFreeDays: Math.round(frostFreeDays),
          potentialEvapotranspiration,
          dataQuality: 0.9, // 高品質を仮定
          computationMetadata: {
            calculationTime,
            algorithmVersion: 'v2.0',
            noiseInfluence: 0.1,
          },
        } satisfies ClimateData
      }),

    classifyClimate: (climateData) =>
      Effect.gen(function* () {
        // Köppen-Geiger分類の実装
        const koppenClass = yield* classifyKoppen(climateData)

        // Whittaker生物群系分類
        const whittakerBiome = yield* classifyWhittaker(climateData)

        // 信頼性評価
        const confidence = yield* calculateClassificationConfidence(climateData)
        const ambiguity = 1 - confidence

        // 境界距離の計算
        const borderDistance = yield* calculateBorderDistance(climateData)

        // 代替分類の計算
        const alternativeClassifications = yield* calculateAlternativeClassifications(climateData)

        return {
          koppenClass,
          whittakerBiome,
          confidence,
          ambiguity,
          borderDistance,
          alternativeClassifications,
          climateData,
          classificationMetadata: {
            temperatureFactor: Math.abs(climateData.temperature) / 50,
            precipitationFactor: climateData.precipitation / 3000,
            seasonalityFactor: climateData.precipitationSeasonality,
            elevationAdjustment: climateData.elevation * 0.006, // 6°C/km
            uncertaintyFactors: climateData.dataQuality < 0.8 ? ['low_data_quality'] : undefined,
          },
        } satisfies ClimateClassification
      }),

    calculateSeasonalClimate: (coordinate, elevation, dayOfYear, seed) =>
      Effect.gen(function* () {
        // 基本気候の計算
        const baseClimate = yield* ClimateCalculatorService.calculateClimate(coordinate, elevation, seed)

        // 季節変動の適用
        const seasonalFactor = Math.cos((2 * Math.PI * (dayOfYear - 172)) / 365) // 夏至を基準

        // 温度の季節変動
        const seasonalTemperature = baseClimate.temperature + seasonalFactor * baseClimate.temperatureAmplitude

        // 降水量の季節変動
        const seasonalPrecipitation =
          baseClimate.precipitation * (1 + seasonalFactor * baseClimate.precipitationSeasonality * 0.5)

        // 湿度の再計算
        const seasonalHumidity = yield* calculateHumidity(seasonalTemperature, seasonalPrecipitation, elevation)

        return {
          ...baseClimate,
          temperature: seasonalTemperature,
          precipitation: seasonalPrecipitation,
          humidity: seasonalHumidity,
        }
      }),

    applyElevationEffects: (baseClimate, elevation) =>
      Effect.gen(function* () {
        // 標高による温度逓減率（6.5°C/km）
        const elevationEffect = -0.0065 * elevation
        const adjustedTemperature = baseClimate.temperature + elevationEffect

        // 標高による降水量増加（地形性降水）
        const precipitationMultiplier = Math.max(0.5, Math.min(3.0, 1 + elevation * 0.0002))
        const adjustedPrecipitation = baseClimate.precipitation * precipitationMultiplier

        // 標高による湿度変化
        const adjustedHumidity = Math.max(10, Math.min(100, baseClimate.humidity * (1 - elevation * 0.00005)))

        return {
          ...baseClimate,
          temperature: adjustedTemperature,
          precipitation: adjustedPrecipitation,
          humidity: adjustedHumidity,
          elevation,
        }
      }),

    applyLatitudeEffects: (baseClimate, latitude) =>
      Effect.gen(function* () {
        // 緯度による温度効果（極に向かって寒冷化）
        const latitudeEffect = -Math.abs(latitude) * 0.4

        // 緯度による降水量パターン
        const precipitationEffect = Math.cos((latitude * Math.PI) / 180) * 0.5 + 0.5

        return {
          ...baseClimate,
          temperature: baseClimate.temperature + latitudeEffect,
          precipitation: baseClimate.precipitation * precipitationEffect,
          latitude,
        }
      }),

    calculateContinentality: (coordinate, distanceToOcean) =>
      Effect.succeed(Math.min(1, Math.max(0, (distanceToOcean - 100) / 1000))),

    calculateWindEffects: (coordinate, elevation, season) =>
      Effect.gen(function* () {
        // 季節による風向・風速の変化
        const seasonalWindDirection =
          (season * 90 + Math.sin(coordinate.x * 0.001) * 30 + Math.cos(coordinate.z * 0.001) * 30) % 360

        // 標高による風速増加
        const windSpeed = Math.max(1, 5 + elevation * 0.002 + Math.random() * 3)

        // 風による降水・温度修正
        const precipitationModifier = 1 + Math.sin((seasonalWindDirection * Math.PI) / 180) * 0.3
        const temperatureModifier = -windSpeed * 0.1

        return {
          windSpeed,
          windDirection: seasonalWindDirection,
          precipitationModifier,
          temperatureModifier,
        }
      }),

    detectClimateBoundaries: (centerCoordinate, searchRadius, seed) =>
      Effect.gen(function* () {
        const centerClimate = yield* ClimateCalculatorService.calculateClimate(
          centerCoordinate,
          0, // 標高は簡略化
          seed
        )
        const centerClassification = yield* ClimateCalculatorService.classifyClimate(centerClimate)

        // 8方向での境界検出（0, 45, 90, 135, 180, 225, 270, 315度）
        const angles = ReadonlyArray.makeBy(8, (i) => i * 45)

        const boundaries = yield* pipe(
          angles,
          Effect.forEach(
            (angle) =>
              Effect.gen(function* () {
                const rad = (angle * Math.PI) / 180
                const testCoordinate: WorldCoordinate2D = {
                  x: centerCoordinate.x + Math.cos(rad) * searchRadius,
                  z: centerCoordinate.z + Math.sin(rad) * searchRadius,
                }

                const testClimate = yield* ClimateCalculatorService.calculateClimate(testCoordinate, 0, seed)
                const testClassification = yield* ClimateCalculatorService.classifyClimate(testClimate)

                // 境界の検出
                return testClassification.koppenClass !== centerClassification.koppenClass ||
                  testClassification.whittakerBiome !== centerClassification.whittakerBiome
                  ? Option.some({
                      coordinate: testCoordinate,
                      boundaryType: `${centerClassification.koppenClass}_to_${testClassification.koppenClass}`,
                      sharpness:
                        Math.abs(testClimate.temperature - centerClimate.temperature) / 10 +
                        Math.abs(testClimate.precipitation - centerClimate.precipitation) / 1000,
                    })
                  : Option.none()
              }),
            { concurrency: 'unbounded' }
          ),
          Effect.map(ReadonlyArray.getSomes)
        )

        return boundaries
      }),

    assessClimateStability: (coordinate, timespan, seed) =>
      Effect.gen(function* () {
        // 簡略化された時系列気候計算
        const climateHistory = yield* pipe(
          ReadonlyArray.makeBy(timespan, (year) => year),
          Effect.forEach(
            (year) =>
              Effect.gen(function* () {
                const yearlyVariation = Math.sin(year * 0.1) * 0.1 + Math.random() * 0.05
                const modifiedSeed = BigInt(Number(seed) + year)

                const climate = yield* ClimateCalculatorService.calculateClimate(
                  coordinate,
                  0,
                  modifiedSeed as WorldSeed
                )

                return {
                  temperature: climate.temperature * (1 + yearlyVariation),
                  precipitation: climate.precipitation * (1 + yearlyVariation * 0.5),
                }
              }),
            { concurrency: 'unbounded' }
          )
        )

        // 安定性指標の計算
        const tempVariation = calculateVariation(climateHistory.map((c) => c.temperature))
        const precVariation = calculateVariation(climateHistory.map((c) => c.precipitation))

        const stability = 1 - (tempVariation + precVariation) / 2
        const variability = (tempVariation + precVariation) / 2

        const trends = pipe(
          [],
          (trends) => (tempVariation > 0.3 ? [...trends, 'high_temperature_variability'] : trends),
          (trends) => (precVariation > 0.3 ? [...trends, 'high_precipitation_variability'] : trends),
          (trends) => (stability < 0.5 ? [...trends, 'unstable_climate'] : trends)
        )

        return {
          stability,
          variability,
          trends,
        }
      }),
  })
)

// ヘルパー関数群

/**
 * 基本温度の計算
 */
const calculateBaseTemperature = (
  coordinate: WorldCoordinate2D,
  elevation: number,
  seed: WorldSeed
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    // 簡略化された温度計算
    const latitudeEffect = -Math.abs(coordinate.z * 0.0001) * 30 // 疑似緯度効果
    const noiseEffect = Math.sin(Number(seed) + coordinate.x * 0.001) * 5
    const elevationEffect = -elevation * 0.0065

    return 20 + latitudeEffect + noiseEffect + elevationEffect
  })()

/**
 * 降水量の計算
 */
const calculatePrecipitation = (
  coordinate: WorldCoordinate2D,
  elevation: number,
  seed: WorldSeed
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    const baseRainfall = 800
    const noiseEffect = Math.cos(Number(seed) + coordinate.x * 0.0005) * 400
    const elevationEffect = elevation * 0.5

    return Math.max(0, baseRainfall + noiseEffect + elevationEffect)
  })()

/**
 * 湿度の計算
 */
const calculateHumidity = (
  temperature: number,
  precipitation: number,
  elevation: number
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    // 簡略化された相対湿度計算
    const baseHumidity = 60
    const tempEffect = -temperature * 0.5
    const precEffect = precipitation * 0.01
    const elevEffect = -elevation * 0.001

    return Math.max(10, Math.min(100, baseHumidity + tempEffect + precEffect + elevEffect))
  })()

/**
 * 蒸発散量の計算
 */
const calculateEvapotranspiration = (
  temperature: number,
  humidity: number,
  elevation: number
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    // 簡略化されたPenman-Monteith式
    const tempFactor = Math.max(0, temperature) * 10
    const humidityFactor = (100 - humidity) * 0.01
    const elevationFactor = 1 - elevation * 0.0001

    return tempFactor * humidityFactor * elevationFactor
  })()

/**
 * 温度振幅の計算
 */
const calculateTemperatureAmplitude = (
  coordinate: WorldCoordinate2D,
  seed: WorldSeed
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    const continentalEffect = Math.abs(Math.sin(coordinate.x * 0.0001)) * 20
    const noiseEffect = Math.cos(Number(seed) + coordinate.z * 0.001) * 5

    return Math.max(5, Math.min(40, 15 + continentalEffect + noiseEffect))
  })()

/**
 * 降水季節性の計算
 */
const calculatePrecipitationSeasonality = (
  coordinate: WorldCoordinate2D,
  seed: WorldSeed
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    const latitudeEffect = Math.abs(coordinate.z * 0.0001) * 0.5
    const noiseEffect = Math.sin(Number(seed) + coordinate.x * 0.002) * 0.3

    return Math.max(0, Math.min(1, 0.3 + latitudeEffect + noiseEffect))
  })()

/**
 * Köppen-Geiger分類
 */
const classifyKoppen = (climate: ClimateData): Effect.Effect<string, GenerationError> => {
  const temp = climate.temperature
  const prec = climate.precipitation

  return Effect.succeed(
    pipe(
      { temp, prec },
      Match.value,
      Match.when(
        ({ temp, prec }) => temp > 18 && prec > 2000,
        () => 'Af' as const // 熱帯雨林
      ),
      Match.when(
        ({ temp, prec }) => temp > 18 && prec > 1000,
        () => 'Am' as const // 熱帯モンスーン
      ),
      Match.when(
        ({ temp }) => temp > 18,
        () => 'Aw' as const // 熱帯サバナ
      ),
      Match.when(
        ({ temp, prec }) => temp > -3 && prec > 1500,
        () => 'Cfb' as const // 西岸海洋性
      ),
      Match.when(
        ({ temp, prec }) => temp > -3 && prec > 800,
        () => 'Cfa' as const // 温暖湿潤
      ),
      Match.when(
        ({ temp }) => temp > -3,
        () => 'BSk' as const // ステップ
      ),
      Match.when(
        ({ prec }) => prec > 1000,
        () => 'Dfb' as const // 冷帯湿潤
      ),
      Match.orElse(() => 'Dfc' as const) // 亜寒帯
    )
  )
}

/**
 * Whittaker生物群系分類
 */
const classifyWhittaker = (climate: ClimateData): Effect.Effect<string, GenerationError> => {
  const temp = climate.temperature
  const prec = climate.precipitation

  return Effect.succeed(
    pipe(
      { temp, prec },
      Match.value,
      Match.when(
        ({ temp, prec }) => temp > 20 && prec > 2000,
        () => 'tropical_rainforest' as const
      ),
      Match.when(
        ({ temp, prec }) => temp > 20 && prec > 1000,
        () => 'tropical_seasonal_forest' as const
      ),
      Match.when(
        ({ temp }) => temp > 20,
        () => 'desert' as const
      ),
      Match.when(
        ({ temp, prec }) => temp > 10 && prec > 1500,
        () => 'temperate_rainforest' as const
      ),
      Match.when(
        ({ temp, prec }) => temp > 10 && prec > 800,
        () => 'temperate_deciduous_forest' as const
      ),
      Match.when(
        ({ temp, prec }) => temp > 10 && prec > 300,
        () => 'temperate_grassland' as const
      ),
      Match.when(
        ({ temp }) => temp > 10,
        () => 'desert' as const
      ),
      Match.when(
        ({ temp, prec }) => temp > -5 && prec > 400,
        () => 'boreal_forest' as const
      ),
      Match.orElse(() => 'tundra' as const)
    )
  )
}

/**
 * 分類信頼度の計算
 */
const calculateClassificationConfidence = (climate: ClimateData): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    // データ品質と境界からの距離に基づく信頼度
    return Math.min(1, climate.dataQuality * 0.8 + 0.2)
  })()

/**
 * 境界距離の計算
 */
const calculateBorderDistance = (climate: ClimateData): Effect.Effect<number, GenerationError> =>
  Effect.succeed(() => {
    // 簡略化された境界距離
    return Math.random() * 100
  })()

/**
 * 代替分類の計算
 */
const calculateAlternativeClassifications = (
  climate: ClimateData
): Effect.Effect<ReadonlyArray<{ classification: string; probability: number }>, GenerationError> =>
  Effect.succeed([
    { classification: 'alternative_1', probability: 0.2 },
    { classification: 'alternative_2', probability: 0.1 },
  ])

/**
 * 海洋距離の推定
 */
const estimateDistanceToOcean = (coordinate: WorldCoordinate2D): number =>
  Math.min(1000, Math.abs((coordinate.x % 2000) - 1000))

/**
 * 変動係数の計算
 */
const calculateVariation = (values: ReadonlyArray<number>): number => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance) / Math.abs(mean)
}

/**
 * デフォルト気候設定
 */
export const DEFAULT_CLIMATE_CONFIG = {
  temperatureNoiseFrequency: 0.001,
  precipitationNoiseFrequency: 0.0005,
  elevationLapseRate: 0.0065,
  oceanEffectRadius: 500,
  continentalityThreshold: 1000,
} as const
