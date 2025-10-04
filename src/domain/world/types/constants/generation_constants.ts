/**
 * @fileoverview Generation Constants
 * 世界生成アルゴリズムに関する定数
 */

import { Schema } from 'effect'

// === ノイズ生成定数 ===

/** Perlinノイズ設定 */
export const PERLIN_NOISE = {
  /** デフォルトオクターブ数 */
  DEFAULT_OCTAVES: 4,
  /** 最小オクターブ数 */
  MIN_OCTAVES: 1,
  /** 最大オクターブ数 */
  MAX_OCTAVES: 8,
  /** デフォルト振幅 */
  DEFAULT_AMPLITUDE: 1.0,
  /** デフォルト周波数 */
  DEFAULT_FREQUENCY: 0.01,
  /** 振幅減衰率 */
  AMPLITUDE_DECAY: 0.5,
  /** 周波数増加率 */
  FREQUENCY_MULTIPLIER: 2.0,
} as const

/** Simplexノイズ設定 */
export const SIMPLEX_NOISE = {
  /** デフォルトスケール */
  DEFAULT_SCALE: 0.01,
  /** 最小スケール */
  MIN_SCALE: 0.001,
  /** 最大スケール */
  MAX_SCALE: 1.0,
  /** デフォルト振幅 */
  DEFAULT_AMPLITUDE: 1.0,
} as const

/** ノイズ値の範囲 */
export const NOISE_RANGE = {
  /** 最小値 */
  MIN: -1.0,
  /** 最大値 */
  MAX: 1.0,
  /** 正規化済み最小値 */
  NORMALIZED_MIN: 0.0,
  /** 正規化済み最大値 */
  NORMALIZED_MAX: 1.0,
} as const

// === 地形生成定数 ===

/** 高度マップ生成 */
export const HEIGHT_MAP = {
  /** 基本高度 */
  BASE_HEIGHT: 64,
  /** 最大高度変動 */
  MAX_VARIATION: 64,
  /** 平坦度 */
  FLATNESS_FACTOR: 0.5,
  /** 山岳度 */
  MOUNTAIN_FACTOR: 2.0,
} as const

/** 表面生成 */
export const SURFACE_GENERATION = {
  /** 草ブロック深度 */
  GRASS_DEPTH: 1,
  /** 土ブロック深度 */
  DIRT_DEPTH: 3,
  /** 石ブロック開始深度 */
  STONE_START_DEPTH: 4,
} as const

/** 地下生成 */
export const UNDERGROUND = {
  /** 洞窟生成開始深度 */
  CAVE_START_DEPTH: 10,
  /** 洞窟生成確率 */
  CAVE_PROBABILITY: 0.1,
  /** 洞窟サイズファクター */
  CAVE_SIZE_FACTOR: 1.5,
  /** 地下水レベル */
  UNDERGROUND_WATER_LEVEL: 10,
} as const

// === バイオーム生成定数 ===

/** 気候パラメータ */
export const CLIMATE = {
  /** 温度範囲 */
  TEMPERATURE: {
    MIN: -0.5,
    MAX: 2.0,
    DEFAULT: 0.5,
  },
  /** 湿度範囲 */
  HUMIDITY: {
    MIN: 0.0,
    MAX: 1.0,
    DEFAULT: 0.5,
  },
  /** 大陸性範囲 */
  CONTINENTALNESS: {
    MIN: -1.2,
    MAX: 1.0,
    DEFAULT: 0.0,
  },
  /** 侵食性範囲 */
  EROSION: {
    MIN: -1.0,
    MAX: 1.0,
    DEFAULT: 0.0,
  },
  /** 深度範囲 */
  DEPTH: {
    MIN: 0.0,
    MAX: 1.0,
    DEFAULT: 0.5,
  },
  /** 奇異性範囲 */
  WEIRDNESS: {
    MIN: -2.0,
    MAX: 2.0,
    DEFAULT: 0.0,
  },
} as const

/** バイオーム遷移 */
export const BIOME_TRANSITION = {
  /** 遷移幅（ブロック） */
  TRANSITION_WIDTH: 8,
  /** 混合係数 */
  BLEND_FACTOR: 0.5,
  /** 最小遷移距離 */
  MIN_TRANSITION_DISTANCE: 4,
  /** 最大遷移距離 */
  MAX_TRANSITION_DISTANCE: 16,
} as const

// === 構造物生成定数 ===

/** 村生成 */
export const VILLAGE_GENERATION = {
  /** 最小間隔（チャンク） */
  MIN_SPACING: 8,
  /** 平均間隔（チャンク） */
  AVERAGE_SPACING: 32,
  /** 生成確率 */
  GENERATION_PROBABILITY: 0.004,
  /** 最小サイズ */
  MIN_SIZE: 5,
  /** 最大サイズ */
  MAX_SIZE: 20,
} as const

