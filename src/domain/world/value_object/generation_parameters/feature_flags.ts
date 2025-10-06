/**
 * FeatureFlags Value Object - 機能フラグ設定
 *
 * ワールド生成の各機能のオン/オフとパラメータ調整
 * 実験的機能と安定機能の管理
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'

/**
 * フラグ重要度Brand型（1-10）
 */
export type FlagPriority = number & BrandType.Brand<'FlagPriority'>

/**
 * バージョン番号Brand型
 */
export type VersionNumber = string & BrandType.Brand<'VersionNumber'>

/**
 * フラグ重要度Schema
 */
export const FlagPrioritySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 10),
  Schema.brand('FlagPriority'),
  Schema.annotations({
    identifier: 'FlagPriority',
    title: 'Feature Flag Priority',
    description: 'Priority level of feature flag (1=low, 10=critical)',
    examples: [1, 5, 8, 10],
  })
)

/**
 * バージョン番号Schema
 */
export const VersionNumberSchema = Schema.String.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+(-[a-z0-9]+)?$/),
  Schema.brand('VersionNumber'),
  Schema.annotations({
    identifier: 'VersionNumber',
    title: 'Version Number',
    description: 'Semantic version number for feature compatibility',
    examples: ['1.0.0', '2.1.3', '3.0.0-beta', '1.5.2-alpha'],
  })
)

/**
 * 機能カテゴリ
 */
export const FeatureCategorySchema = Schema.Literal(
  'terrain', // 地形生成
  'biomes', // バイオーム
  'structures', // 構造物
  'ores', // 鉱石
  'caves', // 洞窟
  'water', // 水系
  'vegetation', // 植生
  'weather', // 天候
  'lighting', // 光源
  'physics', // 物理演算
  'performance', // パフォーマンス
  'experimental', // 実験的機能
  'debug', // デバッグ
  'compatibility' // 互換性
).pipe(
  Schema.annotations({
    title: 'Feature Category',
    description: 'Category classification of feature',
  })
)

export type FeatureCategory = typeof FeatureCategorySchema.Type

/**
 * 機能状態
 */
export const FeatureStateSchema = Schema.Literal(
  'enabled', // 有効
  'disabled', // 無効
  'deprecated', // 非推奨
  'experimental', // 実験的
  'beta', // ベータ
  'stable', // 安定
  'legacy' // レガシー
).pipe(
  Schema.annotations({
    title: 'Feature State',
    description: 'Current state of feature flag',
  })
)

export type FeatureState = typeof FeatureStateSchema.Type

/**
 * 条件演算子
 */
export const ConditionOperatorSchema = Schema.Literal(
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'contains',
  'starts_with',
  'ends_with',
  'matches_regex'
).pipe(
  Schema.annotations({
    title: 'Condition Operator',
    description: 'Operator for conditional feature activation',
  })
)

export type ConditionOperator = typeof ConditionOperatorSchema.Type

/**
 * 条件設定
 */
export const FeatureConditionSchema = Schema.Struct({
  property: Schema.String,
  operator: ConditionOperatorSchema,
  value: Schema.Unknown,
  description: Schema.String.pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'FeatureCondition',
    title: 'Feature Activation Condition',
    description: 'Condition that must be met for feature activation',
  })
)

export type FeatureCondition = typeof FeatureConditionSchema.Type

/**
 * パフォーマンス影響度
 */
export const PerformanceImpactSchema = Schema.Literal(
  'none', // 影響なし
  'minimal', // 最小限
  'low', // 低
  'moderate', // 中程度
  'high', // 高
  'severe' // 深刻
).pipe(
  Schema.annotations({
    title: 'Performance Impact',
    description: 'Expected performance impact of feature',
  })
)

export type PerformanceImpact = typeof PerformanceImpactSchema.Type

/**
 * 個別機能フラグ設定
 */
export const FeatureFlagConfigSchema = Schema.Struct({
  // 基本設定
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.pattern(/^[a-z][a-z0-9_]*$/),
    Schema.annotations({ description: 'Unique feature flag name in snake_case' })
  ),

  displayName: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(200),
    Schema.annotations({ description: 'Human-readable feature name' })
  ),

  description: Schema.String.pipe(
    Schema.maxLength(1000),
    Schema.annotations({ description: 'Detailed description of feature functionality' })
  ),

  // 状態管理
  state: FeatureStateSchema,
  enabled: Schema.Boolean,
  category: FeatureCategorySchema,
  priority: FlagPrioritySchema,

  // バージョン情報
  version: Schema.Struct({
    introduced: VersionNumberSchema,
    lastModified: VersionNumberSchema,
    deprecated: VersionNumberSchema.pipe(Schema.optional),
    removed: VersionNumberSchema.pipe(Schema.optional),
  }),

  // 依存関係
  dependencies: Schema.Struct({
    requires: Schema.Array(Schema.String).pipe(Schema.optional),
    conflicts: Schema.Array(Schema.String).pipe(Schema.optional),
    suggests: Schema.Array(Schema.String).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 条件付き有効化
  conditions: Schema.Array(FeatureConditionSchema).pipe(Schema.optional),

  // パフォーマンス情報
  performance: Schema.Struct({
    impact: PerformanceImpactSchema,
    cpuUsage: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.optional),
    memoryUsage: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
    diskUsage: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 設定パラメータ
  parameters: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.Boolean, Schema.Number, Schema.String, Schema.Array(Schema.Unknown)),
  }).pipe(Schema.optional),

  // メタデータ
  metadata: Schema.Struct({
    author: Schema.String.pipe(Schema.optional),
    tags: Schema.Array(Schema.String).pipe(Schema.optional),
    documentation: Schema.String.pipe(Schema.optional),
    issues: Schema.Array(Schema.String).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'FeatureFlagConfig',
    title: 'Individual Feature Flag Configuration',
    description: 'Complete configuration for a specific feature flag',
  })
)

