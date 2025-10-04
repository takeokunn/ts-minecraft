/**
 * @fileoverview Core Types Export Module for World Domain
 * コア型の統合エクスポート
 */

export * from './biome_types'
export * from './coordinate_types'
export * from './generation_types'
export * from './world_types'

// 主要型の再エクスポート
export type {
  ChunkCoordinate,
  ChunkPosition,
  Difficulty,
  DimensionId,
  GameMode,
  GameTime,
  Height,
  SectionCoordinate,
  SectionPosition,
  Vector2D,
  Vector3D,
  WeatherState,
  WeatherType,
  WorldAge,
  WorldBorder,
  WorldCoordinate,
  // World Types
  WorldId,
  WorldSeed,
  WorldSettings,
  WorldState,
} from './world_types'

export type {
  BiomeGenerationData,
  BoundingBox,
  ChunkGenerationResult,
  GenerationContext,
  GenerationPerformanceStats,
  GenerationRequestId,
  // Generation Types
  GenerationSessionId,
  GenerationSettings,
  GenerationStage,
  GenerationStageProgress,
  GenerationStageStatus,
  HeightMap,
  HeightMapValue,
  NoiseCoordinate,
  NoiseParameters,
  NoiseValue,
  NormalizedNoiseValue,
  StructureInfo,
  StructureType,
} from './generation_types'

export type {
  // Coordinate Types
  BlockCoordinate,
  BlockPosition,
  ChunkLocalCoordinate,
  ChunkLocalPosition,
  CircularArea,
  Direction,
  Distance,
  DistanceMeasurement,
  FloatBoundingBox,
  HorizontalDirection,
  IntBoundingBox,
  PixelCoordinate,
  PixelPosition,
  RectangularArea,
  RegionCoordinate,
  RegionPosition,
  RelativePosition,
  Rotation3D,
  RotationDegrees,
  RotationRadians,
} from './coordinate_types'

export type {
  BiomeCategory,
  BiomeColors,
  BiomeDefinition,
  BiomeDistributionEntry,
  BiomeDistributionTable,
  // Biome Types
  BiomeId,
  BiomeMobSpawning,
  BiomeSounds,
  BiomeStructureGeneration,
  BiomeTerrainFeatures,
  BiomeTransitionRule,
  BiomeWeight,
  BlockType,
  ClimateData,
  Continentalness,
  Depth,
  Erosion,
  GenerationDensity,
  GenerationProbability,
  Humidity,
  PrecipitationType,
  Temperature,
  Weirdness,
} from './biome_types'

// 主要スキーマの再エクスポート
export {
  ChunkCoordinateSchema,
  ChunkPositionSchema,
  DimensionIdSchema,
  HeightSchema,
  Vector2DSchema,
  Vector3DSchema,
  WorldCoordinateSchema,
  // World Schemas
  WorldIdSchema,
  WorldSeedSchema,
  WorldSettingsSchema,
  WorldStateSchema,
} from './world_types'

export {
  ChunkGenerationResultSchema,
  GenerationContextSchema,
  // Generation Schemas
  GenerationSessionIdSchema,
  GenerationSettingsSchema,
  GenerationStageSchema,
  HeightMapSchema,
  NoiseParametersSchema,
  NoiseValueSchema,
  NormalizedNoiseValueSchema,
} from './generation_types'

export {
  // Coordinate Schemas
  BlockCoordinateSchema,
  BlockPositionSchema,
  DirectionSchema,
  DistanceSchema,
  FloatBoundingBoxSchema,
  IntBoundingBoxSchema,
  PixelCoordinateSchema,
  PixelPositionSchema,
  Rotation3DSchema,
} from './coordinate_types'

export {
  BiomeCategorySchema,
  BiomeColorsSchema,
  BiomeDefinitionSchema,
  BiomeDistributionTableSchema,
  // Biome Schemas
  BiomeIdSchema,
  ClimateDataSchema,
  HumiditySchema,
  TemperatureSchema,
} from './biome_types'

// ヘルパー関数の再エクスポート
export {
  createChunkPosition,
  // World Helpers
  createVector3D,
  createWorldId,
  createWorldSeed,
} from './world_types'

export {
  createGenerationRequestId,
  createGenerationSessionId,
  createHeightMapValue,
  // Generation Helpers
  createNoiseValue,
  createNormalizedNoiseValue,
} from './generation_types'

export {
  // Coordinate Helpers
  createBlockPosition,
  createChunkLocalPosition,
  createIntBoundingBox,
  createPixelPosition,
  createRotation3D,
} from './coordinate_types'

export {
  // Biome Helpers
  createBiomeId,
  createClimateData,
  createGenerationDensity,
  createGenerationProbability,
  createHumidity,
  createTemperature,
} from './biome_types'

// 定数の再エクスポート
export { COORDINATE_CONSTANTS } from './coordinate_types'
