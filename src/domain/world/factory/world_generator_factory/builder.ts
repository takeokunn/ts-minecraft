/**
 * @fileoverview WorldGeneratorBuilder - Fluent API Builder Pattern
 *
 * WorldGeneratorの段階的構築を提供するBuilderパターン実装です。
 * 複雑な設定プロセスを直感的で型安全なAPIに抽象化します。
 *
 * ## 特徴
 * - Fluent API による宣言的な設定
 * - 型安全な段階的構築
 * - 設定検証の自動化
 * - デフォルト値の智的適用
 * - エラーハンドリングの一元化
 */

import type * as WorldGenerator from '@domain/world/aggregate/world_generator'
import * as BiomeProperties from '@domain/world/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import * as WorldSeed from '@domain/world/value_object/world_seed/index'
import { Effect } from 'effect'
import type { CreateWorldGeneratorParams, FactoryError, PresetType } from './index'

// ================================
// Deprecated Types (Use builder_state.ts)
// ================================

/**
 * @deprecated Use WorldGeneratorBuilderState from builder_state.ts
 */
interface BuilderState {
  readonly seed?: WorldSeed.WorldSeed
  readonly parameters?: GenerationParameters.GenerationParameters
  readonly biomeConfig?: BiomeProperties.BiomeConfiguration
  readonly noiseConfig?: NoiseConfiguration.NoiseConfiguration
  readonly maxConcurrentGenerations?: number
  readonly cacheSize?: number
  readonly enableStructures?: boolean
  readonly enableCaves?: boolean
  readonly enableOres?: boolean
  readonly qualityLevel?: 'fast' | 'balanced' | 'quality'
  readonly enableDebugMode?: boolean
  readonly logLevel?: 'error' | 'warn' | 'info' | 'debug'
}

/**
 * @deprecated Use ValidationState from builder_state.ts
 */
interface ValidationState {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

// ================================
// WorldGeneratorBuilder Interface
// ================================

export interface WorldGeneratorBuilder {
  // 基本設定
  readonly withSeed: (seed: WorldSeed.WorldSeed | string | number) => WorldGeneratorBuilder
  readonly withRandomSeed: () => WorldGeneratorBuilder

  // 生成パラメータ設定
  readonly withParameters: (parameters: GenerationParameters.GenerationParameters) => WorldGeneratorBuilder
  readonly withDefaultParameters: () => WorldGeneratorBuilder

  // バイオーム設定
  readonly withBiomeConfig: (config: BiomeProperties.BiomeConfiguration) => WorldGeneratorBuilder
  readonly withDefaultBiomes: () => WorldGeneratorBuilder

  // ノイズ設定
  readonly withNoiseConfig: (config: NoiseConfiguration.NoiseConfiguration) => WorldGeneratorBuilder
  readonly withDefaultNoise: () => WorldGeneratorBuilder

  // パフォーマンス設定
  readonly withMaxConcurrentGenerations: (count: number) => WorldGeneratorBuilder
  readonly withCacheSize: (size: number) => WorldGeneratorBuilder

  // 機能設定
  readonly enableStructures: (enable?: boolean) => WorldGeneratorBuilder
  readonly enableCaves: (enable?: boolean) => WorldGeneratorBuilder
  readonly enableOres: (enable?: boolean) => WorldGeneratorBuilder

  // 品質設定
  readonly withQualityLevel: (level: 'fast' | 'balanced' | 'quality') => WorldGeneratorBuilder

  // デバッグ設定
  readonly enableDebugMode: (enable?: boolean) => WorldGeneratorBuilder
  readonly withLogLevel: (level: 'error' | 'warn' | 'info' | 'debug') => WorldGeneratorBuilder

  // プリセット適用
  readonly applyPreset: (preset: PresetType) => WorldGeneratorBuilder

  // 高レベル設定
  readonly optimizeForPerformance: () => WorldGeneratorBuilder
  readonly optimizeForQuality: () => WorldGeneratorBuilder
  readonly optimizeForDevelopment: () => WorldGeneratorBuilder

  // 条件設定
  readonly when: (
    condition: boolean,
    configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
  ) => WorldGeneratorBuilder
  readonly unless: (
    condition: boolean,
    configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
  ) => WorldGeneratorBuilder

  // 検証
  readonly validate: () => Effect.Effect<ValidationState, FactoryError>
  readonly isValid: () => Effect.Effect<boolean, FactoryError>

