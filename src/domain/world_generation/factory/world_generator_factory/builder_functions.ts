/**
 * @fileoverview WorldGeneratorBuilder Pure Functions
 *
 * Builder操作を純粋関数として実装します。
 * クラスベースのBuilderパターンから関数型アプローチへの移行です。
 */

import * as WorldSeed from '@domain/shared/value_object/world_seed/index'
import * as BiomeProperties from '@domain/world/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import type * as WorldGenerator from '@domain/world_generation/aggregate/world_generator'
import { Effect, Function, Match } from 'effect'
import type { ValidationState, WorldGeneratorBuilderState } from './builder_state'
import type { CreateWorldGeneratorParams, FactoryError as FactoryErrorType, PresetType } from './factory'
import { FactoryError, WorldGeneratorFactoryTag } from './factory'

// ================================
// Basic Configuration Functions
// ================================

/**
 * シード値を設定
 *
 * WorldSeed、string、numberの3種類の入力を受け付けます。
 */
export const withSeed = (
  state: WorldGeneratorBuilderState,
  seed: WorldSeed.WorldSeed | string | number
): WorldGeneratorBuilderState => {
  const resolvedSeed = Function.pipe(
    Match.type<WorldSeed.WorldSeed | string | number>(),
    Match.when(Match.string, (s) => WorldSeed.createFromString(s)),
    Match.when(Match.number, (n) => WorldSeed.createFromNumber(n)),
    Match.orElse((seed) => seed satisfies WorldSeed.WorldSeed)
  )(seed)

  return {
    ...state,
    seed: resolvedSeed,
  }
}

/**
 * ランダムシード値を設定
 */
export const withRandomSeed = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  seed: WorldSeed.createRandom(),
})

// ================================
// Generation Parameters Functions
// ================================

/**
 * 生成パラメータを設定
 */
export const withParameters = (
  state: WorldGeneratorBuilderState,
  parameters: GenerationParameters.BiomeConfig
): WorldGeneratorBuilderState => ({
  ...state,
  parameters,
})

/**
 * デフォルト生成パラメータを設定
 */
export const withDefaultParameters = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  parameters: GenerationParameters.GenerationParametersFactory.createDefaultBiomeConfig('plains'),
})

// ================================
// Biome Configuration Functions
// ================================

/**
 * バイオーム設定を設定
 */
export const withBiomeConfig = (
  state: WorldGeneratorBuilderState,
  config: BiomeProperties.TemperatureRange
): WorldGeneratorBuilderState => ({
  ...state,
  biomeConfig: config,
})

/**
 * デフォルトバイオーム設定を設定
 */
export const withDefaultBiomes = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  biomeConfig: BiomeProperties.BiomePropertiesFactory.createTemperateForest().temperature,
})

// ================================
// Noise Configuration Functions
// ================================

/**
 * ノイズ設定を設定
 */
export const withNoiseConfig = (
  state: WorldGeneratorBuilderState,
  config: NoiseConfiguration.BasicNoiseSettings
): WorldGeneratorBuilderState => ({
  ...state,
  noiseConfig: config,
})

/**
 * デフォルトノイズ設定を設定
 */
export const withDefaultNoise = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  noiseConfig: NoiseConfiguration.NoiseConfigurationFactory.createTerrainNoise(),
})

// ================================
// Performance Configuration Functions
// ================================

/**
 * 最大同時生成数を設定（1-16の範囲に制限）
 */
export const withMaxConcurrentGenerations = (
  state: WorldGeneratorBuilderState,
  count: number
): WorldGeneratorBuilderState => ({
  ...state,
  maxConcurrentGenerations: Math.max(1, Math.min(16, count)),
})

/**
 * キャッシュサイズを設定（100-10000の範囲に制限）
 */
export const withCacheSize = (state: WorldGeneratorBuilderState, size: number): WorldGeneratorBuilderState => ({
  ...state,
  cacheSize: Math.max(100, Math.min(10000, size)),
})

// ================================
// Feature Configuration Functions
// ================================

/**
 * 構造物生成を有効化/無効化
 */
export const enableStructures = (state: WorldGeneratorBuilderState, enable = true): WorldGeneratorBuilderState => ({
  ...state,
  enableStructures: enable,
})

