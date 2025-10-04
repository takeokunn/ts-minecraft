/**
 * @fileoverview Biome Constants
 * バイオーム定義と特性に関する定数
 */

import { Schema } from 'effect'

// === バイオーム識別子定数 ===

/** 基本バイオームID */
export const BIOME_IDS = {
  // 温帯バイオーム
  PLAINS: 'minecraft:plains',
  FOREST: 'minecraft:forest',
  BIRCH_FOREST: 'minecraft:birch_forest',
  DARK_FOREST: 'minecraft:dark_forest',

  // 寒帯バイオーム
  TAIGA: 'minecraft:taiga',
  SNOWY_TAIGA: 'minecraft:snowy_taiga',
  SNOWY_PLAINS: 'minecraft:snowy_plains',
  ICE_SPIKES: 'minecraft:ice_spikes',

  // 乾燥バイオーム
  DESERT: 'minecraft:desert',
  SAVANNA: 'minecraft:savanna',
  BADLANDS: 'minecraft:badlands',
  ERODED_BADLANDS: 'minecraft:eroded_badlands',

  // 湿潤バイオーム
  SWAMP: 'minecraft:swamp',
  MANGROVE_SWAMP: 'minecraft:mangrove_swamp',
  JUNGLE: 'minecraft:jungle',
  BAMBOO_JUNGLE: 'minecraft:bamboo_jungle',

  // 山岳バイオーム
  WINDSWEPT_HILLS: 'minecraft:windswept_hills',
  WINDSWEPT_FOREST: 'minecraft:windswept_forest',
  WINDSWEPT_GRAVELLY_HILLS: 'minecraft:windswept_gravelly_hills',

  // 海洋バイオーム
  OCEAN: 'minecraft:ocean',
  DEEP_OCEAN: 'minecraft:deep_ocean',
  COLD_OCEAN: 'minecraft:cold_ocean',
  WARM_OCEAN: 'minecraft:warm_ocean',
  LUKEWARM_OCEAN: 'minecraft:lukewarm_ocean',
  FROZEN_OCEAN: 'minecraft:frozen_ocean',

  // 地下バイオーム
  DEEP_DARK: 'minecraft:deep_dark',
  DRIPSTONE_CAVES: 'minecraft:dripstone_caves',
  LUSH_CAVES: 'minecraft:lush_caves',

  // ネザーバイオーム
  NETHER_WASTES: 'minecraft:nether_wastes',
  CRIMSON_FOREST: 'minecraft:crimson_forest',
  WARPED_FOREST: 'minecraft:warped_forest',
  SOUL_SAND_VALLEY: 'minecraft:soul_sand_valley',
  BASALT_DELTAS: 'minecraft:basalt_deltas',

  // エンドバイオーム
  THE_END: 'minecraft:the_end',
  END_HIGHLANDS: 'minecraft:end_highlands',
  END_MIDLANDS: 'minecraft:end_midlands',
  SMALL_END_ISLANDS: 'minecraft:small_end_islands',
  END_BARRENS: 'minecraft:end_barrens',
} as const

/** バイオームカテゴリ */
export const BIOME_CATEGORIES = {
  TEMPERATE: 'temperate',
  COLD: 'cold',
  DRY: 'dry',
  WET: 'wet',
  MOUNTAIN: 'mountain',
  OCEAN: 'ocean',
  UNDERGROUND: 'underground',
  NETHER: 'nether',
  END: 'end',
} as const

// === 気候特性定数 ===