export type FeatureFlagConfig = typeof FeatureFlagConfigSchema.Type

/**
 * 機能フラグ群設定
 */
export const FeatureFlagsSchema = Schema.Struct({
  // グローバル設定
  globalSettings: Schema.Struct({
    enabled: Schema.Boolean,
    strictMode: Schema.Boolean,
    logLevel: Schema.Literal('none', 'error', 'warn', 'info', 'debug'),
    cacheEnabled: Schema.Boolean,
    validationEnabled: Schema.Boolean,
  }),

  // フラグ定義
  flags: Schema.Record({
    key: Schema.String,
    value: FeatureFlagConfigSchema,
  }),

  // プリセット設定
  presets: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      flagOverrides: Schema.Record({
        key: Schema.String,
        value: Schema.Boolean,
      }),
    }),
  }).pipe(Schema.optional),

  // 環境別設定
  environments: Schema.Record({
    key: Schema.Literal('development', 'testing', 'staging', 'production'),
    value: Schema.Struct({
      defaultState: FeatureStateSchema,
      allowedStates: Schema.Array(FeatureStateSchema),
      autoEnable: Schema.Array(Schema.String),
      autoDisable: Schema.Array(Schema.String),
    }),
  }).pipe(Schema.optional),

  // 実験設定
  experiments: Schema.Struct({
    enabled: Schema.Boolean,
    maxConcurrent: Schema.Number.pipe(Schema.int(), Schema.positive()),
    rolloutPercentage: Schema.Number.pipe(Schema.between(0, 100)),
    targetAudience: Schema.Array(Schema.String),
  }).pipe(Schema.optional),

  // 監視・分析
  monitoring: Schema.Struct({
    enabled: Schema.Boolean,
    metricsCollection: Schema.Boolean,
    errorReporting: Schema.Boolean,
    usageAnalytics: Schema.Boolean,
    performanceMonitoring: Schema.Boolean,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'FeatureFlags',
    title: 'Complete Feature Flags Configuration',
    description: 'Full feature flags system configuration',
  })
)

export type FeatureFlags = typeof FeatureFlagsSchema.Type

/**
 * 機能フラグ作成パラメータ
 */
export const CreateFeatureFlagsParamsSchema = Schema.Struct({
  preset: Schema.Literal('minimal', 'standard', 'full', 'experimental', 'custom').pipe(Schema.optional),
  enabledCategories: Schema.Array(FeatureCategorySchema).pipe(Schema.optional),
  environment: Schema.Literal('development', 'testing', 'staging', 'production').pipe(Schema.optional),
  customFlags: Schema.Record({
    key: Schema.String,
    value: Schema.Boolean,
  }).pipe(Schema.optional),
})

export type CreateFeatureFlagsParams = typeof CreateFeatureFlagsParamsSchema.Type

/**
 * 機能フラグエラー型
 */
export const FeatureFlagsErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidFlagName'),
    name: Schema.String,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('DependencyConflict'),
    flag: Schema.String,
    dependencies: Schema.Array(Schema.String),
    conflicts: Schema.Array(Schema.String),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('VersionCompatibilityError'),
    flag: Schema.String,
    requiredVersion: VersionNumberSchema,
    currentVersion: VersionNumberSchema,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConditionEvaluationError'),
    flag: Schema.String,
    condition: FeatureConditionSchema,
    error: Schema.String,
    message: Schema.String,
  }),
])

export type FeatureFlagsError = typeof FeatureFlagsErrorSchema.Type

/**
 * 標準機能フラグ定義
 */
export const STANDARD_FEATURE_FLAGS = {
  // 地形生成
  TERRAIN_GENERATION: 'terrain_generation',
  ADVANCED_TERRAIN: 'advanced_terrain',
  TERRAIN_SMOOTHING: 'terrain_smoothing',

  // バイオーム
  BIOME_BLENDING: 'biome_blending',
  CUSTOM_BIOMES: 'custom_biomes',
  BIOME_VARIANTS: 'biome_variants',

  // 構造物
  STRUCTURE_GENERATION: 'structure_generation',
  LARGE_STRUCTURES: 'large_structures',
  STRUCTURE_VARIANTS: 'structure_variants',

  // 洞窟
  CAVE_GENERATION: 'cave_generation',
  COMPLEX_CAVES: 'complex_caves',
  UNDERGROUND_BIOMES: 'underground_biomes',

  // パフォーマンス
  ASYNC_GENERATION: 'async_generation',
  CHUNK_CACHING: 'chunk_caching',
  MEMORY_OPTIMIZATION: 'memory_optimization',

  // 実験的
  EXPERIMENTAL_FEATURES: 'experimental_features',
  BETA_TERRAIN: 'beta_terrain',
  FUTURE_COMPATIBILITY: 'future_compatibility',
} as const
