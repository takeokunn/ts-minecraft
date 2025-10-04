/**
 * @fileoverview World Constants
 * 世界生成と管理に関する基本定数
 */

import { Schema } from 'effect'

// === 世界サイズ定数 ===

/** 世界の高度制限 */
export const WORLD_HEIGHT = {
  /** 最小高度（基盤岩レベル） */
  MIN: 0,
  /** 最大高度（建築制限） */
  MAX: 256,
  /** 海面レベル */
  SEA_LEVEL: 64,
  /** 雲レベル */
  CLOUD_LEVEL: 128,
  /** 基盤岩厚さ */
  BEDROCK_THICKNESS: 5,
} as const

/** チャンクサイズ定数 */
export const CHUNK_SIZE = {
  /** X軸サイズ（幅） */
  X: 16,
  /** Z軸サイズ（奥行き） */
  Z: 16,
  /** Y軸サイズ（高さ） */
  Y: 256,
  /** チャンク内ブロック総数 */
  TOTAL_BLOCKS: 16 * 16 * 256,
} as const

/** セクション関連定数 */
export const SECTION_SIZE = {
  /** セクションの高さ */
  HEIGHT: 16,
  /** Y軸方向のセクション数 */
  COUNT_Y: WORLD_HEIGHT.MAX / 16,
  /** セクション内ブロック数 */
  BLOCKS_PER_SECTION: 16 * 16 * 16,
} as const

// === 世界境界定数 ===

/** 世界境界の制限 */
export const WORLD_BORDER = {
  /** デフォルト境界サイズ */
  DEFAULT_SIZE: 60_000_000,
  /** 最大境界サイズ */
  MAX_SIZE: 60_000_000,
  /** 最小境界サイズ */
  MIN_SIZE: 1,
  /** 境界ダメージ開始距離 */
  DAMAGE_BUFFER: 5,
  /** 境界ダメージ量（ハート/秒） */
  DAMAGE_AMOUNT: 0.2,
} as const

// === パフォーマンス関連定数 ===

/** 描画距離関連 */
export const RENDER_DISTANCE = {
  /** デフォルト描画距離（チャンク） */
  DEFAULT: 10,
  /** 最小描画距離 */
  MIN: 2,
  /** 最大描画距離 */
  MAX: 32,
  /** シミュレーション距離 */
  SIMULATION: 10,
} as const

/** チャンク読み込み関連 */
export const CHUNK_LOADING = {
  /** 同時読み込み可能チャンク数 */
  MAX_CONCURRENT: 16,
  /** チャンクキャッシュサイズ */
  CACHE_SIZE: 256,
  /** アンロード遅延時間（ms） */
  UNLOAD_DELAY: 30_000,
  /** 読み込み優先度更新間隔（ms） */
  PRIORITY_UPDATE_INTERVAL: 1_000,
} as const

// === 物理法則定数 ===

/** 重力と物理 */
export const PHYSICS = {
  /** 重力加速度（ブロック/秒²） */
  GRAVITY: 32.0,
  /** 終端速度（ブロック/秒） */
  TERMINAL_VELOCITY: 78.4,
  /** 水中抵抗係数 */
  WATER_RESISTANCE: 0.8,
  /** 溶岩抵抗係数 */
  LAVA_RESISTANCE: 0.5,
} as const

/** 光の伝播 */
export const LIGHT = {
  /** 最大光レベル */
  MAX_LEVEL: 15,
  /** 最小光レベル */
  MIN_LEVEL: 0,
  /** 日光の最大レベル */
  SUNLIGHT_MAX: 15,
  /** 光の減衰率 */
  DECAY_RATE: 1,
} as const

// === 時間関連定数 ===

/** ゲーム内時間 */
export const GAME_TIME = {
  /** 1日の長さ（ゲーム内tick） */
  DAY_LENGTH: 24_000,
  /** 昼の長さ（tick） */
  DAY_TIME: 12_000,
  /** 夜の長さ（tick） */
  NIGHT_TIME: 12_000,
  /** 1tickの実時間（ms） */
  TICK_DURATION: 50,
  /** 1秒のtick数 */
  TICKS_PER_SECOND: 20,
} as const

// === 世界定数統合型 ===

export const WORLD_CONSTANTS = {
  HEIGHT: WORLD_HEIGHT,
  CHUNK: CHUNK_SIZE,
  SECTION: SECTION_SIZE,
  BORDER: WORLD_BORDER,
  RENDER: RENDER_DISTANCE,
  LOADING: CHUNK_LOADING,
  PHYSICS,
  LIGHT,
  TIME: GAME_TIME,
} as const

// === Brand型スキーマ定数 ===

/** 高度値のスキーマ定数 */
export const HEIGHT_SCHEMA_CONSTANTS = {
  MIN: WORLD_HEIGHT.MIN,
  MAX: WORLD_HEIGHT.MAX,
  DEFAULT: WORLD_HEIGHT.SEA_LEVEL,
} as const

/** チャンク座標のスキーマ定数 */
export const CHUNK_COORDINATE_CONSTANTS = {
  MIN: -30_000_000,
  MAX: 30_000_000,
} as const

/** 世界座標のスキーマ定数 */
export const WORLD_COORDINATE_CONSTANTS = {
  MIN: CHUNK_COORDINATE_CONSTANTS.MIN * CHUNK_SIZE.X,
  MAX: CHUNK_COORDINATE_CONSTANTS.MAX * CHUNK_SIZE.X,
} as const

// === 検証用スキーマ ===

/** 高度値検証スキーマ */
export const ValidHeightSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(WORLD_HEIGHT.MIN, WORLD_HEIGHT.MAX),
  Schema.annotations({
    title: 'Valid Height',
    description: `World height value between ${WORLD_HEIGHT.MIN} and ${WORLD_HEIGHT.MAX}`,
  })
)

/** チャンク座標検証スキーマ */
export const ValidChunkCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(CHUNK_COORDINATE_CONSTANTS.MIN, CHUNK_COORDINATE_CONSTANTS.MAX),
  Schema.annotations({
    title: 'Valid Chunk Coordinate',
    description: `Chunk coordinate between ${CHUNK_COORDINATE_CONSTANTS.MIN} and ${CHUNK_COORDINATE_CONSTANTS.MAX}`,
  })
)

/** 世界座標検証スキーマ */
export const ValidWorldCoordinateSchema = Schema.Number.pipe(
  Schema.between(WORLD_COORDINATE_CONSTANTS.MIN, WORLD_COORDINATE_CONSTANTS.MAX),
  Schema.annotations({
    title: 'Valid World Coordinate',
    description: `World coordinate between ${WORLD_COORDINATE_CONSTANTS.MIN} and ${WORLD_COORDINATE_CONSTANTS.MAX}`,
  })
)
