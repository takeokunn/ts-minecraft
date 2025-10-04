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
  // Core Aggregate
  type WorldGenerator,
  type WorldGeneratorId,
  type AggregateVersion,
  type GenerationContext,
  type GenerateChunkCommand,
  type UpdateSettingsCommand,

  // Schemas
  WorldGeneratorSchema,
  WorldGeneratorIdSchema,
  AggregateVersionSchema,
  GenerationContextSchema,
  GenerateChunkCommandSchema,
  UpdateSettingsCommandSchema,

  // Factory Functions
  createWorldGeneratorId,

  // Operations
  create as createWorldGenerator,
  generateChunk,
  updateSettings as updateWorldGeneratorSettings,
  validateIntegrity as validateWorldGeneratorIntegrity,

  // Service
  WorldGeneratorTag,
  WorldGeneratorLive,

  // Context Management
  type ContextMetadata,
  type CreateContextParams,
  GenerationContextIdSchema,
  ContextMetadataSchema,
  CreateContextParamsSchema,
  create as createGenerationContext,
  update as updateGenerationContext,
  clone as cloneGenerationContext,
  createPreset,
  validateGenerationCompatibility,

  // State Management
  type GenerationState,
  type GenerationStatus,
  type ChunkGenerationInfo,
  type GenerationStatistics,
  GenerationStateSchema,
  GenerationStatusSchema,
  ChunkGenerationInfoSchema,
  GenerationStatisticsSchema,
  createInitial as createInitialGenerationState,
  startChunkGeneration,
  completeChunkGeneration,
  failChunkGeneration,
  getCurrentGenerationLoad,
  getGenerationProgress,
  getChunkGenerationStatus,

  // Business Rules
  MAX_CONCURRENT_GENERATIONS,
  MAX_GENERATION_ATTEMPTS,
  GENERATION_TIMEOUT_MS,
  MAX_CHUNK_DISTANCE_FROM_ORIGIN,
  validateCreationContext,
  validateChunkGenerationRequest,
  validateSettingsUpdate,
  validateStructuralIntegrity,
  validateDataIntegrity,
  validateStateIntegrity,

  // Domain Events
  type WorldGeneratorEvent,
  type WorldGeneratorCreated,
  type ChunkGenerationStarted,
  type ChunkGenerated,
  type ChunkGenerationFailed,
  type SettingsUpdated,
  type GeneratorPaused,
  type GeneratorResumed,
  type StatisticsUpdated,
  type BaseEvent,
  type EventStore,
  type EventPublisher,

  WorldGeneratorEventSchema,
  WorldGeneratorCreatedSchema,
  ChunkGenerationStartedSchema,
  ChunkGeneratedSchema,
  ChunkGenerationFailedSchema,
  SettingsUpdatedSchema,
  GeneratorPausedSchema,
  GeneratorResumedSchema,
  StatisticsUpdatedSchema,
  BaseEventSchema,

  createWorldGeneratorCreated,
  createChunkGenerationStarted,
  createChunkGenerated,
  createChunkGenerationFailed,
  createSettingsUpdated,

  publish as publishWorldGeneratorEvent,
  subscribe as subscribeToWorldGeneratorEvents,
  saveEvents as saveWorldGeneratorEvents,
  loadEvents as loadWorldGeneratorEvents,

  EventStoreTag,
  EventPublisherTag,
  InMemoryEventStore,
  InMemoryEventPublisher,
} from "./world_generator/index.js"

// ================================
// GenerationSession Aggregate Root
// ================================

