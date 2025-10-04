/**
 * @fileoverview Events Export Module for World Domain
 * イベント型の統合エクスポート
 */

import { Schema } from 'effect'

export * from './generation_events'
export * from './lifecycle_events'
export * from './world_events'

// 主要イベントタイプの再エクスポート
export type {
  DimensionCreatedEvent,
  DimensionDestroyedEvent,
  DomainEvent,
  // World Events
  EventMetadata,
  PlayerChangedDimensionEvent,
  PlayerJoinedWorldEvent,
  PlayerLeftWorldEvent,
  TimeAdvancedEvent,
  WeatherChangedEvent,
  WorldCreatedEvent,
  WorldDestroyedEvent,
  WorldDomainEvent,
  WorldLoadedEvent,
  WorldSavedEvent,
  WorldSettingsChangedEvent,
  WorldUnloadedEvent,
} from './world_events'

export type {
  BiomeAssignedEvent,
  ChunkGenerationCompletedEvent,
  ChunkGenerationFailedEvent,
  // Generation Events
  ChunkGenerationStartedEvent,
  GenerationDomainEvent,
  GenerationPerformanceRecordedEvent,
  GenerationSessionCompletedEvent,
  GenerationSessionStartedEvent,
  HeightMapGeneratedEvent,
  NoiseGeneratedEvent,
  StructurePlacedEvent,
  TerrainGeneratedEvent,
} from './generation_events'

export type {
  BackupCreatedEvent,
  ChunkLoadedEvent,
  ChunkUnloadedEvent,
  LifecycleDomainEvent,
  MemoryUsageRecordedEvent,
  PerformanceThresholdExceededEvent,
  ResourcesAllocatedEvent,
  ResourcesReleasedEvent,
  RestoreCompletedEvent,
  // Lifecycle Events
  SystemInitializedEvent,
  SystemShutdownEvent,
} from './lifecycle_events'

// 主要スキーマの再エクスポート
export {
  DimensionCreatedEventSchema,
  DimensionDestroyedEventSchema,
  DomainEventSchema,
  // World Event Schemas
  EventMetadataSchema,
  PlayerChangedDimensionEventSchema,
  PlayerJoinedWorldEventSchema,
  PlayerLeftWorldEventSchema,
  TimeAdvancedEventSchema,
  WeatherChangedEventSchema,
  WorldCreatedEventSchema,
  WorldDestroyedEventSchema,
  WorldDomainEventSchema,
  WorldLoadedEventSchema,
  WorldSavedEventSchema,
  WorldSettingsChangedEventSchema,
  WorldUnloadedEventSchema,
} from './world_events'

export {
  BiomeAssignedEventSchema,
  ChunkGenerationCompletedEventSchema,
  ChunkGenerationFailedEventSchema,
  // Generation Event Schemas
  ChunkGenerationStartedEventSchema,
  GenerationDomainEventSchema,
  GenerationPerformanceRecordedEventSchema,
  GenerationSessionCompletedEventSchema,
  GenerationSessionStartedEventSchema,
  HeightMapGeneratedEventSchema,
  NoiseGeneratedEventSchema,
  StructurePlacedEventSchema,
  TerrainGeneratedEventSchema,
} from './generation_events'

export {
  BackupCreatedEventSchema,
  ChunkLoadedEventSchema,
  ChunkUnloadedEventSchema,
  LifecycleDomainEventSchema,
  MemoryUsageRecordedEventSchema,
  PerformanceThresholdExceededEventSchema,
  ResourcesAllocatedEventSchema,
  ResourcesReleasedEventSchema,
  RestoreCompletedEventSchema,
  // Lifecycle Event Schemas
  SystemInitializedEventSchema,
  SystemShutdownEventSchema,
} from './lifecycle_events'

// ヘルパー関数の再エクスポート
export {
  // World Event Helpers
  createEventMetadata,
  createPlayerJoinedWorldEvent,
  createTimeAdvancedEvent,
  createWeatherChangedEvent,
  createWorldCreatedEvent,
} from './world_events'

export {
  createBiomeAssignedEvent,
  createChunkGenerationCompletedEvent,
  // Generation Event Helpers
  createChunkGenerationStartedEvent,
  createStructurePlacedEvent,
  createTerrainGeneratedEvent,
} from './generation_events'

export {
  createBackupCreatedEvent,
  createChunkLoadedEvent,
  createPerformanceThresholdExceededEvent,
  createResourcesAllocatedEvent,
  // Lifecycle Event Helpers
  createSystemInitializedEvent,
} from './lifecycle_events'

// 統合イベント型
export type WorldTypesEvent = WorldDomainEvent | GenerationDomainEvent | LifecycleDomainEvent

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

export type EventCategory = (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES]

// イベント重要度レベル
export const EVENT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type EventPriority = (typeof EVENT_PRIORITY)[keyof typeof EVENT_PRIORITY]

// イベント処理ステータス
export const EVENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS]
