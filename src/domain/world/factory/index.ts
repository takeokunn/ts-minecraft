/**
 * @fileoverview World Factory Layer - Main Index
 * ワールドファクトリー層の統合エクスポート
 */

import { Layer } from 'effect'

import { BiomeSystemFactoryLive } from '@domain/biome/factory/biome_system_factory'
import { WorldConfigurationFactoryLive } from './world_configuration_factory'
import { GenerationSessionFactoryLive } from '@/domain/world_generation/factory/generation_session_factory'
import { WorldGeneratorFactoryLive } from '@/domain/world_generation/factory/world_generator_factory'

/**
 * 設定可能なFactory Layer
 */
export interface WorldFactoryConfig {
  readonly enableWorldGenerator: boolean
  readonly enableGenerationSession: boolean
  readonly enableBiomeSystem: boolean
  readonly enableWorldConfiguration: boolean
  readonly enableValidation: boolean
  readonly enableMetrics: boolean
}

export const defaultWorldFactoryConfig: WorldFactoryConfig = {
  enableWorldGenerator: true,
  enableGenerationSession: true,
  enableBiomeSystem: true,
  enableWorldConfiguration: true,
  enableValidation: true,
  enableMetrics: true,
}

/**
 * 設定可能なFactory Layer作成
 */
export const createWorldDomainFactoryLayer = (
  config: Partial<WorldFactoryConfig> = {}
): Layer.Layer<never, never, unknown> => {
  const finalConfig = { ...defaultWorldFactoryConfig, ...config }

  // ルールベース設計: Layer構成を宣言的に定義
  const layerRules = [
    { condition: finalConfig.enableWorldGenerator, layer: WorldGeneratorFactoryLive },
    { condition: finalConfig.enableGenerationSession, layer: GenerationSessionFactoryLive },
    { condition: finalConfig.enableBiomeSystem, layer: BiomeSystemFactoryLive },
    { condition: finalConfig.enableWorldConfiguration, layer: WorldConfigurationFactoryLive },
  ]

  const enabledLayers = layerRules.filter((rule) => rule.condition).map((rule) => rule.layer)

  return Layer.mergeAll(...enabledLayers)
}

// ================================
// Convenience Workflows
// ================================

export * from './helpers'

// ================================
// Testing Utilities
// ================================

// Exported from ./layer

// ================================
// Version Information
// ================================

export const WORLD_DOMAIN_FACTORY_VERSION = '1.0.0'
export const SUPPORTED_FACTORY_TYPES = [
  'WorldGeneratorFactory',
  'GenerationSessionFactory',
  'BiomeSystemFactory',
  'WorldConfigurationFactory',
] as const

export const FACTORY_LAYER_FEATURES = [
  'DDD Factory Pattern',
  'Builder Pattern Support',
  'Template System',
  'Configuration Management',
  'Validation System',
  'Performance Optimization',
  'Error Recovery',
  'Type Safety',
] as const

// ================================
// Factory Summary
// ================================
// (Exported from helpers.ts)
