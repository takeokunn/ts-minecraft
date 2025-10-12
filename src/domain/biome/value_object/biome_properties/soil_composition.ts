/**
 * SoilComposition Value Object - 土壌組成設定
 *
 * 土壌物理学・化学的特性の正確なモデリング
 * 粒径分布・化学組成・生物活性の統合的表現
 */

import { taggedUnion } from '@domain/shared/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'

/**
 * 粒径比率Brand型（0.0から1.0）
 */
export type ParticleRatio = number & BrandType.Brand<'ParticleRatio'>

/**
 * pH値Brand型（0.0から14.0）
 */
export type SoilPH = number & BrandType.Brand<'SoilPH'>

/**
 * 有機物含有率Brand型（0.0から1.0）
 */
export type OrganicMatterContent = number & BrandType.Brand<'OrganicMatterContent'>

/**
 * 電気伝導度Brand型（dS/m、0.0から20.0）
 */
export type ElectricConductivity = number & BrandType.Brand<'ElectricConductivity'>

/**
 * 粒径比率Schema
 */
export const ParticleRatioSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('ParticleRatio'),
  Schema.annotations({
    identifier: 'ParticleRatio',
    title: 'Soil Particle Size Ratio',
    description: 'Ratio of specific particle size in soil composition (0.0 to 1.0)',
    examples: [0.1, 0.3, 0.5, 0.7, 0.9],
  })
)

/**
 * pH値Schema
 */
export const SoilPHSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 14.0),
  Schema.brand('SoilPH'),
  Schema.annotations({
    identifier: 'SoilPH',
    title: 'Soil pH Value',
    description: 'Soil acidity/alkalinity on pH scale (0.0 to 14.0)',
    examples: [4.5, 6.0, 7.0, 8.5, 9.0],
  })
)

/**
 * 有機物含有率Schema
 */
export const OrganicMatterContentSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0.0, 1.0),
  Schema.brand('OrganicMatterContent'),
  Schema.annotations({
    identifier: 'OrganicMatterContent',
    title: 'Organic Matter Content',
    description: 'Fraction of soil mass as organic matter (0.0 to 1.0)',
    examples: [0.01, 0.03, 0.05, 0.1, 0.3],
  })
)

/**
 * 電気伝導度Schema
 */
export const ElectricConductivitySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.between(0.0, 20.0),
  Schema.brand('ElectricConductivity'),
  Schema.annotations({
    identifier: 'ElectricConductivity',
    title: 'Electric Conductivity',
    description: 'Soil electric conductivity in dS/m (0.0 to 20.0)',
    examples: [0.1, 0.5, 2.0, 4.0, 8.0],
  })
)

/**
 * makeUnsafe ヘルパー関数
 * パフォーマンスクリティカルな地形生成コードで使用
 */
export const makeUnsafeParticleRatio = (value: number): ParticleRatio => unsafeCoerce<number, ParticleRatio>(value)

export const makeUnsafeSoilPH = (value: number): SoilPH => unsafeCoerce<number, SoilPH>(value)

export const makeUnsafeOrganicMatterContent = (value: number): OrganicMatterContent =>
  unsafeCoerce<number, OrganicMatterContent>(value)

export const makeUnsafeElectricConductivity = (value: number): ElectricConductivity =>
  unsafeCoerce<number, ElectricConductivity>(value)

/**
 * 土壌テクスチャ分類
 */
export const SoilTextureSchema = Schema.Literal(
  'sand', // 砂土
  'loamy_sand', // 壌質砂土
  'sandy_loam', // 砂質壌土
  'loam', // 壌土
  'silt_loam', // シルト質壌土
  'silt', // シルト土
  'clay_loam', // 粘土質壌土
  'silty_clay_loam', // シルト質粘土質壌土
  'sandy_clay_loam', // 砂質粘土質壌土
  'silty_clay', // シルト質粘土土
  'sandy_clay', // 砂質粘土土
  'clay' // 粘土土
).pipe(
  Schema.annotations({
    title: 'Soil Texture Classification',
    description: 'USDA soil texture classification based on particle size distribution',
  })
)

export type SoilTexture = typeof SoilTextureSchema.Type

