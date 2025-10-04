/**
 * WorldSeed Value Object - バレルエクスポート
 *
 * World生成システムの根幹となるシード値の完全な型安全実装
 * DDD原理主義 + Effect-TS 3.17+ による堅牢な設計
 */

// 型定義とSchema
export {
  type WorldSeed,
  type WorldSeedBrand,
  type EntropyLevel,
  type Timestamp,
  type CreateWorldSeedParams,
  type WorldSeedError,
  type SeedQuality,
  WorldSeedSchema,
  WorldSeedValueObjectSchema,
  EntropyLevelSchema,
  TimestampSchema,
  CreateWorldSeedParamsSchema,
  WorldSeedErrorSchema,
  SeedQualitySchema
} from './seed.js'

// 操作関数群
export {
  WorldSeedOps
} from './operations.js'

// 検証関数群
export {
  WorldSeedValidation,
  type ValidationResult,
  type ValidationOptions,
  ValidationResultSchema,
  ValidationOptionsSchema
} from './validation.js'

/**
 * 便利なファクトリ関数群
 */
export const WorldSeedFactory = {
  /**
   * 数値から作成
   */
  fromNumber: WorldSeedOps.fromNumber,

  /**
   * 文字列から作成
   */
  fromString: WorldSeedOps.fromString,

  /**
   * ランダム生成
   */
  random: WorldSeedOps.random,

  /**
   * タイムスタンプから生成
   */
  fromTimestamp: WorldSeedOps.fromTimestamp,

  /**
   * JSONから復元
   */
  fromJSON: WorldSeedOps.fromJSON
} as const

/**
 * 便利な定数
 */
export const WorldSeedConstants = {
  /**
   * デフォルトシード
   */
  DEFAULT: 0,

  /**
   * 最小値
   */
  MIN_VALUE: -2147483648,

  /**
   * 最大値
   */
  MAX_VALUE: 2147483647,

  /**
   * 品質しきい値
   */
  QUALITY_THRESHOLDS: {
    MINIMUM: 20,
    RECOMMENDED: 50,
    EXCELLENT: 80
  },

  /**
   * 一般的なテスト用シード
   */
  TEST_SEEDS: {
    SIMPLE: 12345,
    COMPLEX: 1985732486,
    NEGATIVE: -987654321,
    HIGH_ENTROPY: 1634582947
  }
} as const

/**
 * 型ガード
 */
export const WorldSeedTypeGuards = {
  /**
   * WorldSeedかどうかの判定
   */
  isWorldSeed: (value: unknown): value is WorldSeed => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'value' in value &&
      'timestamp' in value &&
      'entropy' in value &&
      typeof (value as any).value === 'number' &&
      typeof (value as any).timestamp === 'number' &&
      ['low', 'medium', 'high'].includes((value as any).entropy)
    )
  },

  /**
   * 有効なエントロピーレベルかどうかの判定
   */
  isValidEntropyLevel: (value: unknown): value is EntropyLevel => {
    return typeof value === 'string' && ['low', 'medium', 'high'].includes(value)
  }
} as const