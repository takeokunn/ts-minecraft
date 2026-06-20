import {
  AIR_BLOCK_INDEX,
  CACTUS_BLOCK_INDEX,
  CACTUS_HEIGHT_SALT,
  CHUNK_HEIGHT,
  LILY_PAD_BLOCK_INDEX,
  SUGAR_CANE_BLOCK_INDEX,
  SUGAR_CANE_HEIGHT_SALT,
  blockAt,
  setBlock,
} from './plant-placement-model'
import { canPlaceCactusSegmentAt, naturalHeight } from './plant-placement-rules'

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