/**
 * 土壌排水性
 */
export const SoilDrainageSchema = Schema.Literal(
  'excessively_drained', // 過度排水
  'well_drained', // 良排水
  'moderately_drained', // 中排水
  'somewhat_poorly_drained', // やや不良排水
  'poorly_drained', // 不良排水
  'very_poorly_drained' // 極不良排水
).pipe(
  Schema.annotations({
    title: 'Soil Drainage Class',
    description: 'Soil drainage classification based on water movement',
  })
)

export type SoilDrainage = typeof SoilDrainageSchema.Type

/**
 * 土壌構造
 */
export const SoilStructureSchema = Schema.Literal(
  'granular', // 団粒状
  'blocky', // ブロック状
  'prismatic', // 柱状
  'platy', // 板状
  'massive', // 塊状
  'single_grain' // 単粒状
).pipe(
  Schema.annotations({
    title: 'Soil Structure Type',
    description: 'Type of soil aggregate structure',
  })
)

export type SoilStructure = typeof SoilStructureSchema.Type

/**
 * 粒径分布
 */
export const ParticleSizeDistributionSchema = Schema.Struct({
  // 粗砂（2.0-0.2mm）
  coarseSand: ParticleRatioSchema,

  // 中砂（0.2-0.02mm）
  mediumSand: ParticleRatioSchema,

  // 細砂（0.02-0.002mm）
  fineSand: ParticleRatioSchema,

  // シルト（0.002-0.0002mm）
  silt: ParticleRatioSchema,

  // 粘土（<0.0002mm）
  clay: ParticleRatioSchema,

  // 検証用合計（1.0である必要）
  total: Schema.Number.pipe(
    Schema.between(0.99, 1.01),
    Schema.annotations({ description: 'Sum of all fractions (should be ~1.0)' })
  ),

  // 有効粒径
  effectiveDiameter: Schema.Struct({
    d10: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.001, 10),
      Schema.annotations({ description: 'Effective diameter D10 in mm' })
    ),
    d50: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.001, 10),
      Schema.annotations({ description: 'Median diameter D50 in mm' })
    ),
    d60: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.001, 10),
      Schema.annotations({ description: 'Effective diameter D60 in mm' })
    ),
  }).pipe(Schema.optional),

  // 均等係数・曲率係数
  gradation: Schema.Struct({
    uniformityCoefficient: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(1, 1000),
      Schema.annotations({ description: 'Uniformity coefficient (Cu = D60/D10)' })
    ),
    curvatureCoefficient: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.1, 10),
      Schema.annotations({ description: 'Curvature coefficient (Cc = D30²/(D10×D60))' })
    ),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'ParticleSizeDistribution',
    title: 'Soil Particle Size Distribution',
    description: 'Complete particle size analysis with gradation parameters',
  })
)

export type ParticleSizeDistribution = typeof ParticleSizeDistributionSchema.Type

/**
 * 化学組成
 */
export const SoilChemistrySchema = Schema.Struct({
  // 基本化学特性
  pH: SoilPHSchema,
  electricConductivity: ElectricConductivitySchema,

  // 陽イオン交換容量（cmol/kg）
  cationExchangeCapacity: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 100),
    Schema.annotations({ description: 'Cation exchange capacity in cmol/kg' })
  ),

  // 塩基飽和度（%）
  baseSaturation: Schema.Number.pipe(
    Schema.between(0, 100),
    Schema.annotations({ description: 'Base saturation percentage' })
  ),

  // 主要栄養素（mg/kg）
  macronutrients: Schema.Struct({
    nitrogen: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 10000),
      Schema.annotations({ description: 'Total nitrogen content in mg/kg' })
    ),
    phosphorus: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 1000),
      Schema.annotations({ description: 'Available phosphorus in mg/kg' })
    ),
    potassium: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 2000),
      Schema.annotations({ description: 'Exchangeable potassium in mg/kg' })
    ),
    sulfur: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 500),
      Schema.annotations({ description: 'Available sulfur in mg/kg' })
    ).pipe(Schema.optional),
  }),

  // 二次栄養素（mg/kg）
  secondaryNutrients: Schema.Struct({
    calcium: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 50000),
      Schema.annotations({ description: 'Exchangeable calcium in mg/kg' })
    ),
    magnesium: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 10000),
      Schema.annotations({ description: 'Exchangeable magnesium in mg/kg' })
    ),
  }).pipe(Schema.optional),

  // 微量要素（mg/kg）
  micronutrients: Schema.Struct({
    iron: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 1000)).pipe(Schema.optional),
    manganese: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 500)).pipe(Schema.optional),
    zinc: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 100)).pipe(Schema.optional),
    copper: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 50)).pipe(Schema.optional),
    boron: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 20)).pipe(Schema.optional),
    molybdenum: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 5)).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 有害元素（mg/kg）
  toxicElements: Schema.Struct({
    aluminum: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 10000)).pipe(Schema.optional),
    sodium: Schema.Number.pipe(Schema.nonNegative(), Schema.between(0, 5000)).pipe(Schema.optional),
    heavyMetals: Schema.Struct({
      lead: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
      cadmium: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
      mercury: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
      chromium: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
    }).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'SoilChemistry',
    title: 'Soil Chemical Composition',
    description: 'Complete soil chemical analysis including nutrients and toxic elements',
  })
)

