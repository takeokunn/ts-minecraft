import { Effect, Schema } from 'effect'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { BlockTypeSchema } from '@/domain/block'
import { CHUNK_SIZE } from '@/domain/chunk'

/**
 * Biome types for terrain classification
 */
export const BiomeTypeSchema = Schema.Literal('PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE')
export type BiomeType = Schema.Schema.Type<typeof BiomeTypeSchema>

/**
 * Properties that define how a biome affects terrain generation
 */
export const BiomePropertiesSchema = Schema.Struct({
  /** Block type for surface layer */
  surfaceBlock: BlockTypeSchema,
  /** Block type below surface */
  subSurfaceBlock: BlockTypeSchema,
  /** Density of trees (0-1) */
  treeDensity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  /** Height modifier for terrain */
  heightModifier: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  /** Base height for this biome */
  baseHeight: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  /** Temperature range (0-1) */
  temperature: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  /** Humidity range (0-1) */
  humidity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type BiomeProperties = Schema.Schema.Type<typeof BiomePropertiesSchema>

/**
 * Default biome properties for each biome type
 */
const BIOME_PROPERTIES: Record<BiomeType, BiomeProperties> = {
  PLAINS: {
    surfaceBlock: 'GRASS',
    subSurfaceBlock: 'DIRT',
    treeDensity: 0.01,
    heightModifier: 1.0,
    baseHeight: 64,
    temperature: 0.5,
    humidity: 0.3,
  },
  DESERT: {
    surfaceBlock: 'SAND',
    subSurfaceBlock: 'SAND',
    treeDensity: 0.0,
    heightModifier: 0.5,
    baseHeight: 64,
    temperature: 0.9,
    humidity: 0.1,
  },
  FOREST: {
    surfaceBlock: 'GRASS',
    subSurfaceBlock: 'DIRT',
    treeDensity: 0.3,
    heightModifier: 1.0,
    baseHeight: 64,
    temperature: 0.5,
    humidity: 0.6,
  },
  OCEAN: {
    surfaceBlock: 'SAND',
    subSurfaceBlock: 'SAND',
    treeDensity: 0.0,
    heightModifier: 0.3,
    baseHeight: 40,
    temperature: 0.5,
    humidity: 0.9,
  },
  MOUNTAINS: {
    surfaceBlock: 'STONE',
    subSurfaceBlock: 'STONE',
    treeDensity: 0.02,
    heightModifier: 3.0,
    baseHeight: 80,
    temperature: 0.3,
    humidity: 0.4,
  },
  SNOW: {
    surfaceBlock: 'SNOW',
    subSurfaceBlock: 'DIRT',
    treeDensity: 0.05,
    heightModifier: 1.0,
    baseHeight: 64,
    temperature: 0.1,
    humidity: 0.5,
  },
  SWAMP: {
    surfaceBlock: 'GRASS',
    subSurfaceBlock: 'DIRT',
    treeDensity: 0.2,
    heightModifier: 0.5,
    baseHeight: 58,
    temperature: 0.6,
    humidity: 0.8,
  },
  JUNGLE: {
    surfaceBlock: 'GRASS',
    subSurfaceBlock: 'DIRT',
    treeDensity: 0.5,
    heightModifier: 1.2,
    baseHeight: 64,
    temperature: 0.9,
    humidity: 0.8,
  },
}

/**
 * Determine biome type from temperature and humidity
 *
 * Biome selection matrix:
 * - COLD + DRY = SNOW/TUNDRA
 * - COLD + WET = SNOW (forest variant)
 * - TEMPERATE + DRY = PLAINS
 * - TEMPERATE + WET = FOREST
 * - HOT + DRY = DESERT
 * - HOT + WET = JUNGLE or OCEAN
 */
const classifyBiome = (temperature: number, humidity: number): BiomeType => {
  // Temperature thresholds
  const isCold = temperature < 0.3
  const isHot = temperature > 0.7

  // Humidity thresholds
  const isDry = humidity < 0.3
  const isWet = humidity > 0.6

  // Special case: very low humidity in any temp = desert-like
  if (humidity < 0.15) {
    return isCold ? 'SNOW' : 'DESERT'
  }

  // Special case: very high humidity = water/swamp
  if (humidity > 0.85) {
    return temperature > 0.6 ? 'SWAMP' : 'OCEAN'
  }

  // Cold biomes
  if (isCold) {
    return humidity > 0.4 ? 'MOUNTAINS' : 'SNOW'
  }

  // Hot biomes
  if (isHot) {
    return isWet ? 'JUNGLE' : 'DESERT'
  }

  // Temperate biomes (middle temperatures)
  if (isDry) {
    return 'PLAINS'
  }

  if (isWet) {
    return 'FOREST'
  }

  // Default to plains for edge cases
  return 'PLAINS'
}

/**
 * Scale factor for biome noise (larger = bigger biomes)
 */
const BIOME_SCALE = 0.005

/**
 * BiomeService class for biome classification and properties
 *
 * Uses temperature and humidity noise layers to classify biomes.
 * Biomes affect terrain height, block types, and feature density.
 */
export class BiomeService extends Effect.Service<BiomeService>()(
  '@minecraft/application/BiomeService',
  {
    effect: Effect.map(NoiseServicePort, (noiseService) => {
      const getTemperature = (x: number, z: number): Effect.Effect<number, never> =>
        // Use octave noise for smoother temperature gradients
        noiseService.octaveNoise2D(x * BIOME_SCALE, z * BIOME_SCALE, 4, 0.5, 2.0)

      const getHumidity = (x: number, z: number): Effect.Effect<number, never> =>
        // Offset coordinates to get independent noise
        noiseService.octaveNoise2D(
          (x + 10000) * BIOME_SCALE,
          (z + 10000) * BIOME_SCALE,
          4,
          0.5,
          2.0
        )

      const getBiome = (x: number, z: number): Effect.Effect<BiomeType, never> =>
        Effect.gen(function* () {
          const temp = yield* getTemperature(x, z)
          const hum = yield* getHumidity(x, z)
          return classifyBiome(temp, hum)
        })

      const getBiomeProperties = (biome: BiomeType): Effect.Effect<BiomeProperties, never, never> =>
        Effect.succeed(BIOME_PROPERTIES[biome])

      const getBiomesAndPropertiesForChunk = (
        chunkX: number,
        chunkZ: number,
      ): Effect.Effect<ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>> => {
        // Index layout: outer=lx (Math.floor(i/CHUNK_SIZE)), inner=lz (i%CHUNK_SIZE).
        // Must match generateTerrain's terrainPoints and double-loop order (lx outer, lz inner).
        const columnCount = CHUNK_SIZE * CHUNK_SIZE
        const biomeScaleXs: number[] = []
        biomeScaleXs.length = columnCount
        const biomeScaleZs: number[] = []
        biomeScaleZs.length = columnCount
        const humidityOffsetXs: number[] = []
        humidityOffsetXs.length = columnCount
        const humidityOffsetZs: number[] = []
        humidityOffsetZs.length = columnCount
        for (let i = 0; i < columnCount; i++) {
          const lx = Math.floor(i / CHUNK_SIZE)
          const lz = i % CHUNK_SIZE
          const x = chunkX * CHUNK_SIZE + lx
          const z = chunkZ * CHUNK_SIZE + lz
          biomeScaleXs[i] = x * BIOME_SCALE
          biomeScaleZs[i] = z * BIOME_SCALE
          humidityOffsetXs[i] = (x + 10000) * BIOME_SCALE
          humidityOffsetZs[i] = (z + 10000) * BIOME_SCALE
        }
        return Effect.gen(function* () {
          const tempVals = yield* noiseService.octaveNoise2DBatchXY(biomeScaleXs, biomeScaleZs, 4, 0.5, 2.0)
          const humVals = yield* noiseService.octaveNoise2DBatchXY(humidityOffsetXs, humidityOffsetZs, 4, 0.5, 2.0)
          const results: Array<{ biome: BiomeType; props: BiomeProperties }> = []
          results.length = columnCount
          for (let i = 0; i < columnCount; i++) {
            const biome = classifyBiome(tempVals[i]!, humVals[i]!)
            results[i] = { biome, props: BIOME_PROPERTIES[biome] }
          }
          return results
        })
      }

      return {
        getBiome,
        getBiomeProperties,
        getTemperature,
        getHumidity,
        getBiomesAndPropertiesForChunk,
      }
    }),
  }
) {}
export const BiomeServiceLive = BiomeService.Default
