/**
 * VegetationDensity Value Object - 植生密度設定
 *
 * 生態学的に正確な植生分布と密度のモデリング
 * キャリング・キャパシティと競争原理に基づく実装
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'

/**
 * 植生密度Brand型（0.0から1.0）
 */
export type VegetationDensity = number & BrandType.Brand<'VegetationDensity'>

/**
 * バイオマスBrand型（kg/m²、0から100）
 */
export type Biomass = number & BrandType.Brand<'Biomass'>

/**
 * 被覆率Brand型（0.0から1.0）
 */
export type CoverageRatio = number & BrandType.Brand<'CoverageRatio'>

/**
 * 種多様性指数Brand型（0.0から5.0）
 */
export type SpeciesDiversityIndex = number & BrandType.Brand<'SpeciesDiversityIndex'>

/**
 * 植生密度Schema
 */
export const VegetationDensitySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('VegetationDensity'),
  Schema.annotations({
    identifier: 'VegetationDensity',
    title: 'Vegetation Density',
    description: 'Relative vegetation density from sparse (0.0) to dense (1.0)',
    examples: [0.1, 0.3, 0.6, 0.8, 1.0],
  })
)

/**
 * バイオマスSchema
 */
export const BiomassSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 100.0),
  Schema.brand('Biomass'),
  Schema.annotations({
    identifier: 'Biomass',
    title: 'Biomass Density',
    description: 'Biomass density in kilograms per square meter (0 to 100 kg/m²)',
    examples: [0.5, 2.0, 5.0, 15.0, 50.0],
  })
)

/**
 * 被覆率Schema
 */
export const CoverageRatioSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('CoverageRatio'),
  Schema.annotations({
    identifier: 'CoverageRatio',
    title: 'Vegetation Coverage Ratio',
    description: 'Fraction of ground covered by vegetation (0.0 to 1.0)',
    examples: [0.05, 0.25, 0.5, 0.75, 0.95],
  })
)

/**
 * 種多様性指数Schema
 */
export const SpeciesDiversityIndexSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 5.0),
  Schema.brand('SpeciesDiversityIndex'),
  Schema.annotations({
    identifier: 'SpeciesDiversityIndex',
    title: 'Species Diversity Index',
    description: 'Shannon-Wiener diversity index (0.0 to 5.0)',
    examples: [0.5, 1.2, 2.0, 3.1, 4.2],
  })
)

/**
 * makeUnsafe ヘルパー関数
 * パフォーマンスクリティカルな地形生成コードで使用
 */
export const makeUnsafeVegetationDensity = (value: number): VegetationDensity =>
  unsafeCoerce<number, VegetationDensity>(value)

export const makeUnsafeBiomass = (value: number): Biomass => unsafeCoerce<number, Biomass>(value)

export const makeUnsafeCoverageRatio = (value: number): CoverageRatio => unsafeCoerce<number, CoverageRatio>(value)

export const makeUnsafeSpeciesDiversityIndex = (value: number): SpeciesDiversityIndex =>
  unsafeCoerce<number, SpeciesDiversityIndex>(value)

/**
 * 植生タイプ
 */
export const VegetationTypeSchema = Schema.Literal(
  'trees', // 高木
  'shrubs', // 低木
  'grasses', // 草本
  'herbs', // ハーブ類
  'ferns', // シダ類
  'mosses', // コケ類
  'lichens', // 地衣類
  'fungi', // 菌類
  'aquatic_plants', // 水生植物
  'epiphytes', // 着生植物
  'parasitic_plants', // 寄生植物
  'carnivorous_plants' // 食虫植物
).pipe(
  Schema.annotations({
    title: 'Vegetation Type',
    description: 'Functional type of vegetation',
  })
)

export type VegetationType = typeof VegetationTypeSchema.Type

/**
 * 成長段階
 */
export const GrowthStageSchema = Schema.Literal(
  'seedling', // 実生
  'juvenile', // 幼体
  'mature', // 成体
  'reproductive', // 繁殖期
  'senescent', // 老齢
  'dead' // 枯死
).pipe(
  Schema.annotations({
    title: 'Growth Stage',
    description: 'Life cycle stage of vegetation',
  })
)

