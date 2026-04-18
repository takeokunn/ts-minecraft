import { blockTypeToIndex } from '@/domain/chunk'
import { type BiomeType } from '@/application/biome/biome-service'
import { SEA_LEVEL } from '@/application/constants'
import { BEDROCK_LAYER_TOP, DEEPSLATE_CEILING, BEDROCK_PROBABILITY } from './constants'
import { hash3, chunkBlockIndexUnchecked } from './math'
import {
  ALPINE_HEIGHT_OFFSET,
  OUTCROP_HEIGHT_OFFSET,
  RUGGEDNESS_SAVANNA_GRAVEL,
  RUGGEDNESS_MOUNTAINS_GRAVEL,
  RUGGEDNESS_SNOW_ALPINE_STONE,
  RUGGEDNESS_ALPINE_STONE,
  RUGGEDNESS_OUTCROP,
} from './surface-resolver.config'

export const AIR_BLOCK_INDEX = blockTypeToIndex('AIR')
export const WOOD_BLOCK_INDEX = blockTypeToIndex('WOOD')
export const LEAVES_BLOCK_INDEX = blockTypeToIndex('LEAVES')

export type SurfaceProfile = {
  surfaceBlockIndex: number
  subSurfaceBlockIndex: number
  surfaceDepth: number
}

export type TreeArchetype = 'ROUND_OAK' | 'TALL_BIRCH' | 'SPRUCE' | 'TALL_CANOPY'

export const resolveSurfaceProfile = (params: {
  biome: BiomeType
  defaultSurfaceBlockIndex: number
  defaultSubSurfaceBlockIndex: number
  surfaceY: number
  ruggedness: number
  hasLakeBasin: boolean
  isShore: boolean
  sandBlockIndex: number
  gravelBlockIndex: number
  stoneBlockIndex: number
}): SurfaceProfile => {
  if (params.hasLakeBasin) {
    return {
      surfaceBlockIndex: params.sandBlockIndex,
      subSurfaceBlockIndex: params.sandBlockIndex,
      surfaceDepth: 2,
    }
  }

  if (params.isShore) {
    return {
      surfaceBlockIndex: params.sandBlockIndex,
      subSurfaceBlockIndex: params.defaultSubSurfaceBlockIndex,
      surfaceDepth: 2,
    }
  }

  const defaultProfile: SurfaceProfile = {
    surfaceBlockIndex: params.defaultSurfaceBlockIndex,
    subSurfaceBlockIndex: params.defaultSubSurfaceBlockIndex,
    surfaceDepth: 3,
  }

  const alpine       = params.surfaceY >= SEA_LEVEL + ALPINE_HEIGHT_OFFSET
  const ruggedOutcrop = params.surfaceY >= SEA_LEVEL + OUTCROP_HEIGHT_OFFSET && params.ruggedness >= RUGGEDNESS_OUTCROP

  if (params.biome === 'DESERT' || params.biome === 'OCEAN' || params.biome === 'BEACH') {
    return defaultProfile
  }

  if (params.biome === 'SAVANNA') {
    return params.ruggedness >= RUGGEDNESS_SAVANNA_GRAVEL
      ? { surfaceBlockIndex: params.gravelBlockIndex, subSurfaceBlockIndex: params.defaultSubSurfaceBlockIndex, surfaceDepth: 2 }
      : { surfaceBlockIndex: params.defaultSurfaceBlockIndex, subSurfaceBlockIndex: params.defaultSubSurfaceBlockIndex, surfaceDepth: 2 }
  }

  if (params.biome === 'TAIGA') {
    if (alpine || ruggedOutcrop) {
      return { surfaceBlockIndex: params.gravelBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 1 }
    }
    return { surfaceBlockIndex: params.defaultSurfaceBlockIndex, subSurfaceBlockIndex: params.defaultSubSurfaceBlockIndex, surfaceDepth: 4 }
  }

  if (params.biome === 'MOUNTAINS') {
    return params.ruggedness >= RUGGEDNESS_MOUNTAINS_GRAVEL
      ? { surfaceBlockIndex: params.gravelBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 2 }
      : defaultProfile
  }

  if (params.biome === 'SNOW') {
    if (alpine && params.ruggedness >= RUGGEDNESS_SNOW_ALPINE_STONE) {
      return { surfaceBlockIndex: params.stoneBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 1 }
    }
    if (ruggedOutcrop) {
      return { surfaceBlockIndex: params.gravelBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 1 }
    }
    return defaultProfile
  }

  if (alpine && params.ruggedness >= RUGGEDNESS_ALPINE_STONE) {
    return { surfaceBlockIndex: params.stoneBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 1 }
  }
  if (ruggedOutcrop) {
    return { surfaceBlockIndex: params.gravelBlockIndex, subSurfaceBlockIndex: params.stoneBlockIndex, surfaceDepth: 1 }
  }

  return defaultProfile
}

