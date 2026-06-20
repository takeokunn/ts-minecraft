import { Data, Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type BlockType, type Position } from '@ts-minecraft/core'

import type { Chunk } from './chunk'
import { chunkBlockIndexUnchecked } from './terrain/math'

export const FALLING_BLOCK_MAX_PER_TICK = 32

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')
const SAND_BLOCK_IDX = blockTypeToIndex('SAND')
const GRAVEL_BLOCK_IDX = blockTypeToIndex('GRAVEL')
const EXPECTED_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

type FallingBlockChunk = Pick<Chunk, 'coord' | 'blocks'>

export type FallingBlockType = Extract<BlockType, 'SAND' | 'GRAVEL'>

export type FallingBlockMove = {
  readonly from: Position
  readonly to: Position
  readonly blockType: FallingBlockType
}

export class FallingBlockChunkError extends Data.TaggedError('FallingBlockChunkError')<{
  readonly chunkCoord: FallingBlockChunk['coord']
  readonly expectedBlockCount: number
  readonly actualBlockCount: number
}> {
  override get message(): string {
    return `Falling blocks require complete chunk block buffers at (${this.chunkCoord.x}, ${this.chunkCoord.z}): expected ${this.expectedBlockCount}, got ${this.actualBlockCount}`
  }
}

const requireCompleteFallingBlockChunk = (chunk: FallingBlockChunk): Effect.Effect<void, FallingBlockChunkError> =>
  chunk.blocks.length === EXPECTED_CHUNK_BLOCK_COUNT
    ? Effect.void
    : Effect.fail(new FallingBlockChunkError({
      chunkCoord: chunk.coord,
      expectedBlockCount: EXPECTED_CHUNK_BLOCK_COUNT,
      actualBlockCount: chunk.blocks.length,
    }))

const blockAt = (chunk: FallingBlockChunk, localX: number, y: number, localZ: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)] ?? AIR_BLOCK_IDX

const fallingBlockTypeForIndex = (blockIndex: number): FallingBlockType | undefined => {
  if (blockIndex === SAND_BLOCK_IDX) return 'SAND'
  if (blockIndex === GRAVEL_BLOCK_IDX) return 'GRAVEL'
  return undefined
}

export const collectFallingBlockMoves = (
  chunks: ReadonlyArray<FallingBlockChunk>,
): Effect.Effect<ReadonlyArray<FallingBlockMove>, FallingBlockChunkError> =>
  Effect.gen(function* () {
    const moves: FallingBlockMove[] = []

    for (const chunk of chunks) {
      yield* requireCompleteFallingBlockChunk(chunk)

      const worldBaseX = chunk.coord.x * CHUNK_SIZE
      const worldBaseZ = chunk.coord.z * CHUNK_SIZE

      for (let y = 1; y < CHUNK_HEIGHT; y++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
          for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
            const blockType = fallingBlockTypeForIndex(blockAt(chunk, localX, y, localZ))
            if (!blockType) continue
            if (blockAt(chunk, localX, y - 1, localZ) !== AIR_BLOCK_IDX) continue

            const x = worldBaseX + localX
            const z = worldBaseZ + localZ
            moves.push({
              from: { x, y, z },
              to: { x, y: y - 1, z },
              blockType,
            })
            if (moves.length >= FALLING_BLOCK_MAX_PER_TICK) {
              return moves
            }
          }
        }
      }
    }

    return moves
  })
