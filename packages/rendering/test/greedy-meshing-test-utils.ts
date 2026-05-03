import { Array as Arr, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'
import type { BlockType } from '@ts-minecraft/kernel'

// ─── Helpers ───────────────────────────────────────────────────────────────

export const makeEmptyChunk = (coord: ChunkCoord): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord, blocks, fluid: Option.none() }
}

export const makeChunkWithBlock = (
  coord: ChunkCoord,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
  blocks[idx] = blockTypeToIndex(blockType)
  return { coord, blocks, fluid: Option.none() }
}

export const makeChunkWithBlocks = (
  coord: ChunkCoord,
  entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }>
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(entries, ({ lx, y, lz, blockType }) => {
    const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    blocks[idx] = blockTypeToIndex(blockType)
  })
  return { coord, blocks, fluid: Option.none() }
}

export const ZERO_COORD: ChunkCoord = { x: 0, z: 0 }
export const ZERO_OFFSET = { wx: 0, wz: 0 }
