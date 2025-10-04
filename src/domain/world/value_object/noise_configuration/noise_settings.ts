/**
 * NoiseSettings Value Object - ノイズ生成設定
 *
 * Perlin/Simplex/Value ノイズの数学的に正確な設定
 * 決定論的生成とパフォーマンス最適化の両立
 */

import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'

/**
 * 周波数Brand型（正の数値）
 */
export type Frequency = number & BrandType.Brand<'Frequency'>

/**
 * 振幅Brand型（正の数値）
 */
export type Amplitude = number & BrandType.Brand<'Amplitude'>

/**
 * ラクナリティBrand型（1.0以上）
 */
export type Lacunarity = number & BrandType.Brand<'Lacunarity'>

/**
 * パーシスタンスBrand型（0.0から1.0）
 */
export type Persistence = number & BrandType.Brand<'Persistence'>

/**
 * オクターブBrand型（1以上の整数）
 */
export type Octaves = number & BrandType.Brand<'Octaves'>

/**
 * スケールBrand型（正の数値）
 */
export type Scale = number & BrandType.Brand<'Scale'>

/**
 * 周波数Schema
 */
export const FrequencySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.0001, 1000),
  Schema.brand('Frequency'),
  Schema.annotations({
    identifier: 'Frequency',
    title: 'Noise Frequency',
    description: 'Frequency of noise oscillation (0.0001 to 1000)',
    examples: [0.01, 0.1, 1.0, 10.0],
  })
)

/**
 * 振幅Schema
 */
export const AmplitudeSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.001, 1000),
  Schema.brand('Amplitude'),
  Schema.annotations({
    identifier: 'Amplitude',
    title: 'Noise Amplitude',
    description: 'Amplitude of noise signal (0.001 to 1000)',
    examples: [0.5, 1.0, 2.0, 10.0],
  })
)

/**
 * ラクナリティSchema
 */
export const LacunaritySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(1.0),
  Schema.between(1.0, 10.0),
  Schema.brand('Lacunarity'),
  Schema.annotations({
    identifier: 'Lacunarity',
    title: 'Lacunarity',
    description: 'Frequency multiplier between octaves (1.0 to 10.0)',
    examples: [2.0, 2.5, 3.0, 4.0],
  })
)

/**
 * パーシスタンスSchema
 */
export const PersistenceSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('Persistence'),
  Schema.annotations({
    identifier: 'Persistence',
    title: 'Persistence',
    description: 'Amplitude multiplier between octaves (0.0 to 1.0)',
    examples: [0.3, 0.5, 0.7, 0.9],
  })
)

/**
 * オクターブSchema
 */
export const OctavesSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.positive(),
  Schema.between(1, 16),
  Schema.brand('Octaves'),
  Schema.annotations({
    identifier: 'Octaves',
    title: 'Octaves',
    description: 'Number of noise octaves (1 to 16)',
    examples: [4, 6, 8, 12],
  })
)

/**
 * スケールSchema
 */
export const ScaleSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.001, 10000),
  Schema.brand('Scale'),
  Schema.annotations({
    identifier: 'Scale',
    title: 'Noise Scale',
    description: 'Overall scale of noise generation (0.001 to 10000)',
    examples: [0.1, 1.0, 10.0, 100.0],
  })
)

/**
 * ノイズタイプ列挙
 */
export const NoiseTypeSchema = Schema.Literal(
  'perlin', // Perlinノイズ
  'simplex', // Simplexノイズ
  'value', // Valueノイズ
  'worley', // Worleyノイズ（セル状）
  'ridge', // Ridgeノイズ（稜線）
  'billow', // Billowノイズ（雲状）
  'fBm', // Fractional Brownian Motion
  'turbulence', // タービュランス
  'domain_warp', // ドメイン歪み
  'custom' // カスタムノイズ
).pipe(
  Schema.annotations({
    title: 'Noise Type',
    description: 'Type of noise generation algorithm',
  })
)

export type NoiseType = typeof NoiseTypeSchema.Type

/**
 * 補間方法
 */
export const InterpolationSchema = Schema.Literal(
  'linear', // 線形補間
  'cosine', // コサイン補間
  'cubic', // 三次補間
  'quintic', // 五次補間
  'hermite', // エルミート補間
  'catmull_rom', // Catmull-Rom補間
  'bezier' // ベジエ補間
).pipe(
  Schema.annotations({
    title: 'Interpolation Method',
    description: 'Method for value interpolation between noise points',
  })
)

export type Interpolation = typeof InterpolationSchema.Type

/**
 * ノイズ次元
 */
export const NoiseDimensionSchema = Schema.Literal(1, 2, 3, 4).pipe(
  Schema.annotations({
    title: 'Noise Dimension',
    description: 'Dimensional space for noise generation (1D, 2D, 3D, 4D)',
  })
)

export type NoiseDimension = typeof NoiseDimensionSchema.Type

/**
 * ノイズ品質設定
 */
export const NoiseQualitySchema = Schema.Literal(
  'fast', // 高速（低品質）
  'standard', // 標準（バランス）
  'high', // 高品質（低速）
  'ultra' // 最高品質（最低速）
).pipe(
  Schema.annotations({
    title: 'Noise Quality',
    description: 'Quality vs performance tradeoff setting',
  })
)

export type NoiseQuality = typeof NoiseQualitySchema.Type

/**
 * 基本ノイズ設定
 */
