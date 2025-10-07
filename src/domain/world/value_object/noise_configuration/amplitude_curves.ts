/**
 * AmplitudeCurves Value Object - 振幅カーブ設定
 *
 * 地形生成における振幅変化の数学的モデリング
 * ベジェ曲線・スプライン補間による滑らかな変化制御
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'

/**
 * 正規化時間Brand型（0.0から1.0）
 */
export type NormalizedTime = number & BrandType.Brand<'NormalizedTime'>

/**
 * 制御点値Brand型（-10.0から10.0）
 */
export type ControlPointValue = number & BrandType.Brand<'ControlPointValue'>

/**
 * カーブ張力Brand型（0.0から1.0）
 */
export type CurveTension = number & BrandType.Brand<'CurveTension'>

/**
 * スムージング強度Brand型（0.0から1.0）
 */
export type SmoothingStrength = number & BrandType.Brand<'SmoothingStrength'>

/**
 * 正規化時間Schema
 */
export const NormalizedTimeSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('NormalizedTime'),
  Schema.annotations({
    identifier: 'NormalizedTime',
    title: 'Normalized Time',
    description: 'Time parameter normalized to 0.0-1.0 range',
    examples: [0.0, 0.25, 0.5, 0.75, 1.0],
  })
)

/**
 * 制御点値Schema
 */
export const ControlPointValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-10.0, 10.0),
  Schema.brand('ControlPointValue'),
  Schema.annotations({
    identifier: 'ControlPointValue',
    title: 'Control Point Value',
    description: 'Value at curve control point (-10.0 to 10.0)',
    examples: [-2.0, -1.0, 0.0, 1.0, 2.0],
  })
)

/**
 * カーブ張力Schema
 */
export const CurveTensionSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('CurveTension'),
  Schema.annotations({
    identifier: 'CurveTension',
    title: 'Curve Tension',
    description: 'Tension parameter for curve interpolation (0.0 to 1.0)',
    examples: [0.0, 0.25, 0.5, 0.75, 1.0],
  })
)

/**
 * スムージング強度Schema
 */
export const SmoothingStrengthSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('SmoothingStrength'),
  Schema.annotations({
    identifier: 'SmoothingStrength',
    title: 'Smoothing Strength',
    description: 'Strength of curve smoothing (0.0 = no smoothing, 1.0 = maximum)',
    examples: [0.0, 0.2, 0.5, 0.8, 1.0],
  })
)

/**
 * NormalizedTime型のunsafe変換関数
 * 定数定義時の型アサーションを型安全に実施（範囲検証なし）
 */
export const makeUnsafeNormalizedTime = (value: number): NormalizedTime => value as NormalizedTime

/**
 * ControlPointValue型のunsafe変換関数
 * 定数定義時の型アサーションを型安全に実施（範囲検証なし）
 */
export const makeUnsafeControlPointValue = (value: number): ControlPointValue => value as ControlPointValue

/**
 * カーブタイプ
 */
export const CurveTypeSchema = Schema.Literal(
  'linear', // 線形補間
  'bezier', // ベジェ曲線
  'hermite', // エルミート補間
  'catmull_rom', // Catmull-Rom スプライン
  'b_spline', // Bスプライン
  'nurbs', // NURBS
  'polynomial', // 多項式補間
  'exponential', // 指数関数
  'logarithmic', // 対数関数
  'trigonometric', // 三角関数
  'gaussian', // ガウシアン
  'sigmoid', // シグモイド
  'custom' // カスタム関数
).pipe(
  Schema.annotations({
    title: 'Curve Type',
    description: 'Type of mathematical curve for amplitude interpolation',
  })
)

export type CurveType = typeof CurveTypeSchema.Type

/**
 * 制御点
 */
