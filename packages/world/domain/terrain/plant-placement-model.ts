import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BiomeType } from '../biome'
import { chunkBlockIndexUnchecked } from './math'

export const AIR_BLOCK_INDEX = blockTypeToIndex('AIR')
export const WATER_BLOCK_INDEX = blockTypeToIndex('WATER')
export const DIRT_BLOCK_INDEX = blockTypeToIndex('DIRT')
export const GRASS_BLOCK_INDEX = blockTypeToIndex('GRASS')
export const SAND_BLOCK_INDEX = blockTypeToIndex('SAND')
export const SUGAR_CANE_BLOCK_INDEX = blockTypeToIndex('SUGAR_CANE')
export const CACTUS_BLOCK_INDEX = blockTypeToIndex('CACTUS')
export const DANDELION_BLOCK_INDEX = blockTypeToIndex('DANDELION')
export const POPPY_BLOCK_INDEX = blockTypeToIndex('POPPY')
export const TALL_GRASS_BLOCK_INDEX = blockTypeToIndex('TALL_GRASS')
export const FERN_BLOCK_INDEX = blockTypeToIndex('FERN')
export const LILY_PAD_BLOCK_INDEX = blockTypeToIndex('LILY_PAD')
export const BROWN_MUSHROOM_BLOCK_INDEX = blockTypeToIndex('BROWN_MUSHROOM')
export const RED_MUSHROOM_BLOCK_INDEX = blockTypeToIndex('RED_MUSHROOM')

export const PLANT_RNG_X_SCALE = 12.9898
export const PLANT_RNG_Z_SCALE = 78.233
export const PLANT_RNG_SALT_SCALE = 37.719
export const PLANT_RNG_AMPLITUDE = 43758.5453
export const SUGAR_CANE_HEIGHT_SALT = 11
export const CACTUS_HEIGHT_SALT = 23
export const SUGAR_CANE_PLACEMENT_SALT = 31
export const CACTUS_PLACEMENT_SALT = 47
export const GROUND_PLANT_PLACEMENT_SALT = 59
export const GROUND_PLANT_VARIANT_SALT = 61
export const LILY_PAD_PLACEMENT_SALT = 71
export const MUSHROOM_PLACEMENT_SALT = 83
export const MUSHROOM_VARIANT_SALT = 89
export const MAX_NATURAL_PLANT_HEIGHT = 3
export const MAX_NATURAL_MUSHROOM_SHADE_SCAN = 12

export const SUGAR_CANE_DENSITY_BY_BIOME: Partial<Record<BiomeType, number>> = {
  BEACH: 0.28,
  RIVER: 0.35,
  SWAMP: 0.24,
  JUNGLE: 0.18,
  PLAINS: 0.08,
  DESERT: 0.06,
  SAVANNA: 0.05,
}

export const CACTUS_DENSITY_BY_BIOME: Partial<Record<BiomeType, number>> = {
  DESERT: 0.12,
}

export const GROUND_PLANT_DENSITY_BY_BIOME: Partial<Record<BiomeType, number>> = {
  PLAINS: 0.22,
  FOREST: 0.14,
  SWAMP: 0.1,
  JUNGLE: 0.18,
  TAIGA: 0.12,
  SAVANNA: 0.08,
  BEACH: 0.02,
}

export const LILY_PAD_DENSITY_BY_BIOME: Partial<Record<BiomeType, number>> = {
  SWAMP: 0.2,
  RIVER: 0.08,
  JUNGLE: 0.04,
}

export const MUSHROOM_DENSITY_BY_BIOME: Partial<Record<BiomeType, number>> = {
  FOREST: 0.06,
  SWAMP: 0.08,
  TAIGA: 0.04,
  JUNGLE: 0.03,
}

type HorizontalOffset = Readonly<{
  lx: number
  lz: number
}>

export const HORIZONTAL_OFFSETS: ReadonlyArray<HorizontalOffset> = [
  { lx: -1, lz: 0 },
  { lx: 1, lz: 0 },
  { lx: 0, lz: -1 },
  { lx: 0, lz: 1 },
]

export const isLocalColumnInChunk = (lx: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE

export const columnStateIndex = (lx: number, lz: number): number => lx * CHUNK_SIZE + lz

export const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] ?? AIR_BLOCK_INDEX

export const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, blockIndex: number): void => {
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockIndex
}

export { CHUNK_HEIGHT, CHUNK_SIZE }
