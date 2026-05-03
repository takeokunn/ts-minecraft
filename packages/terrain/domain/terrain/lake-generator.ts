import { Option } from 'effect'
import { SEA_LEVEL, LAKE_LEVEL } from '@ts-minecraft/kernel'
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

// Returns depressed surface Y if noise threshold + terrain height produce a basin below LAKE_LEVEL; Option.none() otherwise.
export const computeLakeBasin = (
  biome: BiomeType,
  lakeNoiseVal: number,
  initialSurfaceY: number
): Option.Option<number> => {
  if (biome === 'OCEAN' || lakeNoiseVal <= LAKE_THRESHOLD || initialSurfaceY < LAKE_LEVEL) {
    return Option.none()
  }
  const t = (lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD)
  const lakeDepth = Math.max(LAKE_MIN_DEPTH, Math.floor(t * LAKE_MAX_DEPTH))
  const depressedY = Math.max(SEA_LEVEL + 1, initialSurfaceY - lakeDepth)
  /* c8 ignore next */
  return depressedY < LAKE_LEVEL ? Option.some(depressedY) : Option.none()
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
): Option.Option<number> => {
  if (biome === 'RIVER') return Option.some(RIVER_WATER_LEVEL)
  if (surfaceY < SEA_LEVEL) return Option.some(SEA_LEVEL)
  /* c8 ignore next */
  return Option.map(lakeBasinY, () => LAKE_LEVEL)
}

export const fillWaterForColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  biome: BiomeType,
  surfaceY: number,
  lakeBasinY: Option.Option<number>,
  waterBlockIndex: number,
): void => {
  Option.match(determineWaterLevel(biome, surfaceY, lakeBasinY), {
    onNone: () => { /* no water to fill */ },
    onSome: (waterTopY) => {
      for (let y = surfaceY + 1; y <= waterTopY; y++) {
        blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
      }
    },
  })
}
