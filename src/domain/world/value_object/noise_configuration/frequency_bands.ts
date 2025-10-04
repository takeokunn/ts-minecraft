/**
 * FrequencyBands Value Object - 周波数帯域設定
 *
 * 多層周波数分析による地形生成の高精度化
 * FFT/DFT原理に基づく周波数領域での制御
 */

import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'
import { Brand } from 'effect'
import type { Brand as BrandType } from 'effect'

/**
 * 周波数値Brand型（正の数値）
 */
export type FrequencyValue = number & BrandType.Brand<'FrequencyValue'>

/**
 * 帯域幅Brand型（正の数値）
 */
export type Bandwidth = number & BrandType.Brand<'Bandwidth'>

/**
 * ゲイン値Brand型（デシベル、-60dBから60dB）
 */
export type Gain = number & BrandType.Brand<'Gain'>

/**
 * Q値Brand型（0.1から100）
 */
export type QFactor = number & BrandType.Brand<'QFactor'>

/**
 * 周波数値Schema
 */
export const FrequencyValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.0001, 1000.0),
  Schema.brand('FrequencyValue'),
  Schema.annotations({
    identifier: 'FrequencyValue',
    title: 'Frequency Value',
    description: 'Specific frequency value in cycles per unit (0.0001 to 1000.0)',
    examples: [0.01, 0.1, 1.0, 10.0]
  })
)

/**
 * 帯域幅Schema
 */
export const BandwidthSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.001, 100.0),
  Schema.brand('Bandwidth'),
  Schema.annotations({
    identifier: 'Bandwidth',
    title: 'Frequency Bandwidth',
    description: 'Width of frequency band (0.001 to 100.0)',
    examples: [0.1, 0.5, 2.0, 10.0]
  })
)

/**
 * ゲイン値Schema
 */
export const GainSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-60.0, 60.0),
  Schema.brand('Gain'),
  Schema.annotations({
    identifier: 'Gain',
    title: 'Frequency Gain',
    description: 'Gain in decibels (-60dB to +60dB)',
    examples: [-20, -6, 0, 6, 12]
  })
)

/**
 * Q値Schema
 */
export const QFactorSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.positive(),
  Schema.between(0.1, 100.0),
  Schema.brand('QFactor'),
  Schema.annotations({
    identifier: 'QFactor',
    title: 'Quality Factor',
    description: 'Q factor for frequency selectivity (0.1 to 100.0)',
    examples: [0.5, 1.0, 2.0, 10.0]
  })
)

/**
 * フィルタータイプ
 */
export const FilterTypeSchema = Schema.Literal(
  'lowpass',      // ローパス
  'highpass',     // ハイパス
  'bandpass',     // バンドパス
  'bandstop',     // バンドストップ
  'peak',         // ピーキング
  'notch',        // ノッチ
  'shelf_low',    // ローシェルフ
  'shelf_high',   // ハイシェルフ
  'allpass',      // オールパス
  'custom'        // カスタム
).pipe(
  Schema.annotations({
    title: 'Filter Type',
    description: 'Type of frequency filter'
  })
)

export type FilterType = typeof FilterTypeSchema.Type

/**
 * 周波数帯域分類
 */
export const FrequencyBandClassSchema = Schema.Literal(
  'sub_bass',     // サブベース (0.001 - 0.01)
  'bass',         // ベース (0.01 - 0.1)
  'low_mid',      // ローミッド (0.1 - 1.0)
  'mid',          // ミッド (1.0 - 10.0)
  'high_mid',     // ハイミッド (10.0 - 100.0)
  'treble',       // トレブル (100.0 - 1000.0)
  'ultra_high'    // ウルトラハイ (1000.0+)
).pipe(
  Schema.annotations({
    title: 'Frequency Band Class',
    description: 'Classification of frequency band by range'
  })
)

export type FrequencyBandClass = typeof FrequencyBandClassSchema.Type

/**
 * 個別周波数帯域設定
 */
