import type { BiomeType } from './biome'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  BIOME_SCALE,
  CLIMATE_VARIANCE_STRETCH,
  HUMIDITY_WORLD_OFFSET,
  RIVER_CENTER,
  RIVER_HALF_WIDTH,
  HUM_DRY, HUM_WET, HUM_VERY_DRY, HUM_VERY_WET,
  HUM_JUNGLE, TEMP_JUNGLE,
  HUM_TAIGA, HUM_MOUNTAINS,
  HUM_SAVANNA_MIN,
  TEMP_COLD, TEMP_HOT,
} from './biome-classifier.config'

export type ClimateSample = {
  readonly temperature: number
  readonly humidity: number
  readonly continentalness: number
  readonly erosion: number
  readonly pv: number
  readonly riverNoise: number
}

export const peaksAndValleysFromWeirdness = (weirdness: number): number =>
  1 - Math.abs(3 * Math.abs(weirdness) - 2)

// temperature: cold < TEMP_COLD < temperate < TEMP_HOT < hot; humidity: dry < HUM_DRY < moderate < HUM_WET < wet < HUM_VERY_WET < very-wet
type ClimatePair = {
  readonly temperature: number
  readonly humidity: number
}

const isColdClimate = (temperature: number): boolean => temperature < TEMP_COLD
const isHotClimate = (temperature: number): boolean => temperature > TEMP_HOT
const isDryClimate = (humidity: number): boolean => humidity < HUM_DRY
const isWetClimate = (humidity: number): boolean => humidity > HUM_WET

type BiomeRule = {
  readonly matches: (climate: ClimatePair) => boolean
  readonly resolve: (climate: ClimatePair) => BiomeType
}

const CLASSIFY_BIOME_RULES: ReadonlyArray<BiomeRule> = [
  {
    matches: ({ humidity }) => humidity < HUM_VERY_DRY,
    resolve: ({ temperature }) => (isColdClimate(temperature) ? 'SNOW' : 'DESERT'),
  },
  {
    matches: ({ temperature, humidity }) => humidity > HUM_JUNGLE && temperature > TEMP_JUNGLE,
    resolve: () => 'JUNGLE',
  },
  {
    matches: ({ humidity }) => humidity > HUM_VERY_WET,
    resolve: ({ temperature, humidity }) => {
      if (isColdClimate(temperature)) return humidity > HUM_TAIGA ? 'TAIGA' : 'MOUNTAINS'
      if (isHotClimate(temperature)) return 'SWAMP'
      return 'FOREST'
    },
  },
  {
    matches: ({ temperature }) => isColdClimate(temperature),
    resolve: ({ humidity }) =>
      humidity > HUM_TAIGA ? 'TAIGA' : humidity > HUM_MOUNTAINS ? 'MOUNTAINS' : 'SNOW',
  },
  {
    matches: ({ temperature }) => isHotClimate(temperature),
    resolve: ({ humidity }) =>
      isWetClimate(humidity) ? 'JUNGLE' : humidity > HUM_SAVANNA_MIN ? 'SAVANNA' : 'DESERT',
  },
  {
    matches: ({ humidity }) => isDryClimate(humidity),
    resolve: () => 'PLAINS',
  },
  {
    matches: ({ humidity }) => isWetClimate(humidity),
    resolve: () => 'FOREST',
  },
]

export const classifyBiome = (temperature: number, humidity: number): BiomeType => {
  const climate = { temperature, humidity }
  for (const rule of CLASSIFY_BIOME_RULES) {
    if (rule.matches(climate)) return rule.resolve(climate)
  }
  return 'PLAINS'
}

// Widens fBm-concentrated climate noise back to the [0,1] spread the
// thresholds assume (see CLIMATE_VARIANCE_STRETCH).
export const stretchClimate = (value: number): number => {
  const stretched = 0.5 + (value - 0.5) * CLIMATE_VARIANCE_STRETCH
  return stretched < 0 ? 0 : stretched > 1 ? 1 : stretched
}