export type SoilChemistry = typeof SoilChemistrySchema.Type

/**
 * 有機物組成
 */
export const OrganicMatterCompositionSchema = Schema.Struct({
  // 全有機物含有率
  totalOrganicMatter: OrganicMatterContentSchema,

  // 有機炭素含有率
  organicCarbon: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.between(0, 50),
    Schema.annotations({ description: 'Organic carbon content as percentage' })
  ),

  // C/N比
  carbonNitrogenRatio: Schema.Number.pipe(
    Schema.positive(),
    Schema.between(1, 100),
    Schema.annotations({ description: 'Carbon to nitrogen ratio' })
  ),

  // 腐植組成
  humicSubstances: Schema.Struct({
    humicAcids: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Humic acids fraction (0-1)' })
    ),
    fulvicAcids: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Fulvic acids fraction (0-1)' })
    ),
    humin: Schema.Number.pipe(Schema.between(0, 1), Schema.annotations({ description: 'Humin fraction (0-1)' })),
  }).pipe(Schema.optional),

  // 分解度
  decompositionStage: Schema.Literal(
    'fresh', // 新鮮
    'partially', // 部分分解
    'well_decomposed', // 良分解
    'humified' // 腐植化
  ),

  // 生物活性
  biologicalActivity: Schema.Struct({
    microbialBiomass: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 5000),
      Schema.annotations({ description: 'Microbial biomass carbon in mg/kg' })
    ),
    enzymeActivity: Schema.Struct({
      dehydrogenase: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
      phosphatase: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
      urease: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional),
    }).pipe(Schema.optional),
    respiration: Schema.Number.pipe(
      Schema.nonNegative(),
      Schema.between(0, 100),
      Schema.annotations({ description: 'Soil respiration rate in mg CO2/kg/day' })
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OrganicMatterComposition',
    title: 'Soil Organic Matter Composition',
    description: 'Detailed analysis of soil organic matter and biological activity',
  })
)

export type OrganicMatterComposition = typeof OrganicMatterCompositionSchema.Type

/**
 * 物理特性
 */
