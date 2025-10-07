import * as Coordinates from '@/domain/biome/value_object/coordinates/index.js'
import * as WorldSeed from '@domain/world/value_object/world_seed/index.js'
import { Brand, Schema } from 'effect'

export type BiomeSystemId = string & Brand.Brand<'BiomeSystemId'>

export const BiomeSystemIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('BiomeSystemId'),
  Schema.annotations({
    title: 'BiomeSystemId',
    description: 'Unique identifier for biome system aggregate',
  })
)

export const createBiomeSystemId = (value: string): BiomeSystemId => Schema.decodeSync(BiomeSystemIdSchema)(value)

export const BiomeSystemConfigurationSchema = Schema.Struct({
  climateModel: Schema.Struct({
    temperatureRange: Schema.Tuple(Schema.Number, Schema.Number),
    humidityRange: Schema.Tuple(Schema.Number, Schema.Number),
    seasonalVariance: Schema.Number,
  }),
  noiseSettings: Schema.Struct({
    octaves: Schema.Number.pipe(Schema.int(), Schema.between(1, 8)),
    frequency: Schema.Number.pipe(Schema.greaterThan(0)),
    lacunarity: Schema.Number.pipe(Schema.greaterThan(0)),
    persistence: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  biomeWeights: Schema.Record({
    key: Schema.String,
    value: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  transitionSettings: Schema.Struct({
    smoothingRadius: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
    steepness: Schema.Number.pipe(Schema.between(0.1, 10.0)),
  }),
})

export type BiomeSystemConfiguration = typeof BiomeSystemConfigurationSchema.Type

export const BiomeSystemSchema = Schema.Struct({
  id: BiomeSystemIdSchema,
  configuration: BiomeSystemConfigurationSchema,
  worldSeed: WorldSeed.WorldSeedSchema,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

export type BiomeSystem = typeof BiomeSystemSchema.Type

export const BiomeDistributionSchema = Schema.Struct({
  chunkCoordinate: Coordinates.ChunkCoordinateSchema,
  dominantBiome: Schema.String,
  biomeDistribution: Schema.Record({
    key: Schema.String,
    value: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  transitionZones: Schema.Array(
    Schema.Struct({
      fromBiome: Schema.String,
      toBiome: Schema.String,
      transitionStrength: Schema.Number.pipe(Schema.between(0, 1)),
      boundaryType: Schema.Literal('smooth', 'sharp', 'gradient'),
    })
  ),
  climateFactors: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.between(-50, 60)),
    humidity: Schema.Number.pipe(Schema.between(0, 100)),
    elevation: Schema.Number.pipe(Schema.between(-100, 500)),
    windPattern: Schema.Literal('calm', 'gentle', 'moderate', 'strong'),
    seasonalVariation: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  lastUpdated: Schema.DateTimeUtc,
})

export type BiomeDistribution = typeof BiomeDistributionSchema.Type

export const BiomeDistributionPayloadSchema = Schema.Struct({
  coordinate: Coordinates.ChunkCoordinateSchema,
  distribution: Schema.Unknown,
})
