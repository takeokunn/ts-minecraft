/**
 * @fileoverview Biome Core Types
 * バイオームシステムの基本型定義
 */

import { Brand, Schema } from 'effect'
import { BIOME_CONSTANTS } from '../constants/biome_constants'
import { BlockPosition, CircularArea, RectangularArea } from './coordinate_types'

// === バイオーム識別子型 ===

/** バイオームID - Minecraftバイオームの識別子 */
export type BiomeId = string & Brand.Brand<'BiomeId'>

export const BiomeIdSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z_]+$/),
  Schema.brand('BiomeId'),
  Schema.annotations({
    title: 'Biome ID',
    description: 'Minecraft biome identifier in namespaced format',
    examples: ['minecraft:plains', 'minecraft:forest', 'minecraft:desert'],
  })
)

/** バイオームカテゴリ */
export type BiomeCategory = typeof BIOME_CONSTANTS.CATEGORIES[keyof typeof BIOME_CONSTANTS.CATEGORIES]

export const BiomeCategorySchema = Schema.Literal(
  ...Object.values(BIOME_CONSTANTS.CATEGORIES)
).pipe(
  Schema.annotations({
    title: 'Biome Category',
    description: 'High-level biome categorization',
  })
)

// === 気候パラメータ型 ===

/** 温度値 - バイオームの温度 (-0.5 ~ 2.0) */
export type Temperature = number & Brand.Brand<'Temperature'>

export const TemperatureSchema = Schema.Number.pipe(
  Schema.between(-0.5, 2.0),
  Schema.brand('Temperature'),
  Schema.annotations({
    title: 'Temperature',
    description: 'Biome temperature value (-0.5 to 2.0)',
  })
)

/** 湿度値 - バイオームの湿度 (0.0 ~ 1.0) */
export type Humidity = number & Brand.Brand<'Humidity'>

export const HumiditySchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.brand('Humidity'),
  Schema.annotations({
    title: 'Humidity',
    description: 'Biome humidity value (0.0 to 1.0)',
  })
)

/** 大陸性値 - 大陸からの距離による影響 (-1.2 ~ 1.0) */
export type Continentalness = number & Brand.Brand<'Continentalness'>

export const ContinentalnessSchema = Schema.Number.pipe(
  Schema.between(-1.2, 1.0),
  Schema.brand('Continentalness'),
  Schema.annotations({
    title: 'Continentalness',
    description: 'Continental influence value (-1.2 to 1.0)',
  })
)

/** 侵食性値 - 地形の侵食度 (-1.0 ~ 1.0) */
export type Erosion = number & Brand.Brand<'Erosion'>

export const ErosionSchema = Schema.Number.pipe(
  Schema.between(-1.0, 1.0),
  Schema.brand('Erosion'),
  Schema.annotations({
    title: 'Erosion',
    description: 'Terrain erosion value (-1.0 to 1.0)',
  })
)

/** 深度値 - 地形の深度 (0.0 ~ 1.0) */
export type Depth = number & Brand.Brand<'Depth'>

export const DepthSchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.brand('Depth'),
  Schema.annotations({
    title: 'Depth',
    description: 'Terrain depth value (0.0 to 1.0)',
  })
)

/** 奇異性値 - 地形の異常性 (-2.0 ~ 2.0) */
export type Weirdness = number & Brand.Brand<'Weirdness'>

export const WeirdnessSchema = Schema.Number.pipe(
  Schema.between(-2.0, 2.0),
  Schema.brand('Weirdness'),
  Schema.annotations({
    title: 'Weirdness',
    description: 'Terrain weirdness value (-2.0 to 2.0)',
  })
)

// === 降水型 ===

/** 降水タイプ */
export type PrecipitationType = 'none' | 'rain' | 'snow'

export const PrecipitationTypeSchema = Schema.Literal('none', 'rain', 'snow').pipe(
  Schema.annotations({
    title: 'Precipitation Type',
    description: 'Type of precipitation in the biome',
  })
)

// === 気候データ型 ===

/** 完全な気候データ */
export interface ClimateData {
  readonly temperature: Temperature
  readonly humidity: Humidity
  readonly continentalness: Continentalness
  readonly erosion: Erosion
  readonly depth: Depth
  readonly weirdness: Weirdness
  readonly precipitation: PrecipitationType
}