export type GrowthStage = typeof GrowthStageSchema.Type

/**
 * 分布パターン
 */
export const DistributionPatternSchema = Schema.Literal(
  'random', // ランダム分布
  'uniform', // 均等分布
  'clustered', // クラスター分布
  'linear', // 線形分布
  'patchy', // パッチ状分布
  'gradient', // 勾配分布
  'mosaic' // モザイク分布
).pipe(
  Schema.annotations({
    title: 'Distribution Pattern',
    description: 'Spatial distribution pattern of vegetation',
  })
)

export type DistributionPattern = typeof DistributionPatternSchema.Type

/**
 * 個別植生層設定
 */
export const VegetationLayerSchema = Schema.Struct({
  // レイヤー識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for vegetation layer' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for layer' })
  ),
  type: VegetationTypeSchema,

  // 物理特性
  height: Schema.Struct({
    minimum: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100),
      Schema.annotations({ description: 'Minimum height in meters' })
    ),
    maximum: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100),
      Schema.annotations({ description: 'Maximum height in meters' })
    ),
    average: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100),
      Schema.annotations({ description: 'Average height in meters' })
    ),
  }),

  // 密度特性
  density: VegetationDensitySchema,
  coverage: CoverageRatioSchema,
  biomass: BiomassSchema,

  // 分布特性
  distribution: Schema.Struct({
    pattern: DistributionPatternSchema,
    clusterSize: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(1, 1000),
      Schema.annotations({ description: 'Average cluster size in square meters' })
    ).pipe(Schema.optional),
    spacing: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.1, 100),
      Schema.annotations({ description: 'Average spacing between individuals in meters' })
    ).pipe(Schema.optional),
  }),

  // 年齢構造
  ageStructure: Schema.Struct({
    seedlings: Schema.Number.pipe(Schema.between(0, 1)),
    juveniles: Schema.Number.pipe(Schema.between(0, 1)),
    mature: Schema.Number.pipe(Schema.between(0, 1)),
    reproductive: Schema.Number.pipe(Schema.between(0, 1)),
    senescent: Schema.Number.pipe(Schema.between(0, 1)),
  }).pipe(Schema.optional),

  // 季節変動
  seasonalVariation: Schema.Struct({
    phenology: Schema.Struct({
      leafOut: Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 365),
        Schema.annotations({ description: 'Day of year for leaf emergence' })
      ).pipe(Schema.optional),
      flowering: Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 365),
        Schema.annotations({ description: 'Day of year for flowering' })
      ).pipe(Schema.optional),
      fruiting: Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 365),
        Schema.annotations({ description: 'Day of year for fruiting' })
      ).pipe(Schema.optional),
      senescence: Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 365),
        Schema.annotations({ description: 'Day of year for senescence' })
      ).pipe(Schema.optional),
    }),

    // 季節バイオマス変動
    biomassCycle: Schema.Array(
      Schema.Struct({
        month: Schema.Number.pipe(Schema.int(), Schema.between(1, 12)),
        biomassRatio: Schema.Number.pipe(Schema.between(0, 2)),
      })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'VegetationLayer',
    title: 'Individual Vegetation Layer',
    description: 'Configuration for a single vegetation layer or stratum',
  })
)

export type VegetationLayer = typeof VegetationLayerSchema.Type

/**
 * 競争・相互作用関係
 */
