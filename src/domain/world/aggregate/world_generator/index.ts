/**
 * @fileoverview WorldGenerator Aggregate Index
 *
 * WorldGenerator集約の統合エクスポート
 */

// ================================
// Core Aggregate
// ================================

export {
  AggregateVersionSchema,
  GenerateChunkCommandSchema,
  GenerationContextSchema,
  UpdateSettingsCommandSchema,
  WorldGeneratorIdSchema,
  WorldGeneratorLive,
  // Schemas
  WorldGeneratorSchema,
  // Service
  WorldGeneratorTag,
  // Operations
  create,
  // Factory Functions
  createWorldGeneratorId,
  generateChunk,
  updateSettings,
  validateIntegrity,
  type AggregateVersion,
  type GenerateChunkCommand,
  type GenerationContext,
  type UpdateSettingsCommand,
  // Types
  type WorldGenerator,
  type WorldGeneratorId,
} from './world_generator.js'

// ================================
// Generation Context
// ================================

export {
  ContextMetadataSchema,
  CreateContextParamsSchema,
  // Schemas
  GenerationContextIdSchema,
  clone as cloneContext,
  // Operations
  create as createContext,
  createPreset,
  update as updateContext,
  validateGenerationCompatibility,
  // Types
  type ContextMetadata,
  type CreateContextParams,
} from './generation_context.js'

// ================================
// Generation State
// ================================

export {
  ChunkGenerationInfoSchema,
  // Schemas
  GenerationStateSchema,
  GenerationStatisticsSchema,
  GenerationStatusSchema,
  completeChunkGeneration,
  // Operations
  createInitial,
  failChunkGeneration,
  getChunkGenerationStatus,
  getCurrentGenerationLoad,
  getGenerationProgress,
  startChunkGeneration,
  type ChunkGenerationInfo,
  // Types
  type GenerationState,
  type GenerationStatistics,
  type GenerationStatus,
} from './generation_state.js'

// ================================
// Business Rules
// ================================

export {
  GENERATION_TIMEOUT_MS,
  MAX_CHUNK_DISTANCE_FROM_ORIGIN,
  // Constants
  MAX_CONCURRENT_GENERATIONS,
  MAX_GENERATION_ATTEMPTS,
  validateChunkGenerationRequest,
  // Validation Functions
  validateCreationContext,
  validateDataIntegrity,
  validateSettingsUpdate,
  validateStateIntegrity,
  validateStructuralIntegrity,
} from './business_rules.js'

// ================================
// Domain Events
// ================================

export {
  BaseEventSchema,
  ChunkGeneratedSchema,
  ChunkGenerationFailedSchema,
  ChunkGenerationStartedSchema,
  EventPublisherTag,
  // Service Tags
  EventStoreTag,
  GeneratorPausedSchema,
  GeneratorResumedSchema,
  InMemoryEventPublisher,
  // Implementations
  InMemoryEventStore,
  SettingsUpdatedSchema,
  StatisticsUpdatedSchema,
  WorldGeneratorCreatedSchema,
  // Event Schemas
  WorldGeneratorEventSchema,
  createChunkGenerated,
  createChunkGenerationFailed,
  createChunkGenerationStarted,
  createSettingsUpdated,
  // Event Factory Functions
  createWorldGeneratorCreated,
  loadEvents,
  // Event Services
  publish,
  saveEvents,
  subscribe,
  type BaseEvent,
  type ChunkGenerated,
  type ChunkGenerationFailed,
  type ChunkGenerationStarted,
  type EventPublisher,
  type EventStore,
  type GeneratorPaused,
  type GeneratorResumed,
  type SettingsUpdated,
  type StatisticsUpdated,
  type WorldGeneratorCreated,
  // Event Types
  type WorldGeneratorEvent,
} from './events.js'