export const ClimateDataSchema = Schema.Struct({
  temperature: TemperatureSchema,
  humidity: HumiditySchema,
  continentalness: ContinentalnessSchema,
  erosion: ErosionSchema,
  depth: DepthSchema,
  weirdness: WeirdnessSchema,
  precipitation: PrecipitationTypeSchema,
}).pipe(
  Schema.annotations({
    title: 'Climate Data',
    description: 'Complete climate parameters for biome generation',
  })
)

// === バイオーム特性型 ===

/** バイオーム色彩情報 */
export interface BiomeColors {
  readonly grass: number    // 16進数RGB
  readonly foliage: number  // 16進数RGB
  readonly water: number    // 16進数RGB
  readonly fog: number      // 16進数RGB
  readonly sky: number      // 16進数RGB
}

export const BiomeColorsSchema = Schema.Struct({
  grass: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xFFFFFF)),
  foliage: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xFFFFFF)),
  water: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xFFFFFF)),
  fog: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xFFFFFF)),
  sky: Schema.Number.pipe(Schema.int(), Schema.between(0, 0xFFFFFF)),
}).pipe(
  Schema.annotations({
    title: 'Biome Colors',
    description: 'Color palette for biome rendering',
  })
)

/** バイオーム音響設定 */
export interface BiomeSounds {
  readonly ambient?: {
    readonly sound: string
    readonly volume: number
    readonly pitch: number
  }
  readonly music?: {
    readonly sound: string
    readonly volume: number
    readonly minDelay: number
    readonly maxDelay: number
  }
  readonly mood?: {
    readonly sound: string
    readonly volume: number
    readonly offset: number
  }
}

export const BiomeSoundsSchema = Schema.Struct({
  ambient: Schema.optional(Schema.Struct({
    sound: Schema.String,
    volume: Schema.Number.pipe(Schema.between(0, 1)),
    pitch: Schema.Number.pipe(Schema.between(0, 2)),
  })),
  music: Schema.optional(Schema.Struct({
    sound: Schema.String,
    volume: Schema.Number.pipe(Schema.between(0, 1)),
    minDelay: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    maxDelay: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  })),
  mood: Schema.optional(Schema.Struct({
    sound: Schema.String,
    volume: Schema.Number.pipe(Schema.between(0, 1)),
    offset: Schema.Number.pipe(Schema.nonNegative()),
  })),
}).pipe(
  Schema.annotations({
    title: 'Biome Sounds',
    description: 'Audio settings for biome atmosphere',
  })
)

// === バイオーム生成特性型 ===

/** ブロックタイプ */
export type BlockType = string & Brand.Brand<'BlockType'>

export const BlockTypeSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z_]+$/),
  Schema.brand('BlockType'),
  Schema.annotations({
    title: 'Block Type',
    description: 'Minecraft block identifier',
  })
)

/** 生成密度 - 0.0～1.0の密度値 */
export type GenerationDensity = number & Brand.Brand<'GenerationDensity'>

export const GenerationDensitySchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.brand('GenerationDensity'),
  Schema.annotations({
    title: 'Generation Density',
    description: 'Density for feature generation (0.0 to 1.0)',
  })
)

/** 生成確率 - 0.0～1.0の確率値 */
export type GenerationProbability = number & Brand.Brand<'GenerationProbability'>

export const GenerationProbabilitySchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.brand('GenerationProbability'),
  Schema.annotations({
    title: 'Generation Probability',
    description: 'Probability for structure generation (0.0 to 1.0)',
  })
)

/** バイオーム地形特性 */
export interface BiomeTerrainFeatures {
  readonly surfaceBlock: BlockType
  readonly fillerBlock: BlockType
  readonly undergroundBlock: BlockType
  readonly treeTypes: readonly string[]
  readonly treeDensity: GenerationDensity
  readonly grassDensity: GenerationDensity
  readonly flowerDensity: GenerationDensity
  readonly mushroomDensity: GenerationDensity
  readonly cactusSpawnRate: GenerationProbability
  readonly deadBushSpawnRate: GenerationProbability
}

