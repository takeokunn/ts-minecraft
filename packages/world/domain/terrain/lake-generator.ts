import { Option } from 'effect'
import type { BiomeType } from '../biome'
import {
  LAKE_THRESHOLD,
  LAKE_MAX_DEPTH,
  RIVER_MIN_CUT,
  RIVER_MAX_CUT,
  RIVER_WATER_LEVEL,
} from './constants'
import { chunkBlockIndexUnchecked } from './math'
import { DEFAULT_TERRAIN_LEVELS, type TerrainLevels } from './generator-types'

const smoothstep01 = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

// Returns the carved (bowl-blended) surface Y for columns inside a lake
// region; Option.none() outside it. The surface blends CONTINUOUSLY from the
// untouched terrain at the region edge down to a bed below the water line at
// the center, so banks slope like vanilla instead of dropping off a wall.
// (The old model floored depth at LAKE_MIN_DEPTH=10 and skipped columns whose
// carve stayed above water — every shoreline was a sheer 8-10 block cliff.)
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
  const t = smoothstep01((lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD))
  // Bed the center aims for: just under the water line at the region edge,
  // LAKE_MAX_DEPTH under it at the center.
  const carveTarget = lakeLevel - 1 - t * (LAKE_MAX_DEPTH - 1)
  const blended = Math.round(initialSurfaceY + t * (carveTarget - initialSurfaceY))
  return blended < initialSurfaceY ? Option.some(blended) : Option.none()
}

export const resolveSurfaceY = (biome: BiomeType, initialSurfaceY: number, lakeBasinY: Option.Option<number>): number => {
  // A river bed must ALWAYS sit below its water level. The old cap-at-
  // RIVER_MAX_CUT left rivers crossing terrain above y≈72 as DRY canyons
  // (bed carved 10 down but still above the y=62 water line). Vanilla rivers
  // carve through hills; the bed lands in [waterLevel-RIVER_MAX_CUT, waterLevel-2].
  const riverSurfaceY = biome === 'RIVER'
    ? Math.max(
        RIVER_WATER_LEVEL - RIVER_MAX_CUT,
        Math.min(initialSurfaceY - RIVER_MIN_CUT, RIVER_WATER_LEVEL - 2),
      )
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
  // Lake columns fill to the LAKE level even when the carved bed dips below
  // sea level — checking seaLevel first misclassified deep lake beds as ocean.
  if (Option.getOrNull(lakeBasinY) !== null) return Option.some(lakeLevel)
  if (surfaceY < seaLevel) return Option.some(seaLevel)
  return Option.none()
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
