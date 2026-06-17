import { Data, Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type Position } from '@ts-minecraft/core'
import type { Chunk } from './chunk'
import { chunkBlockIndexUnchecked } from './terrain/math'

export const GRASS_SPREAD_MAX_PER_TICK = 32

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')
const DIRT_BLOCK_IDX = blockTypeToIndex('DIRT')
const GRASS_BLOCK_IDX = blockTypeToIndex('GRASS')
const EXPECTED_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

type GrassSpreadChunk = Pick<Chunk, 'coord' | 'blocks'>

export class GrassSpreadChunkError extends Data.TaggedError('GrassSpreadChunkError')<{
  readonly chunkCoord: GrassSpreadChunk['coord']
  readonly expectedBlockCount: number
  readonly actualBlockCount: number
}> {
  override get message(): string {
    return `Grass spread requires complete chunk block buffers at (${this.chunkCoord.x}, ${this.chunkCoord.z}): expected ${this.expectedBlockCount}, got ${this.actualBlockCount}`
  }
}

const requireCompleteBlockBuffer = (chunk: GrassSpreadChunk): Effect.Effect<void, GrassSpreadChunkError> =>
  chunk.blocks.length === EXPECTED_CHUNK_BLOCK_COUNT
    ? Effect.void
    : Effect.fail(new GrassSpreadChunkError({
      chunkCoord: chunk.coord,
      expectedBlockCount: EXPECTED_CHUNK_BLOCK_COUNT,
      actualBlockCount: chunk.blocks.length,
    }))

const blockAt = (chunk: GrassSpreadChunk, localX: number, y: number, localZ: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)]!

const hasHorizontalGrassNeighbor = (chunk: GrassSpreadChunk, localX: number, y: number, localZ: number): boolean => {
  if (localX > 0 && blockAt(chunk, localX - 1, y, localZ) === GRASS_BLOCK_IDX) return true
  if (localX < CHUNK_SIZE - 1 && blockAt(chunk, localX + 1, y, localZ) === GRASS_BLOCK_IDX) return true
  if (localZ > 0 && blockAt(chunk, localX, y, localZ - 1) === GRASS_BLOCK_IDX) return true
  if (localZ < CHUNK_SIZE - 1 && blockAt(chunk, localX, y, localZ + 1) === GRASS_BLOCK_IDX) return true
  return false
}

export const collectGrassSpreadTargets = (
  chunks: ReadonlyArray<GrassSpreadChunk>,
): Effect.Effect<ReadonlyArray<Position>, GrassSpreadChunkError> => Effect.gen(function* () {
  const targets: Position[] = []

  for (const chunk of chunks) {
    yield* requireCompleteBlockBuffer(chunk)

    const worldBaseX = chunk.coord.x * CHUNK_SIZE
    const worldBaseZ = chunk.coord.z * CHUNK_SIZE

    for (let y = 0; y < CHUNK_HEIGHT - 1; y++) {
      for (let localX = 0; localX < CHUNK_SIZE; localX++) {
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
          if (blockAt(chunk, localX, y, localZ) !== DIRT_BLOCK_IDX) continue
          if (blockAt(chunk, localX, y + 1, localZ) !== AIR_BLOCK_IDX) continue
          if (!hasHorizontalGrassNeighbor(chunk, localX, y, localZ)) continue

          targets.push({ x: worldBaseX + localX, y, z: worldBaseZ + localZ })
          if (targets.length >= GRASS_SPREAD_MAX_PER_TICK) return targets
        }
      }
    }
  }

  return targets
})
