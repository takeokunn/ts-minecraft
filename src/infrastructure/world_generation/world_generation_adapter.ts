import {
  BiomeMapperService,
  type MinecraftBiomeType,
} from '@/domain/biome/domain_service/biome_classification/biome_mapper'
import { BiomeClassificationLayer } from '@/domain/biome/domain_service/biome_classification/layer'
import {
  makeUnsafeWorldCoordinate2D,
  type WorldCoordinate2D,
} from '@/domain/biome/value_object/coordinates/world_coordinate'
import {
  WorldGenerationAdapterService,
  WorldGeneratorSchema,
} from '@/domain/world_generation/adapter/world_generation_adapter'
import type { GenerateChunkCommand, GenerationContext } from '@/domain/world_generation/aggregate/world_generator'
import { NoiseGenerationLayer } from '@/domain/world_generation/domain_service/noise_generation/layer'
import {
  DEFAULT_SIMPLEX_CONFIG,
  SimplexNoiseService,
} from '@/domain/world_generation/domain_service/noise_generation/simplex_noise_service'
import type * as WorldTypes from '@domain/world/types/core'
import type { ClimateData } from '@domain/world/types/core'
import type * as GenerationErrors from '@domain/world/types/errors'
import { DateTime, Effect, Layer, Match, Order, ReadonlyArray, Schema, pipe } from 'effect'

const CHUNK_SIZE = 16

const createClimateData = (coordinate: WorldCoordinate2D, elevation: number): ClimateData => ({
  temperature: 15 + Math.sin(coordinate.x * 0.001) * 10 - elevation * 0.01,
  humidity: 50 + Math.cos(coordinate.z * 0.001) * 30,
  precipitation: 800 + Math.max(0, 100 - elevation),
  evapotranspiration: 600,
  coordinate,
  elevation,
  temperatureAmplitude: 18,
  precipitationSeasonality: 0.35,
  continentality: 0.5,
  aridity: 0.3,
  thermicity: 150,
  growingDegreeDays: 2000,
  frostFreeDays: 200,
  potentialEvapotranspiration: 700,
  dataQuality: 0.9,
})

const normalizeNoise = (value: number): number => (value + 1) / 2

const convertToHeight = (normalized: number): number => {
  const baseHeight = 48
  const variance = 64
  const height = Math.round(baseHeight + normalized * variance)
  return Math.max(16, Math.min(200, height))
}

const toBiomeId = (biome: MinecraftBiomeType, cache: Map<MinecraftBiomeType, number>): number => {
  return Match.value(cache.get(biome)).pipe(
    Match.when(
      (value): value is number => value !== undefined,
      (value) => value
    ),
    Match.orElse(() => {
      const nextId = cache.size
      cache.set(biome, nextId)
      return nextId
    }),
    Match.exhaustive
  )
}

const generateChunkDataEffect = (
  simplexNoise: SimplexNoiseService,
  biomeMapper: BiomeMapperService,
  context: GenerationContext,
  command: GenerateChunkCommand
): Effect.Effect<WorldTypes.ChunkData, GenerationErrors.GenerationError> =>
  Effect.gen(function* () {
    const baseChunkX = Number(command.coordinate.x)
    const baseChunkZ = Number(command.coordinate.z)
    const numericSeed = typeof context.seed === 'bigint' ? context.seed : BigInt(Math.trunc(Number(context.seed ?? 0)))
    const simplexConfig = {
      ...DEFAULT_SIMPLEX_CONFIG,
      seed: numericSeed,
    }

    const positions = pipe(
      ReadonlyArray.range(0, CHUNK_SIZE - 1),
      ReadonlyArray.flatMap((localZ) =>
        pipe(
          ReadonlyArray.range(0, CHUNK_SIZE - 1),
          ReadonlyArray.map((localX) => ({
            localX,
            localZ,
            index: localZ * CHUNK_SIZE + localX,
            worldX: baseChunkX * CHUNK_SIZE + localX,
            worldZ: baseChunkZ * CHUNK_SIZE + localZ,
          }))
        )
      )
    )

    const biomeCache = new Map<MinecraftBiomeType, number>()

    const columnResults = yield* pipe(
      positions,
      Effect.forEach(
        ({ worldX, worldZ, index }) =>
          Effect.gen(function* () {
            const coordinate2d = makeUnsafeWorldCoordinate2D(worldX, worldZ)
            const noiseSample = yield* simplexNoise.sample2D(coordinate2d, simplexConfig)
            const normalized = normalizeNoise(noiseSample.value)
            const height = convertToHeight(normalized)
            const climate = createClimateData(coordinate2d, height)
            const biomeResult = yield* biomeMapper.mapPrimaryBiome(climate, coordinate2d, context.seed)
            const biomeId = toBiomeId(biomeResult.primaryBiome, biomeCache)

            return {
              index,
              height,
              biomeId,
            }
          }),
        { concurrency: 16 }
      )
    )

    const orderedResults = pipe(
      columnResults,
      ReadonlyArray.sort(Order.mapInput(Order.number, (result) => result.index))
    )

    const heightMap = Array.from(orderedResults, (result) => result.height)
    const biomes = Array.from(orderedResults, (result) => result.biomeId)

    const generatedAt = yield* DateTime.nowAsDate

    const chunkData: WorldTypes.ChunkData = {
      coordinate: command.coordinate,
      heightMap,
      biomes,
      structures: [],
      generatedAt,
    }

    return chunkData
  })

export const WorldGenerationAdapterLive = Layer.effect(
  WorldGenerationAdapterService,
  Effect.gen(function* () {
    const simplexNoise = yield* SimplexNoiseService
    const biomeMapper = yield* BiomeMapperService

    return WorldGenerationAdapterService.of({
      generateChunkData: (context, command) => generateChunkDataEffect(simplexNoise, biomeMapper, context, command),
      encodeWorldGenerator: (generator) => Schema.encode(WorldGeneratorSchema)(generator),
      decodeWorldGenerator: (encoded) => Schema.decode(WorldGeneratorSchema)(encoded),
    })
  })
)

export const WorldGenerationAdapterLayer = Layer.mergeAll(
  NoiseGenerationLayer,
  BiomeClassificationLayer,
  WorldGenerationAdapterLive
)