export const BasicNoiseSettingsSchema = Schema.Struct({
  // ノイズ基本パラメータ
  type: NoiseTypeSchema,
  dimension: NoiseDimensionSchema,
  quality: NoiseQualitySchema,

  // 周波数・振幅設定
  frequency: FrequencySchema,
  amplitude: AmplitudeSchema,
  scale: ScaleSchema,

  // フラクタルパラメータ
  octaves: OctavesSchema,
  lacunarity: LacunaritySchema,
  persistence: PersistenceSchema,

  // 補間設定
  interpolation: InterpolationSchema,

  // オフセット・バイアス
  offset: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number.pipe(Schema.optional),
    w: Schema.Number.pipe(Schema.optional),
  }),

  // 出力調整
  outputRange: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }),

  // 正規化設定
  normalize: Schema.Boolean,
  clamp: Schema.Boolean,
}).pipe(
  Schema.annotations({
    identifier: 'BasicNoiseSettings',
    title: 'Basic Noise Configuration',
    description: 'Fundamental noise generation parameters',
  })
)

export type BasicNoiseSettings = typeof BasicNoiseSettingsSchema.Type

/**
 * 高度ノイズ設定
 */
export const AdvancedNoiseSettingsSchema = Schema.Struct({
  // 基本設定継承
  ...BasicNoiseSettingsSchema.fields,

  // ドメイン歪み設定
  domainWarp: Schema.Struct({
    enabled: Schema.Boolean,
    strength: Schema.Number.pipe(Schema.between(0, 10)),
    frequency: FrequencySchema,
    octaves: OctavesSchema.pipe(Schema.optional),
  }).pipe(Schema.optional),

  // フィルター設定
  filters: Schema.Array(
    Schema.Struct({
      type: Schema.Literal('blur', 'sharpen', 'smooth', 'contrast', 'gamma'),
      strength: Schema.Number.pipe(Schema.between(0, 2)),
      radius: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
    })
  ).pipe(Schema.optional),

  // カスケード設定（複数ノイズの組み合わせ）
  cascade: Schema.Array(
    Schema.Struct({
      operation: Schema.Literal('add', 'multiply', 'subtract', 'divide', 'min', 'max', 'blend'),
      noise: BasicNoiseSettingsSchema,
      weight: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ).pipe(Schema.optional),

  // 条件付き変調
  modulation: Schema.Struct({
    enabled: Schema.Boolean,
    modulatorNoise: BasicNoiseSettingsSchema.pipe(Schema.optional),
    modulationStrength: Schema.Number.pipe(Schema.between(0, 1)),
    modulationType: Schema.Literal('amplitude', 'frequency', 'phase'),
  }).pipe(Schema.optional),

  // セルラーオートマタ設定（Worleyノイズ用）
  cellular: Schema.Struct({
    cellSize: Schema.Number.pipe(Schema.positive()),
    distanceFunction: Schema.Literal('euclidean', 'manhattan', 'chebyshev', 'minkowski'),
    returnType: Schema.Literal('distance', 'distance2', 'cell_value', 'border'),
    jitter: Schema.Number.pipe(Schema.between(0, 1)),
  }).pipe(Schema.optional),

  // パフォーマンス設定
  performance: Schema.Struct({
    cacheEnabled: Schema.Boolean,
    multiThreaded: Schema.Boolean,
    approximation: Schema.Boolean,
    chunkSize: Schema.Number.pipe(Schema.int(), Schema.positive()).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'AdvancedNoiseSettings',
    title: 'Advanced Noise Configuration',
    description: 'Comprehensive noise generation with advanced features',
  })
)

export type AdvancedNoiseSettings = typeof AdvancedNoiseSettingsSchema.Type

/**
 * ノイズ設定作成パラメータ
 */
export const CreateNoiseSettingsParamsSchema = Schema.Struct({
  preset: Schema.Literal('terrain', 'caves', 'ore', 'temperature', 'humidity', 'custom').pipe(Schema.optional),
  type: NoiseTypeSchema.pipe(Schema.optional),
  quality: NoiseQualitySchema.pipe(Schema.optional),
  complexity: Schema.Literal('simple', 'moderate', 'complex', 'extreme').pipe(Schema.optional),
  performance: Schema.Literal('fast', 'balanced', 'quality').pipe(Schema.optional),
  customParameters: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }).pipe(Schema.optional),
})

export type CreateNoiseSettingsParams = typeof CreateNoiseSettingsParamsSchema.Type

/**
 * ノイズ設定エラー型
 */
export const NoiseSettingsErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidFrequency'),
    frequency: Schema.Number,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OctaveOverflow'),
    octaves: Schema.Number,
    maxAllowed: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ParameterConflict'),
    parameter1: Schema.String,
    parameter2: Schema.String,
    conflict: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('UnsupportedCombination'),
    noiseType: NoiseTypeSchema,
    feature: Schema.String,
    message: Schema.String,
  }),
])

export type NoiseSettingsError = typeof NoiseSettingsErrorSchema.Type

/**
 * 標準ノイズプリセット
 */
export const NOISE_PRESETS = {
  TERRAIN: {
    description: 'Terrain height generation',
    frequency: 0.01,
    amplitude: 100,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
  },
  CAVES: {
    description: 'Cave generation',
    frequency: 0.02,
    amplitude: 1,
    octaves: 4,
    persistence: 0.6,
    lacunarity: 2.5,
  },
  TEMPERATURE: {
    description: 'Temperature variation',
    frequency: 0.005,
    amplitude: 30,
    octaves: 3,
    persistence: 0.7,
    lacunarity: 2.0,
  },
  HUMIDITY: {
    description: 'Humidity variation',
    frequency: 0.008,
    amplitude: 1,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 1.8,
  },
} as const