/** バイオーム気候データ */
export const BIOME_CLIMATE_DATA = {
  [BIOME_IDS.PLAINS]: {
    temperature: 0.8,
    humidity: 0.4,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.TEMPERATE,
  },
  [BIOME_IDS.FOREST]: {
    temperature: 0.7,
    humidity: 0.8,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.TEMPERATE,
  },
  [BIOME_IDS.BIRCH_FOREST]: {
    temperature: 0.6,
    humidity: 0.6,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.TEMPERATE,
  },
  [BIOME_IDS.DARK_FOREST]: {
    temperature: 0.7,
    humidity: 0.8,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.TEMPERATE,
  },
  [BIOME_IDS.TAIGA]: {
    temperature: 0.25,
    humidity: 0.8,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.COLD,
  },
  [BIOME_IDS.SNOWY_TAIGA]: {
    temperature: -0.5,
    humidity: 0.4,
    precipitation: 'snow',
    category: BIOME_CATEGORIES.COLD,
  },
  [BIOME_IDS.SNOWY_PLAINS]: {
    temperature: 0.0,
    humidity: 0.5,
    precipitation: 'snow',
    category: BIOME_CATEGORIES.COLD,
  },
  [BIOME_IDS.ICE_SPIKES]: {
    temperature: 0.0,
    humidity: 0.5,
    precipitation: 'snow',
    category: BIOME_CATEGORIES.COLD,
  },
  [BIOME_IDS.DESERT]: {
    temperature: 2.0,
    humidity: 0.0,
    precipitation: 'none',
    category: BIOME_CATEGORIES.DRY,
  },
  [BIOME_IDS.SAVANNA]: {
    temperature: 1.2,
    humidity: 0.0,
    precipitation: 'none',
    category: BIOME_CATEGORIES.DRY,
  },
  [BIOME_IDS.BADLANDS]: {
    temperature: 2.0,
    humidity: 0.0,
    precipitation: 'none',
    category: BIOME_CATEGORIES.DRY,
  },
  [BIOME_IDS.SWAMP]: {
    temperature: 0.8,
    humidity: 0.9,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.WET,
  },
  [BIOME_IDS.JUNGLE]: {
    temperature: 0.95,
    humidity: 0.9,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.WET,
  },
  [BIOME_IDS.OCEAN]: {
    temperature: 0.5,
    humidity: 0.5,
    precipitation: 'rain',
    category: BIOME_CATEGORIES.OCEAN,
  },
  [BIOME_IDS.DEEP_DARK]: {
    temperature: 0.8,
    humidity: 0.4,
    precipitation: 'none',
    category: BIOME_CATEGORIES.UNDERGROUND,
  },
} as const

// === 生成特性定数 ===

/** バイオーム生成特性 */
export const BIOME_GENERATION_FEATURES = {
  [BIOME_IDS.PLAINS]: {
    surfaceBlock: 'minecraft:grass_block',
    fillerBlock: 'minecraft:dirt',
    treeTypes: ['minecraft:oak'],
    grassDensity: 0.8,
    flowerDensity: 0.2,
    villageSpawnRate: 0.1,
    animalSpawnRate: 0.8,
  },
  [BIOME_IDS.FOREST]: {
    surfaceBlock: 'minecraft:grass_block',
    fillerBlock: 'minecraft:dirt',
    treeTypes: ['minecraft:oak', 'minecraft:birch'],
    treeDensity: 0.9,
    grassDensity: 0.6,
    mushroomDensity: 0.1,
    animalSpawnRate: 0.7,
  },
  [BIOME_IDS.DESERT]: {
    surfaceBlock: 'minecraft:sand',
    fillerBlock: 'minecraft:sand',
    treeTypes: [],
    cactusSpawnRate: 0.3,
    deadBushSpawnRate: 0.1,
    dungeonSpawnRate: 0.05,
    templeProbability: 0.002,
  },
  [BIOME_IDS.TAIGA]: {
    surfaceBlock: 'minecraft:grass_block',
    fillerBlock: 'minecraft:dirt',
    treeTypes: ['minecraft:spruce'],
    treeDensity: 0.8,
    grassDensity: 0.3,
    berryBushDensity: 0.1,
    wolfSpawnRate: 0.2,
  },
  [BIOME_IDS.OCEAN]: {
    surfaceBlock: 'minecraft:gravel',
    fillerBlock: 'minecraft:gravel',
    treeTypes: [],
    kelp: true,
    seagrass: true,
    oceanMonumentProbability: 0.001,
    shipwreckProbability: 0.01,
  },
} as const

// === 色彩定数 ===

