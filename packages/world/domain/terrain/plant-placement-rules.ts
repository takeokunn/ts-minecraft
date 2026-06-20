import type { BiomeType } from '../biome'
import { fract } from './math'
import {
  AIR_BLOCK_INDEX,
  BROWN_MUSHROOM_BLOCK_INDEX,
  CACTUS_PLACEMENT_SALT,
  CACTUS_DENSITY_BY_BIOME,
  CHUNK_HEIGHT,
  DIRT_BLOCK_INDEX,
  DANDELION_BLOCK_INDEX,
  FERN_BLOCK_INDEX,
  GRASS_BLOCK_INDEX,
  GROUND_PLANT_DENSITY_BY_BIOME,
  GROUND_PLANT_PLACEMENT_SALT,
  GROUND_PLANT_VARIANT_SALT,
  HORIZONTAL_OFFSETS,
  LILY_PAD_DENSITY_BY_BIOME,
  LILY_PAD_PLACEMENT_SALT,
  MAX_NATURAL_MUSHROOM_SHADE_SCAN,
  MAX_NATURAL_PLANT_HEIGHT,
  MUSHROOM_DENSITY_BY_BIOME,
  MUSHROOM_PLACEMENT_SALT,
  MUSHROOM_VARIANT_SALT,
  PLANT_RNG_AMPLITUDE,
  PLANT_RNG_SALT_SCALE,
  PLANT_RNG_X_SCALE,
  PLANT_RNG_Z_SCALE,
  POPPY_BLOCK_INDEX,
  RED_MUSHROOM_BLOCK_INDEX,
  SAND_BLOCK_INDEX,
  SUGAR_CANE_DENSITY_BY_BIOME,
  SUGAR_CANE_PLACEMENT_SALT,
  TALL_GRASS_BLOCK_INDEX,
  WATER_BLOCK_INDEX,
  blockAt,
  isLocalColumnInChunk,
} from './plant-placement-model'

