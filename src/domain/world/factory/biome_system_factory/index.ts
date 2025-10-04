/**
 * @fileoverview BiomeSystemFactory - 統合エクスポート
 */

export {
  // Main Factory Interface
  type BiomeSystemFactory,
  BiomeSystemFactoryTag,
  BiomeSystemFactoryLive,

  // Factory Parameters
  type CreateBiomeSystemParams,

  // Advanced Types
  type BiomePresetType,
  type PerformanceProfile,
  type OptimizationTarget,
  type ValidationLevel,
  type ValidationIssue,
  type ValidationResult,

  // Schemas
  BiomePresetTypeSchema,
  PerformanceProfileSchema,
  OptimizationTargetSchema,
  ValidationLevelSchema,
  ValidationIssueSchema,
  ValidationResultSchema,

  // Error Types
  BiomeFactoryError,
  BiomeFactoryErrorSchema,

  // Builder Pattern
  type BiomeSystemBuilder,
  createBiomeSystemBuilder,

  // Helper Functions
  calculateClimate,
  assembleEcosystem,
} from './factory.js'

// ================================
// Convenience Functions
// ================================

import { Effect } from "effect"
import { createBiomeSystemBuilder } from './factory.js'
import type * as BiomeSystem from '../../aggregate/biome_system/biome_system.js'
import type { PerformanceProfile, BiomePresetType } from './factory.js'

export const createDefaultBiomeSystem = (): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withPreset('default')
    .withComplexity('complex')
    .withTransitions(true)
    .withPerformance('balanced')
    .withValidation('standard')
    .build()
    .pipe(Effect.orDie)

export const createSimpleBiomeSystem = (): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withPreset('vanilla')
    .withComplexity('simple')
    .withTransitions(false)
    .withPerformance('fast')
    .withValidation('basic')
    .build()
    .pipe(Effect.orDie)

export const createOptimizedBiomeSystem = (profile: PerformanceProfile): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withPerformance(profile)
    .withCaching(profile !== 'fast')
    .withParallelProcessing(profile === 'ultra' || profile === 'quality')
    .withValidation(profile === 'fast' ? 'basic' : 'standard')
    .build()
    .pipe(Effect.orDie)

export const createPresetBiomeSystem = (preset: BiomePresetType): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withPreset(preset)
    .build()
    .pipe(Effect.orDie)

export const createCustomBiomeSystem = (
  customBiomes: readonly BiomeSystem.BiomeType[],
  complexity: 'simple' | 'complex' | 'realistic' = 'complex'
): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withCustomBiomes(customBiomes)
    .withComplexity(complexity)
    .withTransitions(complexity !== 'simple')
    .withPerformance('balanced')
    .build()
    .pipe(Effect.orDie)

export const BIOME_SYSTEM_FACTORY_VERSION = '1.0.0'