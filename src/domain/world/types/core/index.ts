/**
 * @fileoverview Core Types Export Module for World Domain
 * コア型の統合エクスポート
 */

export * from './world_types'
export * from './generation_types'
export * from './coordinate_types'
export * from './biome_types'

// 主要型の再エクスポート
export type {
  // World Types
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
} from './world_types'

export type {
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
} from './generation_types'

export type {
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
} from './coordinate_types'

export type {
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
} from './biome_types'

// 主要スキーマの再エクスポート
export {
  // World Schemas
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
} from './world_types'

export {
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
} from './generation_types'

export {
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
} from './coordinate_types'

export {
  // Biome Schemas
  BiomeIdSchema,
  BiomeCategorySchema,
  TemperatureSchema,
  HumiditySchema,
  ClimateDataSchema,
  BiomeColorsSchema,
  BiomeDefinitionSchema,
  BiomeDistributionTableSchema,
} from './biome_types'

// ヘルパー関数の再エクスポート
export {
  // World Helpers
  createVector3D,
  createChunkPosition,
  createWorldId,
  createWorldSeed,
} from './world_types'

export {
  // Generation Helpers
  createNoiseValue,
  createNormalizedNoiseValue,
  createHeightMapValue,
  createGenerationSessionId,
  createGenerationRequestId,
} from './generation_types'

export {
  // Coordinate Helpers
  createBlockPosition,
  createPixelPosition,
  createChunkLocalPosition,
  createIntBoundingBox,
  createRotation3D,
} from './coordinate_types'

export {
  // Biome Helpers
  createBiomeId,
  createTemperature,
  createHumidity,
  createClimateData,
  createGenerationDensity,
  createGenerationProbability,
} from './biome_types'

// 定数の再エクスポート
export { COORDINATE_CONSTANTS } from './coordinate_types'