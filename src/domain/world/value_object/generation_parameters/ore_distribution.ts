/**
 * OreDistribution Value Object - 鉱石分布設定
 *
 * 地下資源の生成パターンと分布を科学的に管理
 * 現実的な地質学原理とゲームバランスの両立
 */

import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { taggedUnion } from '@domain/world/utils'

/**
 * 濃度値Brand型（0.0から1.0）
 */
export type Concentration = number & BrandType.Brand<'Concentration'>

/**
 * 鉱脈サイズBrand型（1以上）
 */
export type VeinSize = number & BrandType.Brand<'VeinSize'>

/**
 * 希少度Brand型（0.0から1.0、小さいほど希少）
 */
export type Rarity = number & BrandType.Brand<'Rarity'>

/**
 * 深度Brand型（Y座標、-2048から2047）
 */
export type Depth = number & BrandType.Brand<'Depth'>

/**
 * 濃度Schema
 */
export const ConcentrationSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('Concentration'),
  Schema.annotations({
    identifier: 'Concentration',
    title: 'Ore Concentration',
    description: 'Concentration of ore in deposits (0.0 to 1.0)',
    examples: [0.05, 0.2, 0.8, 0.95],
  })
)

/**
 * 鉱脈サイズSchema
 */
export const VeinSizeSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.positive(),
  Schema.between(1, 100),
  Schema.brand('VeinSize'),
  Schema.annotations({
    identifier: 'VeinSize',
    title: 'Ore Vein Size',
    description: 'Size of ore veins in blocks',
    examples: [4, 8, 16, 32],
  })
)

/**
 * 希少度Schema
 */
export const RaritySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 1),
  Schema.brand('Rarity'),
  Schema.annotations({
    identifier: 'Rarity',
    title: 'Ore Rarity',
    description: 'Rarity factor (0.0 = extremely rare, 1.0 = very common)',
    examples: [0.01, 0.1, 0.5, 0.9],
  })
)

/**
 * 深度Schema
 */
export const DepthSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(-2048, 2047),
  Schema.brand('Depth'),
  Schema.annotations({
    identifier: 'Depth',
    title: 'Depth Level',
    description: 'Y-coordinate depth for ore generation',
    examples: [16, 64, -32, -64],
  })
)

/**
 * 鉱石タイプ列挙
 */
export const OreTypeSchema = Schema.Literal(
  // 基本鉱石
  'coal',
  'iron',
  'copper',
  'gold',
  'redstone',
  'lapis',
  'diamond',
  'emerald',

  // ネザー鉱石
  'nether_quartz',
  'nether_gold',
  'ancient_debris',

  // 特殊鉱石
  'amethyst',

  // カスタム鉱石
  'custom_common',
  'custom_uncommon',
  'custom_rare',
  'custom_legendary'
).pipe(
  Schema.annotations({
    title: 'Ore Type',
    description: 'Type of ore to be generated',
  })
)

export type OreType = typeof OreTypeSchema.Type

/**
 * 分布パターン
 */
export const DistributionPatternSchema = Schema.Literal(
  'uniform', // 均等分布
  'clustered', // クラスター分布
  'layered', // 層状分布
  'gradient', // 勾配分布
  'scattered', // 散在分布
  'vein', // 鉱脈分布
  'pocket', // ポケット分布
  'concentrated' // 集中分布
).pipe(
  Schema.annotations({
    title: 'Distribution Pattern',
    description: 'Spatial distribution pattern of ore',
  })
)

export type DistributionPattern = typeof DistributionPatternSchema.Type

/**
 * 地質環境
 */
export const GeologicalEnvironmentSchema = Schema.Literal(
  'igneous', // 火成岩環境
  'sedimentary', // 堆積岩環境
  'metamorphic', // 変成岩環境
  'volcanic', // 火山環境
  'hydrothermal', // 熱水環境
  'surface', // 地表環境
  'deep', // 深部環境
  'cave', // 洞窟環境
  'ocean' // 海底環境
).pipe(
  Schema.annotations({
    title: 'Geological Environment',
    description: 'Geological environment favorable for ore formation',
  })
)

export type GeologicalEnvironment = typeof GeologicalEnvironmentSchema.Type

/**
 * 深度別分布設定
 */
