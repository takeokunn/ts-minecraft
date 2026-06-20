import { blockTypeToIndex, type BlockType } from '@ts-minecraft/core'
import { Option } from 'effect'

import type { Chunk } from '@ts-minecraft/world'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'

import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

export const makeGrowthChunk = (coord: Pick<Chunk, 'coord'>['coord'] = { x: 0, z: 0 }, blocks = makeChunkBlockBuffer()): Chunk => ({
  coord,
  blocks,
  fluid: Option.none(),
})

export const setGrowthChunkBlock = (
  chunk: Chunk,
  x: number,
  y: number,
  z: number,
  blockType: BlockType,
): void => {
  chunk.blocks[chunkBlockIndexUnchecked(x, y, z)] = blockTypeToIndex(blockType)
}