export {
  // Core Aggregate
  type GenerationSession,
  type GenerationSessionId,
  type SessionConfiguration,
  type GenerationRequest,

  GenerationSessionSchema,
  GenerationSessionIdSchema,
  SessionConfigurationSchema,
  GenerationRequestSchema,

  createGenerationSessionId,
  create as createGenerationSession,
  start as startGenerationSession,
  completeBatch as completeSessionBatch,
  failBatch as failSessionBatch,
  pause as pauseGenerationSession,
  resume as resumeGenerationSession,

  GenerationSessionTag,
  GenerationSessionLive,

  // Session State
  type SessionState,
  type SessionStatus,
  type BatchStatus,
  type ChunkBatch,
  type ExecutionContext,

  SessionStateSchema,
  SessionStatusSchema,
  BatchStatusSchema,
  ChunkBatchSchema,
  ExecutionContextSchema,

  createInitial as createInitialSessionState,
  startSession,
  startBatch,
  completeBatch as completeStateBatch,
  failBatch as failStateBatch,
  scheduleRetry,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,

  getBatch,
  getNextExecutableBatch,
  getProgressStatistics,
  isSessionCompleted,

  // Progress Tracking
  type ProgressData,
  type ProgressStatistics,
  type PerformanceMetrics,
  type TimeTracking,

  ProgressDataSchema,
  ProgressStatisticsSchema,
  PerformanceMetricsSchema,
  TimeTrackingSchema,

  createInitial as createInitialProgress,
  startTracking,
  updateProgress,
  pauseTracking,
  resumeTracking,
  completeTracking,
  isCompleted,
  generateProgressReport,

  getProgressVelocity,
  getAchievedMilestones,

  // Error Handling
  type SessionError,
  type ErrorCategory,
  type ErrorSeverity,
  type RetryStrategy,
  type ErrorAnalysis,

  SessionErrorSchema,
  ErrorCategorySchema,
  ErrorSeveritySchema,
  RetryStrategySchema,
  ErrorAnalysisSchema,

  createSessionError,
  shouldRetryBatch,
  calculateRetryDelay,
  analyzeErrors,
  suggestRecoveryStrategy,

  // Session Events
  type SessionEvent,
  type SessionCreated,
  type SessionStarted,
  type SessionPaused,
  type SessionResumed,
  type SessionCompleted,
  type SessionFailed,
  type BatchStarted,
  type BatchCompleted,
  type BatchFailed,
  type BatchRetried,
  type ProgressUpdated,
  type BaseSessionEvent,
  type SessionEventPublisher,

  SessionEventSchema,
  SessionCreatedSchema,
  SessionStartedSchema,
  SessionPausedSchema,
  SessionResumedSchema,
  SessionCompletedSchema,
  SessionFailedSchema,
  BatchStartedSchema,
  BatchCompletedSchema,
  BatchFailedSchema,
  BatchRetriedSchema,
  ProgressUpdatedSchema,
  BaseSessionEventSchema,

  createSessionCreated,
  createSessionStarted,
  createSessionPaused,
  createSessionResumed,
  createSessionCompleted,
  createBatchCompleted,
  createBatchFailed,

  publishSessionEvent,
  subscribeToSessionEvents,

  SessionEventPublisherTag,
  InMemorySessionEventPublisher,
} from "./generation_session/index.js"

// ================================
// BiomeSystem Aggregate Root
// ================================

export {
  // Core Aggregate
  type BiomeSystem,
  type BiomeSystemId,
  type BiomeDistribution,
  type BiomeSystemConfiguration,
  type GenerateBiomeDistributionCommand,
  type UpdateClimateModelCommand,

  BiomeSystemSchema,
  BiomeSystemIdSchema,
  BiomeDistributionSchema,
  BiomeSystemConfigurationSchema,
  GenerateBiomeDistributionCommandSchema,
  UpdateClimateModelCommandSchema,

  createBiomeSystemId,
  create as createBiomeSystem,
  generateBiomeDistribution,
  updateClimateModel,
  addTransitionRule,
  optimize as optimizeBiomeSystem,

  BiomeSystemTag,
  BiomeSystemLive,

  // Registry Management
  type BiomeRegistry,
  BiomeRegistrySchema,
  createDefaultRegistry,
  findCompatibleBiomes,

  // Transition Rules
  type TransitionRule,
  TransitionRuleSchema,
  createDefaultRules,
  validateRule,
  calculateTransitions,
  optimizeRules,

  // Climate Model
  type ClimateModel,
  ClimateModelSchema,
  createClimateModel,
  calculateClimateFactors,
  updateClimateModel as updateClimate,

  // Biome Events
  type BiomeSystemCreated,
  type BiomeDistributionGenerated,
  type ClimateModelUpdated,

  BiomeSystemCreatedSchema,
  BiomeDistributionGeneratedSchema,
  ClimateModelUpdatedSchema,

  createBiomeSystemCreated,
  createBiomeDistributionGenerated,
  createClimateModelUpdated,

  publishBiomeEvent,
  BiomeEventPublisherTag,
  InMemoryBiomeEventPublisher,
} from "./biome_system/index.js"

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
  ) => Effect.Effect<{
    generator: WorldGenerator
    session: GenerationSession
    biomeSystem: BiomeSystem
  }, GenerationErrors.OrchestrationError>

  readonly synchronizeAggregateStates: (
    aggregateIds: {
      worldGeneratorId: WorldGeneratorId
      sessionId: GenerationSessionId
      biomeSystemId: BiomeSystemId
    }
  ) => Effect.Effect<void, GenerationErrors.SynchronizationError>
}

export const AggregateOrchestratorTag = Context.GenericTag<AggregateOrchestrator>('@minecraft/domain/world/aggregate/AggregateOrchestrator')

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
  }) => Effect.Effect<{
    worldGenerator: WorldGenerator
    biomeSystem: BiomeSystem
    eventPublishers: {
      worldGeneratorEvents: EventPublisher
      biomeEvents: typeof BiomeEventPublisherTag.Service
    }
  }, GenerationErrors.CreationError>,

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

import { Context, Effect, Layer } from "effect"
import type * as GenerationErrors from "../types/errors/generation_errors.js"
import type * as WorldSeed from "../value_object/world_seed/index.js"