export const BiomeTerrainFeaturesSchema = Schema.Struct({
  surfaceBlock: BlockTypeSchema,
  fillerBlock: BlockTypeSchema,
  undergroundBlock: BlockTypeSchema,
  treeTypes: Schema.Array(Schema.String),
  treeDensity: GenerationDensitySchema,
  grassDensity: GenerationDensitySchema,
  flowerDensity: GenerationDensitySchema,
  mushroomDensity: GenerationDensitySchema,
  cactusSpawnRate: GenerationProbabilitySchema,
  deadBushSpawnRate: GenerationProbabilitySchema,
}).pipe(
  Schema.annotations({
    title: 'Biome Terrain Features',
    description: 'Terrain and vegetation characteristics of a biome',
  })
)

/** バイオーム構造物生成 */
export interface BiomeStructureGeneration {
  readonly villageSpawnRate: GenerationProbability
  readonly dungeonSpawnRate: GenerationProbability
  readonly templeSpawnRate: GenerationProbability
  readonly monumentSpawnRate: GenerationProbability
  readonly outpostSpawnRate: GenerationProbability
  readonly shipwreckSpawnRate: GenerationProbability
  readonly ruinedPortalSpawnRate: GenerationProbability
}

export const BiomeStructureGenerationSchema = Schema.Struct({
  villageSpawnRate: GenerationProbabilitySchema,
  dungeonSpawnRate: GenerationProbabilitySchema,
  templeSpawnRate: GenerationProbabilitySchema,
  monumentSpawnRate: GenerationProbabilitySchema,
  outpostSpawnRate: GenerationProbabilitySchema,
  shipwreckSpawnRate: GenerationProbabilitySchema,
  ruinedPortalSpawnRate: GenerationProbabilitySchema,
}).pipe(
  Schema.annotations({
    title: 'Biome Structure Generation',
    description: 'Structure spawn rates for the biome',
  })
)

/** バイオーム生物生成 */
export interface BiomeMobSpawning {
  readonly passiveAnimalSpawnRate: GenerationProbability
  readonly hostileMobSpawnRate: GenerationProbability
  readonly aquaticMobSpawnRate: GenerationProbability
  readonly ambientMobSpawnRate: GenerationProbability
  readonly spawnableCreatures: readonly string[]
  readonly spawnableMonsters: readonly string[]
  readonly spawnableWaterCreatures: readonly string[]
  readonly spawnableAmbient: readonly string[]
}

export const BiomeMobSpawningSchema = Schema.Struct({
  passiveAnimalSpawnRate: GenerationProbabilitySchema,
  hostileMobSpawnRate: GenerationProbabilitySchema,
  aquaticMobSpawnRate: GenerationProbabilitySchema,
  ambientMobSpawnRate: GenerationProbabilitySchema,
  spawnableCreatures: Schema.Array(Schema.String),
  spawnableMonsters: Schema.Array(Schema.String),
  spawnableWaterCreatures: Schema.Array(Schema.String),
  spawnableAmbient: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Biome Mob Spawning',
    description: 'Mob spawning configuration for the biome',
  })
)

// === バイオーム定義型 ===

/** 完全なバイオーム定義 */
export interface BiomeDefinition {
  readonly id: BiomeId
  readonly name: string
  readonly category: BiomeCategory
  readonly climate: ClimateData
  readonly colors: BiomeColors
  readonly sounds: BiomeSounds
  readonly terrain: BiomeTerrainFeatures
  readonly structures: BiomeStructureGeneration
  readonly mobs: BiomeMobSpawning
  readonly rarity: GenerationProbability
  readonly minHeight: number
  readonly maxHeight: number
  readonly heightVariation: number
}

export const BiomeDefinitionSchema = Schema.Struct({
  id: BiomeIdSchema,
  name: Schema.String.pipe(Schema.minLength(1)),
  category: BiomeCategorySchema,
  climate: ClimateDataSchema,
  colors: BiomeColorsSchema,
  sounds: BiomeSoundsSchema,
  terrain: BiomeTerrainFeaturesSchema,
  structures: BiomeStructureGenerationSchema,
  mobs: BiomeMobSpawningSchema,
  rarity: GenerationProbabilitySchema,
  minHeight: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)),
  maxHeight: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)),
  heightVariation: Schema.Number.pipe(Schema.int(), Schema.between(0, 128)),
}).pipe(
  Schema.annotations({
    title: 'Biome Definition',
    description: 'Complete definition of a biome with all characteristics',
  })
)