export const VegetationInteractionSchema = Schema.Struct({
  // 競争関係
  competition: Schema.Struct({
    // 光競争
    lightCompetition: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Light competition intensity (0-1)' })
    ),

    // 水競争
    waterCompetition: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Water competition intensity (0-1)' })
    ),

    // 栄養競争
    nutrientCompetition: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Nutrient competition intensity (0-1)' })
    ),

    // 空間競争
    spaceCompetition: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Space competition intensity (0-1)' })
    ),
  }),

  // 協力関係
  facilitation: Schema.Struct({
    // 日陰提供
    shadeProvision: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Shade provision benefit (0-1)' })
    ),

    // 栄養供給
    nutrientSupply: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Nutrient supply benefit (0-1)' })
    ),

    // 微気候改善
    microclimateImprovement: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Microclimate improvement benefit (0-1)' })
    ),
  }).pipe(Schema.optional),

  // アレロパシー（化学的阻害）
  allelopathy: Schema.Struct({
    inhibitionStrength: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Allelopathic inhibition strength (0-1)' })
    ),
    affectedSpecies: Schema.Array(Schema.String),
    chemicalType: Schema.Literal('phenolic', 'terpene', 'alkaloid', 'organic_acid', 'other'),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'VegetationInteraction',
    title: 'Vegetation Interaction Relationships',
    description: 'Competition, facilitation, and allelopathy between vegetation types',
  })
)

export type VegetationInteraction = typeof VegetationInteractionSchema.Type

/**
 * 環境応答特性
 */
export const EnvironmentalResponseSchema = Schema.Struct({
  // 温度応答
  temperatureResponse: Schema.Struct({
    optimalRange: Schema.Struct({
      minimum: Schema.Number.pipe(Schema.between(-50, 60)),
      maximum: Schema.Number.pipe(Schema.between(-50, 60)),
    }),
    toleranceRange: Schema.Struct({
      minimum: Schema.Number.pipe(Schema.between(-60, 50)),
      maximum: Schema.Number.pipe(Schema.between(-40, 70)),
    }),
    growthCurve: Schema.Literal('linear', 'exponential', 'logarithmic', 'sigmoid', 'bell_curve'),
  }),

  // 水分応答
  moistureResponse: Schema.Struct({
    optimalMoisture: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Optimal soil moisture (0-1)' })
    ),
    droughtTolerance: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Drought tolerance level (0-1)' })
    ),
    floodTolerance: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Flood tolerance level (0-1)' })
    ),
    waterUseEfficiency: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.1, 50),
      Schema.annotations({ description: 'Water use efficiency (g biomass/kg water)' })
    ),
  }),

  // 光応答
  lightResponse: Schema.Struct({
    lightRequirement: Schema.Literal('shade_intolerant', 'shade_tolerant', 'intermediate'),
    lightSaturationPoint: Schema.Number.pipe(
      Schema.between(100, 2000),
      Schema.annotations({ description: 'Light saturation point (μmol/m²/s)' })
    ),
    lightCompensationPoint: Schema.Number.pipe(
      Schema.between(1, 100),
      Schema.annotations({ description: 'Light compensation point (μmol/m²/s)' })
    ),
  }),

  // 土壌応答
  soilResponse: Schema.Struct({
    pHOptimal: Schema.Number.pipe(Schema.between(3, 10), Schema.annotations({ description: 'Optimal soil pH' })),
    pHTolerance: Schema.Struct({
      minimum: Schema.Number.pipe(Schema.between(2, 9)),
      maximum: Schema.Number.pipe(Schema.between(4, 11)),
    }),
    nutrientRequirement: Schema.Literal('low', 'moderate', 'high', 'very_high'),
    saltTolerance: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Salt tolerance level (0-1)' })
    ).pipe(Schema.optional),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'EnvironmentalResponse',
    title: 'Environmental Response Characteristics',
    description: 'How vegetation responds to environmental conditions',
  })
)

export type EnvironmentalResponse = typeof EnvironmentalResponseSchema.Type

/**
 * 完全植生密度設定
 */
