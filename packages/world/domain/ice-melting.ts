import { LIGHT_BYTE_LENGTH, getLightAt } from '@ts-minecraft/block/domain/light'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type Position } from '@ts-minecraft/core'
import { Data, Effect } from 'effect'

import type { Chunk } from './chunk'
import { chunkBlockIndexUnchecked } from './terrain/math'

export const ICE_MELT_MAX_PER_TICK = 32
export const ICE_MELT_BLOCK_LIGHT_THRESHOLD = 11

const ICE_BLOCK_IDX = blockTypeToIndex('ICE')
const EXPECTED_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export type IceMeltingChunk = Pick<Chunk, 'coord' | 'blocks' | 'blockLight'>

export class IceMeltingChunkError extends Data.TaggedError('IceMeltingChunkError')<{
  readonly chunkCoord: { readonly x: number; readonly z: number }
  readonly buffer: 'blocks' | 'blockLight'
  readonly expectedCount: number
  readonly actualCount: number
}> {
  override get message(): string {
    return `Ice melting requires complete chunk ${this.buffer} buffers at ${this.chunkCoord.x},${this.chunkCoord.z}: expected ${this.expectedCount}, got ${this.actualCount}`
  }
}

const requireCompleteIceMeltingChunk = (chunk: IceMeltingChunk): Effect.Effect<void, IceMeltingChunkError> => {
  if (chunk.blocks.length !== EXPECTED_CHUNK_BLOCK_COUNT) {
    return Effect.fail(new IceMeltingChunkError({
      chunkCoord: chunk.coord,
      buffer: 'blocks',
      expectedCount: EXPECTED_CHUNK_BLOCK_COUNT,
      actualCount: chunk.blocks.length,
    }))
  }

  if (chunk.blockLight !== undefined && chunk.blockLight.length !== LIGHT_BYTE_LENGTH) {
    return Effect.fail(new IceMeltingChunkError({
      chunkCoord: chunk.coord,
      buffer: 'blockLight',
      expectedCount: LIGHT_BYTE_LENGTH,
      actualCount: chunk.blockLight.length,
    }))
  }

  return Effect.void
}

const blockAt = (chunk: IceMeltingChunk, localX: number, y: number, localZ: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)] ?? 0

export const collectIceMeltTargets = (
  chunks: ReadonlyArray<IceMeltingChunk>,
): Effect.Effect<ReadonlyArray<Position>, IceMeltingChunkError> =>
  Effect.gen(function* () {
    const targets: Position[] = []

    for (const chunk of chunks) {
      yield* requireCompleteIceMeltingChunk(chunk)

      if (chunk.blockLight === undefined) {
        continue
      }

      const worldBaseX = chunk.coord.x * CHUNK_SIZE
      const worldBaseZ = chunk.coord.z * CHUNK_SIZE

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
          for (let localX = 0; localX < CHUNK_SIZE; localX++) {
            if (blockAt(chunk, localX, y, localZ) !== ICE_BLOCK_IDX) {
              continue
            }

            if (getLightAt(chunk.blockLight, localX, y, localZ) <= ICE_MELT_BLOCK_LIGHT_THRESHOLD) {
              continue
            }

            targets.push({ x: worldBaseX + localX, y, z: worldBaseZ + localZ })
            if (targets.length >= ICE_MELT_MAX_PER_TICK) {
              return targets
            }
          }
        }
      }
    }

    return targets
  })