// === バイオーム分布型 ===

/** バイオーム分布重み */
export type BiomeWeight = number & Brand.Brand<'BiomeWeight'>

export const BiomeWeightSchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.brand('BiomeWeight'),
  Schema.annotations({
    title: 'Biome Weight',
    description: 'Weight for biome distribution (0.0 to 1.0)',
  })
)

/** バイオーム分布エントリ */
export interface BiomeDistributionEntry {
  readonly biome: BiomeId
  readonly weight: BiomeWeight
  readonly conditions: ClimateData
  readonly exclusions: readonly BiomeId[]
  readonly requirements: readonly BiomeId[]
}

export const BiomeDistributionEntrySchema = Schema.Struct({
  biome: BiomeIdSchema,
  weight: BiomeWeightSchema,
  conditions: ClimateDataSchema,
  exclusions: Schema.Array(BiomeIdSchema),
  requirements: Schema.Array(BiomeIdSchema),
}).pipe(
  Schema.annotations({
    title: 'Biome Distribution Entry',
    description: 'Entry in biome distribution table',
  })
)

/** バイオーム分布テーブル */
export interface BiomeDistributionTable {
  readonly entries: readonly BiomeDistributionEntry[]
  readonly fallbackBiome: BiomeId
  readonly blendRadius: number
}

export const BiomeDistributionTableSchema = Schema.Struct({
  entries: Schema.Array(BiomeDistributionEntrySchema),
  fallbackBiome: BiomeIdSchema,
  blendRadius: Schema.Number.pipe(Schema.int(), Schema.between(1, 32)),
}).pipe(
  Schema.annotations({
    title: 'Biome Distribution Table',
    description: 'Complete biome distribution configuration',
  })
)

// === バイオーム遷移型 ===

/** バイオーム遷移ルール */
export interface BiomeTransitionRule {
  readonly from: BiomeId
  readonly to: BiomeId
  readonly transitionZone: RectangularArea
  readonly blendFunction: 'linear' | 'smooth' | 'step'
  readonly blendDistance: number
}

export const BiomeTransitionRuleSchema = Schema.Struct({
  from: BiomeIdSchema,
  to: BiomeIdSchema,
  transitionZone: Schema.suspend(() => import('./coordinate_types').then(m => m.RectangularAreaSchema)),
  blendFunction: Schema.Literal('linear', 'smooth', 'step'),
  blendDistance: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
}).pipe(
  Schema.annotations({
    title: 'Biome Transition Rule',
    description: 'Rule for smooth transition between biomes',
  })
)

// === 作成ヘルパー関数 ===

/** BiomeId作成ヘルパー */
export const createBiomeId = (id: string): BiomeId =>
  Schema.decodeSync(BiomeIdSchema)(id)

/** Temperature作成ヘルパー */
export const createTemperature = (value: number): Temperature =>
  Schema.decodeSync(TemperatureSchema)(value)

/** Humidity作成ヘルパー */
export const createHumidity = (value: number): Humidity =>
  Schema.decodeSync(HumiditySchema)(value)

/** ClimateData作成ヘルパー */
export const createClimateData = (
  temperature: number,
  humidity: number,
  continentalness: number = 0.0,
  erosion: number = 0.0,
  depth: number = 0.5,
  weirdness: number = 0.0,
  precipitation: PrecipitationType = 'rain'
): ClimateData =>
  Schema.decodeSync(ClimateDataSchema)({
    temperature: temperature as Temperature,
    humidity: humidity as Humidity,
    continentalness: continentalness as Continentalness,
    erosion: erosion as Erosion,
    depth: depth as Depth,
    weirdness: weirdness as Weirdness,
    precipitation,
  })

/** GenerationDensity作成ヘルパー */
export const createGenerationDensity = (value: number): GenerationDensity =>
  Schema.decodeSync(GenerationDensitySchema)(value)

/** GenerationProbability作成ヘルパー */
export const createGenerationProbability = (value: number): GenerationProbability =>
  Schema.decodeSync(GenerationProbabilitySchema)(value)