export const VegetationDensityConfigSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for vegetation configuration' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for vegetation density' })
  ),
  description: Schema.String.pipe(
    Schema.maxLength(500),
    Schema.annotations({ description: 'Detailed description of vegetation characteristics' })
  ).pipe(Schema.optional),

  // 全体統計
  overall: Schema.Struct({
    totalDensity: VegetationDensitySchema,
    totalBiomass: BiomassSchema,
    totalCoverage: CoverageRatioSchema,
    speciesDiversity: SpeciesDiversityIndexSchema,
    evenness: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Species evenness index (0-1)' })
    ).pipe(Schema.optional),
  }),

  // 植生層構造
  layers: Schema.Array(VegetationLayerSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(10),
    Schema.annotations({ description: 'Vertical layers of vegetation' })
  ),

  // 層間相互作用
  interactions: Schema.Array(
    Schema.Struct({
      layer1Id: Schema.String,
      layer2Id: Schema.String,
      interaction: VegetationInteractionSchema,
    })
  ).pipe(Schema.optional),

  // 環境応答
  environmentalResponse: EnvironmentalResponseSchema,

  // キャリング・キャパシティ
  carryingCapacity: Schema.Struct({
    maxBiomass: BiomassSchema,
    maxDensity: VegetationDensitySchema,
    limitingFactors: Schema.Array(
      Schema.Literal('light', 'water', 'nutrients', 'space', 'temperature', 'herbivory', 'disease')
    ),
    growthRate: Schema.Number.pipe(
      Schema.between(-1, 5),
      Schema.annotations({ description: 'Intrinsic growth rate per year' })
    ),
    carryingCapacityModel: Schema.Literal('logistic', 'exponential', 'gompertz', 'custom'),
  }),

  // 動態・遷移
  succession: Schema.Struct({
    successionStage: Schema.Literal('pioneer', 'early', 'mid', 'late', 'climax'),
    timeToNext: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(1, 1000),
      Schema.annotations({ description: 'Years to next succession stage' })
    ).pipe(Schema.optional),
    disturbanceResponse: Schema.Struct({
      fire: Schema.Literal('killed', 'resprouter', 'seeder', 'resistant'),
      drought: Schema.Literal('sensitive', 'tolerant', 'dormant'),
      flooding: Schema.Literal('sensitive', 'tolerant', 'aquatic'),
      herbivory: Schema.Literal('avoided', 'tolerated', 'preferred'),
    }).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 繁殖・散布
  reproduction: Schema.Struct({
    reproductiveStrategy: Schema.Literal('sexual', 'vegetative', 'both'),
    seedProduction: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100000),
      Schema.annotations({ description: 'Seeds produced per individual per year' })
    ).pipe(Schema.optional),
    dispersalMechanism: Schema.Literal('wind', 'water', 'animal', 'gravity', 'explosive'),
    dispersalDistance: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.1, 10000),
      Schema.annotations({ description: 'Average dispersal distance in meters' })
    ).pipe(Schema.optional),
    germinationRate: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Seed germination rate (0-1)' })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 撹乱履歴
  disturbanceHistory: Schema.Array(
    Schema.Struct({
      type: Schema.Literal('fire', 'flood', 'drought', 'storm', 'disease', 'herbivory', 'human'),
      severity: Schema.Literal('low', 'moderate', 'high', 'severe'),
      frequency: Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Average return interval in years' })
      ),
      lastOccurrence: Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.annotations({ description: 'Years since last occurrence' })
      ).pipe(Schema.optional),
    })
  ).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'VegetationDensityConfig',
    title: 'Complete Vegetation Density Configuration',
    description: 'Comprehensive vegetation density with ecological modeling',
  })
)

export type VegetationDensityConfig = typeof VegetationDensityConfigSchema.Type

/**
 * 植生密度作成パラメータ
 */
export const CreateVegetationDensityParamsSchema = Schema.Struct({
  biomeType: Schema.Literal('forest', 'grassland', 'desert', 'wetland', 'tundra', 'savanna', 'shrubland').pipe(
    Schema.optional
  ),
  climateConditions: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.between(-50, 50)),
    precipitation: Schema.Number.pipe(Schema.between(0, 5000)),
    humidity: Schema.Number.pipe(Schema.between(0, 100)),
  }).pipe(Schema.optional),
  soilConditions: Schema.Struct({
    fertility: Schema.Literal('poor', 'moderate', 'rich'),
    drainage: Schema.Literal('poor', 'moderate', 'good'),
    pH: Schema.Number.pipe(Schema.between(3, 10)),
  }).pipe(Schema.optional),
  disturbanceRegime: Schema.Literal('none', 'low', 'moderate', 'high').pipe(Schema.optional),
  managementIntensity: Schema.Literal('none', 'extensive', 'intensive').pipe(Schema.optional),
})

