import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import type { BiomeType } from '../../application/biome-service'
import { SEA_LEVEL } from '@ts-minecraft/kernel'
import { fract, chunkBlockIndexUnchecked } from './math'
import { type TreeArchetype, AIR_BLOCK_INDEX, WOOD_BLOCK_INDEX, LEAVES_BLOCK_INDEX } from './surface-resolver'
import {
  type TrunkConfig,
  ROUND_OAK_TRUNK, TALL_BIRCH_TRUNK, SPRUCE_TRUNK, TALL_CANOPY_TRUNK,
  ROUND_OAK_TIP_RNG_SCALE, ROUND_OAK_TIP_THRESHOLD,
  SPRUCE_LOWER_RADIUS_RNG_SCALE, SPRUCE_LOWER_RADIUS_THRESHOLD,
  TALL_CANOPY_TIP_RNG_SCALE, TALL_CANOPY_TIP_THRESHOLD,
  TREE_RNG_X_SCALE, TREE_RNG_Z_SCALE, TREE_RNG_AMPLITUDE,
  ARCHETYPE_ROLL_RNG_SCALE,
  TREE_MIN_SURFACE_Y, TREE_SURFACE_Y_HEADROOM,
} from './tree-placer.config'

export { type TreeArchetype }
export { type TrunkConfig }
export const TREE_CANOPY_MARGIN = 2

const computeTrunkHeight = (config: TrunkConfig, treeRng: number): number =>
  config.baseHeight + Math.floor(fract(treeRng * config.rngScale) * config.heightRange)

const setWoodBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): void => {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = WOOD_BLOCK_INDEX
}

const setLeafBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): void => {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return
  const idx = chunkBlockIndexUnchecked(lx, y, lz)
  if (blocks[idx] === AIR_BLOCK_INDEX) {
    blocks[idx] = LEAVES_BLOCK_INDEX
  }
}

const placeTrunk = (blocks: Uint8Array, lx: number, lz: number, surfaceY: number, trunkHeight: number): void => {
  for (let offset = 1; offset <= trunkHeight; offset++) {
    setWoodBlock(blocks, lx, surfaceY + offset, lz)
  }
}

const placeLeafLayer = (blocks: Uint8Array, lx: number, y: number, lz: number, radius: number): void => {
  if (radius === 0) {
    setLeafBlock(blocks, lx, y, lz)
    return
  }

  const distanceLimit = radius * radius + radius
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz > distanceLimit) continue
      setLeafBlock(blocks, lx + dx, y, lz + dz)
    }
  }
}

const placeRoundOakTree = (blocks: Uint8Array, lx: number, lz: number, surfaceY: number, treeRng: number): void => {
  const trunkHeight = computeTrunkHeight(ROUND_OAK_TRUNK, treeRng)
  placeTrunk(blocks, lx, lz, surfaceY, trunkHeight)

  const canopyBase = surfaceY + trunkHeight - 2
  placeLeafLayer(blocks, lx, canopyBase, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 1, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 2, lz, 1)
  if (fract(treeRng * ROUND_OAK_TIP_RNG_SCALE) > ROUND_OAK_TIP_THRESHOLD) {
    placeLeafLayer(blocks, lx, canopyBase + 3, lz, 0)
  }
}

const placeTallBirchTree = (blocks: Uint8Array, lx: number, lz: number, surfaceY: number, treeRng: number): void => {
  const trunkHeight = computeTrunkHeight(TALL_BIRCH_TRUNK, treeRng)
  placeTrunk(blocks, lx, lz, surfaceY, trunkHeight)

  const canopyBase = surfaceY + trunkHeight - 1
  placeLeafLayer(blocks, lx, canopyBase - 1, lz, 1)
  placeLeafLayer(blocks, lx, canopyBase, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 1, lz, 1)
  placeLeafLayer(blocks, lx, canopyBase + 2, lz, 0)
}