/** ダンジョン生成 */
export const DUNGEON_GENERATION = {
  /** 最小深度 */
  MIN_DEPTH: 1,
  /** 最大深度 */
  MAX_DEPTH: 60,
  /** 生成確率 */
  GENERATION_PROBABILITY: 0.001,
  /** 最小サイズ */
  MIN_SIZE: 3,
  /** 最大サイズ */
  MAX_SIZE: 7,
} as const

/** 鉱石生成 */
export const ORE_GENERATION = {
  /** 石炭鉱石 */
  COAL: {
    MIN_HEIGHT: 5,
    MAX_HEIGHT: 128,
    VEIN_SIZE: 17,
    TRIES_PER_CHUNK: 20,
  },
  /** 鉄鉱石 */
  IRON: {
    MIN_HEIGHT: 5,
    MAX_HEIGHT: 64,
    VEIN_SIZE: 9,
    TRIES_PER_CHUNK: 20,
  },
  /** 金鉱石 */
  GOLD: {
    MIN_HEIGHT: 5,
    MAX_HEIGHT: 32,
    VEIN_SIZE: 9,
    TRIES_PER_CHUNK: 2,
  },
  /** ダイヤモンド鉱石 */
  DIAMOND: {
    MIN_HEIGHT: 5,
    MAX_HEIGHT: 16,
    VEIN_SIZE: 8,
    TRIES_PER_CHUNK: 1,
  },
} as const

// === 生成パフォーマンス定数 ===

/** チャンク生成 */
export const CHUNK_GENERATION = {
  /** 並列生成スレッド数 */
  PARALLEL_THREADS: 4,
  /** 生成タイムアウト（ms） */
  GENERATION_TIMEOUT: 5000,
  /** バッチサイズ */
  BATCH_SIZE: 16,
  /** 優先度更新間隔（ms） */
  PRIORITY_UPDATE_INTERVAL: 1000,
} as const

/** メモリ管理 */
export const MEMORY_MANAGEMENT = {
  /** チャンクキャッシュサイズ */
  CHUNK_CACHE_SIZE: 256,
  /** ガベージコレクション間隔（ms） */
  GC_INTERVAL: 60_000,
  /** メモリ制限（MB） */
  MEMORY_LIMIT: 512,
} as const

// === 生成定数統合型 ===

export const GENERATION_CONSTANTS = {
  NOISE: {
    PERLIN: PERLIN_NOISE,
    SIMPLEX: SIMPLEX_NOISE,
    RANGE: NOISE_RANGE,
  },
  TERRAIN: {
    HEIGHT_MAP,
    SURFACE: SURFACE_GENERATION,
    UNDERGROUND,
  },
  BIOME: {
    CLIMATE,
    TRANSITION: BIOME_TRANSITION,
  },
  STRUCTURES: {
    VILLAGE: VILLAGE_GENERATION,
    DUNGEON: DUNGEON_GENERATION,
    ORE: ORE_GENERATION,
  },
  PERFORMANCE: {
    CHUNK: CHUNK_GENERATION,
    MEMORY: MEMORY_MANAGEMENT,
  },
} as const

// === 検証用スキーマ ===

/** ノイズ値検証スキーマ */
export const ValidNoiseValueSchema = Schema.Number.pipe(
  Schema.between(NOISE_RANGE.MIN, NOISE_RANGE.MAX),
  Schema.annotations({
    title: 'Valid Noise Value',
    description: `Noise value between ${NOISE_RANGE.MIN} and ${NOISE_RANGE.MAX}`,
  })
)

/** 正規化ノイズ値検証スキーマ */
export const ValidNormalizedNoiseValueSchema = Schema.Number.pipe(
  Schema.between(NOISE_RANGE.NORMALIZED_MIN, NOISE_RANGE.NORMALIZED_MAX),
  Schema.annotations({
    title: 'Valid Normalized Noise Value',
    description: `Normalized noise value between ${NOISE_RANGE.NORMALIZED_MIN} and ${NOISE_RANGE.NORMALIZED_MAX}`,
  })
)

/** 温度値検証スキーマ */
export const ValidTemperatureSchema = Schema.Number.pipe(
  Schema.between(CLIMATE.TEMPERATURE.MIN, CLIMATE.TEMPERATURE.MAX),
  Schema.annotations({
    title: 'Valid Temperature',
    description: `Temperature value between ${CLIMATE.TEMPERATURE.MIN} and ${CLIMATE.TEMPERATURE.MAX}`,
  })
)

/** 湿度値検証スキーマ */
export const ValidHumiditySchema = Schema.Number.pipe(
  Schema.between(CLIMATE.HUMIDITY.MIN, CLIMATE.HUMIDITY.MAX),
  Schema.annotations({
    title: 'Valid Humidity',
    description: `Humidity value between ${CLIMATE.HUMIDITY.MIN} and ${CLIMATE.HUMIDITY.MAX}`,
  })
)