export const DepthDistributionSchema = Schema.Struct({
  minDepth: DepthSchema,
  maxDepth: DepthSchema,
  peakDepth: DepthSchema,
  concentration: ConcentrationSchema,

  // 深度による濃度変化
  depthFalloff: Schema.Struct({
    enabled: Schema.Boolean,
    rate: Schema.Number.pipe(Schema.between(0, 1)),
    pattern: Schema.Literal('linear', 'exponential', 'bell_curve', 'step'),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'DepthDistribution',
    title: 'Depth-based Ore Distribution',
    description: 'Distribution parameters for specific depth ranges',
  })
)

export type DepthDistribution = typeof DepthDistributionSchema.Type

/**
 * 個別鉱石分布設定
 */
export const OreDistributionConfigSchema = Schema.Struct({
  // 基本設定
  type: OreTypeSchema,
  enabled: Schema.Boolean,

  // 物理的性質
  rarity: RaritySchema,
  veinSize: VeinSizeSchema,
  pattern: DistributionPatternSchema,

  // 地質環境
  environment: GeologicalEnvironmentSchema,
  hostRocks: Schema.Array(Schema.String), // 母岩の種類

  // 深度分布
  depthDistribution: Schema.Array(DepthDistributionSchema),

  // 生成条件
  conditions: Schema.Struct({
    // バイオーム制限
    allowedBiomes: Schema.Array(Schema.String),
    forbiddenBiomes: Schema.Array(Schema.String).pipe(Schema.optional),

    // 温度・湿度条件
    temperatureRange: Schema.Struct({
      min: Schema.Number,
      max: Schema.Number,
    }).pipe(Schema.optional),

    // 近接制限
    avoidWater: Schema.Boolean.pipe(Schema.optional),
    avoidAir: Schema.Boolean.pipe(Schema.optional),
    requiresBedrock: Schema.Boolean.pipe(Schema.optional),
  }),

  // 関連性設定
  associations: Schema.Struct({
    // 共生鉱石（一緒に出現しやすい）
    synergistic: Schema.Array(OreTypeSchema).pipe(Schema.optional),

    // 排他鉱石（一緒に出現しにくい）
    antagonistic: Schema.Array(OreTypeSchema).pipe(Schema.optional),

    // 母鉱石（この鉱石の近くに出現）
    parentOres: Schema.Array(OreTypeSchema).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 品質グレード
  qualityGrades: Schema.Array(
    Schema.Struct({
      grade: Schema.String,
      probability: Schema.Number.pipe(Schema.between(0, 1)),
      multiplier: Schema.Number.pipe(Schema.positive()),
      specialProperties: Schema.Array(Schema.String).pipe(Schema.optional),
    })
  ).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OreDistributionConfig',
    title: 'Individual Ore Distribution Configuration',
    description: 'Complete distribution configuration for a specific ore type',
  })
)

export type OreDistributionConfig = typeof OreDistributionConfigSchema.Type

/**
 * 全体鉱石分布設定
 */
export const OverallOreDistributionSchema = Schema.Struct({
  // グローバル設定
  globalMultiplier: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({ description: 'Global ore generation multiplier' })
  ),

  // 個別鉱石設定
  ores: Schema.Record({
    key: OreTypeSchema,
    value: OreDistributionConfigSchema,
  }),

  // 地質層設定
  geologicalLayers: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      minDepth: DepthSchema,
      maxDepth: DepthSchema,
      rockType: Schema.String,
      hardness: Schema.Number.pipe(Schema.between(0, 10)),
      favoredOres: Schema.Array(OreTypeSchema),
      oreMultiplier: Schema.Number.pipe(Schema.positive()),
    })
  ),

  // 特殊地形での調整
  terrainModifiers: Schema.Struct({
    mountains: Schema.Number.pipe(Schema.positive()),
    valleys: Schema.Number.pipe(Schema.positive()),
    underground: Schema.Number.pipe(Schema.positive()),
    nearWater: Schema.Number.pipe(Schema.positive()),
    nearLava: Schema.Number.pipe(Schema.positive()),
  }).pipe(Schema.optional),

  // 季節・時間変動
  temporalVariation: Schema.Struct({
    enabled: Schema.Boolean,
    seasonalEffect: Schema.Number.pipe(Schema.between(0, 1)),
    lunarEffect: Schema.Number.pipe(Schema.between(0, 1)),
    weatherEffect: Schema.Number.pipe(Schema.between(0, 1)),
  }).pipe(Schema.optional),

  // パフォーマンス制限
  performanceSettings: Schema.Struct({
    maxOresPerChunk: Schema.Number.pipe(Schema.int(), Schema.positive()),
    generationTimeout: Schema.Number.pipe(Schema.positive()),
    cacheSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OverallOreDistribution',
    title: 'Overall Ore Distribution Configuration',
    description: 'Complete ore distribution configuration for world generation',
  })
)

export type OverallOreDistribution = typeof OverallOreDistributionSchema.Type

/**
 * 鉱石分布作成パラメータ
 */
export const CreateOreDistributionParamsSchema = Schema.Struct({
  preset: Schema.Literal('realistic', 'balanced', 'abundant', 'scarce', 'custom').pipe(Schema.optional),
  globalMultiplier: Schema.Number.pipe(Schema.optional),
  enabledOres: Schema.Array(OreTypeSchema).pipe(Schema.optional),
  customDepthRanges: Schema.Record({
    key: OreTypeSchema,
    value: Schema.Struct({
      min: Schema.Number,
      max: Schema.Number,
    }),
  }).pipe(Schema.optional),
})

export type CreateOreDistributionParams = typeof CreateOreDistributionParamsSchema.Type

/**
 * 鉱石分布エラー型
 */
export const OreDistributionErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidDepthRange'),
    ore: OreTypeSchema,
    minDepth: Schema.Number,
    maxDepth: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConflictingAssociations'),
    ore: OreTypeSchema,
    conflicts: Schema.Array(OreTypeSchema),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('GeologicalInconsistency'),
    ore: OreTypeSchema,
    environment: GeologicalEnvironmentSchema,
    reason: Schema.String,
    message: Schema.String,
  }),
])

export type OreDistributionError = typeof OreDistributionErrorSchema.Type

/**
 * 標準的な鉱石分布プリセット
 */
export const ORE_DISTRIBUTION_PRESETS = {
  REALISTIC: {
    description: 'Realistic geological distribution based on real-world patterns',
    globalMultiplier: 0.8,
  },
  BALANCED: {
    description: 'Balanced distribution for normal gameplay',
    globalMultiplier: 1.0,
  },
  ABUNDANT: {
    description: 'Increased ore availability for creative gameplay',
    globalMultiplier: 2.0,
  },
  SCARCE: {
    description: 'Reduced ore availability for survival challenge',
    globalMultiplier: 0.4,
  },
} as const
