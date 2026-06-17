import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  blockIndexUnsafe,
  blockTypeToIndex,
} from '@ts-minecraft/core'
import type { BlockType, ChunkCoord } from '@ts-minecraft/core'
import { Option } from 'effect'

export const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export type ChunkBlockFixture = {
  readonly lx: number
  readonly y: number
  readonly lz: number
  readonly blockType: BlockType
}

export type MinimalBlockChunk = {
  readonly coord: ChunkCoord
  readonly blocks: Uint8Array
  readonly fluid: Option.Option<Uint8Array>
}

export const makeChunkBlocks = (blockType: BlockType = 'AIR'): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  blocks.fill(blockTypeToIndex(blockType))
  return blocks
}

export const setChunkBlock = (
  blocks: Uint8Array,
  { lx, y, lz, blockType }: ChunkBlockFixture,
): void => {
  blocks[blockIndexUnsafe(lx, y, lz)] = blockTypeToIndex(blockType)
}

export const makeChunkBlocksWithFixtures = (
  fixtures: ReadonlyArray<ChunkBlockFixture>,
  defaultBlockType: BlockType = 'AIR',
): Uint8Array => {
  const blocks = makeChunkBlocks(defaultBlockType)
  for (const fixture of fixtures) setChunkBlock(blocks, fixture)
  return blocks
}

export const makeMinimalBlockChunk = (
  coord: ChunkCoord,
  blocks: Uint8Array = makeChunkBlocks(),
): MinimalBlockChunk => ({
  coord,
  blocks,
  fluid: Option.none<Uint8Array>(),
})
