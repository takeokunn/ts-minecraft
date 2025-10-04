/**
 * BiomeConfig Value Object - バイオーム設定
 *
 * バイオーム生成における設定パラメータの完全実装
 * Minecraft準拠の生態学的妥当性と気候データ管理
 */

import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'
import { Brand } from 'effect'
import type { Brand as BrandType } from 'effect'

/**
 * 温度値Brand型（摂氏-50度から50度）
 */
export type Temperature = number & BrandType.Brand<'Temperature'>

/**
 * 湿度値Brand型（0.0から1.0）
 */
export type Humidity = number & BrandType.Brand<'Humidity'>

/**
 * 標高値Brand型（-2048から2047メートル）
 */
export type Elevation = number & BrandType.Brand<'Elevation'>

/**
 * 降水量Brand型（0から2000mm/年）
 */
export type Precipitation = number & BrandType.Brand<'Precipitation'>

/**
 * 温度Schema
 */
export const TemperatureSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-50, 50),
  Schema.brand('Temperature'),
  Schema.annotations({
    identifier: 'Temperature',
    title: 'Biome Temperature',
    description: 'Temperature in Celsius (-50°C to +50°C)',
    examples: [20, -10, 35, 0]
  })
)

/**
 * 湿度Schema
 */
export const HumiditySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('Humidity'),
  Schema.annotations({
    identifier: 'Humidity',
    title: 'Relative Humidity',
    description: 'Relative humidity from 0.0 (dry) to 1.0 (saturated)',
    examples: [0.3, 0.7, 0.9, 0.1]
  })
)

/**
 * 標高Schema
 */
export const ElevationSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(-2048, 2047),
  Schema.brand('Elevation'),
  Schema.annotations({
    identifier: 'Elevation',
    title: 'Biome Elevation',
    description: 'Elevation in meters (-2048m to +2047m)',
    examples: [64, 128, 256, -64, 0]
  })
)

/**
 * 降水量Schema
 */
export const PrecipitationSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0, 2000),
  Schema.brand('Precipitation'),
  Schema.annotations({
    identifier: 'Precipitation',
    title: 'Annual Precipitation',
    description: 'Annual precipitation in millimeters (0-2000mm)',
    examples: [500, 1200, 100, 1800]
  })
)

/**
 * バイオームタイプ列挙
 */
export const BiomeTypeSchema = Schema.Literal(
  // 陸上バイオーム
  'plains',
  'desert',
  'forest',
  'taiga',
  'tundra',
  'savanna',
  'jungle',
  'mountains',
  'hills',
  'swamp',
  'mushroom_fields',
  // 海洋バイオーム
  'ocean',
  'deep_ocean',
  'frozen_ocean',
  'warm_ocean',
  'lukewarm_ocean',
  'cold_ocean',
  // ネザー・エンド
  'nether_wastes',
  'soul_sand_valley',
  'crimson_forest',
  'warped_forest',
  'basalt_deltas',
  'the_end',
  'end_highlands',
  'end_midlands',
  'small_end_islands',
  'end_barrens'
).pipe(
  Schema.annotations({
    title: 'Biome Type',
    description: 'Standard Minecraft biome types'
  })
)

export type BiomeType = typeof BiomeTypeSchema.Type

/**
 * バイオーム気候帯
 */
export const ClimateZoneSchema = Schema.Literal(
  'arctic',      // 北極圏（-30°C以下）
  'subarctic',   // 亜北極圏（-30°C～0°C）
  'temperate',   // 温帯（0°C～20°C）
  'subtropical', // 亜熱帯（20°C～30°C）
  'tropical',    // 熱帯（30°C以上）
  'alpine',      // 高山帯（標高による）
  'coastal',     // 沿岸部（海洋影響）
  'continental', // 大陸性（内陸部）
  'desert',      // 砂漠性（低湿度）
  'monsoon'      // モンスーン（季節的変化）
).pipe(
  Schema.annotations({
    title: 'Climate Zone',
    description: 'Climatic classification of biome'
  })
)

export type ClimateZone = typeof ClimateZoneSchema.Type

/**
 * 植生密度Brand型（0.0から1.0）
 */
export type VegetationDensity = number & BrandType.Brand<'VegetationDensity'>

export const VegetationDensitySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('VegetationDensity'),
  Schema.annotations({
    title: 'Vegetation Density',
    description: 'Density of vegetation from 0.0 (barren) to 1.0 (dense forest)'
  })
)

/**
 * バイオーム設定Value Object
 */
