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
  // World Core Types
  WorldId,
  WorldSeed,
  DimensionId,
  WorldCoordinate,
  ChunkCoordinate,
  SectionCoordinate,
  Height,
  Vector2D,
  Vector3D,
  ChunkPosition,
  SectionPosition,
  WorldBorder,
  GameTime,
  WorldAge,
  Difficulty,
  GameMode,
  WorldSettings,
  WorldState,
  WeatherType,
  WeatherState,

  // Generation Types
  GenerationSessionId,
  GenerationRequestId,
  NoiseValue,
  NormalizedNoiseValue,
  NoiseCoordinate,
  NoiseParameters,
  HeightMapValue,
  HeightMap,
  GenerationStage,
  GenerationStageStatus,
  GenerationStageProgress,
  GenerationSettings,
  ChunkGenerationResult,
  BiomeGenerationData,
  StructureType,
  StructureInfo,
  BoundingBox,
  GenerationPerformanceStats,
  GenerationContext,

  // Coordinate Types
  BlockCoordinate,
  PixelCoordinate,
  RegionCoordinate,
  BlockPosition,
  PixelPosition,
  RegionPosition,
  RelativePosition,
  ChunkLocalCoordinate,
  ChunkLocalPosition,
  IntBoundingBox,
  FloatBoundingBox,
  RectangularArea,
  CircularArea,
  Direction,
  HorizontalDirection,
  RotationDegrees,
  RotationRadians,
  Rotation3D,
  Distance,
  DistanceMeasurement,

  // Biome Types
  BiomeId,
  BiomeCategory,
  Temperature,
  Humidity,
  Continentalness,
  Erosion,
  Depth,
  Weirdness,
  PrecipitationType,
  ClimateData,
  BiomeColors,
  BiomeSounds,
  BlockType,
  GenerationDensity,
  GenerationProbability,
  BiomeTerrainFeatures,
  BiomeStructureGeneration,
  BiomeMobSpawning,
  BiomeDefinition,
  BiomeWeight,
  BiomeDistributionEntry,
  BiomeDistributionTable,
  BiomeTransitionRule,
} from './core'

// Constants (exported as values, not types)
// Note: Constants are exported as const objects from ./constants

// Error Types
export type {
  // World Errors
  WorldDomainError,
  ErrorContext,
  WorldNotFoundError,
  WorldCreationError,
  InvalidCoordinateError,

  // Generation Errors
  GenerationDomainError,
  ChunkGenerationError,
  NoiseGenerationError,
  BiomeAssignmentError,

  // Validation Errors
  ValidationDomainError,
  SchemaValidationError,
  NumberOutOfRangeError,
  PatternMismatchError,

  // Unified Error Type
  WorldTypesError,
} from './errors'

// Event Types
export type {
  // World Events
  WorldDomainEvent,
  WorldCreatedEvent,
  PlayerJoinedWorldEvent,
  WeatherChangedEvent,

  // Generation Events
  GenerationDomainEvent,
  ChunkGenerationStartedEvent,
  ChunkGenerationCompletedEvent,
  TerrainGeneratedEvent,

  // Lifecycle Events
  LifecycleDomainEvent,
  SystemInitializedEvent,
  ChunkLoadedEvent,
  PerformanceThresholdExceededEvent,

  // Unified Event Type
  WorldTypesEvent,
} from './events'

// === 主要スキーマの直接エクスポート ===

export {
  // Core Schemas
  WorldIdSchema,
  WorldSeedSchema,
  DimensionIdSchema,
  WorldCoordinateSchema,
  ChunkCoordinateSchema,
  HeightSchema,
  Vector2DSchema,
  Vector3DSchema,
  ChunkPositionSchema,
  WorldSettingsSchema,
  WorldStateSchema,

  // Generation Schemas
  GenerationSessionIdSchema,
  NoiseValueSchema,
  NormalizedNoiseValueSchema,
  NoiseParametersSchema,
  HeightMapSchema,
  GenerationStageSchema,
  GenerationSettingsSchema,
  ChunkGenerationResultSchema,
  GenerationContextSchema,

  // Coordinate Schemas
  BlockCoordinateSchema,
  PixelCoordinateSchema,
  BlockPositionSchema,
  PixelPositionSchema,
  IntBoundingBoxSchema,
  FloatBoundingBoxSchema,
  DirectionSchema,
  Rotation3DSchema,
  DistanceSchema,

  // Biome Schemas
  BiomeIdSchema,
  BiomeCategorySchema,
  TemperatureSchema,
  HumiditySchema,
  ClimateDataSchema,
  BiomeColorsSchema,
  BiomeDefinitionSchema,
  BiomeDistributionTableSchema,
} from './core'

export {
  // Constant Schemas
  WORLD_CONSTANTS,
  GENERATION_CONSTANTS,
  BIOME_CONSTANTS,
  NOISE_CONSTANTS,
} from './constants'

export {
  // Error Schemas
  WorldTypesErrorSchema,
  WorldDomainErrorSchema,
  GenerationDomainErrorSchema,
  ValidationDomainErrorSchema,
} from './errors'

export {
  // Event Schemas
  WorldTypesEventSchema,
  WorldDomainEventSchema,
  GenerationDomainEventSchema,
  LifecycleDomainEventSchema,
} from './events'

// === ヘルパー関数 ===

export {
  // Core Helpers
  createVector3D,
  createChunkPosition,
  createWorldId,
  createWorldSeed,

  // Generation Helpers
  createNoiseValue,
  createNormalizedNoiseValue,
  createHeightMapValue,
  createGenerationSessionId,
  createGenerationRequestId,

  // Coordinate Helpers
  createBlockPosition,
  createPixelPosition,
  createChunkLocalPosition,
  createIntBoundingBox,
  createRotation3D,

  // Biome Helpers
  createBiomeId,
  createTemperature,
  createHumidity,
  createClimateData,
  createGenerationDensity,
  createGenerationProbability,
} from './core'

export {
  // Error Helpers
  createErrorContext,
  createWorldNotFoundError,
  createChunkGenerationError,
  createSchemaValidationError,
  createNumberOutOfRangeError,
} from './errors'

export {
  // Event Helpers
  createEventMetadata,
  createWorldCreatedEvent,
  createChunkGenerationStartedEvent,
  createSystemInitializedEvent,
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