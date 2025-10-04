/**
 * @fileoverview Noise Constants
 * ノイズ生成アルゴリズムの定数とパラメータ
 */

import { Schema } from 'effect'

// === ノイズアルゴリズム定数 ===

/** Perlinノイズ設定 */
export const PERLIN_NOISE_SETTINGS = {
  /** デフォルト設定 */
  DEFAULT: {
    octaves: 4,
    amplitude: 1.0,
    frequency: 0.01,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 100.0,
  },
  /** 地形用設定 */
  TERRAIN: {
    octaves: 6,
    amplitude: 64.0,
    frequency: 0.005,
    persistence: 0.6,
    lacunarity: 2.0,
    scale: 200.0,
  },
  /** 洞窟用設定 */
  CAVES: {
    octaves: 3,
    amplitude: 1.0,
    frequency: 0.02,
    persistence: 0.4,
    lacunarity: 2.5,
    scale: 50.0,
  },
  /** 鉱石分布用設定 */
  ORES: {
    octaves: 2,
    amplitude: 1.0,
    frequency: 0.03,
    persistence: 0.3,
    lacunarity: 3.0,
    scale: 30.0,
  },
} as const

/** Simplexノイズ設定 */
export const SIMPLEX_NOISE_SETTINGS = {
  /** デフォルト設定 */
  DEFAULT: {
    scale: 0.01,
    amplitude: 1.0,
    octaves: 1,
  },
  /** バイオーム用設定 */
  BIOME: {
    temperature: {
      scale: 0.005,
      amplitude: 1.0,
      octaves: 2,
    },
    humidity: {
      scale: 0.005,
      amplitude: 1.0,
      octaves: 2,
    },
    continentalness: {
      scale: 0.002,
      amplitude: 1.0,
      octaves: 3,
    },
    erosion: {
      scale: 0.003,
      amplitude: 1.0,
      octaves: 2,
    },
    depth: {
      scale: 0.004,
      amplitude: 1.0,
      octaves: 2,
    },
    weirdness: {
      scale: 0.002,
      amplitude: 1.0,
      octaves: 3,
    },
  },
} as const

/** Ridgedノイズ設定 */
export const RIDGED_NOISE_SETTINGS = {
  /** デフォルト設定 */
  DEFAULT: {
    octaves: 4,
    frequency: 0.01,
    lacunarity: 2.0,
    gain: 0.5,
    offset: 1.0,
  },
  /** 山脈用設定 */
  RIDGES: {
    octaves: 6,
    frequency: 0.008,
    lacunarity: 2.2,
    gain: 0.4,
    offset: 0.8,
  },
} as const

// === ノイズ結合定数 ===

/** ノイズ演算タイプ */
export const NOISE_OPERATIONS = {
  ADD: 'add',
  SUBTRACT: 'subtract',
  MULTIPLY: 'multiply',
  DIVIDE: 'divide',
  MIN: 'min',
  MAX: 'max',
  AVERAGE: 'average',
  POWER: 'power',
  ABS: 'abs',
  INVERT: 'invert',
} as const

/** ノイズフィルタ */
export const NOISE_FILTERS = {
  /** 平滑化フィルタ */
  SMOOTH: {
    radius: 1,
    weight: 0.8,
  },
  /** エッジ検出フィルタ */
  EDGE: {
    threshold: 0.1,
    factor: 2.0,
  },
  /** コントラスト調整 */
  CONTRAST: {
    factor: 1.5,
    midpoint: 0.5,
  },
  /** ガンマ補正 */
  GAMMA: {
    gamma: 2.2,
  },
} as const

// === ノイズサンプリング定数 ===

/** サンプリング設定 */
export const SAMPLING_SETTINGS = {
  /** 2Dサンプリング */
  SAMPLING_2D: {
    step: 1.0,
    interpolation: 'linear',
  },
  /** 3Dサンプリング */
  SAMPLING_3D: {
    step: 1.0,
    interpolation: 'trilinear',
  },
  /** 補間タイプ */
  INTERPOLATION_TYPES: {
    NEAREST: 'nearest',
    LINEAR: 'linear',
    CUBIC: 'cubic',
    HERMITE: 'hermite',
  },
} as const

// === ノイズ最適化定数 ===

/** パフォーマンス設定 */
export const NOISE_PERFORMANCE = {
  /** キャッシュ設定 */
  CACHE: {
    enabled: true,
    maxSize: 1000,
    ttl: 60000, // 1分
  },
  /** 並列化設定 */
  PARALLEL: {
    enabled: true,
    threadCount: 4,
    chunkSize: 16,
  },
  /** メモリ制限 */
  MEMORY: {
    maxUsage: 128 * 1024 * 1024, // 128MB
    gcThreshold: 0.8,
  },
} as const

// === ノイズ品質設定 ===

/** 品質レベル */
export const NOISE_QUALITY = {
  /** 低品質（高速） */
  LOW: {
    octaves: 2,
    sampleRate: 0.5,
    interpolation: 'linear',
  },
  /** 中品質（標準） */
  MEDIUM: {
    octaves: 4,
    sampleRate: 1.0,
    interpolation: 'cubic',
  },
  /** 高品質（低速） */
  HIGH: {
    octaves: 8,
    sampleRate: 2.0,
    interpolation: 'hermite',
  },
} as const

// === シード関連定数 ===

