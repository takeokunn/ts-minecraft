import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/config/generation_parameters'
import * as NoiseConfiguration from '@domain/world/config/noise_configuration'
import * as WorldSeed from '@domain/world/config/world_seed'
import type { JsonRecord } from '@shared/schema/json'
import * as Effect from 'effect/Effect'
import type { WorldConfigurationBuilderState } from './builder_state'
import type { ConfigurationFactoryError } from './errors'
import { createDefaultConfiguration } from './factory'
import type { WorldConfiguration } from './types'

/**
 * Seed設定関数
 */
export const withSeed = (
  state: WorldConfigurationBuilderState,
  seed: WorldSeed.WorldSeed
): WorldConfigurationBuilderState => ({
  ...state,
  seed,
})

/**
 * GenerationParameters設定関数
 */
export const withParameters = (
  state: WorldConfigurationBuilderState,
  params: GenerationParameters.GenerationParameters
): WorldConfigurationBuilderState => ({
  ...state,
  parameters: params,
})

/**
 * BiomeConfiguration設定関数
 */
export const withBiomeConfig = (
  state: WorldConfigurationBuilderState,
  config: BiomeProperties.BiomeConfiguration
): WorldConfigurationBuilderState => ({
  ...state,
  biomeConfig: config,
})

/**
 * NoiseConfiguration設定関数
 */
export const withNoiseConfig = (
  state: WorldConfigurationBuilderState,
  config: NoiseConfiguration.NoiseConfiguration
): WorldConfigurationBuilderState => ({
  ...state,
  noiseConfig: config,
})

/**
 * Metadata設定関数（マージ）
 */
export const withMetadata = (
  state: WorldConfigurationBuilderState,
  metadata: JsonRecord
): WorldConfigurationBuilderState => ({
  ...state,
  metadata: { ...state.metadata, ...metadata },
})

/**
 * Build関数 - デフォルト値の適用とWorldConfiguration生成
 */
export const build = (
  state: WorldConfigurationBuilderState
): Effect.Effect<WorldConfiguration, ConfigurationFactoryError> =>
  Effect.gen(function* () {
    const defaultConfig = yield* createDefaultConfiguration()

    return {
      seed: state.seed ?? defaultConfig.seed,
      parameters: state.parameters ?? defaultConfig.parameters,
      biomeConfig: state.biomeConfig ?? defaultConfig.biomeConfig,
      noiseConfig: state.noiseConfig ?? defaultConfig.noiseConfig,
      metadata: state.metadata,
    }
  })