export const SoilPhysicalPropertiesSchema = Schema.Struct({
  // テクスチャ分類
  texture: SoilTextureSchema,

  // 構造
  structure: Schema.Struct({
    type: SoilStructureSchema,
    grade: Schema.Literal('weak', 'moderate', 'strong'),
    size: Schema.Literal('very_fine', 'fine', 'medium', 'coarse', 'very_coarse'),
  }),

  // 密度（g/cm³）
  density: Schema.Struct({
    bulk: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.5, 2.5),
      Schema.annotations({ description: 'Bulk density in g/cm³' })
    ),
    particle: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(2.0, 3.0),
      Schema.annotations({ description: 'Particle density in g/cm³' })
    ),
  }),

  // 間隙率
  porosity: Schema.Struct({
    total: Schema.Number.pipe(Schema.between(0, 1), Schema.annotations({ description: 'Total porosity (0-1)' })),
    macroporosity: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Macroporosity >0.05mm (0-1)' })
    ),
    microporosity: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Microporosity <0.05mm (0-1)' })
    ),
  }),

  // 水分特性
  waterCharacteristics: Schema.Struct({
    fieldCapacity: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Field capacity (volumetric water content)' })
    ),
    wiltingPoint: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Permanent wilting point' })
    ),
    availableWater: Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: 'Available water capacity' })
    ),
    saturatedConductivity: Schema.Number.pipe(
      Schema.positive(),
      Schema.between(0.01, 1000),
      Schema.annotations({ description: 'Saturated hydraulic conductivity in mm/hr' })
    ),
  }),

  // 排水性
  drainage: SoilDrainageSchema,

  // 浸透性
  permeability: Schema.Literal(
    'very_slow', // 非常に遅い (<0.15 mm/hr)
    'slow', // 遅い (0.15-0.5 mm/hr)
    'moderately_slow', // やや遅い (0.5-1.5 mm/hr)
    'moderate', // 中程度 (1.5-5.0 mm/hr)
    'moderately_rapid', // やや速い (5.0-15 mm/hr)
    'rapid', // 速い (15-50 mm/hr)
    'very_rapid' // 非常に速い (>50 mm/hr)
  ),
}).pipe(
  Schema.annotations({
    identifier: 'SoilPhysicalProperties',
    title: 'Soil Physical Properties',
    description: 'Physical characteristics including texture, structure, and water relations',
  })
)

export type SoilPhysicalProperties = typeof SoilPhysicalPropertiesSchema.Type

/**
 * 完全土壌組成設定
 */
