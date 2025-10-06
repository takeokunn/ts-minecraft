/**
 * @fileoverview WorldConfigurationFactory - 統合エクスポート
 */

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
  // Builder Pattern
  type WorldConfigurationBuilder,
  // Main Factory Interface
  type WorldConfigurationFactory,
} from './index'

// ================================
// Convenience Functions
// ================================

import { Effect } from 'effect'
import type * as WorldConfiguration from './index'
import type { ConfigurationPresetType, OptimizationMode, ValidationStrictness } from './index'
import { createWorldConfigurationBuilder } from './index'

export const createQuickConfiguration = (): Effect.Effect<WorldConfiguration.WorldConfiguration, never> =>
  createWorldConfigurationBuilder().build().pipe(Effect.orDie)

export const createOptimizedConfiguration = (
  optimization: OptimizationMode
): Effect.Effect<WorldConfiguration.WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = WorldConfiguration.WorldConfigurationFactoryTag
    return yield* factory.createOptimized(optimization)
  }).pipe(Effect.orDie)

export const createPresetConfiguration = (
  preset: ConfigurationPresetType
): Effect.Effect<WorldConfiguration.WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = WorldConfiguration.WorldConfigurationFactoryTag
    return yield* factory.createFromPreset(preset)
  }).pipe(Effect.orDie)

export const createValidatedConfiguration = (
  preset: ConfigurationPresetType = 'default',
  strictness: ValidationStrictness = 'standard'
): Effect.Effect<
  {
    config: WorldConfiguration.WorldConfiguration
    validation: WorldConfiguration.ConfigurationValidationResult
  },
  never
> =>
  Effect.gen(function* () {
    const factory = WorldConfiguration.WorldConfigurationFactoryTag
    const config = yield* factory.createFromPreset(preset)
    const validation = yield* factory.validate(config, strictness)
    return { config, validation }
  }).pipe(Effect.orDie)

export const createBatchConfigurations = (
  presets: readonly ConfigurationPresetType[]
): Effect.Effect<readonly WorldConfiguration.WorldConfiguration[], never> =>
  Effect.gen(function* () {
    const factory = WorldConfiguration.WorldConfigurationFactoryTag
    const requests = presets.map((preset) => ({ preset }))
    return yield* factory.createBatch(requests)
  }).pipe(Effect.orDie)

export const createCustomConfiguration = (
  basePreset: ConfigurationPresetType = 'default',
  customParams: Record<string, unknown> = {}
): Effect.Effect<WorldConfiguration.WorldConfiguration, never> =>
  Effect.gen(function* () {
    const factory = WorldConfiguration.WorldConfigurationFactoryTag
    return yield* factory.create({
      preset: basePreset,
      customParameters: customParams,
      validateCompatibility: true,
    })
  }).pipe(Effect.orDie)

export const WORLD_CONFIGURATION_FACTORY_VERSION = '1.0.0'