export type CreateVegetationDensityParams = typeof CreateVegetationDensityParamsSchema.Type

/**
 * 植生密度エラー型
 */
export const VegetationDensityErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('EcologicalInconsistency'),
    parameter1: Schema.String,
    parameter2: Schema.String,
    conflict: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CarryingCapacityExceeded'),
    requestedDensity: Schema.Number,
    maxCapacity: Schema.Number,
    limitingFactor: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SpeciesInteractionConflict'),
    species1: Schema.String,
    species2: Schema.String,
    interactionType: Schema.String,
    conflict: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('EnvironmentalLimitExceeded'),
    environmentalFactor: Schema.String,
    currentValue: Schema.Number,
    toleranceLimit: Schema.Number,
    message: Schema.String,
  }),
])

export type VegetationDensityError = typeof VegetationDensityErrorSchema.Type

/**
 * 標準植生密度プリセット
 */
export const VEGETATION_DENSITY_PRESETS = {
  SPARSE_DESERT: {
    description: 'Sparse desert vegetation',
    density: 0.05,
    biomass: 0.1,
    coverage: 0.02,
    diversity: 0.8,
  },
  GRASSLAND: {
    description: 'Temperate grassland',
    density: 0.6,
    biomass: 2.5,
    coverage: 0.85,
    diversity: 2.1,
  },
  SAVANNA: {
    description: 'Tropical savanna',
    density: 0.4,
    biomass: 5.0,
    coverage: 0.6,
    diversity: 2.8,
  },
  TEMPERATE_FOREST: {
    description: 'Temperate deciduous forest',
    density: 0.8,
    biomass: 25.0,
    coverage: 0.95,
    diversity: 3.2,
  },
  TROPICAL_RAINFOREST: {
    description: 'Tropical rainforest',
    density: 1.0,
    biomass: 45.0,
    coverage: 0.98,
    diversity: 4.5,
  },
  BOREAL_FOREST: {
    description: 'Boreal/taiga forest',
    density: 0.7,
    biomass: 15.0,
    coverage: 0.9,
    diversity: 1.8,
  },
  ALPINE_TUNDRA: {
    description: 'Alpine tundra',
    density: 0.3,
    biomass: 1.0,
    coverage: 0.4,
    diversity: 2.0,
  },
  WETLAND: {
    description: 'Freshwater wetland',
    density: 0.9,
    biomass: 8.0,
    coverage: 0.85,
    diversity: 2.5,
  },
} as const

/**
 * バイオーム植生マッピング
 */
export const BIOME_VEGETATION_MAPPING = {
  DESERT: { density: 0.05, biomass: 0.1, layers: ['sparse_shrubs', 'cacti'] },
  SAVANNA: { density: 0.4, biomass: 5.0, layers: ['grasses', 'scattered_trees'] },
  PLAINS: { density: 0.6, biomass: 2.5, layers: ['grasses', 'herbs'] },
  FOREST: { density: 0.8, biomass: 25.0, layers: ['trees', 'understory', 'ground_cover'] },
  TAIGA: { density: 0.7, biomass: 15.0, layers: ['conifers', 'understory', 'mosses'] },
  JUNGLE: { density: 1.0, biomass: 45.0, layers: ['canopy', 'understory', 'shrubs', 'ground_cover'] },
  SWAMP: { density: 0.9, biomass: 8.0, layers: ['trees', 'aquatic_plants', 'mosses'] },
  TUNDRA: { density: 0.3, biomass: 1.0, layers: ['low_shrubs', 'grasses', 'mosses', 'lichens'] },
  MOUNTAINS: { density: 0.5, biomass: 8.0, layers: ['alpine_plants', 'shrubs'] },
  ICE_SPIKES: { density: 0.01, biomass: 0.01, layers: ['lichens'] },
} as const
