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

import { Effect, Function, Match } from 'effect'
import type * as WorldGenerator from '../../aggregate/world_generator/world_generator.js'
import * as BiomeProperties from '../../value_object/biome_properties/index.js'
import * as GenerationParameters from '../../value_object/generation_parameters/index.js'
import * as NoiseConfiguration from '../../value_object/noise_configuration/index.js'
import * as WorldSeed from '../../value_object/world_seed/index.js'
import type { CreateWorldGeneratorParams, FactoryError, PresetType } from './factory.js'

// ================================
// Builder State Management
// ================================

/**
 * Builder状態インターフェース
 * 各設定段階での型安全性を保証
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
 * Builder検証状態
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
// Builder Implementation
// ================================

class WorldGeneratorBuilderImpl implements WorldGeneratorBuilder {
  constructor(private readonly state: BuilderState = {}) {}

  // 基本設定
  withSeed(seed: WorldSeed.WorldSeed | string | number): WorldGeneratorBuilder {
    const resolvedSeed = Function.pipe(
      Match.type<WorldSeed.WorldSeed | string | number>(),
      Match.when(Match.string, (s) => WorldSeed.createFromString(s)),
      Match.when(Match.number, (n) => WorldSeed.createFromNumber(n)),
      Match.orElse((seed) => seed as WorldSeed.WorldSeed)
    )(seed)

    return new WorldGeneratorBuilderImpl({
      ...this.state,
      seed: resolvedSeed,
    })
  }

  withRandomSeed(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      seed: WorldSeed.createRandom(),
    })
  }

  // 生成パラメータ設定
  withParameters(parameters: GenerationParameters.GenerationParameters): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      parameters,
    })
  }

  withDefaultParameters(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      parameters: GenerationParameters.createDefault(),
    })
  }

  // バイオーム設定
  withBiomeConfig(config: BiomeProperties.BiomeConfiguration): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      biomeConfig: config,
    })
  }

  withDefaultBiomes(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      biomeConfig: BiomeProperties.createDefaultConfiguration(),
    })
  }

  // ノイズ設定
  withNoiseConfig(config: NoiseConfiguration.NoiseConfiguration): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      noiseConfig: config,
    })
  }

  withDefaultNoise(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      noiseConfig: NoiseConfiguration.createDefault(),
    })
  }

  // パフォーマンス設定
  withMaxConcurrentGenerations(count: number): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      maxConcurrentGenerations: Math.max(1, Math.min(16, count)),
    })
  }

  withCacheSize(size: number): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      cacheSize: Math.max(100, Math.min(10000, size)),
    })
  }

  // 機能設定
  enableStructures(enable = true): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      enableStructures: enable,
    })
  }

  enableCaves(enable = true): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      enableCaves: enable,
    })
  }

  enableOres(enable = true): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      enableOres: enable,
    })
  }

  // 品質設定
  withQualityLevel(level: 'fast' | 'balanced' | 'quality'): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      qualityLevel: level,
    })
  }

  // デバッグ設定
  enableDebugMode(enable = true): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      enableDebugMode: enable,
    })
  }

  withLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      logLevel: level,
    })
  }

  // プリセット適用
  applyPreset(preset: PresetType): WorldGeneratorBuilder {
    const presetConfig = Function.pipe(
      Match.value(preset),
      Match.when('default', () => this.optimizeForBalance()),
      Match.when('survival', () => this.optimizeForQuality()),
      Match.when('creative', () => this.optimizeForPerformance().enableStructures(false)),
      Match.when('peaceful', () => this.optimizeForBalance().enableStructures(false)),
      Match.when('hardcore', () => this.optimizeForQuality().withMaxConcurrentGenerations(1)),
      Match.when('superflat', () => this.optimizeForPerformance().disableAllFeatures()),
      Match.when('amplified', () => this.optimizeForQuality()),
      Match.when('debug', () => this.optimizeForDevelopment()),
      Match.when('custom', () => this),
      Match.when('experimental', () => this.optimizeForQuality().enableDebugMode()),
      Match.orElse(() => this)
    )

    return presetConfig
  }

  // 高レベル設定
  optimizeForPerformance(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      qualityLevel: 'fast',
      maxConcurrentGenerations: 8,
      cacheSize: 2000,
      enableDebugMode: false,
    })
  }

  optimizeForQuality(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      qualityLevel: 'quality',
      maxConcurrentGenerations: 2,
      cacheSize: 5000,
      enableDebugMode: false,
    })
  }

  optimizeForDevelopment(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      qualityLevel: 'fast',
      maxConcurrentGenerations: 4,
      cacheSize: 1000,
      enableDebugMode: true,
      logLevel: 'debug',
    })
  }

  // 内部ヘルパー
  private optimizeForBalance(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      qualityLevel: 'balanced',
      maxConcurrentGenerations: 4,
      cacheSize: 1000,
      enableDebugMode: false,
    })
  }

  private disableAllFeatures(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({
      ...this.state,
      enableStructures: false,
      enableCaves: false,
      enableOres: false,
    })
  }

  // 条件設定
  when(
    condition: boolean,
    configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
  ): WorldGeneratorBuilder {
    return condition ? configureFn(this) : this
  }

  unless(
    condition: boolean,
    configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
  ): WorldGeneratorBuilder {
    return !condition ? configureFn(this) : this
  }

  // 検証
  validate(): Effect.Effect<ValidationState, FactoryError> {
    return Effect.gen(
      function* () {
        const errors: string[] = []
        const warnings: string[] = []

        // 必須設定のチェック
        if (!this.state.seed) {
          warnings.push('No seed specified, random seed will be generated')
        }

        // パフォーマンス設定の妥当性チェック
        if (this.state.maxConcurrentGenerations && this.state.maxConcurrentGenerations > 8) {
          warnings.push('High concurrent generation count may impact performance')
        }

        if (this.state.cacheSize && this.state.cacheSize > 5000) {
          warnings.push('Large cache size may consume significant memory')
        }

        // 設定の整合性チェック
        if (this.state.qualityLevel === 'fast' && this.state.maxConcurrentGenerations === 1) {
          warnings.push('Fast quality with single thread may not be optimal')
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
        }
      }.bind(this)
    )
  }

  isValid(): Effect.Effect<boolean, FactoryError> {
    return Effect.map(this.validate(), (state) => state.isValid)
  }

  // 構築
  build(): Effect.Effect<WorldGenerator.WorldGenerator, FactoryError> {
    return Effect.gen(
      function* () {
        // 検証
        const validation = yield* this.validate()
        if (!validation.isValid) {
          return yield* Effect.fail(
            new FactoryError({
              category: 'parameter_validation',
              message: `Builder validation failed: ${validation.errors.join(', ')}`,
            })
          )
        }

        // パラメータ構築
        const params = yield* this.buildParams()

        // ファクトリを使用してWorldGenerator作成
        const { WorldGeneratorFactoryTag } = await import('./factory.js')
        const factory = yield* Effect.service(WorldGeneratorFactoryTag)

        return yield* factory.create(params)
      }.bind(this)
    )
  }

  buildWithDefaults(): Effect.Effect<WorldGenerator.WorldGenerator, FactoryError> {
    return this.withRandomSeed()
      .withDefaultParameters()
      .withDefaultBiomes()
      .withDefaultNoise()
      .optimizeForBalance()
      .build()
  }

  buildParams(): Effect.Effect<CreateWorldGeneratorParams, FactoryError> {
    return Effect.succeed({
      seed: this.state.seed,
      parameters: this.state.parameters,
      biomeConfig: this.state.biomeConfig,
      noiseConfig: this.state.noiseConfig,
      maxConcurrentGenerations: this.state.maxConcurrentGenerations,
      cacheSize: this.state.cacheSize,
      enableStructures: this.state.enableStructures,
      enableCaves: this.state.enableCaves,
      enableOres: this.state.enableOres,
      qualityLevel: this.state.qualityLevel,
      enableDebugMode: this.state.enableDebugMode,
      logLevel: this.state.logLevel,
    })
  }

  // 状態管理
  getState(): BuilderState {
    return { ...this.state }
  }

  clone(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({ ...this.state })
  }

  reset(): WorldGeneratorBuilder {
    return new WorldGeneratorBuilderImpl({})
  }
}

// ================================
// Factory Functions
// ================================

/**
 * 新しいWorldGeneratorBuilder作成
 */
