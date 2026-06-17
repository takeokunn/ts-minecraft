import { Option } from 'effect'
import {
  blockIndex,
  blockTypeToIndex,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
} from '@ts-minecraft/core'
import type { BlockType, ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'

export type ChunkBlockFixture = Readonly<{
  lx: number
  y: number
  lz: number
  blockType: BlockType
}>

export const CHUNK_BLOCK_SAMPLE_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export const makeChunkBlockBuffer = (): Uint8Array<ArrayBufferLike> =>
  new Uint8Array(CHUNK_BLOCK_SAMPLE_COUNT)

export const testBlockIndexAt = (lx: number, y: number, lz: number): number =>
  Option.getOrElse(blockIndex(lx, y, lz), () => -1)

export const makeEmptyTestChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: makeChunkBlockBuffer(),
  fluid: Option.none(),
})

export const makeTestChunkWithBlocks = (
  blockTypes: ReadonlyArray<ChunkBlockFixture>,
  coord: ChunkCoord = { x: 0, z: 0 },
): Chunk => {
  const blocks = makeChunkBlockBuffer()

  for (const { lx, y, lz, blockType } of blockTypes) {
    const idx = testBlockIndexAt(lx, y, lz)
    if (idx >= 0) blocks[idx] = blockTypeToIndex(blockType)
  }

  return { coord, blocks, fluid: Option.none() }
}
