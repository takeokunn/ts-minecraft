/**
 * @fileoverview World Domain Aggregate Layer - 統合インデックス
 *
 * 世界ドメインの全集約ルートを統合エクスポートします。
 * - DDD原理主義に基づく完全な集約境界
 * - Event Sourcing + STM並行制御
 * - 型安全なドメインAPI
 */

// ================================
// WorldGenerator Aggregate Root
// ================================

export {
  AggregateVersionSchema,
  BaseEventSchema,
  ChunkGeneratedSchema,
  ChunkGenerationFailedSchema,
  ChunkGenerationInfoSchema,
  ChunkGenerationStartedSchema,
  clone as cloneGenerationContext,
  completeChunkGeneration,
  ContextMetadataSchema,
  createChunkGenerated,
  createChunkGenerationFailed,
  createChunkGenerationStarted,
  CreateContextParamsSchema,
  create as createGenerationContext,
  createInitial as createInitialGenerationState,
  createPreset,
  createSettingsUpdated,
  // Operations
  create as createWorldGenerator,
  createWorldGeneratorCreated,
  // Factory Functions
  createWorldGeneratorId,
  EventPublisherTag,
  EventStoreTag,
  failChunkGeneration,
  generateChunk,
  GenerateChunkCommandSchema,
  GENERATION_TIMEOUT_MS,
  GenerationContextIdSchema,
  GenerationContextSchema,
  GenerationStateSchema,
  GenerationStatisticsSchema,
  GenerationStatusSchema,
  GeneratorPausedSchema,
  GeneratorResumedSchema,
  getChunkGenerationStatus,
  getCurrentGenerationLoad,
  getGenerationProgress,
  InMemoryEventPublisher,
  InMemoryEventStore,
  loadEvents as loadWorldGeneratorEvents,
  MAX_CHUNK_DISTANCE_FROM_ORIGIN,
  // Business Rules
  MAX_CONCURRENT_GENERATIONS,
  MAX_GENERATION_ATTEMPTS,
  publish as publishWorldGeneratorEvent,
  saveEvents as saveWorldGeneratorEvents,
  SettingsUpdatedSchema,
  startChunkGeneration,
  StatisticsUpdatedSchema,
  subscribe as subscribeToWorldGeneratorEvents,
  update as updateGenerationContext,
  UpdateSettingsCommandSchema,
  updateSettings as updateWorldGeneratorSettings,
  validateChunkGenerationRequest,
  validateCreationContext,
  validateDataIntegrity,
  validateGenerationCompatibility,
  validateSettingsUpdate,
  validateStateIntegrity,
  validateStructuralIntegrity,
  validateIntegrity as validateWorldGeneratorIntegrity,
  WorldGeneratorCreatedSchema,
  WorldGeneratorEventSchema,
  WorldGeneratorIdSchema,
  WorldGeneratorLive,
  // Schemas
  WorldGeneratorSchema,
  // Service
  WorldGeneratorTag,
  type AggregateVersion,
  type BaseEvent,
  type ChunkGenerated,
  type ChunkGenerationFailed,
  type ChunkGenerationInfo,
  type ChunkGenerationStarted,
  // Context Management
  type ContextMetadata,
  type CreateContextParams,
  type EventPublisher,
  type EventStore,
  type GenerateChunkCommand,
  type GenerationContext,
  // State Management
  type GenerationState,
  type GenerationStatistics,
  type GenerationStatus,
  type GeneratorPaused,
  type GeneratorResumed,
  type SettingsUpdated,
  type StatisticsUpdated,
  type UpdateSettingsCommand,
  // Core Aggregate
  type WorldGenerator,
  type WorldGeneratorCreated,
  // Domain Events
  type WorldGeneratorEvent,
  type WorldGeneratorId,
} from './world_generator/index'

// ================================
// GenerationSession Aggregate Root
// ================================

