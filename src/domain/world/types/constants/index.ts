/**
 * @fileoverview Constants Export Module for World Domain
 * 定数の統合エクスポート
 */

export * from './world_constants'
export * from './generation_constants'
export * from './biome_constants'
export * from './noise_constants'

// 個別定数オブジェクトの再エクスポート
export { WORLD_CONSTANTS } from './world_constants'
export { GENERATION_CONSTANTS } from './generation_constants'
export { BIOME_CONSTANTS } from './biome_constants'
export { NOISE_CONSTANTS } from './noise_constants'

// 統合定数オブジェクト
import { WORLD_CONSTANTS } from './world_constants'
import { GENERATION_CONSTANTS } from './generation_constants'
import { BIOME_CONSTANTS } from './biome_constants'
import { NOISE_CONSTANTS } from './noise_constants'

export const WORLD_DOMAIN_CONSTANTS = {
  WORLD: WORLD_CONSTANTS,
  GENERATION: GENERATION_CONSTANTS,
  BIOME: BIOME_CONSTANTS,
  NOISE: NOISE_CONSTANTS,
} as const

// 検証スキーマの統合エクスポート
export {
  ValidHeightSchema,
  ValidChunkCoordinateSchema,
  ValidWorldCoordinateSchema,
} from './world_constants'

export {
  ValidNoiseValueSchema,
  ValidNormalizedNoiseValueSchema,
  ValidTemperatureSchema,
  ValidHumiditySchema,
} from './generation_constants'

export {
  ValidBiomeIdSchema,
  ValidBiomeCategorySchema,
  ValidPrecipitationTypeSchema,
  ValidBiomeTemperatureSchema,
  ValidBiomeHumiditySchema,
} from './biome_constants'

export {
  ValidOctavesSchema,
  ValidAmplitudeSchema,
  ValidFrequencySchema,
  ValidPersistenceSchema,
  ValidLacunaritySchema,
  ValidNoiseScaleSchema,
  ValidSeedSchema,
  ValidNoiseOperationSchema,
  ValidInterpolationTypeSchema,
} from './noise_constants'