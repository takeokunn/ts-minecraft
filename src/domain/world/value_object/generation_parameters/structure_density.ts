/**
 * StructureDensity Value Object - 構造物密度設定
 *
 * ワールド生成における構造物の配置密度と生成頻度を管理
 * バランス調整とパフォーマンス最適化を両立
 */

import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { taggedUnion } from '@domain/world/utils'

/**
 * 密度値Brand型（0.0から1.0）
 */
export type DensityValue = number & BrandType.Brand<'DensityValue'>

/**
 * 間隔値Brand型（チャンク単位、1以上）
 */
export type SpacingValue = number & BrandType.Brand<'SpacingValue'>

/**
 * 確率値Brand型（0.0から1.0）
 */
export type ProbabilityValue = number & BrandType.Brand<'ProbabilityValue'>

/**
 * 密度値Schema
 */
export const DensityValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('DensityValue'),
  Schema.annotations({
    identifier: 'DensityValue',
    title: 'Structure Density',
    description: 'Density value from 0.0 (no structures) to 1.0 (maximum density)',
    examples: [0.1, 0.5, 0.8, 0.05],
  })
)

/**
 * 間隔値Schema
 */
export const SpacingValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.positive(),
  Schema.between(1, 1000),
  Schema.brand('SpacingValue'),
  Schema.annotations({
    identifier: 'SpacingValue',
    title: 'Structure Spacing',
    description: 'Minimum spacing between structures in chunks',
    examples: [8, 16, 32, 64],
  })
)

/**
 * 確率値Schema
 */
export const ProbabilityValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('ProbabilityValue'),
  Schema.annotations({
    identifier: 'ProbabilityValue',
    title: 'Generation Probability',
    description: 'Probability of structure generation at valid location',
    examples: [0.01, 0.1, 0.25, 0.5],
  })
)

/**
 * 構造物タイプ列挙
 */
export const StructureTypeSchema = Schema.Literal(
  // 居住構造物
  'village',
  'pillager_outpost',
  'mansion',
  'igloo',
  'witch_hut',

  // 探索構造物
  'dungeon',
  'mineshaft',
  'stronghold',
  'fortress',
  'end_city',

  // 寺院系
  'desert_temple',
  'jungle_temple',
  'ocean_monument',
  'shipwreck',
  'buried_treasure',

  // 自然構造物
  'ruined_portal',
  'fossil',
  'geode',

  // ネザー構造物
  'bastion_remnant',
  'nether_fortress',

  // カスタム構造物
  'custom_small',
  'custom_medium',
  'custom_large',
  'custom_rare'
).pipe(
  Schema.annotations({
    title: 'Structure Type',
    description: 'Type of generated structure',
  })
)

export type StructureType = typeof StructureTypeSchema.Type

/**
 * 構造物サイズ分類
 */
export const StructureSizeSchema = Schema.Literal(
  'tiny', // 1-4チャンク
  'small', // 4-16チャンク
  'medium', // 16-64チャンク
  'large', // 64-256チャンク
  'massive' // 256+チャンク
).pipe(
  Schema.annotations({
    title: 'Structure Size',
    description: 'Size classification of structure',
  })
)

export type StructureSize = typeof StructureSizeSchema.Type

/**
 * 生成条件
 */
export const GenerationConditionSchema = Schema.Struct({
  // バイオーム制限
  allowedBiomes: Schema.Array(Schema.String),
  forbiddenBiomes: Schema.Array(Schema.String).pipe(Schema.optional),

  // 高度制限
  minElevation: Schema.Number.pipe(Schema.optional),
  maxElevation: Schema.Number.pipe(Schema.optional),

  // 地形条件
  requiresFlat: Schema.Boolean.pipe(Schema.optional),
  requiresWater: Schema.Boolean.pipe(Schema.optional),
  requiresLand: Schema.Boolean.pipe(Schema.optional),

  // 近接制限
  minDistanceFromOtherStructures: SpacingValueSchema.pipe(Schema.optional),
  conflictingStructures: Schema.Array(StructureTypeSchema).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'GenerationCondition',
    title: 'Structure Generation Condition',
    description: 'Conditions that must be met for structure generation',
  })
)

export type GenerationCondition = typeof GenerationConditionSchema.Type

/**
 * 個別構造物密度設定
 */
