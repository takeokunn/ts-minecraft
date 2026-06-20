import { Effect } from 'effect'

import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'

import {
  plantGrowthBlockAt,
  plantGrowthChunkKey,
  requireCompletePlantGrowthChunk,
  toPlantGrowthWorldBlock,
} from './plant-growth-chunk-access'
import {
  PLANT_GROWTH_MAX_PER_TICK,
  type PlantGrowthChunk,
  type PlantGrowthTarget,
  type PlantGrowthChunkError,
} from './plant-growth-model'
import { canPlantGrowAt, plantGrowthTypeFromBlockIndex } from './plant-growth-rules'

export { PLANT_GROWTH_MAX_PER_TICK, PlantGrowthChunkError } from './plant-growth-model'
export type { PlantGrowthTarget } from './plant-growth-model'

export const collectPlantGrowthTargets = (
  chunks: ReadonlyArray<PlantGrowthChunk>,
): Effect.Effect<ReadonlyArray<PlantGrowthTarget>, PlantGrowthChunkError> =>
  Effect.gen(function* () {
    const chunksByCoord = new Map<string, PlantGrowthChunk>()
    for (const chunk of chunks) {
      yield* requireCompletePlantGrowthChunk(chunk)
      chunksByCoord.set(plantGrowthChunkKey(chunk.coord.x, chunk.coord.z), chunk)
    }

    const targets: PlantGrowthTarget[] = []
    for (const chunk of chunks) {
      for (let y = 1; y < CHUNK_HEIGHT - 1; y += 1) {
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
          for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
            const blockType = plantGrowthTypeFromBlockIndex(plantGrowthBlockAt(chunk, localX, y, localZ))
            if (!blockType) {
              continue
            }

            const worldBlock = toPlantGrowthWorldBlock(chunk, localX, y, localZ)
            if (!canPlantGrowAt(chunksByCoord, blockType, worldBlock.x, y, worldBlock.z)) {
              continue
            }

            targets.push({
              position: { x: worldBlock.x, y: worldBlock.y + 1, z: worldBlock.z },
              blockType,
            })
            if (targets.length >= PLANT_GROWTH_MAX_PER_TICK) {
              return targets
            }
          }
        }
      }
    }

    return targets
  })
