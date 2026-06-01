import { Effect, Option } from 'effect'
import { BlockType, blockTypeToIndex, indexToBlockType,
ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT,
blockIndex, } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { ChunkError } from '../domain/errors'

export class ChunkService extends Effect.Service<ChunkService>()(
  '@minecraft/application/ChunkService',
  {
    effect: Effect.succeed({
      createChunk: (coord: ChunkCoord): Effect.Effect<Chunk, never> =>
        Effect.succeed({
          coord,
          blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
          fluid: Option.some(new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)),
        }),

      getBlock: (chunk: Chunk, localX: number, y: number, localZ: number): Effect.Effect<BlockType, ChunkError> =>
        Option.match(blockIndex(localX, y, localZ), {
          onNone: () => Effect.fail(new ChunkError({
            chunkCoord: chunk.coord,
            reason: `Invalid local coordinates: (${localX}, ${y}, ${localZ}). Valid range: x,z=[0,${CHUNK_SIZE - 1}], y=[0,${CHUNK_HEIGHT - 1}]`,
          })),
          onSome: (idx) => Effect.succeed(indexToBlockType(chunk.blocks[idx]!)),
        }),

      // Returns a new Chunk with the block replaced; does not mutate the original.
      setBlock: (chunk: Chunk, localX: number, y: number, localZ: number, blockType: BlockType): Effect.Effect<Chunk, ChunkError> =>
        Option.match(blockIndex(localX, y, localZ), {
          onNone: () => Effect.fail(new ChunkError({
            chunkCoord: chunk.coord,
            reason: `Invalid local coordinates: (${localX}, ${y}, ${localZ}). Valid range: x,z=[0,${CHUNK_SIZE - 1}], y=[0,${CHUNK_HEIGHT - 1}]`,
          })),
          onSome: (idx) => {
            const newBlocks = new Uint8Array(chunk.blocks)
            newBlocks[idx] = blockTypeToIndex(blockType)
            return Effect.succeed({ ...chunk, blocks: newBlocks })
          },
        }),

      worldToChunkCoord: (worldX: number, worldZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed({
          x: Math.floor(worldX / CHUNK_SIZE),
          z: Math.floor(worldZ / CHUNK_SIZE),
        }),

      chunkToWorldCoord: (coord: ChunkCoord, localX: number, localZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed({
          x: coord.x * CHUNK_SIZE + localX,
          z: coord.z * CHUNK_SIZE + localZ,
        }),
    }),
  }
) {}

export const ChunkServiceLive = ChunkService.Default