/**
 * Fill a single vertical column of blocks up to surfaceY using biome block types.
 *
 * Block assignment (pure, no Effect overhead):
 *   y == 0: BEDROCK (always)
 *   y == 1..4: probabilistic BEDROCK (decreasing with altitude) else DEEPSLATE.
 *             Deterministic hash of (wx, y, wz) — regenerates identically on reload.
 *   y == surfaceY: biome surface block (GRASS, SAND, STONE, etc.)
 *   surfaceY-3 <= y < surfaceY: biome subsurface block (DIRT, SAND, etc.)
 *   y < surfaceY-3: STONE — replaced by DEEPSLATE below DEEPSLATE_CEILING (16).
 *                   Additionally, per-column GRANITE/DIORITE/ANDESITE noise flags
 *                   may replace STONE (and only STONE, never DEEPSLATE at this
 *                   scope — see module doc).
 *
 * Stone variants (GRANITE/DIORITE/ANDESITE):
 *   Applied only inside the deep-stone region (y < surfaceY-3) AND only to
 *   STONE/DEEPSLATE blocks — never to BEDROCK, AIR, or sub-surface DIRT/SAND.
 *   A pre-sampled per-column flag (granite/diorite/andesite) gates the entire
 *   vertical stripe; first match wins (GRANITE > DIORITE > ANDESITE).
 *   NOTE: current scope replaces STONE layer only; DEEPSLATE-variants are
 *   intentionally out-of-scope (vanilla behaviour).
 */
export const fillColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  wx: number,
  wz: number,
  surfaceY: number,
  props: {
    surfaceBlockIndex: number
    subSurfaceBlockIndex: number
    surfaceDepth: number
    stoneBlockIndex: number
    bedrockBlockIndex: number
    deepslateBlockIndex: number
    graniteBlockIndex: number
    dioriteBlockIndex: number
    andesiteBlockIndex: number
    graniteFlag: boolean
    dioriteFlag: boolean
    andesiteFlag: boolean
  }
): void => {
  const variantStone = props.graniteFlag
    ? props.graniteBlockIndex
    : props.dioriteFlag
      ? props.dioriteBlockIndex
      : props.andesiteFlag
        ? props.andesiteBlockIndex
        : -1
  const subSurfaceFloor = Math.max(1, surfaceY - props.surfaceDepth)
  let idx = chunkBlockIndexUnchecked(lx, 0, lz)
  for (let y = 0; y <= surfaceY; y++, idx++) {
    if (y <= BEDROCK_LAYER_TOP) {
      blocks[idx] = hash3(wx, y, wz) < BEDROCK_PROBABILITY[y]!
        ? props.bedrockBlockIndex
        : props.deepslateBlockIndex
    } else if (y === surfaceY) {
      blocks[idx] = props.surfaceBlockIndex
    } else if (y >= subSurfaceFloor) {
      blocks[idx] = props.subSurfaceBlockIndex
    } else {
      blocks[idx] = y < DEEPSLATE_CEILING
        ? props.deepslateBlockIndex
        : variantStone >= 0
          ? variantStone
          : props.stoneBlockIndex
    }
  }
}
