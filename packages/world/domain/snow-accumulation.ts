import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import { Effect } from 'effect'
import type { BiomeType } from './biome'
import {
  plantGrowthBlockAt,
  requireCompletePlantGrowthChunk,
  toPlantGrowthWorldBlock,
} from './plant-growth-chunk-access'
import {
  type PlantGrowthChunk,
  type PlantGrowthChunkError,
} from './plant-growth-model'

export const SNOW_ACCUMULATION_MAX_PER_TICK = 32

type SnowBiomeLookup = {
  readonly getBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>
}

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')
const SNOW_BLOCK_IDX = blockTypeToIndex('SNOW')
const WATER_BLOCK_IDX = blockTypeToIndex('WATER')
const LAVA_BLOCK_IDX = blockTypeToIndex('LAVA')

const NON_SNOW_SUPPORT_BLOCK_INDICES = new Set<number>([
  AIR_BLOCK_IDX,
  SNOW_BLOCK_IDX,
  WATER_BLOCK_IDX,
  LAVA_BLOCK_IDX,
])

const canAccumulateSnowOnBlock = (blockIndex: number): boolean =>
  !NON_SNOW_SUPPORT_BLOCK_INDICES.has(blockIndex)

const findSnowAccumulationY = (
  chunk: PlantGrowthChunk,
  localX: number,
  localZ: number,
): number | undefined => {
  for (let y = CHUNK_HEIGHT - 2; y >= 0; y -= 1) {
    const surfaceBlock = plantGrowthBlockAt(chunk, localX, y, localZ)
    if (surfaceBlock === AIR_BLOCK_IDX) {
      continue
    }

    const targetBlock = plantGrowthBlockAt(chunk, localX, y + 1, localZ)
    if (targetBlock !== AIR_BLOCK_IDX || !canAccumulateSnowOnBlock(surfaceBlock)) {
      return undefined
    }

    return y + 1
  }

  return undefined
}

export const collectSnowAccumulationTargets = (
  chunks: ReadonlyArray<PlantGrowthChunk>,
  biomeLookup: SnowBiomeLookup,
): Effect.Effect<ReadonlyArray<Position>, PlantGrowthChunkError> =>
  Effect.gen(function* () {
    const targets: Position[] = []

    for (const chunk of chunks) {
      yield* requireCompletePlantGrowthChunk(chunk)

      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
          const snowY = findSnowAccumulationY(chunk, localX, localZ)
          if (snowY === undefined) {
            continue
          }

          const worldBlock = toPlantGrowthWorldBlock(chunk, localX, snowY, localZ)
          const biome = yield* biomeLookup.getBiome(worldBlock.x, worldBlock.z)
          if (biome !== 'SNOW') {
            continue
          }

          targets.push(worldBlock)
          if (targets.length >= SNOW_ACCUMULATION_MAX_PER_TICK) {
            return targets
          }
        }
      }
    }

    return targets
  })