  // 構築
  readonly build: () => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>
  readonly buildWithDefaults: () => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>
  readonly buildParams: () => Effect.Effect<CreateWorldGeneratorParams, FactoryError>

  // 状態取得
  readonly getState: () => BuilderState
  readonly clone: () => WorldGeneratorBuilder
  readonly reset: () => WorldGeneratorBuilder
}

// ================================
// Deprecated Class Implementation
// ================================

/**
 * @deprecated Use builder_functions.ts with pipe pattern instead
 *
 * This class is kept for backward compatibility but will be removed in future versions.
 * Migration example:
 *
 * Before:
 *   const generator = createBuilder().withSeed(seed).withParams(params).build()
 *
 * After:
 *   const generator = pipe(
 *     initialWorldGeneratorBuilderState,
 *     (state) => withSeed(state, seed),
 *     (state) => withParameters(state, params),
 *     buildWorldGenerator
 *   )
 */
class WorldGeneratorBuilderImpl implements WorldGeneratorBuilder {
  constructor(private readonly state: BuilderState = {}) {}

  withSeed(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withRandomSeed(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withParameters(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withDefaultParameters(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withBiomeConfig(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withDefaultBiomes(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withNoiseConfig(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withDefaultNoise(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withMaxConcurrentGenerations(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withCacheSize(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  enableStructures(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  enableCaves(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  enableOres(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withQualityLevel(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  enableDebugMode(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  withLogLevel(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  applyPreset(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  optimizeForPerformance(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  optimizeForQuality(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  optimizeForDevelopment(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  when(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  unless(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  validate(): Effect.Effect<ValidationState, FactoryError> {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  isValid(): Effect.Effect<boolean, FactoryError> {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  build(): Effect.Effect<WorldGenerator.WorldGenerator, FactoryError> {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  buildWithDefaults(): Effect.Effect<WorldGenerator.WorldGenerator, FactoryError> {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  buildParams(): Effect.Effect<CreateWorldGeneratorParams, FactoryError> {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  getState(): BuilderState {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  clone(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }

  reset(): WorldGeneratorBuilder {
    throw new Error(
      'WorldGeneratorBuilderImpl is deprecated. Use builder_functions.ts with pipe pattern. See builder.ts for migration example.'
    )
  }
}

// ================================
// Deprecated Factory Functions
// ================================

/**
 * @deprecated Use builder_functions.ts with initialWorldGeneratorBuilderState instead
 */
export const createBuilder = (): WorldGeneratorBuilder => new WorldGeneratorBuilderImpl()

/**
 * @deprecated Use builder_functions.ts with initialWorldGeneratorBuilderState and spread params instead
 */
export const createBuilderFromParams = (params: CreateWorldGeneratorParams): WorldGeneratorBuilder =>
  new WorldGeneratorBuilderImpl(params)

/**
 * @deprecated Use builder_functions.ts with initialWorldGeneratorBuilderState and spread generator.context instead
 */
export const createBuilderFromGenerator = (generator: WorldGenerator.WorldGenerator): WorldGeneratorBuilder =>
  new WorldGeneratorBuilderImpl({
    seed: generator.context.seed,
    parameters: generator.context.parameters,
    biomeConfig: generator.context.biomeConfig,
    noiseConfig: generator.context.noiseConfig,
  })

/**
 * @deprecated Use applyPreset function from builder_functions.ts instead
 */
export const createBuilderFromPreset = (preset: PresetType): WorldGeneratorBuilder =>
  createBuilder().applyPreset(preset)

// ================================
// Deprecated Common Builder Patterns
// ================================

/**
 * @deprecated Use optimizeForPerformance and enableDebugMode functions from builder_functions.ts instead
 */
export const createFastBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForPerformance().enableDebugMode().withLogLevel('debug')

/**
 * @deprecated Use optimizeForQuality and feature enable functions from builder_functions.ts instead
 */
export const createQualityBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForQuality().enableStructures().enableCaves().enableOres()

/**
 * @deprecated Use applyPreset('default') and feature enable functions from builder_functions.ts instead
 */
export const createBalancedBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForBalance().enableStructures().enableCaves().enableOres()

/**
 * @deprecated Use pipe with configureFn from builder_functions.ts instead
 */
export const createCustomBuilder = (
  configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
): WorldGeneratorBuilder => configureFn(createBuilder())

// ================================
// Exports
// ================================

export { type BuilderState, type ValidationState, type WorldGeneratorBuilder }