/**
 * 洞窟生成を有効化/無効化
 */
export const enableCaves = (state: WorldGeneratorBuilderState, enable = true): WorldGeneratorBuilderState => ({
  ...state,
  enableCaves: enable,
})

/**
 * 鉱石生成を有効化/無効化
 */
export const enableOres = (state: WorldGeneratorBuilderState, enable = true): WorldGeneratorBuilderState => ({
  ...state,
  enableOres: enable,
})

// ================================
// Quality Configuration Functions
// ================================

/**
 * 品質レベルを設定
 */
export const withQualityLevel = (
  state: WorldGeneratorBuilderState,
  level: 'fast' | 'balanced' | 'quality'
): WorldGeneratorBuilderState => ({
  ...state,
  qualityLevel: level,
})

// ================================
// Debug Configuration Functions
// ================================

/**
 * デバッグモードを有効化/無効化
 */
export const enableDebugMode = (state: WorldGeneratorBuilderState, enable = true): WorldGeneratorBuilderState => ({
  ...state,
  enableDebugMode: enable,
})

/**
 * ログレベルを設定
 */
export const withLogLevel = (
  state: WorldGeneratorBuilderState,
  level: 'error' | 'warn' | 'info' | 'debug'
): WorldGeneratorBuilderState => ({
  ...state,
  logLevel: level,
})

// ================================
// Preset Configuration Functions
// ================================

/**
 * パフォーマンス最適化プリセット適用
 */
export const optimizeForPerformance = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  qualityLevel: 'fast',
  maxConcurrentGenerations: 8,
  cacheSize: 2000,
  enableDebugMode: false,
})

/**
 * 品質最適化プリセット適用
 */
export const optimizeForQuality = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  qualityLevel: 'quality',
  maxConcurrentGenerations: 2,
  cacheSize: 5000,
  enableDebugMode: false,
})

/**
 * 開発環境最適化プリセット適用
 */
export const optimizeForDevelopment = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  qualityLevel: 'fast',
  maxConcurrentGenerations: 4,
  cacheSize: 1000,
  enableDebugMode: true,
  logLevel: 'debug',
})

/**
 * バランス型プリセット適用（内部ヘルパー）
 */
const optimizeForBalance = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  qualityLevel: 'balanced',
  maxConcurrentGenerations: 4,
  cacheSize: 1000,
  enableDebugMode: false,
})

/**
 * 全機能無効化（内部ヘルパー）
 */
const disableAllFeatures = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({
  ...state,
  enableStructures: false,
  enableCaves: false,
  enableOres: false,
})

/**
 * プリセット適用
 *
 * 10種類のプリセットから選択して適用します。
 */
export const applyPreset = (state: WorldGeneratorBuilderState, preset: PresetType): WorldGeneratorBuilderState => {
  return Function.pipe(
    Match.value(preset),
    Match.when('default', () => optimizeForBalance(state)),
    Match.when('survival', () => optimizeForQuality(state)),
    Match.when('creative', () => Function.pipe(state, optimizeForPerformance, (s) => enableStructures(s, false))),
    Match.when('peaceful', () => Function.pipe(state, optimizeForBalance, (s) => enableStructures(s, false))),
    Match.when('hardcore', () => Function.pipe(state, optimizeForQuality, (s) => withMaxConcurrentGenerations(s, 1))),
    Match.when('superflat', () => Function.pipe(state, optimizeForPerformance, disableAllFeatures)),
    Match.when('amplified', () => optimizeForQuality(state)),
    Match.when('debug', () => optimizeForDevelopment(state)),
    Match.when('custom', () => state),
    Match.when('experimental', () => Function.pipe(state, optimizeForQuality, (s) => enableDebugMode(s, true))),
    Match.orElse(() => state)
  )
}

// ================================
// Conditional Configuration Functions
// ================================

/**
 * 条件付き設定適用
 *
 * conditionがtrueの場合のみconfigureFnを適用します。
 */
export const when = (
  state: WorldGeneratorBuilderState,
  condition: boolean,
  configureFn: (state: WorldGeneratorBuilderState) => WorldGeneratorBuilderState
): WorldGeneratorBuilderState => (condition ? configureFn(state) : state)

/**
 * 条件付き設定適用（否定）
 *
 * conditionがfalseの場合のみconfigureFnを適用します。
 */
