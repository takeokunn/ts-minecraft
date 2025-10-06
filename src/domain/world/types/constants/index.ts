/**
 * @fileoverview Constants Export Module for World Domain
 * 定数の統合エクスポート
 */

export * from './index'
export * from './index'
export * from './index'
export * from './index'

// 個別定数オブジェクトの再エクスポート
export { BIOME_CONSTANTS } from './index'
export { GENERATION_CONSTANTS } from './index'
export { NOISE_CONSTANTS } from './index'
export { WORLD_CONSTANTS } from './index'

// 統合定数オブジェクト
import { BIOME_CONSTANTS } from './index'
import { GENERATION_CONSTANTS } from './index'
import { NOISE_CONSTANTS } from './index'
import { WORLD_CONSTANTS } from './index'

export const WORLD_DOMAIN_CONSTANTS = {
  WORLD: WORLD_CONSTANTS,
  GENERATION: GENERATION_CONSTANTS,
  BIOME: BIOME_CONSTANTS,
  NOISE: NOISE_CONSTANTS,
} as const

// 検証スキーマの統合エクスポート
export { ValidChunkCoordinateSchema, ValidHeightSchema, ValidWorldCoordinateSchema } from './index'

export {
  ValidHumiditySchema,
  ValidNoiseValueSchema,
  ValidNormalizedNoiseValueSchema,
  ValidTemperatureSchema,
} from './index'

export {
  ValidBiomeCategorySchema,
  ValidBiomeHumiditySchema,
  ValidBiomeIdSchema,
  ValidBiomeTemperatureSchema,
  ValidPrecipitationTypeSchema,
} from './index'

export {
  ValidAmplitudeSchema,
  ValidFrequencySchema,
  ValidInterpolationTypeSchema,
  ValidLacunaritySchema,
  ValidNoiseOperationSchema,
  ValidNoiseScaleSchema,
  ValidOctavesSchema,
  ValidPersistenceSchema,
  ValidSeedSchema,
} from './index'
export * from './index';
export * from './index';
export * from './index';