export const IndividualFrequencyBandSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for the frequency band' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for the band' })
  ),
  class: FrequencyBandClassSchema,
  enabled: Schema.Boolean,

  // 周波数特性
  centerFrequency: FrequencyValueSchema,
  bandwidth: BandwidthSchema,
  gain: GainSchema,
  qFactor: QFactorSchema,

  // フィルター設定
  filter: Schema.Struct({
    type: FilterTypeSchema,
    order: Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, 8),
      Schema.annotations({ description: 'Filter order (1-8)' })
    ),
    rolloff: Schema.Number.pipe(
      Schema.between(6, 96),
      Schema.annotations({ description: 'Rolloff rate in dB/octave' })
    ).pipe(Schema.optional)
  }),

  // 動的制御
  modulation: Schema.Struct({
    enabled: Schema.Boolean,
    modulationType: Schema.Literal('lfo', 'envelope', 'random', 'noise'),
    rate: Schema.Number.pipe(Schema.positive()),
    depth: Schema.Number.pipe(Schema.between(0, 1)),
    phase: Schema.Number.pipe(Schema.between(0, Math.PI * 2)).pipe(Schema.optional)
  }).pipe(Schema.optional),

  // 空間的変化
  spatialVariation: Schema.Struct({
    enabled: Schema.Boolean,
    frequencyModulation: Schema.Number.pipe(Schema.between(0, 1)),
    gainModulation: Schema.Number.pipe(Schema.between(0, 1)),
    modulationFrequency: FrequencyValueSchema
  }).pipe(Schema.optional),

  // 適応制御
  adaptive: Schema.Struct({
    enabled: Schema.Boolean,
    targetParameter: Schema.String,
    responseSpeed: Schema.Number.pipe(Schema.between(0.001, 1.0)),
    sensitivityThreshold: Schema.Number.pipe(Schema.positive())
  }).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'IndividualFrequencyBand',
    title: 'Individual Frequency Band Configuration',
    description: 'Complete configuration for a single frequency band'
  })
)

export type IndividualFrequencyBand = typeof IndividualFrequencyBandSchema.Type

/**
 * 周波数帯域群設定
 */
export const FrequencyBandCollectionSchema = Schema.Struct({
  // 帯域群管理
  bands: Schema.Array(IndividualFrequencyBandSchema),

  // グローバル設定
  global: Schema.Struct({
    // 全体ゲイン
    masterGain: GainSchema,

    // クロスオーバー設定
    crossover: Schema.Struct({
      enabled: Schema.Boolean,
      type: Schema.Literal('linkwitz_riley', 'butterworth', 'bessel', 'chebyshev'),
      slope: Schema.Number.pipe(Schema.between(6, 48))
    }),

    // 位相補正
    phaseCorrection: Schema.Struct({
      enabled: Schema.Boolean,
      method: Schema.Literal('linear', 'minimum', 'mixed'),
      delay: Schema.Number.pipe(Schema.nonNegative())
    }).pipe(Schema.optional),

    // 動的レンジ制御
    dynamics: Schema.Struct({
      enabled: Schema.Boolean,
      compressor: Schema.Struct({
        threshold: GainSchema,
        ratio: Schema.Number.pipe(Schema.between(1, 20)),
        attack: Schema.Number.pipe(Schema.positive()),
        release: Schema.Number.pipe(Schema.positive())
      }).pipe(Schema.optional),

      limiter: Schema.Struct({
        threshold: GainSchema,
        lookahead: Schema.Number.pipe(Schema.nonNegative())
      }).pipe(Schema.optional)
    }).pipe(Schema.optional)
  }),

  // スペクトラム解析
  analysis: Schema.Struct({
    enabled: Schema.Boolean,
    fftSize: Schema.Number.pipe(Schema.int()).pipe(
      Schema.refine(n => [128, 256, 512, 1024, 2048, 4096].includes(n), {
        message: 'FFT size must be a power of 2 between 128 and 4096'
      })
    ),
    windowFunction: Schema.Literal('hann', 'hamming', 'blackman', 'kaiser', 'rectangular'),
    overlapRatio: Schema.Number.pipe(Schema.between(0, 0.9))
  }).pipe(Schema.optional),

  // 最適化設定
  optimization: Schema.Struct({
    enabled: Schema.Boolean,
    autoGainStaging: Schema.Boolean,
    dynamicBandwidth: Schema.Boolean,
    adaptiveFiltering: Schema.Boolean,
    memoryOptimization: Schema.Boolean
  }).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'FrequencyBandCollection',
    title: 'Frequency Band Collection',
    description: 'Complete collection of frequency bands with global controls'
  })
)