export const ControlPointSchema = Schema.Struct({
  // 位置（時間軸）
  time: NormalizedTimeSchema,

  // 値（振幅軸）
  value: ControlPointValueSchema,

  // 接線制御（ベジェ曲線用）
  tangent: Schema.Struct({
    inAngle: Schema.Number.pipe(
      Schema.between(-Math.PI, Math.PI),
      Schema.annotations({ description: 'Incoming tangent angle in radians' })
    ).pipe(Schema.optional),
    outAngle: Schema.Number.pipe(
      Schema.between(-Math.PI, Math.PI),
      Schema.annotations({ description: 'Outgoing tangent angle in radians' })
    ).pipe(Schema.optional),
    inMagnitude: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.annotations({ description: 'Incoming tangent magnitude' })
    ).pipe(Schema.optional),
    outMagnitude: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.annotations({ description: 'Outgoing tangent magnitude' })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 制御点属性
  locked: Schema.Boolean.pipe(Schema.optional),
  weight: Schema.Number.pipe(Schema.between(0.0, 1.0)).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'ControlPoint',
    title: 'Curve Control Point',
    description: 'Single control point defining curve shape',
  })
)

export type ControlPoint = typeof ControlPointSchema.Type

/**
 * カーブセグメント
 */
export const CurveSegmentSchema = Schema.Struct({
  // セグメント識別
  id: Schema.String.pipe(Schema.optional),

  // 開始・終了制御点
  startPoint: ControlPointSchema,
  endPoint: ControlPointSchema,

  // セグメント特性
  type: CurveTypeSchema,
  tension: CurveTensionSchema.pipe(Schema.optional),

  // 補間パラメータ
  interpolation: Schema.Struct({
    method: Schema.Literal('uniform', 'chord_length', 'centripetal'),
    alpha: Schema.Number.pipe(Schema.between(0.0, 1.0)).pipe(Schema.optional),
    resolution: Schema.Number.pipe(
      Schema.int(),
      Schema.between(2, 1000),
      Schema.annotations({ description: 'Number of interpolation points' })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 最適化設定
  optimization: Schema.Struct({
    enabled: Schema.Boolean,
    tolerance: Schema.Number.pipe(Schema.positive()),
    maxIterations: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'CurveSegment',
    title: 'Amplitude Curve Segment',
    description: 'Individual segment of amplitude curve between two control points',
  })
)

export type CurveSegment = typeof CurveSegmentSchema.Type

/**
 * 完全振幅カーブ設定
 */
export const AmplitudeCurveSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Unique identifier for amplitude curve' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(200),
    Schema.annotations({ description: 'Human-readable name for curve' })
  ),
  description: Schema.String.pipe(
    Schema.maxLength(1000),
    Schema.annotations({ description: 'Detailed description of curve purpose' })
  ).pipe(Schema.optional),

  // カーブ構造
  controlPoints: Schema.Array(ControlPointSchema).pipe(
    Schema.minItems(2),
    Schema.maxItems(100),
    Schema.annotations({ description: 'Array of control points defining the curve' })
  ),

  // グローバル設定
  global: Schema.Struct({
    // カーブタイプ
    defaultType: CurveTypeSchema,

    // 範囲設定
    inputRange: Schema.Struct({
      min: Schema.Number,
      max: Schema.Number,
    }),
    outputRange: Schema.Struct({
      min: ControlPointValueSchema,
      max: ControlPointValueSchema,
    }),

    // スムージング
    smoothing: Schema.Struct({
      enabled: Schema.Boolean,
      strength: SmoothingStrengthSchema,
      iterations: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    }).pipe(Schema.optional),

    // 正規化
    normalization: Schema.Struct({
      enabled: Schema.Boolean,
      method: Schema.Literal('min_max', 'z_score', 'unit_vector'),
      preserveShape: Schema.Boolean,
    }).pipe(Schema.optional),
  }),

  // 動的制御
  animation: Schema.Struct({
    enabled: Schema.Boolean,
    keyframes: Schema.Array(
      Schema.Struct({
        time: Schema.Number.pipe(Schema.nonNegative()),
        curve: Schema.Array(ControlPointSchema),
        easing: Schema.Literal('linear', 'ease_in', 'ease_out', 'ease_in_out'),
      })
    ),
    looping: Schema.Boolean,
    duration: Schema.Number.pipe(Schema.positive()),
  }).pipe(Schema.optional),

  // 条件付き変調
  modulation: Schema.Struct({
    enabled: Schema.Boolean,
    modulators: Schema.Array(
      Schema.Struct({
        parameter: Schema.String,
        influence: Schema.Number.pipe(Schema.between(0.0, 1.0)),
        mapping: Schema.Literal('linear', 'exponential', 'logarithmic', 'custom'),
      })
    ),
  }).pipe(Schema.optional),

  // パフォーマンス設定
  performance: Schema.Struct({
    cacheEnabled: Schema.Boolean,
    precalculateSteps: Schema.Number.pipe(Schema.int(), Schema.positive()).pipe(Schema.optional),
    approximationLevel: Schema.Literal('none', 'low', 'medium', 'high').pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 解析・デバッグ
  analysis: Schema.Struct({
    enabled: Schema.Boolean,
    outputStatistics: Schema.Boolean,
    visualize: Schema.Boolean,
    exportPoints: Schema.Boolean,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'AmplitudeCurve',
    title: 'Complete Amplitude Curve Configuration',
    description: 'Comprehensive amplitude curve with mathematical interpolation',
  })
)

export type AmplitudeCurve = typeof AmplitudeCurveSchema.Type

/**
 * 振幅カーブ作成パラメータ
 */
export const CreateAmplitudeCurveParamsSchema = Schema.Struct({
  preset: Schema.Literal('linear', 'exponential', 'logarithmic', 'bell', 'sawtooth', 'square', 'custom').pipe(
    Schema.optional
  ),
  pointCount: Schema.Number.pipe(Schema.int(), Schema.between(2, 50)).pipe(Schema.optional),
  curveType: CurveTypeSchema.pipe(Schema.optional),
  valueRange: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }).pipe(Schema.optional),
  customPoints: Schema.Array(
    Schema.Struct({
      time: Schema.Number,
      value: Schema.Number,
    })
  ).pipe(Schema.optional),
})

export type CreateAmplitudeCurveParams = typeof CreateAmplitudeCurveParamsSchema.Type

/**
 * 振幅カーブエラー型
 */
export const AmplitudeCurveErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidControlPoint'),
    pointIndex: Schema.Number,
    time: Schema.Number,
    value: Schema.Number,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CurveDiscontinuity'),
    segmentIndex: Schema.Number,
    discontinuityType: Schema.Literal('position', 'tangent', 'curvature'),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InterpolationError'),
    curveType: CurveTypeSchema,
    error: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InsufficientControlPoints'),
    required: Schema.Number,
    provided: Schema.Number,
    curveType: CurveTypeSchema,
    message: Schema.String,
  }),
])

