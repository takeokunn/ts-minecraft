import {
  AIR_BLOCK_INDEX,
  KELP_BLOCK_INDEX,
  KELP_SURFACE_CLEARANCE,
  SEAGRASS_BLOCK_INDEX,
  WATER_BLOCK_INDEX,
  CACTUS_BLOCK_INDEX,
  CACTUS_HEIGHT_SALT,
  CHUNK_HEIGHT,
  LILY_PAD_BLOCK_INDEX,
  SUGAR_CANE_BLOCK_INDEX,
  SUGAR_CANE_HEIGHT_SALT,
  blockAt,
  setBlock,
} from './plant-placement-model'
import { canPlaceCactusSegmentAt, kelpNaturalHeight, naturalHeight } from './plant-placement-rules'

export const placeSugarCaneStack = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
  wx: number,
  wz: number,
): void => {
  const height = naturalHeight(wx, wz, SUGAR_CANE_HEIGHT_SALT)
  for (let offset = 1; offset <= height && surfaceY + offset < CHUNK_HEIGHT; offset++) {
    if (blockAt(blocks, lx, surfaceY + offset, lz) !== AIR_BLOCK_INDEX) return
    setBlock(blocks, lx, surfaceY + offset, lz, SUGAR_CANE_BLOCK_INDEX)
  }
}

// Kelp replaces WATER cells from the sea floor upward; it stops early if the
// column runs out of water (keeping KELP_SURFACE_CLEARANCE water blocks above
// the stalk so it never pokes through the surface).
export const placeKelpStack = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
  wx: number,
  wz: number,
): void => {
  const height = kelpNaturalHeight(wx, wz)
  for (let offset = 1; offset <= height && surfaceY + offset < CHUNK_HEIGHT; offset++) {
    const y = surfaceY + offset
    if (blockAt(blocks, lx, y, lz) !== WATER_BLOCK_INDEX) return
    // Keep a water cushion above: every cell in the clearance band must be water.
    for (let above = 1; above <= KELP_SURFACE_CLEARANCE; above++) {
      if (blockAt(blocks, lx, y + above, lz) !== WATER_BLOCK_INDEX) return
    }
    setBlock(blocks, lx, y, lz, KELP_BLOCK_INDEX)
  }
}

// Single-block seagrass tuft replacing the water cell on the sea floor.
export const placeSeagrass = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): void => {
  setBlock(blocks, lx, surfaceY + 1, lz, SEAGRASS_BLOCK_INDEX)
}

export const placeCactusStack = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
  wx: number,
  wz: number,
): void => {
  const height = naturalHeight(wx, wz, CACTUS_HEIGHT_SALT)
  for (let offset = 1; offset <= height && surfaceY + offset < CHUNK_HEIGHT; offset++) {
    if (!canPlaceCactusSegmentAt(blocks, lx, surfaceY + offset, lz)) return
    setBlock(blocks, lx, surfaceY + offset, lz, CACTUS_BLOCK_INDEX)
  }
}

export const placeGroundPlant = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
  blockIndex: number,
): void => {
  setBlock(blocks, lx, surfaceY + 1, lz, blockIndex)
}

export const placeLilyPad = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
): void => {
  setBlock(blocks, lx, surfaceY + 1, lz, LILY_PAD_BLOCK_INDEX)
}

export const placeMushroom = (
  blocks: Uint8Array,
  lx: number,
  surfaceY: number,
  lz: number,
  blockIndex: number,
): void => {
  setBlock(blocks, lx, surfaceY + 1, lz, blockIndex)
}