export {
  analyzeErrors,
  BaseSessionEventSchema,
  BatchCompletedSchema,
  BatchFailedSchema,
  BatchRetriedSchema,
  BatchStartedSchema,
  BatchStatusSchema,
  calculateRetryDelay,
  cancelSession,
  ChunkBatchSchema,
  completeSession,
  completeBatch as completeSessionBatch,
  completeBatch as completeStateBatch,
  completeTracking,
  createBatchCompleted,
  createBatchFailed,
  create as createGenerationSession,
  createGenerationSessionId,
  createInitial as createInitialProgress,
  createInitial as createInitialSessionState,
  createSessionCompleted,
  createSessionCreated,
  createSessionError,
  createSessionPaused,
  createSessionResumed,
  createSessionStarted,
  ErrorAnalysisSchema,
  ErrorCategorySchema,
  ErrorSeveritySchema,
  ExecutionContextSchema,
  failBatch as failSessionBatch,
  failBatch as failStateBatch,
  generateProgressReport,
  GenerationRequestSchema,
  GenerationSessionIdSchema,
  GenerationSessionLive,
  GenerationSessionSchema,
  GenerationSessionTag,
  getAchievedMilestones,
  getBatch,
  getNextExecutableBatch,
  getProgressStatistics,
  getProgressVelocity,
  InMemorySessionEventPublisher,
  isCompleted,
  isSessionCompleted,
  pause as pauseGenerationSession,
  pauseSession,
  pauseTracking,
  PerformanceMetricsSchema,
  ProgressDataSchema,
  ProgressStatisticsSchema,
  ProgressUpdatedSchema,
  publishSessionEvent,
  resume as resumeGenerationSession,
  resumeSession,
  resumeTracking,
  RetryStrategySchema,
  scheduleRetry,
  SessionCompletedSchema,
  SessionConfigurationSchema,
  SessionCreatedSchema,
  SessionErrorSchema,
  SessionEventPublisherTag,
  SessionEventSchema,
  SessionFailedSchema,
  SessionPausedSchema,
  SessionResumedSchema,
  SessionStartedSchema,
  SessionStateSchema,
  SessionStatusSchema,
  shouldRetryBatch,
  startBatch,
  start as startGenerationSession,
  startSession,
  startTracking,
  subscribeToSessionEvents,
  suggestRecoveryStrategy,
  TimeTrackingSchema,
  updateProgress,
  type BaseSessionEvent,
  type BatchCompleted,
  type BatchFailed,
  type BatchRetried,
  type BatchStarted,
  type BatchStatus,
  type ChunkBatch,
  type ErrorAnalysis,
  type ErrorCategory,
  type ErrorSeverity,
  type ExecutionContext,
  type GenerationRequest,
  // Core Aggregate
  type GenerationSession,
  type GenerationSessionId,
  type PerformanceMetrics,
  // Progress Tracking
  type ProgressData,
  type ProgressStatistics,
  type ProgressUpdated,
  type RetryStrategy,
  type SessionCompleted,
  type SessionConfiguration,
  type SessionCreated,
  // Error Handling
  type SessionError,
  // Session Events
  type SessionEvent,
  type SessionEventPublisher,
  type SessionFailed,
  type SessionPaused,
  type SessionResumed,
  type SessionStarted,
  // Session State
  type SessionState,
  type SessionStatus,
  type TimeTracking,
} from './generation_session/index'

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

/**
 * 全集約ルートサービスの統合タグ
 */
export const WorldAggregateServicesTag = Context.GenericTag<{
  readonly worldGenerator: typeof WorldGeneratorTag.Service
  readonly generationSession: typeof GenerationSessionTag.Service
  readonly biomeSystem: typeof BiomeSystemTag.Service
}>('@minecraft/domain/world/aggregate/WorldAggregateServices')

/**
 * 全イベント発行者の統合タグ
 */
export const WorldEventPublishersTag = Context.GenericTag<{
  readonly worldGeneratorEvents: EventPublisher
  readonly sessionEvents: SessionEventPublisher
  readonly biomeEvents: typeof BiomeEventPublisherTag.Service
}>('@minecraft/domain/world/aggregate/WorldEventPublishers')

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

/**
 * 統合レイヤー実装
 */
export const WorldAggregateLive = Layer.mergeAll(
  WorldGeneratorLive.pipe(Layer.provide(Layer.succeed(WorldGeneratorTag, WorldGeneratorLive))),
  GenerationSessionLive.pipe(Layer.provide(Layer.succeed(GenerationSessionTag, GenerationSessionLive))),
  BiomeSystemLive.pipe(Layer.provide(Layer.succeed(BiomeSystemTag, BiomeSystemLive)))
)

/**
 * イベント発行者統合レイヤー
 */
export const WorldEventPublishersLive = Layer.mergeAll(
  Layer.succeed(EventPublisherTag, InMemoryEventPublisher),
  Layer.succeed(SessionEventPublisherTag, InMemorySessionEventPublisher),
  Layer.succeed(BiomeEventPublisherTag, InMemoryBiomeEventPublisher)
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

import { Context, Effect, Layer } from 'effect'
import type * as GenerationErrors from '@domain/world/types/errors'
import type * as WorldSeed from '@domain/world/value_object/world_seed/index'
