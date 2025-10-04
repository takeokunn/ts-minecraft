/**
 * @fileoverview WorldGenerator Aggregate Index
 *
 * WorldGenerator集約の統合エクスポート
 */

// ================================
// Core Aggregate
// ================================

export {
  // Types
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
  create,
  generateChunk,
  updateSettings,
  validateIntegrity,

  // Service
  WorldGeneratorTag,
  WorldGeneratorLive,
} from "./world_generator.js"

// ================================
// Generation Context
// ================================

export {
  // Types
  type ContextMetadata,
  type CreateContextParams,

  // Schemas
  GenerationContextIdSchema,
  ContextMetadataSchema,
  CreateContextParamsSchema,

  // Operations
  create as createContext,
  update as updateContext,
  clone as cloneContext,
  createPreset,
  validateGenerationCompatibility,
} from "./generation_context.js"

// ================================
// Generation State
// ================================

export {
  // Types
  type GenerationState,
  type GenerationStatus,
  type ChunkGenerationInfo,
  type GenerationStatistics,

  // Schemas
  GenerationStateSchema,
  GenerationStatusSchema,
  ChunkGenerationInfoSchema,
  GenerationStatisticsSchema,

  // Operations
  createInitial,
  startChunkGeneration,
  completeChunkGeneration,
  failChunkGeneration,
  getCurrentGenerationLoad,
  getGenerationProgress,
  getChunkGenerationStatus,
} from "./generation_state.js"

// ================================
// Business Rules
// ================================

export {
  // Constants
  MAX_CONCURRENT_GENERATIONS,
  MAX_GENERATION_ATTEMPTS,
  GENERATION_TIMEOUT_MS,
  MAX_CHUNK_DISTANCE_FROM_ORIGIN,

  // Validation Functions
  validateCreationContext,
  validateChunkGenerationRequest,
  validateSettingsUpdate,
  validateStructuralIntegrity,
  validateDataIntegrity,
  validateStateIntegrity,
} from "./business_rules.js"

// ================================
// Domain Events
// ================================

export {
  // Event Types
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

  // Event Schemas
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

  // Event Factory Functions
  createWorldGeneratorCreated,
  createChunkGenerationStarted,
  createChunkGenerated,
  createChunkGenerationFailed,
  createSettingsUpdated,

  // Event Services
  publish,
  subscribe,
  saveEvents,
  loadEvents,

  // Service Tags
  EventStoreTag,
  EventPublisherTag,

  // Implementations
  InMemoryEventStore,
  InMemoryEventPublisher,
} from "./events.js"