export const StructureDensityConfigSchema = Schema.Struct({
  // 基本設定
  type: StructureTypeSchema,
  enabled: Schema.Boolean,

  // 密度パラメータ
  density: DensityValueSchema,
  probability: ProbabilityValueSchema,
  spacing: SpacingValueSchema,

  // サイズ・複雑性
  size: StructureSizeSchema,
  variants: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 10),
    Schema.annotations({ description: 'Number of structural variants' })
  ),

  // 生成条件
  conditions: GenerationConditionSchema,

  // 群生設定
  clustering: Schema.Struct({
    enabled: Schema.Boolean,
    clusterSize: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    clusterRadius: SpacingValueSchema,
    clusterProbability: ProbabilityValueSchema,
  }).pipe(Schema.optional),

  // パフォーマンス設定
  performance: Schema.Struct({
    maxPerChunk: Schema.Number.pipe(Schema.int(), Schema.between(0, 10)),
    generationPriority: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    cacheEnabled: Schema.Boolean,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'StructureDensityConfig',
    title: 'Individual Structure Density Configuration',
    description: 'Complete density configuration for a specific structure type',
  })
)

export type StructureDensityConfig = typeof StructureDensityConfigSchema.Type

/**
 * 全体構造物密度設定
 */
export const OverallStructureDensitySchema = Schema.Struct({
  // グローバル設定
  globalMultiplier: DensityValueSchema,
  maxStructuresPerChunk: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 20),
    Schema.annotations({ description: 'Maximum total structures per chunk' })
  ),

  // 個別構造物設定
  structures: Schema.Record({
    key: StructureTypeSchema,
    value: StructureDensityConfigSchema,
  }),

  // バイオーム固有の調整
  biomeModifiers: Schema.Record({
    key: Schema.String, // バイオーム名
    value: Schema.Struct({
      densityMultiplier: DensityValueSchema,
      disabledStructures: Schema.Array(StructureTypeSchema),
      bonusStructures: Schema.Array(StructureTypeSchema),
    }),
  }).pipe(Schema.optional),

  // 距離による調整
  distanceScaling: Schema.Struct({
    enabled: Schema.Boolean,
    originX: Schema.Number,
    originZ: Schema.Number,
    scalingFactor: Schema.Number.pipe(Schema.positive()),
    maxDistance: Schema.Number.pipe(Schema.positive()),
  }).pipe(Schema.optional),

  // 世代管理（バージョン互換性）
  version: Schema.String.pipe(
    Schema.pattern(/^\d+\.\d+\.\d+$/),
    Schema.annotations({ description: 'Configuration version for compatibility' })
  ),

  // パフォーマンス制限
  performanceLimits: Schema.Struct({
    maxStructuresPerSecond: Schema.Number.pipe(Schema.positive()),
    maxMemoryUsageMB: Schema.Number.pipe(Schema.positive()),
    enableAsyncGeneration: Schema.Boolean,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OverallStructureDensity',
    title: 'Overall Structure Density Configuration',
    description: 'Complete structure density configuration for world generation',
  })
)

export type OverallStructureDensity = typeof OverallStructureDensitySchema.Type

/**
 * 構造物密度作成パラメータ
 */
export const CreateStructureDensityParamsSchema = Schema.Struct({
  preset: Schema.Literal('sparse', 'normal', 'dense', 'extreme', 'custom').pipe(Schema.optional),
  globalMultiplier: Schema.Number.pipe(Schema.optional),
  enabledStructures: Schema.Array(StructureTypeSchema).pipe(Schema.optional),
  customSettings: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }).pipe(Schema.optional),
})

export type CreateStructureDensityParams = typeof CreateStructureDensityParamsSchema.Type

/**
 * 構造物密度エラー型
 */
export const StructureDensityErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidDensityValue'),
    structure: StructureTypeSchema,
    parameter: Schema.String,
    value: Schema.Unknown,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConflictingStructures'),
    structures: Schema.Array(StructureTypeSchema),
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PerformanceLimitExceeded'),
    limit: Schema.String,
    currentValue: Schema.Number,
    maxValue: Schema.Number,
    message: Schema.String,
  }),
])

export type StructureDensityError = typeof StructureDensityErrorSchema.Type

/**
 * プリセット密度設定
 */
export const DENSITY_PRESETS = {
  SPARSE: {
    globalMultiplier: 0.3,
    description: 'Minimal structure generation for exploration-focused gameplay',
  },
  NORMAL: {
    globalMultiplier: 1.0,
    description: 'Balanced structure generation matching vanilla Minecraft',
  },
  DENSE: {
    globalMultiplier: 2.0,
    description: 'Increased structure density for adventure-focused gameplay',
  },
  EXTREME: {
    globalMultiplier: 4.0,
    description: 'Maximum structure density for creative or testing purposes',
  },
} as const
