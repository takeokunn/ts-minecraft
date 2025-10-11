import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/config/generation_parameters.js'
import * as NoiseConfiguration from '@domain/world/config/noise_configuration.js'
import * as WorldSeed from '@domain/world/config/world_seed.js'
import * as Schema from '@effect/schema/Schema'

import { JsonValueSchema } from '@/shared/schema/json'

/**
 * WorldConfigurationBuilder状態スキーマ
 * 全フィールドはoptionalで初期状態は空オブジェクト
 */
export const WorldConfigurationBuilderStateSchema = Schema.Struct({
  seed: Schema.optional(WorldSeed.WorldSeedSchema),
  parameters: Schema.optional(GenerationParameters.GenerationParametersSchema),
  biomeConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.NoiseConfigurationSchema),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: JsonValueSchema })),
})

export type WorldConfigurationBuilderState = Schema.Schema.Type<typeof WorldConfigurationBuilderStateSchema>

/**
 * 初期状態（空オブジェクト）
 */
export const initialWorldConfigurationBuilderState: WorldConfigurationBuilderState = {}
