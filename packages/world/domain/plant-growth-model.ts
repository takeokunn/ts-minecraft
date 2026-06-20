import { Data } from 'effect'

import { CHUNK_HEIGHT, CHUNK_SIZE, type BlockType, type Position } from '@ts-minecraft/core'

import type { Chunk } from './chunk'

export type PlantGrowthChunk = Pick<Chunk, 'coord' | 'blocks'>

export type PlantGrowthBlockType = Extract<BlockType, 'SUGAR_CANE' | 'CACTUS'>

export interface PlantGrowthTarget {
  readonly position: Position
  readonly blockType: PlantGrowthBlockType
}

export class PlantGrowthChunkError extends Data.TaggedError('PlantGrowthChunkError')<{
  readonly chunk: Pick<Chunk, 'coord'>
  readonly blockCount: number
}> {
  override get message(): string {
    return `Plant growth requires complete chunk block buffers (${this.blockCount} blocks) for chunk ${this.chunk.coord.x},${this.chunk.coord.z}`
  }
}

export const EXPECTED_PLANT_GROWTH_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export const PLANT_GROWTH_MAX_PER_TICK = 32
