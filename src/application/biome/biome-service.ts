import { Array as Arr, Effect, Schema } from 'effect'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { BlockTypeSchema } from '@/domain/block'
import { CHUNK_SIZE } from '@/domain/chunk'
import {
  BIOME_PROPERTIES,
  BIOME_SCALE,
  HUMIDITY_WORLD_OFFSET,
  TEMP_COLD, TEMP_HOT,
  HUM_DRY, HUM_WET,
  HUM_VERY_DRY, HUM_VERY_WET,
  HUM_JUNGLE, TEMP_JUNGLE,
  HUM_TAIGA, HUM_MOUNTAINS,
  HUM_SAVANNA_MIN,
  RIVER_CENTER,
  RIVER_HALF_WIDTH,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from './biome-service.config'
/**
 * Biome types for terrain classification
 */
export const BiomeTypeSchema = Schema.Literal('PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE', 'BEACH', 'RIVER', 'TAIGA', 'SAVANNA')
export type BiomeType = Schema.Schema.Type<typeof BiomeTypeSchema>

/**
 * Properties that define how a biome affects terrain generation.
 *
 * Phase 2.1 (multi-noise biomes): `baseHeight` and `heightModifier` have been
 * removed — height is now derived from continentalness / erosion /
 * peaks-and-valleys noise via the density function (task 2.1g). Biomes no
 * longer carry per-biome height parameters.
 */
export const BiomePropertiesSchema = Schema.Struct({
  /** Block type for surface layer */
  surfaceBlock: BlockTypeSchema,
  /** Block type below surface */
  subSurfaceBlock: BlockTypeSchema,
  /** Density of trees (0-1) */
  treeDensity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  /** Temperature range (0-1) */
  temperature: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  /** Humidity range (0-1) */
  humidity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type BiomeProperties = Schema.Schema.Type<typeof BiomePropertiesSchema>

type ClimateSample = {
  readonly temperature: number
  readonly humidity: number
  readonly continentalness: number
  readonly erosion: number
  readonly pv: number
  readonly riverNoise: number
}

const peaksAndValleysFromWeirdness = (weirdness: number): number =>
  1 - Math.abs(3 * Math.abs(weirdness) - 2)

/**
 * Classify a biome from continuous temperature and humidity values.
 *
 * Both axes use thresholds defined in biome-service.config.ts:
 *   temperature: cold < TEMP_COLD < temperate < TEMP_HOT < hot
 *   humidity:    dry < HUM_DRY < moderate < HUM_WET < wet < HUM_VERY_WET < very-wet
 */
export const classifyBiome = (temperature: number, humidity: number): BiomeType => {
  const isCold = temperature < TEMP_COLD
  const isHot  = temperature > TEMP_HOT
  const isDry  = humidity < HUM_DRY
  const isWet  = humidity > HUM_WET

  if (humidity < HUM_VERY_DRY)  return isCold ? 'SNOW' : 'DESERT'
  if (humidity > HUM_VERY_WET)  return temperature > HUM_WET ? 'SWAMP' : 'OCEAN'
  if (humidity > HUM_JUNGLE && temperature > TEMP_JUNGLE) return 'JUNGLE'

  if (isCold) return humidity > HUM_TAIGA ? 'TAIGA' : humidity > HUM_MOUNTAINS ? 'MOUNTAINS' : 'SNOW'
  if (isHot)  return isWet ? 'JUNGLE' : humidity > HUM_SAVANNA_MIN ? 'SAVANNA' : 'DESERT'
  if (isDry)  return 'PLAINS'
  if (isWet)  return 'FOREST'

  return 'PLAINS'
}

const classifyBiomeFromClimate = ({
  temperature,
  humidity,
  continentalness,
  erosion,
  pv,
  riverNoise,
}: ClimateSample): BiomeType => {
  const riverDistance = Math.abs(riverNoise - RIVER_CENTER)
  if (continentalness > -0.22 && continentalness < 0.42 && riverDistance < RIVER_HALF_WIDTH) {
    return 'RIVER'
  }

  const baseBiome = classifyBiome(temperature, humidity)

  if (continentalness < -0.42) {
    return 'OCEAN'
  }

  const mountaininess = Math.max(0, pv) * 0.65 + Math.max(0, 0.45 - erosion) * 0.35
  if (continentalness > 0.5 && mountaininess > 0.42) {
    return temperature < TEMP_COLD ? 'SNOW' : 'MOUNTAINS'
  }

  if (baseBiome === 'OCEAN') {
    return temperature > TEMP_HOT ? 'SWAMP' : 'FOREST'
  }

  if (baseBiome === 'SWAMP' && (continentalness > 0.15 || erosion < 0.35)) {
    return 'FOREST'
  }

  if (baseBiome === 'MOUNTAINS' && (continentalness < 0.32 || mountaininess < 0.28)) {
    return temperature < TEMP_COLD ? 'TAIGA' : 'FOREST'
  }

  return baseBiome
}

const refineBeachBiome = (
  biome: BiomeType,
  neighboringBiomes: ReadonlyArray<BiomeType>,
  continentalness: number,
): BiomeType => {
  if (biome === 'OCEAN' || biome === 'DESERT' || biome === 'SWAMP') return biome

  const adjacentOcean = Arr.some(neighboringBiomes, (neighborBiome) => neighborBiome === 'OCEAN')

  return adjacentOcean && continentalness < 0.12 ? 'BEACH' : biome
}

// ─── Pure data helpers ────────────────────────────────────────────────────────

type ChunkNoiseCoord = {
  readonly tempX: number
  readonly tempZ: number
  readonly humX: number
  readonly humZ: number
}

/**
 * Build noise-input coordinates for every column in a chunk.
 * Index layout matches generateTerrain: outer=lx (i/CHUNK_SIZE), inner=lz (i%CHUNK_SIZE).
 */
export const buildChunkNoiseInputs = (chunkX: number, chunkZ: number): ReadonlyArray<ChunkNoiseCoord> =>
  Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
    const lx = Math.floor(i / CHUNK_SIZE)
    const lz = i % CHUNK_SIZE
    const x = chunkX * CHUNK_SIZE + lx
    const z = chunkZ * CHUNK_SIZE + lz
    return {
      tempX: x * BIOME_SCALE,
      tempZ: z * BIOME_SCALE,
      humX: (x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
      humZ: (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
    }
  })

const batchTerrainIndexFor = (i: number): number => {
  const lx = Math.floor(i / CHUNK_SIZE)
  const lz = i % CHUNK_SIZE
  return lz * CHUNK_SIZE + lx
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BiomeService extends Effect.Service<BiomeService>()(
  '@minecraft/application/BiomeService',
  {
    effect: Effect.map(NoiseServicePort, (noiseService) => {
      const getTemperature = (x: number, z: number): Effect.Effect<number, never> =>
        noiseService.octaveNoise2D(x * BIOME_SCALE, z * BIOME_SCALE, 4, 0.5, 2.0)

      const getHumidity = (x: number, z: number): Effect.Effect<number, never> =>
        noiseService.octaveNoise2D((x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, 4, 0.5, 2.0)

      const getBiome = (x: number, z: number): Effect.Effect<BiomeType, never> =>
        Effect.all([
          getTemperature(x, z),
          getHumidity(x, z),
          noiseService.continentalness(x, z),
          noiseService.erosion(x, z),
          noiseService.weirdness(x, z),
          noiseService.noise2D(x * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET, z * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET),
        ], { concurrency: 'unbounded' }).pipe(
          Effect.map(([temp, hum, continentalness, erosion, weirdness, riverNoise]) =>
            classifyBiomeFromClimate({
              temperature: temp,
              humidity: hum,
              continentalness,
              erosion,
              pv: peaksAndValleysFromWeirdness(weirdness),
              riverNoise,
            })
          )
        )

      const getBiomeProperties = (biome: BiomeType): Effect.Effect<BiomeProperties, never, never> =>
        Effect.succeed(BIOME_PROPERTIES[biome])

      const getBiomesAndPropertiesForChunk = (
        chunkX: number,
        chunkZ: number,
      ): Effect.Effect<ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>> => {
        const coords = buildChunkNoiseInputs(chunkX, chunkZ)
        return Effect.all(
          [
            noiseService.octaveNoise2DBatchXY(
              Arr.map(coords, (c) => c.tempX),
              Arr.map(coords, (c) => c.tempZ),
              4, 0.5, 2.0,
            ),
            noiseService.octaveNoise2DBatchXY(
              Arr.map(coords, (c) => c.humX),
              Arr.map(coords, (c) => c.humZ),
              4, 0.5, 2.0,
            ),
            noiseService.sampleTerrainChannels(chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE),
            noiseService.noise2DBatchXY(
              Arr.map(coords, (c) => c.tempX * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET),
              Arr.map(coords, (c) => c.tempZ * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET),
            ),
          ],
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.flatMap(([tempVals, humVals, terrainChannels, riverNoiseVals]) => {
            const baseBiomes = Arr.makeBy(coords.length, (i) => classifyBiomeFromClimate({
              temperature: tempVals[i]!,
              humidity: humVals[i]!,
              continentalness: terrainChannels.continentalness[batchTerrainIndexFor(i)]!,
              erosion: terrainChannels.erosion[batchTerrainIndexFor(i)]!,
              pv: terrainChannels.pv[batchTerrainIndexFor(i)]!,
              riverNoise: riverNoiseVals[i]!,
            }))
            return Effect.forEach(
              Arr.makeBy(coords.length, (i) => i),
              (i) => {
                const lx = Math.floor(i / CHUNK_SIZE)
                const lz = i % CHUNK_SIZE
                const worldX = chunkX * CHUNK_SIZE + lx
                const worldZ = chunkZ * CHUNK_SIZE + lz
                const biome = baseBiomes[i]!
                return Effect.all([
                  getBiome(worldX - 1, worldZ),
                  getBiome(worldX + 1, worldZ),
                  getBiome(worldX, worldZ - 1),
                  getBiome(worldX, worldZ + 1),
                ], { concurrency: 'unbounded' }).pipe(
                  Effect.map((neighbors) => {
                    const refinedBiome = refineBeachBiome(
                      biome,
                      neighbors,
                      terrainChannels.continentalness[batchTerrainIndexFor(i)]!,
                    )
                    return { biome: refinedBiome, props: BIOME_PROPERTIES[refinedBiome] }
                  }),
                )
              },
              { concurrency: 'unbounded' },
            )
          })
        )
      }

      return { getBiome, getBiomeProperties, getTemperature, getHumidity, getBiomesAndPropertiesForChunk }
    }),
  }
) {}
export const BiomeServiceLive = BiomeService.Default
