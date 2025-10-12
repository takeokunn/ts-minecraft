/**
 * @fileoverview World Domain Aggregate Layer - 統合インデックス
 *
 * 世界ドメインの全集約ルートを統合エクスポートします。
 * - DDD原理主義に基づく完全な集約境界
 * - Event Sourcing + STM並行制御
 * - 型安全なドメインAPI
 */

// ================================
// WorldGenerator Aggregate Root (moved to world_generation context)
// ================================

export * from '@/domain/world_generation/aggregate/world_generator/index'

// ================================
// GenerationSession Aggregate Root (moved to world_generation context)
// ================================

export * from '@/domain/world_generation/aggregate/generation_session/index'

// ================================
// BiomeSystem Aggregate Root
// ================================

export {
  addTransitionRule,
  BiomeDistributionGeneratedSchema,
  BiomeDistributionSchema,
  BiomeEventPublisherTag,
  BiomeRegistrySchema,
  BiomeSystemConfigurationSchema,
  BiomeSystemCreatedSchema,
  BiomeSystemIdSchema,
  BiomeSystemLive,
  BiomeSystemSchema,
  BiomeSystemTag,
  calculateClimateFactors,
  calculateTransitions,
  ClimateModelSchema,
  ClimateModelUpdatedSchema,
  createBiomeDistributionGenerated,
  create as createBiomeSystem,
  createBiomeSystemCreated,
  createBiomeSystemId,
  createClimateModel,
  createClimateModelUpdated,
  createDefaultRegistry,
  createDefaultRules,
  findCompatibleBiomes,
  generateBiomeDistribution,
  GenerateBiomeDistributionCommandSchema,
  InMemoryBiomeEventPublisher,
  optimize as optimizeBiomeSystem,
  optimizeRules,
  publishBiomeEvent,
  TransitionRuleSchema,
  updateClimateModel as updateClimate,
  updateClimateModel,
  UpdateClimateModelCommandSchema,
  validateRule,
  type BiomeDistribution,
  type BiomeDistributionGenerated,
  // Registry Management
  type BiomeRegistry,
  // Core Aggregate
  type BiomeSystem,
  type BiomeSystemConfiguration,
  // Biome Events
  type BiomeSystemCreated,
  type BiomeSystemId,
  // Climate Model
  type ClimateModel,
  type ClimateModelUpdated,
  type GenerateBiomeDistributionCommand,
  // Transition Rules
  type TransitionRule,
  type UpdateClimateModelCommand,
} from './biome_system/index'

// ================================
// Aggregate Layer Integration
// ================================

// ================================
// Layer Integration
// ================================

export * from './layer'

/**
 * 集約間協調サービス
 */
export interface AggregateOrchestrator {
  readonly coordinateWorldGeneration: (
    worldGeneratorId: WorldGeneratorId,
    sessionId: GenerationSessionId,
    biomeSystemId: BiomeSystemId,
    request: GenerationRequest
  ) => Effect.Effect<
    {
      generator: WorldGenerator
      session: GenerationSession
      biomeSystem: BiomeSystem
    },
    GenerationErrors.OrchestrationError
  >

  readonly synchronizeAggregateStates: (aggregateIds: {
    worldGeneratorId: WorldGeneratorId
    sessionId: GenerationSessionId
    biomeSystemId: BiomeSystemId
  }) => Effect.Effect<void, GenerationErrors.SynchronizationError>
}

export const AggregateOrchestratorTag = Context.GenericTag<AggregateOrchestrator>(
  '@minecraft/domain/world/aggregate/AggregateOrchestrator'
)

// ================================
// Type-Safe Aggregate Factory
// ================================

/**
 * 型安全な世界ドメイン集約ファクトリ
 */
export const WorldDomainAggregateFactory = {
  /**
   * 完全な世界生成システム作成
   */
  createCompleteWorldSystem: (params: {
    worldSeed: WorldSeed.WorldSeed
    generationConfiguration?: Partial<BiomeSystemConfiguration>
    sessionConfiguration?: Partial<SessionConfiguration>
  }) =>
    Effect.Effect<
      {
        worldGenerator: WorldGenerator
        biomeSystem: BiomeSystem
        eventPublishers: {
          worldGeneratorEvents: EventPublisher
          biomeEvents: typeof BiomeEventPublisherTag.Service
        }
      },
      GenerationErrors.CreationError
    >,

  /**
   * 生成セッション作成ヘルパー
   */
  createGenerationSessionForWorld: (params: {
    worldGeneratorId: WorldGeneratorId
    biomeSystemId: BiomeSystemId
    request: GenerationRequest
    configuration?: Partial<SessionConfiguration>
  }) => Effect.Effect<GenerationSession, GenerationErrors.CreationError>,
} as const

// ================================
// Exports
// ================================

import type * as GenerationErrors from '@domain/world/types/errors'
import type * as WorldSeed from '@domain/world/value_object/world_seed/index'
import { Context, Effect } from 'effect'