export const SoilCompositionSchema = Schema.Struct({
  // 基本識別
  id: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({ description: 'Unique identifier for soil composition' })
  ),
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({ description: 'Human-readable name for soil type' })
  ),
  description: Schema.String.pipe(
    Schema.maxLength(500),
    Schema.annotations({ description: 'Detailed description of soil characteristics' })
  ).pipe(Schema.optional),

  // 土壌分類
  classification: Schema.Struct({
    // USDA土壌分類
    usda: Schema.Struct({
      order: Schema.String.pipe(Schema.optional),
      suborder: Schema.String.pipe(Schema.optional),
      greatGroup: Schema.String.pipe(Schema.optional),
      subgroup: Schema.String.pipe(Schema.optional),
    }).pipe(Schema.optional),

    // WRB土壌分類
    wrb: Schema.Struct({
      referenceGroup: Schema.String.pipe(Schema.optional),
      qualifiers: Schema.Array(Schema.String).pipe(Schema.optional),
    }).pipe(Schema.optional),

    // 簡易分類
    simplified: Schema.Literal('sandy', 'loamy', 'clayey', 'organic', 'calcareous', 'saline', 'sodic').pipe(
      Schema.optional
    ),
  }).pipe(Schema.optional),

  // 粒径分布
  particleDistribution: ParticleSizeDistributionSchema,

  // 化学組成
  chemistry: SoilChemistrySchema,

  // 有機物組成
  organicMatter: OrganicMatterCompositionSchema,

  // 物理特性
  physicalProperties: SoilPhysicalPropertiesSchema,

  // 層位構造
  horizons: Schema.Array(
    Schema.Struct({
      // 層位名（A, B, C等）
      designation: Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(10),
        Schema.annotations({ description: 'Horizon designation (e.g., A1, Bt, C)' })
      ),

      // 深度（cm）
      depth: Schema.Struct({
        top: Schema.Number.pipe(
          Schema.nonNegative(),
          Schema.between(0, 1000),
          Schema.annotations({ description: 'Top depth in cm' })
        ),
        bottom: Schema.Number.pipe(
          Schema.nonNegative(),
          Schema.between(0, 1000),
          Schema.annotations({ description: 'Bottom depth in cm' })
        ),
      }),

      // 色（Munsell color）
      color: Schema.Struct({
        dry: Schema.String.pipe(Schema.optional),
        moist: Schema.String.pipe(Schema.optional),
      }).pipe(Schema.optional),

      // 特性
      characteristics: Schema.Struct({
        texture: SoilTextureSchema,
        structure: SoilStructureSchema,
        consistency: Schema.Literal('loose', 'friable', 'firm', 'hard', 'very_hard').pipe(Schema.optional),
        rockFragments: Schema.Number.pipe(Schema.between(0, 100)).pipe(Schema.optional),
      }),
    })
  )
    .pipe(Schema.minItems(1), Schema.maxItems(10), Schema.annotations({ description: 'Soil horizon sequence' }))
    .pipe(Schema.optional),

  // 形成因子
  formationFactors: Schema.Struct({
    // 親材料
    parentMaterial: Schema.Literal(
      'igneous',
      'sedimentary',
      'metamorphic',
      'alluvium',
      'colluvium',
      'loess',
      'till',
      'organic'
    ),

    // 地形
    topography: Schema.Struct({
      slope: Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.between(0, 100),
        Schema.annotations({ description: 'Slope percentage' })
      ),
      aspect: Schema.Number.pipe(Schema.between(0, 360), Schema.annotations({ description: 'Aspect in degrees' })).pipe(
        Schema.optional
      ),
      position: Schema.Literal('summit', 'shoulder', 'backslope', 'footslope', 'toeslope').pipe(Schema.optional),
    }).pipe(Schema.optional),

    // 年代
    age: Schema.Struct({
      relative: Schema.Literal('young', 'intermediate', 'mature', 'old'),
      absolute: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional), // years
    }).pipe(Schema.optional),

    // 植生影響
    vegetationInfluence: Schema.Struct({
      type: Schema.String,
      duration: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
      intensity: Schema.Literal('low', 'moderate', 'high'),
    }).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 土壌健康性
  soilHealth: Schema.Struct({
    // 総合評価
    overallRating: Schema.Literal('poor', 'fair', 'good', 'excellent'),

    // 個別指標
    indicators: Schema.Struct({
      organicMatterLevel: Schema.Literal('low', 'adequate', 'high'),
      nutrientAvailability: Schema.Literal('deficient', 'adequate', 'excessive'),
      physicalCondition: Schema.Literal('poor', 'fair', 'good', 'excellent'),
      biologicalActivity: Schema.Literal('low', 'moderate', 'high', 'very_high'),
      chemicalBalance: Schema.Literal('imbalanced', 'somewhat_balanced', 'well_balanced'),
    }).pipe(Schema.optional),

    // 制限因子
    limitations: Schema.Array(
      Schema.Literal(
        'low_fertility',
        'poor_drainage',
        'high_salinity',
        'acidity',
        'alkalinity',
        'compaction',
        'erosion',
        'contamination',
        'shallow_depth',
        'stoniness'
      )
    ).pipe(Schema.optional),
  }).pipe(Schema.optional),

  // 管理履歴
  managementHistory: Schema.Array(
    Schema.Struct({
      practice: Schema.Literal(
        'tillage',
        'fertilization',
        'liming',
        'irrigation',
        'drainage',
        'cropping',
        'grazing',
        'forestry'
      ),
      intensity: Schema.Literal('low', 'moderate', 'high'),
      duration: Schema.Number.pipe(Schema.positive()),
      impact: Schema.Literal('negative', 'neutral', 'positive'),
    })
  ).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'SoilComposition',
    title: 'Complete Soil Composition Configuration',
    description: 'Comprehensive soil composition with pedological analysis',
  })
)

export type SoilComposition = typeof SoilCompositionSchema.Type

/**
 * 土壌組成作成パラメータ
 */
export const CreateSoilCompositionParamsSchema = Schema.Struct({
  parentMaterial: Schema.Literal('igneous', 'sedimentary', 'metamorphic', 'alluvium', 'organic').pipe(Schema.optional),
  climate: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.between(-50, 50)),
    precipitation: Schema.Number.pipe(Schema.between(0, 5000)),
  }).pipe(Schema.optional),
  topography: Schema.Literal('flat', 'gentle_slope', 'steep_slope', 'valley', 'ridge').pipe(Schema.optional),
  vegetation: Schema.Literal('forest', 'grassland', 'desert', 'wetland').pipe(Schema.optional),
  age: Schema.Literal('young', 'intermediate', 'mature', 'old').pipe(Schema.optional),
  drainage: SoilDrainageSchema.pipe(Schema.optional),
})

