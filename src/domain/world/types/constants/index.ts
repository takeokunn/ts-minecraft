/**
 * @fileoverview Constants Export Module for World Domain
 * 定数の統合エクスポート
 */

export * from './biome_constants'
export * from './generation_constants'
export * from './noise_constants'
export * from './world_constants'

// 個別定数オブジェクトの再エクスポート
export { BIOME_CONSTANTS } from './biome_constants'
export { GENERATION_CONSTANTS } from './generation_constants'
export { NOISE_CONSTANTS } from './noise_constants'
export { WORLD_CONSTANTS } from './world_constants'

// 統合定数オブジェクト
import { BIOME_CONSTANTS } from './biome_constants'
import { GENERATION_CONSTANTS } from './generation_constants'
import { NOISE_CONSTANTS } from './noise_constants'
import { WORLD_CONSTANTS } from './world_constants'

export const WORLD_DOMAIN_CONSTANTS = {
  WORLD: WORLD_CONSTANTS,
  GENERATION: GENERATION_CONSTANTS,
  BIOME: BIOME_CONSTANTS,
  NOISE: NOISE_CONSTANTS,
} as const

// 検証スキーマの統合エクスポート
export { ValidChunkCoordinateSchema, ValidHeightSchema, ValidWorldCoordinateSchema } from './world_constants'

export {
  ValidHumiditySchema,
  ValidNoiseValueSchema,
  ValidNormalizedNoiseValueSchema,
  ValidTemperatureSchema,
} from './generation_constants'

export {
  ValidBiomeCategorySchema,
  ValidBiomeHumiditySchema,
  ValidBiomeIdSchema,
  ValidBiomeTemperatureSchema,
  ValidPrecipitationTypeSchema,
} from './biome_constants'

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
} from './noise_constants'
