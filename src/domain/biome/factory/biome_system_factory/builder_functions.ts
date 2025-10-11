import * as BiomeSystem from '@/domain/biome/aggregate/biome_system'
import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import { type JsonRecord } from '@shared/schema/json'
import * as Effect from 'effect/Effect'
import type { BiomePresetType, BiomeSystemBuilderState, PerformanceProfile, ValidationLevel } from './builder_state.js'
import type { BiomeFactoryError } from './errors.js'
import { createBiomeSystemFactory } from './factory.js'

/**
 * Preset設定関数
 */
export const withPreset = (state: BiomeSystemBuilderState, preset: BiomePresetType): BiomeSystemBuilderState => ({
  ...state,
  preset,
})

/**
 * Climate設定関数
 */
export const withClimate = (
  state: BiomeSystemBuilderState,
  config: BiomeProperties.BiomeConfiguration
): BiomeSystemBuilderState => ({
  ...state,
  climateConfig: config,
})

/**
 * Transitions有効化関数
 */
export const withTransitions = (state: BiomeSystemBuilderState, enable: boolean): BiomeSystemBuilderState => ({
  ...state,
  enableTransitions: enable,
})

/**
 * Complexity設定関数
 */
export const withComplexity = (
  state: BiomeSystemBuilderState,
  level: 'simple' | 'complex' | 'realistic'
): BiomeSystemBuilderState => ({
  ...state,
  ecosystemComplexity: level,
})

/**
 * Performance profile設定関数
 */
export const withPerformance = (
  state: BiomeSystemBuilderState,
  profile: PerformanceProfile
): BiomeSystemBuilderState => ({
  ...state,
  performanceProfile: profile,
})

/**
 * Validation level設定関数
 */
export const withValidation = (state: BiomeSystemBuilderState, level: ValidationLevel): BiomeSystemBuilderState => ({
  ...state,
  validationLevel: level,
})

/**
 * Caching有効化関数
 */
export const withCaching = (state: BiomeSystemBuilderState, enable: boolean): BiomeSystemBuilderState => ({
  ...state,
  enableCaching: enable,
})

/**
 * Parallel processing有効化関数
 */
export const withParallelProcessing = (state: BiomeSystemBuilderState, enable: boolean): BiomeSystemBuilderState => ({
  ...state,
  parallelProcessing: enable,
})

/**
 * Memory limit設定関数
 */
export const withMemoryLimit = (state: BiomeSystemBuilderState, limit: number): BiomeSystemBuilderState => ({
  ...state,
  memoryLimit: limit,
})

/**
 * Custom biomes設定関数
 */
export const withCustomBiomes = (
  state: BiomeSystemBuilderState,
  biomes: readonly BiomeProperties.BiomeType[]
): BiomeSystemBuilderState => ({
  ...state,
  customBiomes: biomes,
})

/**
 * Metadata設定関数（マージ）
 */
export const withMetadata = (state: BiomeSystemBuilderState, metadata: JsonRecord): BiomeSystemBuilderState => ({
  ...state,
  metadata: { ...state.metadata, ...metadata },
})

/**
 * Build関数 - BiomeSystem生成
 */
export const build = (state: BiomeSystemBuilderState): Effect.Effect<BiomeSystem.BiomeSystem, BiomeFactoryError> => {
  const params = {
    preset: state.preset,
    climateConfig: state.climateConfig,
    enableTransitions: state.enableTransitions,
    ecosystemComplexity: state.ecosystemComplexity,
    performanceProfile: state.performanceProfile,
    validationLevel: state.validationLevel,
    enableCaching: state.enableCaching,
    parallelProcessing: state.parallelProcessing,
    memoryLimit: state.memoryLimit,
    customBiomes: state.customBiomes,
    metadata: state.metadata,
  }

  return createBiomeSystemFactory().create(params)
}

/**
 * Validation結果型
 */
export type ValidationResult = {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * Validation付きBuild関数
 */
export const buildWithValidation = (
  state: BiomeSystemBuilderState
): Effect.Effect<{ system: BiomeSystem.BiomeSystem; validation: ValidationResult }, BiomeFactoryError> =>
  Effect.gen(function* () {
    const system = yield* build(state)
    const validation = yield* validateBiomeSystem(system, state.validationLevel ?? 'standard')
    return { system, validation }
  })

/**
 * BiomeSystem検証関数
 * 実際の検証ロジックはプロジェクトの要件に応じて実装
 */
const validateBiomeSystem = (
  system: BiomeSystem.BiomeSystem,
  level: ValidationLevel
): Effect.Effect<ValidationResult, BiomeFactoryError> =>
  Effect.succeed({
    isValid: true,
    errors: [],
    warnings: [],
  })
