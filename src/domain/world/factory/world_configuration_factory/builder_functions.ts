import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/config/generation_parameters.js'
import * as NoiseConfiguration from '@domain/world/config/noise_configuration.js'
import * as WorldSeed from '@domain/world/config/world_seed.js'
import * as Effect from 'effect/Effect'
import type { WorldConfigurationBuilderState } from './builder_state.js'
import type { ConfigurationFactoryError } from './errors.js'
import { createDefaultConfiguration } from './factory.js'
import type { WorldConfiguration } from './types.js'

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
  metadata: Record<string, unknown>
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