/** バイオーム色彩設定 */
export const BIOME_COLORS = {
  // 草の色（16進数）
  GRASS_COLORS: {
    [BIOME_IDS.PLAINS]: 0x91bd59,
    [BIOME_IDS.FOREST]: 0x79c05a,
    [BIOME_IDS.DESERT]: 0xbfb755,
    [BIOME_IDS.TAIGA]: 0x86b783,
    [BIOME_IDS.SWAMP]: 0x6a7039,
    [BIOME_IDS.JUNGLE]: 0x59c93c,
  },

  // 葉の色（16進数）
  FOLIAGE_COLORS: {
    [BIOME_IDS.PLAINS]: 0x77ab2f,
    [BIOME_IDS.FOREST]: 0x59ae30,
    [BIOME_IDS.DESERT]: 0xaea42a,
    [BIOME_IDS.TAIGA]: 0x68a464,
    [BIOME_IDS.SWAMP]: 0x6a7039,
    [BIOME_IDS.JUNGLE]: 0x30bb0b,
  },

  // 水の色（16進数）
  WATER_COLORS: {
    [BIOME_IDS.PLAINS]: 0x3f76e4,
    [BIOME_IDS.FOREST]: 0x3f76e4,
    [BIOME_IDS.DESERT]: 0x32a598,
    [BIOME_IDS.TAIGA]: 0x287082,
    [BIOME_IDS.SWAMP]: 0x617b64,
    [BIOME_IDS.OCEAN]: 0x3f76e4,
  },

  // 霧の色（16進数）
  FOG_COLORS: {
    [BIOME_IDS.PLAINS]: 0xc0d8ff,
    [BIOME_IDS.FOREST]: 0xc0d8ff,
    [BIOME_IDS.DESERT]: 0xffe87a,
    [BIOME_IDS.NETHER_WASTES]: 0x330808,
    [BIOME_IDS.THE_END]: 0xa080a0,
  },
} as const

// === 音響定数 ===

/** バイオーム環境音 */
export const BIOME_AMBIENT_SOUNDS = {
  [BIOME_IDS.FOREST]: {
    sound: 'minecraft:ambient.cave',
    volume: 0.1,
    pitch: 1.0,
  },
  [BIOME_IDS.DESERT]: {
    sound: 'minecraft:ambient.desert',
    volume: 0.2,
    pitch: 0.8,
  },
  [BIOME_IDS.OCEAN]: {
    sound: 'minecraft:ambient.underwater.loop',
    volume: 0.3,
    pitch: 1.0,
  },
  [BIOME_IDS.NETHER_WASTES]: {
    sound: 'minecraft:ambient.nether_wastes.loop',
    volume: 0.2,
    pitch: 1.0,
  },
} as const

// === バイオーム定数統合型 ===

export const BIOME_CONSTANTS = {
  IDS: BIOME_IDS,
  CATEGORIES: BIOME_CATEGORIES,
  CLIMATE: BIOME_CLIMATE_DATA,
  GENERATION: BIOME_GENERATION_FEATURES,
  COLORS: BIOME_COLORS,
  SOUNDS: BIOME_AMBIENT_SOUNDS,
} as const

// === 検証用スキーマ ===

/** バイオームID検証スキーマ */
export const ValidBiomeIdSchema = Schema.Literal(...Object.values(BIOME_IDS)).pipe(
  Schema.annotations({
    title: 'Valid Biome ID',
    description: 'A valid Minecraft biome identifier',
  })
)

/** バイオームカテゴリ検証スキーマ */
export const ValidBiomeCategorySchema = Schema.Literal(...Object.values(BIOME_CATEGORIES)).pipe(
  Schema.annotations({
    title: 'Valid Biome Category',
    description: 'A valid biome category',
  })
)

/** 降水タイプ検証スキーマ */
export const ValidPrecipitationTypeSchema = Schema.Literal('none', 'rain', 'snow').pipe(
  Schema.annotations({
    title: 'Valid Precipitation Type',
    description: 'A valid precipitation type',
  })
)

/** バイオーム温度検証スキーマ */
export const ValidBiomeTemperatureSchema = Schema.Number.pipe(
  Schema.between(-0.5, 2.0),
  Schema.annotations({
    title: 'Valid Biome Temperature',
    description: 'Biome temperature value between -0.5 and 2.0',
  })
)

/** バイオーム湿度検証スキーマ */
export const ValidBiomeHumiditySchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.annotations({
    title: 'Valid Biome Humidity',
    description: 'Biome humidity value between 0.0 and 1.0',
  })
)
