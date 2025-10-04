/**
 * @fileoverview BiomeSystemFactory - 統合エクスポート
 */

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
  // Builder Pattern
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
} from './factory.js'

// ================================
// Convenience Functions
// ================================

import { Effect } from 'effect'
import type * as BiomeSystem from '../../aggregate/biome_system/biome_system.js'
import type { BiomePresetType, PerformanceProfile } from './factory.js'
import { createBiomeSystemBuilder } from './factory.js'

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

export const createOptimizedBiomeSystem = (
  profile: PerformanceProfile
): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder()
    .withPerformance(profile)
    .withCaching(profile !== 'fast')
    .withParallelProcessing(profile === 'ultra' || profile === 'quality')
    .withValidation(profile === 'fast' ? 'basic' : 'standard')
    .build()
    .pipe(Effect.orDie)

export const createPresetBiomeSystem = (preset: BiomePresetType): Effect.Effect<BiomeSystem.BiomeSystem, never> =>
  createBiomeSystemBuilder().withPreset(preset).build().pipe(Effect.orDie)

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