export type FrequencyBandCollection = typeof FrequencyBandCollectionSchema.Type

/**
 * 周波数帯域作成パラメータ
 */
export const CreateFrequencyBandsParamsSchema = Schema.Struct({
  preset: Schema.Literal('minimal', 'standard', 'detailed', 'mastering', 'custom').pipe(Schema.optional),
  bandCount: Schema.Number.pipe(Schema.int(), Schema.between(3, 31)).pipe(Schema.optional),
  frequencyRange: Schema.Struct({
    min: FrequencyValueSchema,
    max: FrequencyValueSchema
  }).pipe(Schema.optional),
  spacing: Schema.Literal('linear', 'logarithmic', 'critical_bands', 'custom').pipe(Schema.optional),
  enableAdvanced: Schema.Boolean.pipe(Schema.optional)
})

export type CreateFrequencyBandsParams = typeof CreateFrequencyBandsParamsSchema.Type

/**
 * 周波数帯域エラー型
 */
export const FrequencyBandsErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidFrequencyRange'),
    minFreq: Schema.Number,
    maxFreq: Schema.Number,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('BandOverlap'),
    band1: Schema.String,
    band2: Schema.String,
    overlapAmount: Schema.Number,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('InsufficientBandwidth'),
    bandId: Schema.String,
    requestedBandwidth: Schema.Number,
    availableBandwidth: Schema.Number,
    message: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('FilterInstability'),
    bandId: Schema.String,
    qFactor: Schema.Number,
    message: Schema.String
  })
])

export type FrequencyBandsError = typeof FrequencyBandsErrorSchema.Type

/**
 * 標準周波数帯域プリセット
 */
export const FREQUENCY_BAND_PRESETS = {
  MINIMAL: {
    description: '3-band equalizer (Low, Mid, High)',
    bands: [
      { name: 'Low', centerFreq: 0.02, bandwidth: 0.04 },
      { name: 'Mid', centerFreq: 0.2, bandwidth: 0.4 },
      { name: 'High', centerFreq: 2.0, bandwidth: 4.0 }
    ]
  },
  STANDARD: {
    description: '7-band graphic equalizer',
    bands: [
      { name: '60Hz', centerFreq: 0.006, bandwidth: 0.004 },
      { name: '170Hz', centerFreq: 0.017, bandwidth: 0.01 },
      { name: '310Hz', centerFreq: 0.031, bandwidth: 0.02 },
      { name: '600Hz', centerFreq: 0.06, bandwidth: 0.04 },
      { name: '1kHz', centerFreq: 0.1, bandwidth: 0.08 },
      { name: '3kHz', centerFreq: 0.3, bandwidth: 0.2 },
      { name: '12kHz', centerFreq: 1.2, bandwidth: 0.8 }
    ]
  },
  DETAILED: {
    description: '15-band parametric equalizer',
    bands: Array.from({ length: 15 }, (_, i) => ({
      name: `Band ${i + 1}`,
      centerFreq: 0.001 * Math.pow(2, i * 0.8),
      bandwidth: 0.0005 * Math.pow(2, i * 0.8)
    }))
  },
  MASTERING: {
    description: '31-band professional mastering equalizer',
    bands: Array.from({ length: 31 }, (_, i) => ({
      name: `${Math.round(20 * Math.pow(2, i * 0.33))}Hz`,
      centerFreq: 0.002 * Math.pow(2, i * 0.33),
      bandwidth: 0.001 * Math.pow(2, i * 0.33)
    }))
  }
} as const

/**
 * 地形生成用周波数マッピング
 */
export const TERRAIN_FREQUENCY_MAPPING = {
  CONTINENTAL: { range: [0.0001, 0.001], description: 'Continental-scale features' },
  REGIONAL: { range: [0.001, 0.01], description: 'Regional terrain features' },
  LOCAL: { range: [0.01, 0.1], description: 'Local landscape features' },
  DETAIL: { range: [0.1, 1.0], description: 'Fine terrain details' },
  SURFACE: { range: [1.0, 10.0], description: 'Surface texture and roughness' }
} as const
