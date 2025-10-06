/**
 * @fileoverview World Domain Types - Main Export Module
 * ワールドドメインの型定義統合エクスポート
 *
 * DDD (Domain-Driven Design) アーキテクチャに基づいた
 * World ドメインの完全な型システムを提供します。
 *
 * Effect-TS 3.17+ のベストプラクティスに従い、
 * 以下の機能を提供します：
 * - Brand Types による型安全性
 * - Schema による実行時検証
 * - 構造化エラーハンドリング
 * - Event Sourcing 対応イベント
 */

import { Schema } from 'effect'
import { WORLD_DOMAIN_CONSTANTS } from './constants'
import {
  BiomeDefinitionSchema,
  BiomeIdSchema,
  BlockCoordinateSchema,
  ChunkCoordinateSchema,
  ClimateDataSchema,
  GenerationContextSchema,
  GenerationStageSchema,
  NoiseValueSchema,
  WorldCoordinateSchema,
  WorldIdSchema,
  WorldSeedSchema,
  WorldSettingsSchema,
  WorldStateSchema,
} from './core'
import { WorldTypesErrorSchema } from './errors'
import { WorldTypesEventSchema } from './events'

// === ディレクトリ別エクスポート ===

// Constants - 定数定義
export * from './constants'

// Core - コア型定義
export * from './core'

// Errors - エラー型定義
export * from './errors'

// Events - イベント型定義
export * from './events'

// === 主要型の直接エクスポート ===

// Core Types
export type {
  BiomeCategory,
  BiomeColors,
  BiomeDefinition,
  BiomeDistributionEntry,
  BiomeDistributionTable,
  BiomeGenerationData,
  // Biome Types
  BiomeId,
  BiomeMobSpawning,
  BiomeSounds,
  BiomeStructureGeneration,
  BiomeTerrainFeatures,
  BiomeTransitionRule,
  BiomeWeight,
  // Coordinate Types
  BlockCoordinate,
  BlockPosition,
  BlockType,
  BoundingBox,
  ChunkCoordinate,
  ChunkGenerationResult,
  ChunkLocalCoordinate,
  ChunkLocalPosition,
  ChunkPosition,
  CircularArea,
  ClimateData,
  Continentalness,
  Depth,
  Difficulty,
  DimensionId,
  Direction,
  Distance,
  DistanceMeasurement,
  Erosion,
  FloatBoundingBox,
  GameMode,
  GameTime,
  GenerationContext,
  GenerationDensity,
  GenerationPerformanceStats,
  GenerationProbability,
  GenerationRequestId,
  // Generation Types
  GenerationSessionId,
  GenerationSettings,
  GenerationStage,
  GenerationStageProgress,
  GenerationStageStatus,
  Height,
  HeightMap,
  HeightMapValue,
  HorizontalDirection,
  Humidity,
  IntBoundingBox,
  NoiseCoordinate,
  NoiseParameters,
  NoiseValue,
  NormalizedNoiseValue,
  PixelCoordinate,
  PixelPosition,
  PrecipitationType,
  RectangularArea,
  RegionCoordinate,
  RegionPosition,
  RelativePosition,
  Rotation3D,
  RotationDegrees,
  RotationRadians,
  SectionCoordinate,
  SectionPosition,
  StructureInfo,
  StructureType,
  Temperature,
  Vector2D,
  Vector3D,
  WeatherState,
  WeatherType,
  Weirdness,
  WorldAge,
  WorldBorder,
  WorldCoordinate,
  // World Core Types
  WorldId,
  WorldSeed,
  WorldSettings,
  WorldState,
} from './core'

// Constants (exported as values, not types)
// Note: Constants are exported as const objects from ./constants

// Error Types
export type {
  BiomeAssignmentError,
  ChunkGenerationError,
  ErrorContext,
  // Generation Errors
  GenerationDomainError,
  InvalidCoordinateError,
  NoiseGenerationError,
  NumberOutOfRangeError,
  PatternMismatchError,
  SchemaValidationError,
  // Validation Errors
  ValidationDomainError,
  WorldCreationError,
  // World Errors
  WorldDomainError,
  WorldNotFoundError,
  // Unified Error Type
  WorldTypesError,
} from './errors'

