import { blockTypeToIndex, type BlockTypeIndex } from '@ts-minecraft/core'

import { plantGrowthBlockAtWorld } from './plant-growth-chunk-access'
import { type PlantGrowthBlockType, type PlantGrowthChunk } from './plant-growth-model'

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')
const WATER_BLOCK_IDX = blockTypeToIndex('WATER')
const DIRT_BLOCK_IDX = blockTypeToIndex('DIRT')
const GRASS_BLOCK_IDX = blockTypeToIndex('GRASS')
const SAND_BLOCK_IDX = blockTypeToIndex('SAND')
const SUGAR_CANE_BLOCK_IDX = blockTypeToIndex('SUGAR_CANE')
const CACTUS_BLOCK_IDX = blockTypeToIndex('CACTUS')

const SUGAR_CANE_BASE_SUPPORT_BLOCKS = new Set([DIRT_BLOCK_IDX, GRASS_BLOCK_IDX, SAND_BLOCK_IDX])

export const plantGrowthTypeFromBlockIndex = (blockIndex: number): PlantGrowthBlockType | undefined => {
  if (blockIndex === SUGAR_CANE_BLOCK_IDX) {
    return 'SUGAR_CANE'
  }
  if (blockIndex === CACTUS_BLOCK_IDX) {
    return 'CACTUS'
  }
  return undefined
}

const plantGrowthBlockIndexForType = (blockType: PlantGrowthBlockType): number =>
  blockType === 'SUGAR_CANE' ? SUGAR_CANE_BLOCK_IDX : CACTUS_BLOCK_IDX

const countPlantStackHeightBelowTop = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  y: number,
  worldZ: number,
  blockType: PlantGrowthBlockType,
): number => {
  const plantBlockIndex = plantGrowthBlockIndexForType(blockType)
  let height = 1

  for (let cursorY = y - 1; cursorY >= 0; cursorY -= 1) {
    if (plantGrowthBlockAtWorld(chunksByCoord, worldX, cursorY, worldZ) !== plantBlockIndex) {
      break
    }
    height += 1
  }

  return height
}

const findPlantStackBaseY = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  y: number,
  worldZ: number,
  blockType: PlantGrowthBlockType,
): number => {
  const plantBlockIndex = plantGrowthBlockIndexForType(blockType)
  let baseY = y

  while (baseY > 0 && plantGrowthBlockAtWorld(chunksByCoord, worldX, baseY - 1, worldZ) === plantBlockIndex) {
    baseY -= 1
  }

  return baseY
}

const hasAdjacentWaterAt = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  y: number,
  worldZ: number,
): boolean =>
  plantGrowthBlockAtWorld(chunksByCoord, worldX + 1, y, worldZ) === WATER_BLOCK_IDX ||
  plantGrowthBlockAtWorld(chunksByCoord, worldX - 1, y, worldZ) === WATER_BLOCK_IDX ||
  plantGrowthBlockAtWorld(chunksByCoord, worldX, y, worldZ + 1) === WATER_BLOCK_IDX ||
  plantGrowthBlockAtWorld(chunksByCoord, worldX, y, worldZ - 1) === WATER_BLOCK_IDX

const canSugarCaneGrow = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  y: number,
  worldZ: number,
): boolean => {
  const baseY = findPlantStackBaseY(chunksByCoord, worldX, y, worldZ, 'SUGAR_CANE')
  const supportY = baseY - 1
  const supportBlock = plantGrowthBlockAtWorld(chunksByCoord, worldX, supportY, worldZ)

  return (
    supportBlock !== undefined &&
    SUGAR_CANE_BASE_SUPPORT_BLOCKS.has(supportBlock as BlockTypeIndex) &&
    hasAdjacentWaterAt(chunksByCoord, worldX, supportY, worldZ)
  )
}

const canCactusGrow = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  targetY: number,
  worldZ: number,
): boolean =>
  plantGrowthBlockAtWorld(chunksByCoord, worldX + 1, targetY, worldZ) === AIR_BLOCK_IDX &&
  plantGrowthBlockAtWorld(chunksByCoord, worldX - 1, targetY, worldZ) === AIR_BLOCK_IDX &&
  plantGrowthBlockAtWorld(chunksByCoord, worldX, targetY, worldZ + 1) === AIR_BLOCK_IDX &&
  plantGrowthBlockAtWorld(chunksByCoord, worldX, targetY, worldZ - 1) === AIR_BLOCK_IDX

export const canPlantGrowAt = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  blockType: PlantGrowthBlockType,
  worldX: number,
  y: number,
  worldZ: number,
): boolean => {
  const targetY = y + 1
  if (plantGrowthBlockAtWorld(chunksByCoord, worldX, targetY, worldZ) !== AIR_BLOCK_IDX) {
    return false
  }
  if (countPlantStackHeightBelowTop(chunksByCoord, worldX, y, worldZ, blockType) >= 3) {
    return false
  }

  return blockType === 'SUGAR_CANE'
    ? canSugarCaneGrow(chunksByCoord, worldX, y, worldZ)
    : canCactusGrow(chunksByCoord, worldX, targetY, worldZ)
}