const shouldPlaceByDensity = (
  densityByBiome: Partial<Record<BiomeType, number>>,
  placementSalt: number,
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => {
  const density = densityByBiome[biome] ?? 0
  if (density <= 0 || surfaceY <= 0 || surfaceY >= CHUNK_HEIGHT - 1) return false
  return plantRng(wx, wz, placementSalt) < density
}

export const plantRng = (wx: number, wz: number, salt: number): number =>
  fract(Math.sin(wx * PLANT_RNG_X_SCALE + wz * PLANT_RNG_Z_SCALE + salt * PLANT_RNG_SALT_SCALE) * PLANT_RNG_AMPLITUDE)

export const naturalHeight = (wx: number, wz: number, salt: number): number =>
  1 + Math.floor(plantRng(wx, wz, salt) * MAX_NATURAL_PLANT_HEIGHT)

export const shouldPlaceSugarCane = (
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => shouldPlaceByDensity(SUGAR_CANE_DENSITY_BY_BIOME, SUGAR_CANE_PLACEMENT_SALT, biome, surfaceY, wx, wz)

export const shouldPlaceCactus = (
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => shouldPlaceByDensity(CACTUS_DENSITY_BY_BIOME, CACTUS_PLACEMENT_SALT, biome, surfaceY, wx, wz)

export const shouldPlaceGroundPlant = (
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => shouldPlaceByDensity(GROUND_PLANT_DENSITY_BY_BIOME, GROUND_PLANT_PLACEMENT_SALT, biome, surfaceY, wx, wz)

export const shouldPlaceLilyPad = (
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => shouldPlaceByDensity(LILY_PAD_DENSITY_BY_BIOME, LILY_PAD_PLACEMENT_SALT, biome, surfaceY, wx, wz)

export const shouldPlaceMushroom = (
  biome: BiomeType,
  surfaceY: number,
  wx: number,
  wz: number,
): boolean => shouldPlaceByDensity(MUSHROOM_DENSITY_BY_BIOME, MUSHROOM_PLACEMENT_SALT, biome, surfaceY, wx, wz)

export const selectGroundPlantBlockIndex = (biome: BiomeType, wx: number, wz: number): number => {
  const variant = plantRng(wx, wz, GROUND_PLANT_VARIANT_SALT)
  if (biome === 'TAIGA') return variant < 0.65 ? FERN_BLOCK_INDEX : TALL_GRASS_BLOCK_INDEX
  if (biome === 'JUNGLE') return variant < 0.55 ? FERN_BLOCK_INDEX : TALL_GRASS_BLOCK_INDEX
  if (biome === 'FOREST') {
    if (variant < 0.12) return DANDELION_BLOCK_INDEX
    if (variant < 0.2) return POPPY_BLOCK_INDEX
    return variant < 0.55 ? FERN_BLOCK_INDEX : TALL_GRASS_BLOCK_INDEX
  }
  if (biome === 'PLAINS' || biome === 'SAVANNA') {
    if (variant < 0.12) return DANDELION_BLOCK_INDEX
    if (variant < 0.22) return POPPY_BLOCK_INDEX
    return TALL_GRASS_BLOCK_INDEX
  }
  if (biome === 'SWAMP') return variant < 0.4 ? FERN_BLOCK_INDEX : TALL_GRASS_BLOCK_INDEX
  return TALL_GRASS_BLOCK_INDEX
}

export const selectMushroomBlockIndex = (wx: number, wz: number): number =>
  plantRng(wx, wz, MUSHROOM_VARIANT_SALT) < 0.55
    ? BROWN_MUSHROOM_BLOCK_INDEX
    : RED_MUSHROOM_BLOCK_INDEX

const hasAdjacentWaterAtSupportLevel = (
  blocks: Uint8Array,
  lx: number,
  supportY: number,
  lz: number,
): boolean =>
  HORIZONTAL_OFFSETS.some((offset) => {
    const nx = lx + offset.lx
    const nz = lz + offset.lz
    return isLocalColumnInChunk(nx, nz) && blockAt(blocks, nx, supportY, nz) === WATER_BLOCK_INDEX
  })

export const canPlaceSugarCaneAt = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean => {
  const supportBlock = blockAt(blocks, lx, surfaceY, lz)
  return (
    (supportBlock === DIRT_BLOCK_INDEX || supportBlock === GRASS_BLOCK_INDEX || supportBlock === SAND_BLOCK_INDEX)
    && blockAt(blocks, lx, surfaceY + 1, lz) === AIR_BLOCK_INDEX
    && hasAdjacentWaterAtSupportLevel(blocks, lx, surfaceY, lz)
  )
}

const cactusHorizontalSidesAreAir = (
  blocks: Uint8Array,
  lx: number,
  y: number,
  lz: number,
): boolean =>
  HORIZONTAL_OFFSETS.every((offset) => {
    const nx = lx + offset.lx
    const nz = lz + offset.lz
    return isLocalColumnInChunk(nx, nz) && blockAt(blocks, nx, y, nz) === AIR_BLOCK_INDEX
  })

export const canPlaceCactusSegmentAt = (
  blocks: Uint8Array,
  lx: number,
  y: number,
  lz: number,
): boolean =>
  blockAt(blocks, lx, y, lz) === AIR_BLOCK_INDEX
  && cactusHorizontalSidesAreAir(blocks, lx, y, lz)

export const canPlaceCactusAt = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean =>
  blockAt(blocks, lx, surfaceY, lz) === SAND_BLOCK_INDEX
  && canPlaceCactusSegmentAt(blocks, lx, surfaceY + 1, lz)

export const canPlaceGroundPlantAt = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean => {
  const supportBlock = blockAt(blocks, lx, surfaceY, lz)
  return (
    (supportBlock === DIRT_BLOCK_INDEX || supportBlock === GRASS_BLOCK_INDEX)
    && blockAt(blocks, lx, surfaceY + 1, lz) === AIR_BLOCK_INDEX
  )
}

const hasNaturalMushroomShade = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean => {
  const targetY = surfaceY + 1
  const maxY = Math.min(CHUNK_HEIGHT - 1, targetY + MAX_NATURAL_MUSHROOM_SHADE_SCAN)
  for (let y = targetY + 1; y <= maxY; y++) {
    if (blockAt(blocks, lx, y, lz) !== AIR_BLOCK_INDEX) return true
  }
  return false
}

export const canPlaceMushroomAt = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean => {
  const supportBlock = blockAt(blocks, lx, surfaceY, lz)
  return (
    (supportBlock === DIRT_BLOCK_INDEX || supportBlock === GRASS_BLOCK_INDEX)
    && blockAt(blocks, lx, surfaceY + 1, lz) === AIR_BLOCK_INDEX
    && hasNaturalMushroomShade(blocks, lx, surfaceY, lz)
  )
}

export const canPlaceLilyPadAt = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): boolean =>
  blockAt(blocks, lx, surfaceY, lz) === WATER_BLOCK_INDEX
  && blockAt(blocks, lx, surfaceY + 1, lz) === AIR_BLOCK_INDEX
