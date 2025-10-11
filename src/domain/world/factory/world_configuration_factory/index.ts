/**
 * @fileoverview WorldConfigurationFactory - 統合エクスポート
 */

// Factory exports
export {
  ConfigurationComparisonResultSchema,
  ConfigurationComplexitySchema,
  // Error Types
  ConfigurationFactoryError,
  ConfigurationFactoryErrorSchema,
  // Schemas
  ConfigurationPresetTypeSchema,
  ConfigurationTemplateSchema,
  ConfigurationValidationIssueSchema,
  ConfigurationValidationResultSchema,
  createWorldConfigurationBuilder,
  OptimizationModeSchema,
  ValidationStrictnessSchema,
  WorldConfigurationFactoryLive,
  WorldConfigurationFactoryTag,
  WorldConfigurationSchema,
  type ConfigurationComparisonResult,
  type ConfigurationComplexity,
  type ConfigurationFactoryError,
  // Advanced Types
  type ConfigurationPresetType,
  type ConfigurationTemplate,
  type ConfigurationValidationIssue,
  type ConfigurationValidationResult,
  type CreateConfigurationParams,
  type OptimizationMode,
  type ValidationStrictness,
  // Configuration Types
  type WorldConfiguration,
  // Builder Pattern (deprecated - use Schema + pure functions)
  type WorldConfigurationBuilder,
  // Main Factory Interface
  type WorldConfigurationFactory,
} from './factory.js'

// New Builder Pattern exports (Schema + Pure Functions)
export {
  initialWorldConfigurationBuilderState,
  WorldConfigurationBuilderStateSchema,
  type WorldConfigurationBuilderState,
} from './builder_state.js'

export { build, withBiomeConfig, withMetadata, withNoiseConfig, withParameters, withSeed } from './builder_functions.js'

// ================================
// Convenience Functions
// ================================

import type { JsonRecord } from '@shared/schema/json'
import { Effect } from 'effect'
import type {
  ConfigurationPresetType,
  ConfigurationValidationResult,
  OptimizationMode,
  ValidationStrictness,
  WorldConfiguration,
} from './factory.js'
import { WorldConfigurationFactoryTag } from './factory.js'

export const createQuickConfiguration = (): Effect.Effect<WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    return yield* factory.createFromPreset('default')
  }).pipe(Effect.orDie)

export const createOptimizedConfiguration = (
  optimization: OptimizationMode
): Effect.Effect<WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    return yield* factory.createOptimized(optimization)
  }).pipe(Effect.orDie)

export const createPresetConfiguration = (preset: ConfigurationPresetType): Effect.Effect<WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    return yield* factory.createFromPreset(preset)
  }).pipe(Effect.orDie)

export const createValidatedConfiguration = (
  preset: ConfigurationPresetType = 'default',
  strictness: ValidationStrictness = 'standard'
): Effect.Effect<
  {
    config: WorldConfiguration
    validation: ConfigurationValidationResult
  },
  never
> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    const config = yield* factory.createFromPreset(preset)
    const validation = yield* factory.validate(config, strictness)
    return { config, validation }
  }).pipe(Effect.orDie)

export const createBatchConfigurations = (
  presets: readonly ConfigurationPresetType[]
): Effect.Effect<readonly WorldConfiguration[], never> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    const requests = presets.map((preset) => ({ preset }))
    return yield* factory.createBatch(requests)
  }).pipe(Effect.orDie)

export const createCustomConfiguration = (
  basePreset: ConfigurationPresetType = 'default',
  customParams: JsonRecord = {}
): Effect.Effect<WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = yield* WorldConfigurationFactoryTag
    return yield* factory.create({
      preset: basePreset,
      customParameters: customParams,
      validateCompatibility: true,
    })
  }).pipe(Effect.orDie)

export const WORLD_CONFIGURATION_FACTORY_VERSION = '1.0.0'