export type AmplitudeCurveError = typeof AmplitudeCurveErrorSchema.Type

/**
 * 標準振幅カーブプリセット
 */
export const AMPLITUDE_CURVE_PRESETS = {
  LINEAR: {
    description: 'Simple linear amplitude progression',
    points: [
      { time: 0.0, value: 0.0 },
      { time: 1.0, value: 1.0 },
    ],
  },
  EXPONENTIAL: {
    description: 'Exponential growth curve',
    points: [
      { time: 0.0, value: 0.0 },
      { time: 0.25, value: 0.0625 },
      { time: 0.5, value: 0.25 },
      { time: 0.75, value: 0.5625 },
      { time: 1.0, value: 1.0 },
    ],
  },
  BELL: {
    description: 'Bell-shaped amplitude curve',
    points: [
      { time: 0.0, value: 0.0 },
      { time: 0.25, value: 0.5 },
      { time: 0.5, value: 1.0 },
      { time: 0.75, value: 0.5 },
      { time: 1.0, value: 0.0 },
    ],
  },
  SAWTOOTH: {
    description: 'Sawtooth wave pattern',
    points: [
      { time: 0.0, value: 0.0 },
      { time: 0.5, value: 1.0 },
      { time: 0.51, value: 0.0 },
      { time: 1.0, value: 1.0 },
    ],
  },
  TERRAIN_FALLOFF: {
    description: 'Natural terrain amplitude falloff',
    points: [
      { time: 0.0, value: 1.0 },
      { time: 0.3, value: 0.8 },
      { time: 0.6, value: 0.4 },
      { time: 0.8, value: 0.1 },
      { time: 1.0, value: 0.0 },
    ],
  },
} as const

/**
 * 地形生成用振幅マッピング
 */
export const TERRAIN_AMPLITUDE_MAPPING = {
  HEIGHT_VARIATION: 'Controls overall terrain height variation',
  DETAIL_INTENSITY: 'Controls fine detail amplitude',
  EROSION_PATTERN: 'Controls erosion effect intensity',
  VEGETATION_DENSITY: 'Controls vegetation amplitude variation',
  MOISTURE_GRADIENT: 'Controls moisture level variation',
} as const