/** シード設定 */
export const NOISE_SEED_SETTINGS = {
  /** デフォルトシード */
  DEFAULT_SEED: 0,
  /** 最小シード値 */
  MIN_SEED: -2147483648,
  /** 最大シード値 */
  MAX_SEED: 2147483647,
  /** シードハッシュ定数 */
  HASH_CONSTANTS: {
    PRIME_1: 73856093,
    PRIME_2: 19349663,
    PRIME_3: 83492791,
  },
} as const

// === 次元別ノイズ設定 ===

/** 次元別設定 */
export const DIMENSION_NOISE_SETTINGS = {
  /** オーバーワールド */
  OVERWORLD: {
    temperature: SIMPLEX_NOISE_SETTINGS.BIOME.temperature,
    humidity: SIMPLEX_NOISE_SETTINGS.BIOME.humidity,
    continentalness: SIMPLEX_NOISE_SETTINGS.BIOME.continentalness,
    erosion: SIMPLEX_NOISE_SETTINGS.BIOME.erosion,
    depth: SIMPLEX_NOISE_SETTINGS.BIOME.depth,
    weirdness: SIMPLEX_NOISE_SETTINGS.BIOME.weirdness,
    terrain: PERLIN_NOISE_SETTINGS.TERRAIN,
  },
  /** ネザー */
  NETHER: {
    terrain: {
      octaves: 4,
      amplitude: 32.0,
      frequency: 0.01,
      persistence: 0.5,
      lacunarity: 2.0,
    },
    temperature: {
      scale: 0.008,
      amplitude: 1.0,
    },
  },
  /** エンド */
  END: {
    terrain: {
      octaves: 8,
      amplitude: 16.0,
      frequency: 0.02,
      persistence: 0.6,
      lacunarity: 1.8,
    },
    density: {
      scale: 0.015,
      amplitude: 1.0,
    },
  },
} as const

// === ノイズ定数統合型 ===

export const NOISE_CONSTANTS = {
  PERLIN: PERLIN_NOISE_SETTINGS,
  SIMPLEX: SIMPLEX_NOISE_SETTINGS,
  RIDGED: RIDGED_NOISE_SETTINGS,
  OPERATIONS: NOISE_OPERATIONS,
  FILTERS: NOISE_FILTERS,
  SAMPLING: SAMPLING_SETTINGS,
  PERFORMANCE: NOISE_PERFORMANCE,
  QUALITY: NOISE_QUALITY,
  SEED: NOISE_SEED_SETTINGS,
  DIMENSIONS: DIMENSION_NOISE_SETTINGS,
} as const

// === 検証用スキーマ ===

/** オクターブ数検証スキーマ */
export const ValidOctavesSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 16),
  Schema.annotations({
    title: 'Valid Octaves',
    description: 'Number of noise octaves between 1 and 16',
  })
)

/** 振幅検証スキーマ */
export const ValidAmplitudeSchema = Schema.Number.pipe(
  Schema.between(0.0, 1000.0),
  Schema.annotations({
    title: 'Valid Amplitude',
    description: 'Noise amplitude between 0.0 and 1000.0',
  })
)

/** 周波数検証スキーマ */
export const ValidFrequencySchema = Schema.Number.pipe(
  Schema.between(0.0001, 1.0),
  Schema.annotations({
    title: 'Valid Frequency',
    description: 'Noise frequency between 0.0001 and 1.0',
  })
)

/** 持続性検証スキーマ */
export const ValidPersistenceSchema = Schema.Number.pipe(
  Schema.between(0.0, 1.0),
  Schema.annotations({
    title: 'Valid Persistence',
    description: 'Noise persistence between 0.0 and 1.0',
  })
)

/** 空隙性検証スキーマ */
export const ValidLacunaritySchema = Schema.Number.pipe(
  Schema.between(1.0, 10.0),
  Schema.annotations({
    title: 'Valid Lacunarity',
    description: 'Noise lacunarity between 1.0 and 10.0',
  })
)

/** スケール検証スキーマ */
export const ValidNoiseScaleSchema = Schema.Number.pipe(
  Schema.between(0.0001, 10000.0),
  Schema.annotations({
    title: 'Valid Noise Scale',
    description: 'Noise scale between 0.0001 and 10000.0',
  })
)

/** シード値検証スキーマ */
export const ValidSeedSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(NOISE_SEED_SETTINGS.MIN_SEED, NOISE_SEED_SETTINGS.MAX_SEED),
  Schema.annotations({
    title: 'Valid Seed',
    description: `Seed value between ${NOISE_SEED_SETTINGS.MIN_SEED} and ${NOISE_SEED_SETTINGS.MAX_SEED}`,
  })
)

/** ノイズ演算タイプ検証スキーマ */
export const ValidNoiseOperationSchema = Schema.Literal(
  ...Object.values(NOISE_OPERATIONS)
).pipe(
  Schema.annotations({
    title: 'Valid Noise Operation',
    description: 'A valid noise operation type',
  })
)

/** 補間タイプ検証スキーマ */
export const ValidInterpolationTypeSchema = Schema.Literal(
  ...Object.values(SAMPLING_SETTINGS.INTERPOLATION_TYPES)
).pipe(
  Schema.annotations({
    title: 'Valid Interpolation Type',
    description: 'A valid interpolation type',
  })
)