export const unless = (
  state: WorldGeneratorBuilderState,
  condition: boolean,
  configureFn: (state: WorldGeneratorBuilderState) => WorldGeneratorBuilderState
): WorldGeneratorBuilderState => (!condition ? configureFn(state) : state)

// ================================
// Validation Functions
// ================================

/**
 * Builder状態を検証
 *
 * 検証結果をValidationStateとして返します。
 */
export const validate = (state: WorldGeneratorBuilderState): Effect.Effect<ValidationState, FactoryErrorType> =>
  Effect.gen(function* () {
    const errors: string[] = []

    // ルールベース警告チェック
    const warningRules = [
      {
        condition: !state.seed,
        message: 'No seed specified, random seed will be generated',
      },
      {
        condition: state.maxConcurrentGenerations && state.maxConcurrentGenerations > 8,
        message: 'High concurrent generation count may impact performance',
      },
      {
        condition: state.cacheSize && state.cacheSize > 5000,
        message: 'Large cache size may consume significant memory',
      },
      {
        condition: state.qualityLevel === 'fast' && state.maxConcurrentGenerations === 1,
        message: 'Fast quality with single thread may not be optimal',
      },
    ]

    const warnings = warningRules.filter((rule) => rule.condition).map((rule) => rule.message)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  })

/**
 * Builder状態が有効かチェック
 */
export const isValid = (state: WorldGeneratorBuilderState): Effect.Effect<boolean, FactoryErrorType> =>
  Effect.map(validate(state), (validationState) => validationState.isValid)

// ================================
// Build Functions
// ================================

/**
 * WorldGeneratorを構築
 *
 * 検証後、ファクトリを使用してWorldGeneratorを作成します。
 */
export const buildWorldGenerator = (
  state: WorldGeneratorBuilderState
): Effect.Effect<WorldGenerator.WorldGenerator, FactoryErrorType> =>
  Effect.gen(function* () {
    // 検証
    const validation = yield* validate(state)

    yield* Function.pipe(
      Match.value(validation.isValid),
      Match.when(false, () =>
        Effect.fail(FactoryError.parameterValidation(`Builder validation failed: ${validation.errors.join(', ')}`))
      ),
      Match.orElse(() => Effect.void)
    )

    // パラメータ構築
    const params = yield* buildParams(state)

    // ファクトリを使用してWorldGenerator作成
    const factory = yield* Effect.service(WorldGeneratorFactoryTag)

    return yield* factory.create(params)
  })

/**
 * デフォルト設定でWorldGeneratorを構築
 *
 * 全ての設定をデフォルト値で埋めてから構築します。
 */
export const buildWithDefaults = (
  state: WorldGeneratorBuilderState
): Effect.Effect<WorldGenerator.WorldGenerator, FactoryErrorType> =>
  Function.pipe(
    state,
    withRandomSeed,
    withDefaultParameters,
    withDefaultBiomes,
    withDefaultNoise,
    optimizeForBalance,
    buildWorldGenerator
  )

/**
 * 構築パラメータを作成
 *
 * Builder状態からCreateWorldGeneratorParamsを生成します。
 */
export const buildParams = (
  state: WorldGeneratorBuilderState
): Effect.Effect<CreateWorldGeneratorParams, FactoryErrorType> =>
  Effect.succeed({
    seed: state.seed,
    parameters: state.parameters,
    biomeConfig: state.biomeConfig,
    noiseConfig: state.noiseConfig,
    maxConcurrentGenerations: state.maxConcurrentGenerations,
    cacheSize: state.cacheSize,
    enableStructures: state.enableStructures,
    enableCaves: state.enableCaves,
    enableOres: state.enableOres,
    qualityLevel: state.qualityLevel,
    enableDebugMode: state.enableDebugMode,
    logLevel: state.logLevel,
  })

// ================================
// State Management Functions
// ================================

/**
 * 状態を取得（コピー）
 */
export const getState = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({ ...state })

/**
 * 状態を複製
 */
export const clone = (state: WorldGeneratorBuilderState): WorldGeneratorBuilderState => ({ ...state })

/**
 * 状態をリセット
 */
export const reset = (): WorldGeneratorBuilderState => ({})