// Event Types
export type {
  ChunkGenerationCompletedEvent,
  ChunkGenerationStartedEvent,
  ChunkLoadedEvent,
  // Generation Events
  GenerationDomainEvent,
  // Lifecycle Events
  LifecycleDomainEvent,
  PerformanceThresholdExceededEvent,
  PlayerJoinedWorldEvent,
  SystemInitializedEvent,
  TerrainGeneratedEvent,
  WeatherChangedEvent,
  WorldCreatedEvent,
  // World Events
  WorldDomainEvent,
  // Unified Event Type
  WorldTypesEvent,
} from './events'

// === 主要スキーマの直接エクスポート ===

export {
  BiomeCategorySchema,
  BiomeColorsSchema,
  BiomeDefinitionSchema,
  BiomeDistributionTableSchema,
  // Biome Schemas
  BiomeIdSchema,
  // Coordinate Schemas
  BlockCoordinateSchema,
  BlockPositionSchema,
  ChunkCoordinateSchema,
  ChunkGenerationResultSchema,
  ChunkPositionSchema,
  ClimateDataSchema,
  DimensionIdSchema,
  DirectionSchema,
  DistanceSchema,
  FloatBoundingBoxSchema,
  GenerationContextSchema,
  // Generation Schemas
  GenerationSessionIdSchema,
  GenerationSettingsSchema,
  GenerationStageSchema,
  HeightMapSchema,
  HeightSchema,
  HumiditySchema,
  IntBoundingBoxSchema,
  NoiseParametersSchema,
  NoiseValueSchema,
  NormalizedNoiseValueSchema,
  PixelCoordinateSchema,
  PixelPositionSchema,
  Rotation3DSchema,
  TemperatureSchema,
  Vector2DSchema,
  Vector3DSchema,
  WorldCoordinateSchema,
  // Core Schemas
  WorldIdSchema,
  WorldSeedSchema,
  WorldSettingsSchema,
  WorldStateSchema,
} from './core'

export {
  BIOME_CONSTANTS,
  GENERATION_CONSTANTS,
  NOISE_CONSTANTS,
  // Constant Schemas
  WORLD_CONSTANTS,
} from './constants'

export {
  GenerationDomainErrorSchema,
  ValidationDomainErrorSchema,
  WorldDomainErrorSchema,
  // Error Schemas
  WorldTypesErrorSchema,
} from './errors'

export {
  GenerationDomainEventSchema,
  LifecycleDomainEventSchema,
  WorldDomainEventSchema,
  // Event Schemas
  WorldTypesEventSchema,
} from './events'

// === ヘルパー関数 ===

export {
  // Biome Helpers
  createBiomeId,
  // Coordinate Helpers
  createBlockPosition,
  createChunkLocalPosition,
  createChunkPosition,
  createClimateData,
  createGenerationDensity,
  createGenerationProbability,
  createGenerationRequestId,
  createGenerationSessionId,
  createHeightMapValue,
  createHumidity,
  createIntBoundingBox,
  // Generation Helpers
  createNoiseValue,
  createNormalizedNoiseValue,
  createPixelPosition,
  createRotation3D,
  createTemperature,
  // Core Helpers
  createVector3D,
  createWorldId,
  createWorldSeed,
} from './core'

export {
  createChunkGenerationError,
  // Error Helpers
  createErrorContext,
  createNumberOutOfRangeError,
  createSchemaValidationError,
  createWorldNotFoundError,
} from './errors'

export {
  createChunkGenerationStartedEvent,
  // Event Helpers
  createEventMetadata,
  createSystemInitializedEvent,
  createWorldCreatedEvent,
} from './events'

// === 統合型システム ===

/**
 * World Domain Types の全体型
 * すべての型定義を統合した最上位の型
 */
export type WorldDomainTypes = {
  // Core Types
  readonly core: {
    readonly world: {
      readonly id: WorldId
      readonly seed: WorldSeed
      readonly settings: WorldSettings
      readonly state: WorldState
    }
    readonly generation: {
      readonly noiseValue: NoiseValue
      readonly biomeId: BiomeId
      readonly stage: GenerationStage
      readonly context: GenerationContext
    }
    readonly coordinate: {
      readonly block: BlockCoordinate
      readonly chunk: ChunkCoordinate
      readonly world: WorldCoordinate
    }
    readonly biome: {
      readonly climate: ClimateData
      readonly definition: BiomeDefinition
    }
  }

  // Error Types
  readonly errors: WorldTypesError

  // Event Types
  readonly events: WorldTypesEvent

  // Constants
  readonly constants: typeof WORLD_DOMAIN_CONSTANTS
}