export const createBuilder = (): WorldGeneratorBuilder => new WorldGeneratorBuilderImpl()

/**
 * 既存設定から新しいBuilder作成
 */
export const createBuilderFromParams = (params: CreateWorldGeneratorParams): WorldGeneratorBuilder =>
  new WorldGeneratorBuilderImpl(params)

/**
 * 既存WorldGeneratorから新しいBuilder作成
 */
export const createBuilderFromGenerator = (generator: WorldGenerator.WorldGenerator): WorldGeneratorBuilder =>
  new WorldGeneratorBuilderImpl({
    seed: generator.context.seed,
    parameters: generator.context.parameters,
    biomeConfig: generator.context.biomeConfig,
    noiseConfig: generator.context.noiseConfig,
  })

/**
 * プリセットから事前設定されたBuilder作成
 */
export const createBuilderFromPreset = (preset: PresetType): WorldGeneratorBuilder =>
  createBuilder().applyPreset(preset)

// ================================
// Common Builder Patterns
// ================================

/**
 * 開発者向け高速設定Builder
 */
export const createFastBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForPerformance().enableDebugMode().withLogLevel('debug')

/**
 * 品質重視Builder
 */
export const createQualityBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForQuality().enableStructures().enableCaves().enableOres()

/**
 * バランス型Builder
 */
export const createBalancedBuilder = (): WorldGeneratorBuilder =>
  createBuilder().optimizeForBalance().enableStructures().enableCaves().enableOres()

/**
 * カスタム設定Builder
 */
export const createCustomBuilder = (
  configureFn: (builder: WorldGeneratorBuilder) => WorldGeneratorBuilder
): WorldGeneratorBuilder => configureFn(createBuilder())

// ================================
// Exports
// ================================

export { type BuilderState, type ValidationState, type WorldGeneratorBuilder }
