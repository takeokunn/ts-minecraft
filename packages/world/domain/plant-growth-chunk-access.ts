import { Effect } from 'effect'

import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'

import { chunkBlockIndexUnchecked } from './terrain/math'
import {
  EXPECTED_PLANT_GROWTH_CHUNK_BLOCK_COUNT,
  PlantGrowthChunkError,
  type PlantGrowthChunk,
} from './plant-growth-model'

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')

export const plantGrowthChunkKey = (chunkX: number, chunkZ: number): string => `${chunkX},${chunkZ}`

export const plantGrowthChunkCoordForBlock = (worldCoord: number): number => Math.floor(worldCoord / CHUNK_SIZE)

export const plantGrowthLocalCoordForBlock = (worldCoord: number, chunkCoord: number): number =>
  worldCoord - chunkCoord * CHUNK_SIZE

export const requireCompletePlantGrowthChunk = (
  chunk: PlantGrowthChunk,
): Effect.Effect<void, PlantGrowthChunkError> =>
  chunk.blocks.length === EXPECTED_PLANT_GROWTH_CHUNK_BLOCK_COUNT
    ? Effect.void
    : Effect.fail(new PlantGrowthChunkError({ chunk, blockCount: chunk.blocks.length }))

export const plantGrowthBlockAt = (chunk: PlantGrowthChunk, localX: number, y: number, localZ: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)] ?? AIR_BLOCK_IDX

export const plantGrowthBlockAtWorld = (
  chunksByCoord: ReadonlyMap<string, PlantGrowthChunk>,
  worldX: number,
  y: number,
  worldZ: number,
): number | undefined => {
  if (y < 0 || y >= CHUNK_HEIGHT) {
    return undefined
  }

  const chunkX = plantGrowthChunkCoordForBlock(worldX)
  const chunkZ = plantGrowthChunkCoordForBlock(worldZ)
  const chunk = chunksByCoord.get(plantGrowthChunkKey(chunkX, chunkZ))
  if (!chunk) {
    return undefined
  }

  return plantGrowthBlockAt(
    chunk,
    plantGrowthLocalCoordForBlock(worldX, chunkX),
    y,
    plantGrowthLocalCoordForBlock(worldZ, chunkZ),
  )
}

export const toPlantGrowthWorldBlock = (chunk: PlantGrowthChunk, localX: number, y: number, localZ: number) => ({
  x: chunk.coord.x * CHUNK_SIZE + localX,
  y,
  z: chunk.coord.z * CHUNK_SIZE + localZ,
})
