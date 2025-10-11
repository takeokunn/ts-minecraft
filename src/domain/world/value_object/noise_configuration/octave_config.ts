/**
 * OctaveConfig Value Object - オクターブ設定
 *
 * フラクタルノイズにおける各オクターブの詳細設定
 * 数学的精度とパフォーマンスの最適化
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'

/**
 * オクターブインデックスBrand型（0以上）
 */
export type OctaveIndex = number & BrandType.Brand<'OctaveIndex'>

/**
 * 重みBrand型（0.0から1.0）
 */
export type Weight = number & BrandType.Brand<'Weight'>

/**
 * 位相Brand型（0.0から2π）
 */
export type Phase = number & BrandType.Brand<'Phase'>

/**
 * オクターブインデックスSchema
 */
export const OctaveIndexSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
  Schema.between(0, 15),
  Schema.brand('OctaveIndex'),
  Schema.annotations({
    identifier: 'OctaveIndex',
    title: 'Octave Index',
    description: 'Zero-based index of noise octave (0 to 15)',
    examples: [0, 1, 4, 7],
  })
)

/**
 * 重みSchema
 */
export const WeightSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('Weight'),
  Schema.annotations({
    identifier: 'Weight',
    title: 'Octave Weight',
    description: 'Relative weight of octave contribution (0.0 to 1.0)',
    examples: [0.1, 0.5, 0.8, 1.0],
  })
)

/**
 * 位相Schema
 */
export const PhaseSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, Math.PI * 2),
  Schema.brand('Phase'),
  Schema.annotations({
    identifier: 'Phase',
    title: 'Phase Offset',
    description: 'Phase offset in radians (0.0 to 2π)',
    examples: [0, Math.PI / 4, Math.PI / 2, Math.PI],
  })
)

/**
 * OctaveIndex型のunsafe変換関数
 * 定数定義時の型アサーションを型安全に実施（範囲検証なし）
 */
export const makeUnsafeOctaveIndex = (value: number): OctaveIndex => value as OctaveIndex

/**
 * Weight型のunsafe変換関数
 * 定数定義時の型アサーションを型安全に実施（範囲検証なし）
 */
export const makeUnsafeWeight = (value: number): Weight => value as Weight

/**
 * Phase型のunsafe変換関数
 * 定数定義時の型アサーションを型安全に実施（範囲検証なし）
 */
export const makeUnsafePhase = (value: number): Phase => value as Phase

/**
 * オクターブタイプ
 */
export const OctaveTypeSchema = Schema.Literal(
  'base', // 基本オクターブ
  'detail', // 詳細オクターブ
  'roughness', // 粗さオクターブ
  'distortion', // 歪みオクターブ
  'modulation', // 変調オクターブ
  'mask', // マスクオクターブ
  'custom' // カスタムオクターブ
).pipe(
  Schema.annotations({
    title: 'Octave Type',
    description: 'Functional role of the octave in noise generation',
  })
)

export type OctaveType = typeof OctaveTypeSchema.Type

/**
 * 個別オクターブ設定
 */