const placeSpruceTree = (blocks: Uint8Array, lx: number, lz: number, surfaceY: number, treeRng: number): void => {
  const trunkHeight = computeTrunkHeight(SPRUCE_TRUNK, treeRng)
  placeTrunk(blocks, lx, lz, surfaceY, trunkHeight)

  const canopyBase = surfaceY + trunkHeight - 5
  const lowerRadius = fract(treeRng * SPRUCE_LOWER_RADIUS_RNG_SCALE) > SPRUCE_LOWER_RADIUS_THRESHOLD ? 2 : 1
  placeLeafLayer(blocks, lx, canopyBase, lz, lowerRadius)
  placeLeafLayer(blocks, lx, canopyBase + 1, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 2, lz, 1)
  placeLeafLayer(blocks, lx, canopyBase + 3, lz, 1)
  placeLeafLayer(blocks, lx, canopyBase + 4, lz, 0)
}

const placeTallCanopyTree = (blocks: Uint8Array, lx: number, lz: number, surfaceY: number, treeRng: number): void => {
  const trunkHeight = computeTrunkHeight(TALL_CANOPY_TRUNK, treeRng)
  placeTrunk(blocks, lx, lz, surfaceY, trunkHeight)

  const canopyBase = surfaceY + trunkHeight - 2
  placeLeafLayer(blocks, lx, canopyBase - 2, lz, 1)
  placeLeafLayer(blocks, lx, canopyBase - 1, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 1, lz, 2)
  placeLeafLayer(blocks, lx, canopyBase + 2, lz, 1)
  if (fract(treeRng * TALL_CANOPY_TIP_RNG_SCALE) > TALL_CANOPY_TIP_THRESHOLD) {
    placeLeafLayer(blocks, lx, canopyBase + 3, lz, 0)
  }
}

export const selectTreeArchetype = (biome: BiomeType, surfaceY: number, treeRng: number): TreeArchetype => {
  const roll = fract(treeRng * ARCHETYPE_ROLL_RNG_SCALE)
  const highland = surfaceY >= SEA_LEVEL + 18

  switch (biome) {
    case 'JUNGLE':
      return 'TALL_CANOPY'
    case 'TAIGA':
    case 'SNOW':
    case 'MOUNTAINS':
      return 'SPRUCE'
    case 'SAVANNA':
      return roll < 0.7 ? 'TALL_BIRCH' : 'ROUND_OAK'
    case 'BEACH':
      return roll < 0.1 ? 'ROUND_OAK' : 'TALL_BIRCH'
    case 'FOREST':
      if (highland && roll > 0.72) return 'SPRUCE'
      return roll < 0.42 ? 'TALL_BIRCH' : 'ROUND_OAK'
    case 'PLAINS':
      return roll < 0.28 ? 'TALL_BIRCH' : 'ROUND_OAK'
    case 'SWAMP':
      return roll < 0.18 ? 'TALL_BIRCH' : 'ROUND_OAK'
    default:
      return 'ROUND_OAK'
  }
}

// Deterministic sine-hash RNG — tree placement reproducible across chunk reloads.
// Returns treeRng so the caller can reuse it for trunk-height without recomputing.
export const shouldPlaceTree = (
  treeDensity: number,
  surfaceY: number,
  wx: number,
  wz: number
): { place: boolean; treeRng: number } => {
  if (
    treeDensity <= 0
    || surfaceY <= TREE_MIN_SURFACE_Y
    || surfaceY >= CHUNK_HEIGHT - TREE_SURFACE_Y_HEADROOM
  ) {
    return { place: false, treeRng: 0 }
  }
  const treeRng = Math.sin(wx * TREE_RNG_X_SCALE + wz * TREE_RNG_Z_SCALE) * TREE_RNG_AMPLITUDE
  const treeProb = fract(treeRng)
  return { place: treeProb < treeDensity, treeRng }
}

// Writes are cropped to chunk boundaries.
// Seamless cross-chunk canopies: neighboring chunks re-evaluate nearby tree origins.
// Leaves only placed into AIR to avoid overwriting solid terrain.
export const placeTree = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  surfaceY: number,
  biome: BiomeType,
  treeRng: number
): void => {
  switch (selectTreeArchetype(biome, surfaceY, treeRng)) {
    case 'TALL_CANOPY':
      placeTallCanopyTree(blocks, lx, lz, surfaceY, treeRng)
      return
    case 'SPRUCE':
      placeSpruceTree(blocks, lx, lz, surfaceY, treeRng)
      return
    case 'TALL_BIRCH':
      placeTallBirchTree(blocks, lx, lz, surfaceY, treeRng)
      return
    default:
      placeRoundOakTree(blocks, lx, lz, surfaceY, treeRng)
  }
}