export const classifyBiomeFromClimate = ({
  temperature: rawTemperature,
  humidity: rawHumidity,
  continentalness,
  erosion,
  pv,
  riverNoise,
}: ClimateSample): BiomeType => {
  const temperature = stretchClimate(rawTemperature)
  const humidity = stretchClimate(rawHumidity)
  const riverDistance = Math.abs(riverNoise - RIVER_CENTER)
  if (continentalness > -0.22 && continentalness < 0.42 && riverDistance < RIVER_HALF_WIDTH) {
    return 'RIVER'
  }

  const baseBiome = classifyBiome(temperature, humidity)

  if (continentalness < -0.42) {
    return 'OCEAN'
  }

  // Measured coverage at the old bounds (cont>0.5 && mountaininess>0.42) was
  // 0.9% — vanilla mountain families cover ~8-10% of land. fBm continentalness
  // rarely exceeds 0.5, so both gates are loosened together.
  const mountaininess = Math.max(0, pv) * 0.65 + Math.max(0, 0.45 - erosion) * 0.35
  if (continentalness > 0.32 && mountaininess > 0.32) {
    return temperature < TEMP_COLD ? 'SNOW' : 'MOUNTAINS'
  }

  // Swamps live on low flat wetlands; demote only clearly-inland or
  // clearly-carved terrain (the old 0.15/0.35 bounds demoted essentially
  // every swamp — measured 0.0% world coverage).
  if (baseBiome === 'SWAMP' && (continentalness > 0.35 || erosion < 0.15)) {
    return 'FOREST'
  }

  if (baseBiome === 'MOUNTAINS' && mountaininess < 0.28) {
    return 'TAIGA'
  }

  return baseBiome
}

export const refineBeachBiome = (
  biome: BiomeType,
  neighboringBiomes: ReadonlyArray<BiomeType>,
  continentalness: number,
): BiomeType => {
  if (biome === 'OCEAN' || biome === 'DESERT' || biome === 'SWAMP') return biome
  const adjacentOcean = neighboringBiomes.some((neighborBiome) => neighborBiome === 'OCEAN')
  return adjacentOcean && continentalness < 0.12 ? 'BEACH' : biome
}

export const refineBeachBiomeFromAdjacent = (
  biome: BiomeType,
  xMinusBiome: BiomeType,
  xPlusBiome: BiomeType,
  zMinusBiome: BiomeType,
  zPlusBiome: BiomeType,
  continentalness: number,
): BiomeType => {
  if (biome === 'OCEAN' || biome === 'DESERT' || biome === 'SWAMP') return biome

  const adjacentOcean =
    xMinusBiome === 'OCEAN'
    || xPlusBiome === 'OCEAN'
    || zMinusBiome === 'OCEAN'
    || zPlusBiome === 'OCEAN'

  return adjacentOcean && continentalness < 0.12 ? 'BEACH' : biome
}

// ─── Pure data helpers ────────────────────────────────────────────────────────

export type ChunkNoiseCoord = {
  readonly tempX: number
  readonly tempZ: number
  readonly humX: number
  readonly humZ: number
}

// Index layout: outer=lx (i/CHUNK_SIZE), inner=lz (i%CHUNK_SIZE) — matches generateTerrain iteration order.
export const buildChunkNoiseInputs = (chunkX: number, chunkZ: number): ReadonlyArray<ChunkNoiseCoord> => {
  const coords: Array<ChunkNoiseCoord> = []
  coords.length = CHUNK_SIZE * CHUNK_SIZE

  const baseX = chunkX * CHUNK_SIZE
  const baseZ = chunkZ * CHUNK_SIZE
  let index = 0

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const x = baseX + lx
    const tempX = x * BIOME_SCALE
    const humX = (x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const z = baseZ + lz
      coords[index++] = {
        tempX,
        tempZ: z * BIOME_SCALE,
        humX,
        humZ: (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
      }
    }
  }

  return coords
}

// Translates biome-batch index i (outer=lx, inner=lz) to terrain-channel index (outer=lz, inner=lx),
// matching TerrainChannelSamples z*CHUNK_SIZE+x layout from primitives.ts computeTerrainChannels.
export const batchTerrainIndexFor = (i: number): number => {
  const lx = Math.floor(i / CHUNK_SIZE)
  const lz = i % CHUNK_SIZE
  return lz * CHUNK_SIZE + lx
}