export const IndividualOctaveConfigSchema = Schema.Struct({
  // 基本識別
  index: OctaveIndexSchema,
  type: OctaveTypeSchema,
  enabled: Schema.Boolean,

  // 数学的パラメータ
  frequency: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Frequency for this octave' })),
  amplitude: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Amplitude for this octave' })),
  weight: WeightSchema,

  // 位相・オフセット
  phase: PhaseSchema,
  offset: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number.pipe(Schema.optional),
  }),

  // 変換設定
  transform: Schema.Struct({
    // スケール変換
    scale: Schema.Struct({
      x: Schema.Number.pipe(Schema.positive()),
      y: Schema.Number.pipe(Schema.positive()),
      z: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
    }),

    // 回転変換（度数）
    rotation: Schema.Struct({
      x: Schema.Number.pipe(Schema.between(-360, 360)),
      y: Schema.Number.pipe(Schema.between(-360, 360)),
      z: Schema.Number.pipe(Schema.between(-360, 360)).pipe(Schema.optional),
    }).pipe(Schema.optional),

    // 歪み変換
    distortion: Schema.Struct({
      strength: Schema.Number.pipe(Schema.between(0, 10)),
      frequency: Schema.Number.pipe(Schema.positive()),
    }).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // フィルタリング
  filter: Schema.Struct({
    type: Schema.Literal('none', 'lowpass', 'highpass', 'bandpass', 'notch'),
    cutoffFrequency: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
    resonance: Schema.Number.pipe(Schema.between(0, 10)).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 条件付き有効化
  conditions: Schema.Array(
    Schema.Struct({
      parameter: Schema.String,
      operator: Schema.Literal('>', '<', '>=', '<=', '==', '!='),
      value: Schema.Number,
      action: Schema.Literal('enable', 'disable', 'modify_weight'),
    })
  ).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'IndividualOctaveConfig',
    title: 'Individual Octave Configuration',
    description: 'Complete configuration for a single noise octave',
  })
)

export type IndividualOctaveConfig = typeof IndividualOctaveConfigSchema.Type

/**
 * オクターブ組み合わせ設定
 */
export const OctaveCombinationSchema = Schema.Struct({
  // 基本組み合わせ方法
  method: Schema.Literal(
    'linear', // 線形結合
    'multiplicative', // 乗算結合
    'max', // 最大値
    'min', // 最小値
    'rms', // RMS結合
    'weighted_sum', // 重み付き和
    'custom' // カスタム関数
  ),

  // 正規化設定
  normalization: Schema.Struct({
    enabled: Schema.Boolean,
    method: Schema.Literal('min_max', 'z_score', 'sigmoid', 'tanh'),
    range: Schema.Struct({
      min: Schema.Number,
      max: Schema.Number,
    }).pipe(Schema.optional),
  }),

  // 重み付け戦略
  weighting: Schema.Struct({
    strategy: Schema.Literal('equal', 'exponential', 'logarithmic', 'custom'),
    parameters: Schema.Record({
      key: Schema.String,
      value: Schema.Number,
    }).pipe(Schema.optional),
  }),

  // 閾値処理
  thresholding: Schema.Struct({
    enabled: Schema.Boolean,
    lowerThreshold: Schema.Number.pipe(Schema.optional),
    upperThreshold: Schema.Number.pipe(Schema.optional),
    behavior: Schema.Literal('clamp', 'wrap', 'mirror', 'zero'),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OctaveCombination',
    title: 'Octave Combination Strategy',
    description: 'Method for combining multiple octaves into final result',
  })
)

export type OctaveCombination = typeof OctaveCombinationSchema.Type

/**
 * 完全オクターブ設定
 */
export const CompleteOctaveConfigSchema = Schema.Struct({
  // オクターブ集合
  octaves: Schema.Array(IndividualOctaveConfigSchema),

  // 組み合わせ戦略
  combination: OctaveCombinationSchema,

  // グローバル設定
  global: Schema.Struct({
    // 基本パラメータ
    baseLacunarity: Schema.Number.pipe(Schema.greaterThanOrEqualTo(1.0)),
    basePersistence: Schema.Number.pipe(Schema.between(0.0, 1.0)),

    // 自動計算設定
    autoCalculateWeights: Schema.Boolean,
    autoNormalize: Schema.Boolean,

    // 最適化設定
    optimization: Schema.Struct({
      skipZeroWeightOctaves: Schema.Boolean,
      earlyTermination: Schema.Boolean,
      maxContribution: Schema.Number.pipe(Schema.between(0, 1)),
    }),
  }),

  // パフォーマンス制限
  performance: Schema.Struct({
    maxActiveOctaves: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
    computationBudget: Schema.Number.pipe(Schema.positive()),
    cacheEnabled: Schema.Boolean,
    parallelProcessing: Schema.Boolean,
  }).pipe(Schema.optional),

  // 品質管理
  quality: Schema.Struct({
    samplingRate: Schema.Number.pipe(Schema.positive()),
    interpolationQuality: Schema.Literal('linear', 'cubic', 'quintic'),
    antiAliasing: Schema.Boolean,
    errorTolerance: Schema.Number.pipe(Schema.positive()),
  }).pipe(Schema.optional),

  // デバッグ・解析
  analysis: Schema.Struct({
    enabled: Schema.Boolean,
    outputStatistics: Schema.Boolean,
    visualizeOctaves: Schema.Boolean,
    measurePerformance: Schema.Boolean,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'CompleteOctaveConfig',
    title: 'Complete Octave Configuration',
    description: 'Comprehensive configuration for all noise octaves',
  })
)

export type CompleteOctaveConfig = typeof CompleteOctaveConfigSchema.Type

/**
 * オクターブ設定作成パラメータ
 */
export const CreateOctaveConfigParamsSchema = Schema.Struct({
  octaveCount: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)).pipe(Schema.optional),
  preset: Schema.Literal('simple', 'standard', 'detailed', 'extreme').pipe(Schema.optional),
  lacunarity: Schema.Number.pipe(Schema.optional),
  persistence: Schema.Number.pipe(Schema.optional),
  enableAdvanced: Schema.Boolean.pipe(Schema.optional),
  customOctaves: Schema.Array(
    Schema.Struct({
      frequency: Schema.Number,
      amplitude: Schema.Number,
      weight: Schema.Number.pipe(Schema.optional),
    })
  ).pipe(Schema.optional),
})

export type CreateOctaveConfigParams = typeof CreateOctaveConfigParamsSchema.Type

/**
 * オクターブ設定エラー型
 */
export const OctaveConfigErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidOctaveIndex'),
    index: Schema.Number,
    maxAllowed: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('IncompatibleOctaveTypes'),
    octave1: OctaveTypeSchema,
    octave2: OctaveTypeSchema,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CombinationError'),
    method: Schema.String,
    octaveCount: Schema.Number,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PerformanceExceeded'),
    limit: Schema.String,
    requested: Schema.Number,
    maximum: Schema.Number,
    message: Schema.String,
  }),
])

export type OctaveConfigError = typeof OctaveConfigErrorSchema.Type

/**
 * 標準オクターブプリセット
 */
export const OCTAVE_PRESETS = {
  SIMPLE: {
    description: 'Simple 4-octave configuration',
    octaveCount: 4,
    lacunarity: 2.0,
    persistence: 0.5,
  },
  STANDARD: {
    description: 'Standard 6-octave configuration',
    octaveCount: 6,
    lacunarity: 2.0,
    persistence: 0.5,
  },
  DETAILED: {
    description: 'Detailed 8-octave configuration',
    octaveCount: 8,
    lacunarity: 2.1,
    persistence: 0.45,
  },
  EXTREME: {
    description: 'Maximum detail 12-octave configuration',
    octaveCount: 12,
    lacunarity: 2.2,
    persistence: 0.4,
  },
} as const

/**
 * オクターブ最適化ヒント
 */
export const OCTAVE_OPTIMIZATION_HINTS = {
  PERFORMANCE: {
    maxOctaves: 6,
    skipSmallContributions: true,
    useApproximation: true,
  },
  QUALITY: {
    maxOctaves: 12,
    skipSmallContributions: false,
    useApproximation: false,
  },
  BALANCED: {
    maxOctaves: 8,
    skipSmallContributions: true,
    useApproximation: false,
  },
} as const