/**
 * World Domain Types のスキーマ定義
 */
export const WorldDomainTypesSchema = Schema.Struct({
  core: Schema.Struct({
    world: Schema.Struct({
      id: WorldIdSchema,
      seed: WorldSeedSchema,
      settings: WorldSettingsSchema,
      state: WorldStateSchema,
    }),
    generation: Schema.Struct({
      noiseValue: NoiseValueSchema,
      biomeId: BiomeIdSchema,
      stage: GenerationStageSchema,
      context: GenerationContextSchema,
    }),
    coordinate: Schema.Struct({
      block: BlockCoordinateSchema,
      chunk: ChunkCoordinateSchema,
      world: WorldCoordinateSchema,
    }),
    biome: Schema.Struct({
      climate: ClimateDataSchema,
      definition: BiomeDefinitionSchema,
    }),
  }),
  errors: WorldTypesErrorSchema,
  events: WorldTypesEventSchema,
}).pipe(
  Schema.annotations({
    title: 'World Domain Types',
    description: 'Complete type system for World Domain following DDD principles',
  })
)

// === メタデータ ===

/**
 * World Domain Types のバージョン情報
 */
export const WORLD_TYPES_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  suffix: 'alpha',
} as const

export type WorldTypesVersion = typeof WORLD_TYPES_VERSION

/**
 * World Domain Types の機能フラグ
 */
export const WORLD_TYPES_FEATURES = {
  BRAND_TYPES: true,
  SCHEMA_VALIDATION: true,
  STRUCTURED_ERRORS: true,
  EVENT_SOURCING: true,
  PERFORMANCE_MONITORING: true,
  BATCH_OPERATIONS: true,
  ASYNC_VALIDATION: true,
  SERIALIZATION: true,
} as const

export type WorldTypesFeatures = typeof WORLD_TYPES_FEATURES

/**
 * World Domain Types の設定
 */
export const WORLD_TYPES_CONFIG = {
  version: WORLD_TYPES_VERSION,
  features: WORLD_TYPES_FEATURES,
  schema: {
    strictMode: true,
    validateOnAccess: false,
    enableMemoization: true,
  },
  performance: {
    enableMetrics: true,
    enableProfiling: false,
    batchSize: 1000,
  },
} as const

export type WorldTypesConfig = typeof WORLD_TYPES_CONFIG

// === 型ガード ===

/**
 * World Domain Error の型ガード
 */
export const isWorldDomainError = (error: unknown): error is WorldTypesError => {
  return Schema.is(WorldTypesErrorSchema)(error)
}

/**
 * World Domain Event の型ガード
 */
export const isWorldDomainEvent = (event: unknown): event is WorldTypesEvent => {
  return Schema.is(WorldTypesEventSchema)(event)
}

/**
 * Brand 型の型ガード
 */
export const isWorldId = (value: unknown): value is WorldId => {
  return Schema.is(WorldIdSchema)(value)
}

export const isWorldSeed = (value: unknown): value is WorldSeed => {
  return Schema.is(WorldSeedSchema)(value)
}

export const isWorldCoordinate = (value: unknown): value is WorldCoordinate => {
  return Schema.is(WorldCoordinateSchema)(value)
}

// === デバッグユーティリティ ===

/**
 * 型システムの整合性をチェックする関数
 */
export const validateWorldTypesIntegrity = () => {
  const checks = {
    schemas: {
      worldId: !!WorldIdSchema,
      worldSeed: !!WorldSeedSchema,
      worldCoordinate: !!WorldCoordinateSchema,
      error: !!WorldTypesErrorSchema,
      event: !!WorldTypesEventSchema,
    },
    constants: {
      world: typeof WORLD_CONSTANTS === 'object',
      generation: typeof GENERATION_CONSTANTS === 'object',
      biome: typeof BIOME_CONSTANTS === 'object',
      noise: typeof NOISE_CONSTANTS === 'object',
    },
    config: {
      version: typeof WORLD_TYPES_VERSION === 'object',
      features: typeof WORLD_TYPES_FEATURES === 'object',
      config: typeof WORLD_TYPES_CONFIG === 'object',
    },
  }

  return checks
}
