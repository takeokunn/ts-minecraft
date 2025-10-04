/**
 * @fileoverview Constants Export Module for World Domain
 * 定数の統合エクスポート
 */

export * from './world-constants'
export * from './generation-constants'
export * from './biome-constants'
export * from './noise-constants'

// 個別定数オブジェクトの再エクスポート
export { WORLD_CONSTANTS } from './world-constants'
export { GENERATION_CONSTANTS } from './generation-constants'
export { BIOME_CONSTANTS } from './biome-constants'
export { NOISE_CONSTANTS } from './noise-constants'

// 統合定数オブジェクト
import { WORLD_CONSTANTS } from './world-constants'
import { GENERATION_CONSTANTS } from './generation-constants'
import { BIOME_CONSTANTS } from './biome-constants'
import { NOISE_CONSTANTS } from './noise-constants'

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
} from './world-constants'

export {
  ValidNoiseValueSchema,
  ValidNormalizedNoiseValueSchema,
  ValidTemperatureSchema,
  ValidHumiditySchema,
} from './generation-constants'

export {
  ValidBiomeIdSchema,
  ValidBiomeCategorySchema,
  ValidPrecipitationTypeSchema,
  ValidBiomeTemperatureSchema,
  ValidBiomeHumiditySchema,
} from './biome-constants'

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
} from './noise-constants'