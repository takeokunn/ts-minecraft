/**
 * @fileoverview Events Export Module for World Domain
 * イベント型の統合エクスポート
 */

import { Schema } from 'effect'

export * from './world-events'
export * from './generation-events'
export * from './lifecycle-events'

// 主要イベントタイプの再エクスポート
export type {
  // World Events
  EventMetadata,
  DomainEvent,
  WorldCreatedEvent,
  WorldDestroyedEvent,
  WorldLoadedEvent,
  WorldUnloadedEvent,
  WorldSavedEvent,
  WorldSettingsChangedEvent,
  PlayerJoinedWorldEvent,
  PlayerLeftWorldEvent,
  PlayerChangedDimensionEvent,
  WeatherChangedEvent,
  TimeAdvancedEvent,
  DimensionCreatedEvent,
  DimensionDestroyedEvent,
  WorldDomainEvent,
} from './world-events'

export type {
  // Generation Events
  ChunkGenerationStartedEvent,
  ChunkGenerationCompletedEvent,
  ChunkGenerationFailedEvent,
  TerrainGeneratedEvent,
  BiomeAssignedEvent,
  StructurePlacedEvent,
  NoiseGeneratedEvent,
  HeightMapGeneratedEvent,
  GenerationSessionStartedEvent,
  GenerationSessionCompletedEvent,
  GenerationPerformanceRecordedEvent,
  GenerationDomainEvent,
} from './generation-events'

export type {
  // Lifecycle Events
  SystemInitializedEvent,
  SystemShutdownEvent,
  ResourcesAllocatedEvent,
  ResourcesReleasedEvent,
  ChunkLoadedEvent,
  ChunkUnloadedEvent,
  PerformanceThresholdExceededEvent,
  MemoryUsageRecordedEvent,
  BackupCreatedEvent,
  RestoreCompletedEvent,
  LifecycleDomainEvent,
} from './lifecycle-events'

// 主要スキーマの再エクスポート
export {
  // World Event Schemas
  EventMetadataSchema,
  DomainEventSchema,
  WorldCreatedEventSchema,
  WorldDestroyedEventSchema,
  WorldLoadedEventSchema,
  WorldUnloadedEventSchema,
  WorldSavedEventSchema,
  WorldSettingsChangedEventSchema,
  PlayerJoinedWorldEventSchema,
  PlayerLeftWorldEventSchema,
  PlayerChangedDimensionEventSchema,
  WeatherChangedEventSchema,
  TimeAdvancedEventSchema,
  DimensionCreatedEventSchema,
  DimensionDestroyedEventSchema,
  WorldDomainEventSchema,
} from './world-events'

export {
  // Generation Event Schemas
  ChunkGenerationStartedEventSchema,
  ChunkGenerationCompletedEventSchema,
  ChunkGenerationFailedEventSchema,
  TerrainGeneratedEventSchema,
  BiomeAssignedEventSchema,
  StructurePlacedEventSchema,
  NoiseGeneratedEventSchema,
  HeightMapGeneratedEventSchema,
  GenerationSessionStartedEventSchema,
  GenerationSessionCompletedEventSchema,
  GenerationPerformanceRecordedEventSchema,
  GenerationDomainEventSchema,
} from './generation-events'

export {
  // Lifecycle Event Schemas
  SystemInitializedEventSchema,
  SystemShutdownEventSchema,
  ResourcesAllocatedEventSchema,
  ResourcesReleasedEventSchema,
  ChunkLoadedEventSchema,
  ChunkUnloadedEventSchema,
  PerformanceThresholdExceededEventSchema,
  MemoryUsageRecordedEventSchema,
  BackupCreatedEventSchema,
  RestoreCompletedEventSchema,
  LifecycleDomainEventSchema,
} from './lifecycle-events'

// ヘルパー関数の再エクスポート
export {
  // World Event Helpers
  createEventMetadata,
  createWorldCreatedEvent,
  createPlayerJoinedWorldEvent,
  createWeatherChangedEvent,
  createTimeAdvancedEvent,
} from './world-events'

export {
  // Generation Event Helpers
  createChunkGenerationStartedEvent,
  createChunkGenerationCompletedEvent,
  createTerrainGeneratedEvent,
  createBiomeAssignedEvent,
  createStructurePlacedEvent,
} from './generation-events'

export {
  // Lifecycle Event Helpers
  createSystemInitializedEvent,
  createResourcesAllocatedEvent,
  createChunkLoadedEvent,
  createPerformanceThresholdExceededEvent,
  createBackupCreatedEvent,
} from './lifecycle-events'

// 統合イベント型
export type WorldTypesEvent =
  | WorldDomainEvent
  | GenerationDomainEvent
  | LifecycleDomainEvent

export const WorldTypesEventSchema = Schema.Union(
  WorldDomainEventSchema,
  GenerationDomainEventSchema,
  LifecycleDomainEventSchema
).pipe(
  Schema.annotations({
    title: 'World Types Event',
    description: 'Union of all world domain event types',
  })
)

// イベントカテゴリ分類
export const EVENT_CATEGORIES = {
  WORLD_LIFECYCLE: 'world_lifecycle',
  PLAYER_INTERACTION: 'player_interaction',
  DIMENSION_MANAGEMENT: 'dimension_management',
  WEATHER_SYSTEM: 'weather_system',
  TIME_SYSTEM: 'time_system',
  CHUNK_GENERATION: 'chunk_generation',
  TERRAIN_GENERATION: 'terrain_generation',
  BIOME_ASSIGNMENT: 'biome_assignment',
  STRUCTURE_PLACEMENT: 'structure_placement',
  NOISE_GENERATION: 'noise_generation',
  GENERATION_PERFORMANCE: 'generation_performance',
  SYSTEM_LIFECYCLE: 'system_lifecycle',
  RESOURCE_MANAGEMENT: 'resource_management',
  CHUNK_LIFECYCLE: 'chunk_lifecycle',
  PERFORMANCE_MONITORING: 'performance_monitoring',
  BACKUP_RECOVERY: 'backup_recovery',
} as const

export type EventCategory = typeof EVENT_CATEGORIES[keyof typeof EVENT_CATEGORIES]

// イベント重要度レベル
export const EVENT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type EventPriority = typeof EVENT_PRIORITY[keyof typeof EVENT_PRIORITY]

// イベント処理ステータス
export const EVENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const

export type EventStatus = typeof EVENT_STATUS[keyof typeof EVENT_STATUS]