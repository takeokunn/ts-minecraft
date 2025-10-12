/**
 * @fileoverview BiomeSystemFactory - 統合エクスポート
 */

// Factory exports
export {
  assembleEcosystem,
  // Error Types
  BiomeFactoryError,
  BiomeFactoryErrorSchema,
  // Schemas
  BiomePresetTypeSchema,
  BiomeSystemFactoryLive,
  BiomeSystemFactoryTag,
  // Helper Functions
  calculateClimate,
  createBiomeSystemBuilder,
  OptimizationTargetSchema,
  PerformanceProfileSchema,
  ValidationIssueSchema,
  ValidationLevelSchema,
  ValidationResultSchema,
  // Advanced Types
  type BiomePresetType,
  // Builder Pattern (deprecated - use Schema + pure functions)
  type BiomeSystemBuilder,
  // Main Factory Interface
  type BiomeSystemFactory,
  // Factory Parameters
  type CreateBiomeSystemParams,
  type OptimizationTarget,
  type PerformanceProfile,
  type ValidationIssue,
  type ValidationLevel,
  type ValidationResult,
} from './factory'

// New Builder Pattern exports (Schema + Pure Functions)
export {
  BiomeSystemBuilderStateSchema,
  initialBiomeSystemBuilderState,
  type BiomeSystemBuilderState,
  type BiomePresetType as BuilderBiomePresetType,
  type PerformanceProfile as BuilderPerformanceProfile,
  type ValidationLevel as BuilderValidationLevel,
} from './builder_state'

export {
  build,
  buildWithValidation,
  withCaching,
  withClimate,
  withComplexity,
  withCustomBiomes,
  withMemoryLimit,
  withMetadata,
  withParallelProcessing,
  withPerformance,
  withPreset,
  withTransitions,
  withValidation,
  type ValidationResult as BuilderValidationResult,
} from './builder_functions'

// ================================
// Convenience Functions
// ================================

import type * as BiomeSystem from '@/domain/biome/aggregate/biome_system'
import { Effect, pipe } from 'effect'
import * as BuilderFunctions from './builder_functions'
import * as BuilderState from './builder_state'
import type { BiomePresetType, PerformanceProfile } from './factory'

export const createDefaultBiomeSystem = (): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  pipe(
    BuilderState.initialBiomeSystemBuilderState,
    (state) => BuilderFunctions.withPreset(state, 'default'),
    (state) => BuilderFunctions.withComplexity(state, 'complex'),
    (state) => BuilderFunctions.withTransitions(state, true),
    (state) => BuilderFunctions.withPerformance(state, 'balanced'),
    (state) => BuilderFunctions.withValidation(state, 'standard'),
    BuilderFunctions.build,
    Effect.orDie
  )

export const createSimpleBiomeSystem = (): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  pipe(
    BuilderState.initialBiomeSystemBuilderState,
    (state) => BuilderFunctions.withPreset(state, 'vanilla'),
    (state) => BuilderFunctions.withComplexity(state, 'simple'),
    (state) => BuilderFunctions.withTransitions(state, false),
    (state) => BuilderFunctions.withPerformance(state, 'fast'),
    (state) => BuilderFunctions.withValidation(state, 'basic'),
    BuilderFunctions.build,
    Effect.orDie
  )

export const createOptimizedBiomeSystem = (
  profile: PerformanceProfile
): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  pipe(
    BuilderState.initialBiomeSystemBuilderState,
    (state) => BuilderFunctions.withPerformance(state, profile),
    (state) => BuilderFunctions.withCaching(state, profile !== 'fast'),
    (state) => BuilderFunctions.withParallelProcessing(state, profile === 'quality'),
    (state) => BuilderFunctions.withValidation(state, profile === 'fast' ? 'basic' : 'standard'),
    BuilderFunctions.build,
    Effect.orDie
  )

export const createPresetBiomeSystem = (preset: BiomePresetType): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  pipe(
    BuilderState.initialBiomeSystemBuilderState,
    (state) => BuilderFunctions.withPreset(state, preset),
    BuilderFunctions.build,
    Effect.orDie
  )

export const createCustomBiomeSystem = (
  customBiomes: readonly BiomeSystem.BiomeType[],
  complexity: 'simple' | 'complex' | 'realistic' = 'complex'
): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  pipe(
    BuilderState.initialBiomeSystemBuilderState,
    (state) => BuilderFunctions.withCustomBiomes(state, customBiomes),
    (state) => BuilderFunctions.withComplexity(state, complexity),
    (state) => BuilderFunctions.withTransitions(state, complexity !== 'simple'),
    (state) => BuilderFunctions.withPerformance(state, 'balanced'),
    BuilderFunctions.build,
    Effect.orDie
  )

export const BIOME_SYSTEM_FACTORY_VERSION = '1.0.0'
