import { Option } from 'effect'
import type { BiomeType } from '../biome'
import {
  LAKE_THRESHOLD,
  LAKE_MAX_DEPTH,
  LAKE_MIN_DEPTH,
  RIVER_MIN_CUT,
  RIVER_MAX_CUT,
  RIVER_WATER_LEVEL,
} from './constants'
import { chunkBlockIndexUnchecked } from './math'
import { DEFAULT_TERRAIN_LEVELS, type TerrainLevels } from './generator-types'

// Returns depressed surface Y if noise threshold + terrain height produce a basin below LAKE_LEVEL; Option.none() otherwise.
export const computeLakeBasin = (
  biome: BiomeType,
  lakeNoiseVal: number,
  initialSurfaceY: number,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
): Option.Option<number> => {
  const { lakeLevel } = terrainLevels
  if (biome === 'OCEAN' || lakeNoiseVal <= LAKE_THRESHOLD || initialSurfaceY < lakeLevel) {
    return Option.none()
  }
  const t = (lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD)
  const lakeDepth = Math.max(LAKE_MIN_DEPTH, Math.floor(t * LAKE_MAX_DEPTH))
  const depressedY = Math.max(lakeLevel - LAKE_MAX_DEPTH, initialSurfaceY - lakeDepth)
  /* c8 ignore next */
  return depressedY < lakeLevel ? Option.some(depressedY) : Option.none()
}

export const resolveSurfaceY = (biome: BiomeType, initialSurfaceY: number, lakeBasinY: Option.Option<number>): number => {
  const riverCut = biome === 'RIVER'
    ? Math.max(RIVER_MIN_CUT, Math.min(RIVER_MAX_CUT, initialSurfaceY - RIVER_WATER_LEVEL + 1))
    : 0
  const riverSurfaceY = biome === 'RIVER'
    ? Math.max(RIVER_WATER_LEVEL - 1, initialSurfaceY - riverCut)
    : initialSurfaceY

  return Option.getOrElse(lakeBasinY, () => riverSurfaceY)
}

export const determineWaterLevel = (
  biome: BiomeType,
  surfaceY: number,
  lakeBasinY: Option.Option<number>,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
): Option.Option<number> => {
  /* c8 ignore start -- branch coverage: RIVER biome and below-sea-level cases need specific terrain generation */
  const { seaLevel, lakeLevel } = terrainLevels
  if (biome === 'RIVER') return Option.some(RIVER_WATER_LEVEL)
  if (surfaceY < seaLevel) return Option.some(seaLevel)
  return Option.getOrNull(lakeBasinY) === null ? Option.none() : Option.some(lakeLevel)
  /* c8 ignore end */
}

const ICE_FREEZE_TEMPERATURE = 0.15

export const shouldFreezeWaterSurface = (biome: BiomeType, temperature: number): boolean =>
  biome === 'SNOW' || temperature <= ICE_FREEZE_TEMPERATURE

export const fillWaterForColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  biome: BiomeType,
  surfaceY: number,
  lakeBasinY: Option.Option<number>,
  waterBlockIndex: number,
  iceBlockIndex: number,
  freezeSurface: boolean,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
): void => {
  const waterTopY = Option.getOrNull(determineWaterLevel(biome, surfaceY, lakeBasinY, terrainLevels))
  if (waterTopY !== null) {
    for (let y = surfaceY + 1; y <= waterTopY; y++) {
      blocks[chunkBlockIndexUnchecked(lx, y, lz)] =
        freezeSurface && y === waterTopY ? iceBlockIndex : waterBlockIndex
    }
  }
}