export const BiomeConfigSchema = Schema.Struct({
  // 基本情報
  type: BiomeTypeSchema,
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({
      description: 'Human-readable biome name'
    })
  ),

  // 気候パラメータ
  climate: Schema.Struct({
    zone: ClimateZoneSchema,
    temperature: TemperatureSchema,
    humidity: HumiditySchema,
    precipitation: PrecipitationSchema,

    // 季節変動（オプション）
    seasonalVariation: Schema.Struct({
      temperatureRange: Schema.Number.pipe(Schema.nonNegative()),
      precipitationVariation: Schema.Number.pipe(Schema.between(0, 1))
    }).pipe(Schema.optional)
  }),

  // 地形パラメータ
  terrain: Schema.Struct({
    baseElevation: ElevationSchema,
    elevationVariance: Schema.Number.pipe(Schema.nonNegative()),
    roughness: Schema.Number.pipe(Schema.between(0, 1)),

    // 特殊地形の生成頻度
    specialFeatures: Schema.Struct({
      lakes: Schema.Number.pipe(Schema.between(0, 1)),
      rivers: Schema.Number.pipe(Schema.between(0, 1)),
      caves: Schema.Number.pipe(Schema.between(0, 1)),
      ravines: Schema.Number.pipe(Schema.between(0, 1))
    }).pipe(Schema.optional)
  }),

  // 生態系パラメータ
  ecosystem: Schema.Struct({
    vegetationDensity: VegetationDensitySchema,
    primaryVegetation: Schema.Array(Schema.String),
    animalDensity: Schema.Number.pipe(Schema.between(0, 1)),
    foodChainComplexity: Schema.Number.pipe(Schema.between(0, 1))
  }),

  // 資源生成パラメータ
  resources: Schema.Struct({
    // 鉱石生成頻度
    oreFrequency: Schema.Record({
      key: Schema.String, // 鉱石名
      value: Schema.Number.pipe(Schema.between(0, 1))
    }),

    // 特殊ブロック生成
    specialBlocks: Schema.Array(Schema.Struct({
      blockType: Schema.String,
      frequency: Schema.Number.pipe(Schema.between(0, 1)),
      conditions: Schema.Array(Schema.String).pipe(Schema.optional)
    }))
  }),

  // 構造物生成設定
  structures: Schema.Struct({
    villages: Schema.Number.pipe(Schema.between(0, 1)),
    dungeons: Schema.Number.pipe(Schema.between(0, 1)),
    temples: Schema.Number.pipe(Schema.between(0, 1)),
    strongholds: Schema.Number.pipe(Schema.between(0, 1))
  }),

  // Minecraft固有設定
  minecraft: Schema.Struct({
    // 降水タイプ
    precipitationType: Schema.Literal('rain', 'snow', 'none'),

    // 草・葉の色調
    foliageColor: Schema.String.pipe(
      Schema.pattern(/^#[0-9A-Fa-f]{6}$/),
      Schema.annotations({ description: 'Hex color code for foliage' })
    ).pipe(Schema.optional),

    grassColor: Schema.String.pipe(
      Schema.pattern(/^#[0-9A-Fa-f]{6}$/),
      Schema.annotations({ description: 'Hex color code for grass' })
    ).pipe(Schema.optional),

    // 空の色
    skyColor: Schema.String.pipe(
      Schema.pattern(/^#[0-9A-Fa-f]{6}$/),
      Schema.annotations({ description: 'Hex color code for sky' })
    ).pipe(Schema.optional),

    // 霧の色・密度
    fogColor: Schema.String.pipe(
      Schema.pattern(/^#[0-9A-Fa-f]{6}$/),
      Schema.annotations({ description: 'Hex color code for fog' })
    ).pipe(Schema.optional),

    fogDensity: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.optional)
  })
}).pipe(
  Schema.annotations({
    identifier: 'BiomeConfig',
    title: 'Biome Configuration',
    description: 'Complete biome configuration with climate, terrain, and ecosystem parameters'
  })
)

export type BiomeConfig = typeof BiomeConfigSchema.Type

/**
 * バイオーム設定作成パラメータ
 */
export const CreateBiomeConfigParamsSchema = Schema.Struct({
  type: BiomeTypeSchema,
  name: Schema.String.pipe(Schema.optional),
  temperature: Schema.Number.pipe(Schema.optional),
  humidity: Schema.Number.pipe(Schema.optional),
  elevation: Schema.Number.pipe(Schema.optional),
  customSettings: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }).pipe(Schema.optional)
})

export type CreateBiomeConfigParams = typeof CreateBiomeConfigParamsSchema.Type

/**
 * バイオーム設定エラー型
 */
export const BiomeConfigErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidClimateData'),
    parameter: Schema.String,
    value: Schema.Unknown,
    reason: Schema.String,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('EcosystemInconsistency'),
    conflicts: Schema.Array(Schema.String),
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('UnsupportedBiomeType'),
    biomeType: Schema.String,
    message: Schema.String
  })
])

export type BiomeConfigError = typeof BiomeConfigErrorSchema.Type
