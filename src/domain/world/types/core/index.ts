/**
 * @fileoverview Core Types Export Module for World Domain
 * コア型の統合エクスポート
 */

export * from './index'
export * from './index'
export * from './index'
export * from './index'

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
} from './index'

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
} from './index'

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
} from './index'

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
} from './index'

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
} from './index'

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
} from './index'

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
} from './index'

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
} from './index'

// ヘルパー関数の再エクスポート
export {
  createChunkPosition,
  // World Helpers
  createVector3D,
  createWorldId,
  createWorldSeed,
} from './index'

export {
  createGenerationRequestId,
  createGenerationSessionId,
  createHeightMapValue,
  // Generation Helpers
  createNoiseValue,
  createNormalizedNoiseValue,
} from './index'

export {
  // Coordinate Helpers
  createBlockPosition,
  createChunkLocalPosition,
  createIntBoundingBox,
  createPixelPosition,
  createRotation3D,
} from './index'

export {
  // Biome Helpers
  createBiomeId,
  createClimateData,
  createGenerationDensity,
  createGenerationProbability,
  createHumidity,
  createTemperature,
} from './index'

// 定数の再エクスポート
export { COORDINATE_CONSTANTS } from './index'
export * from './index';
export * from './index';
export * from './world_types';
export * from './coordinate_types';
export * from './biome_types';