export type CreateSoilCompositionParams = typeof CreateSoilCompositionParamsSchema.Type

/**
 * 土壌組成エラー型
 */
export const SoilCompositionErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('InvalidParticleDistribution'),
    totalSum: Schema.Number,
    expectedSum: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ChemicalInconsistency'),
    parameter1: Schema.String,
    parameter2: Schema.String,
    conflict: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PhysicalPropertyConflict'),
    property: Schema.String,
    value: Schema.Number,
    expectedRange: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PedologicalInconsistency'),
    horizon: Schema.String,
    inconsistency: Schema.String,
    message: Schema.String,
  }),
])

export type SoilCompositionError = typeof SoilCompositionErrorSchema.Type

/**
 * 標準土壌組成プリセット
 */
export const SOIL_COMPOSITION_PRESETS = {
  SANDY_SOIL: {
    description: 'Well-drained sandy soil',
    texture: 'sand',
    particles: { sand: 0.85, silt: 0.1, clay: 0.05 },
    drainage: 'well_drained',
    pH: 6.5,
    organicMatter: 0.02,
  },
  LOAMY_SOIL: {
    description: 'Balanced loamy soil',
    texture: 'loam',
    particles: { sand: 0.4, silt: 0.4, clay: 0.2 },
    drainage: 'well_drained',
    pH: 6.8,
    organicMatter: 0.04,
  },
  CLAY_SOIL: {
    description: 'Heavy clay soil',
    texture: 'clay',
    particles: { sand: 0.2, silt: 0.3, clay: 0.5 },
    drainage: 'poorly_drained',
    pH: 7.2,
    organicMatter: 0.03,
  },
  PEAT_SOIL: {
    description: 'Organic peat soil',
    texture: 'organic',
    particles: { sand: 0.1, silt: 0.2, clay: 0.1 },
    drainage: 'poorly_drained',
    pH: 4.5,
    organicMatter: 0.6,
  },
  CALCAREOUS_SOIL: {
    description: 'Limestone-derived calcareous soil',
    texture: 'clay_loam',
    particles: { sand: 0.3, silt: 0.35, clay: 0.35 },
    drainage: 'moderately_drained',
    pH: 8.1,
    organicMatter: 0.025,
  },
  VOLCANIC_SOIL: {
    description: 'Fertile volcanic soil (Andisol)',
    texture: 'silt_loam',
    particles: { sand: 0.25, silt: 0.55, clay: 0.2 },
    drainage: 'well_drained',
    pH: 6.0,
    organicMatter: 0.08,
  },
} as const

/**
 * バイオーム土壌マッピング
 */
export const BIOME_SOIL_MAPPING = {
  DESERT: { texture: 'sand', pH: 8.0, organicMatter: 0.005, drainage: 'excessively_drained' },
  SAVANNA: { texture: 'sandy_loam', pH: 6.5, organicMatter: 0.015, drainage: 'well_drained' },
  PLAINS: { texture: 'silt_loam', pH: 6.8, organicMatter: 0.035, drainage: 'well_drained' },
  FOREST: { texture: 'loam', pH: 5.5, organicMatter: 0.06, drainage: 'moderately_drained' },
  TAIGA: { texture: 'sandy_loam', pH: 4.8, organicMatter: 0.04, drainage: 'moderately_drained' },
  JUNGLE: { texture: 'clay_loam', pH: 5.0, organicMatter: 0.08, drainage: 'well_drained' },
  SWAMP: { texture: 'clay', pH: 6.5, organicMatter: 0.2, drainage: 'very_poorly_drained' },
  TUNDRA: { texture: 'silt_loam', pH: 5.5, organicMatter: 0.05, drainage: 'poorly_drained' },
  MOUNTAINS: { texture: 'loamy_sand', pH: 6.0, organicMatter: 0.02, drainage: 'well_drained' },
  ICE_SPIKES: { texture: 'sand', pH: 7.0, organicMatter: 0.001, drainage: 'excessively_drained' },
} as const
