import { Effect } from 'effect'
import { BlockType, ChunkCoord } from '@ts-minecraft/core'
import {
  type Chunk,
  chunkLocalToWorldCoord,
  createEmptyChunk,
  getBlockFromChunk,
  setBlockOnChunk,
  worldPositionToChunkCoord,
} from '../domain/chunk'
import { ChunkError } from '../domain/errors'

export class ChunkService extends Effect.Service<ChunkService>()(
  '@minecraft/application/ChunkService',
  {
    effect: Effect.succeed({
      createChunk: (coord: ChunkCoord): Effect.Effect<Chunk, never> =>
        Effect.succeed(createEmptyChunk(coord)),

      getBlock: (chunk: Chunk, localX: number, y: number, localZ: number): Effect.Effect<BlockType, ChunkError> =>
        getBlockFromChunk(chunk, localX, y, localZ),

      setBlock: (chunk: Chunk, localX: number, y: number, localZ: number, blockType: BlockType): Effect.Effect<Chunk, ChunkError> =>
        setBlockOnChunk(chunk, localX, y, localZ, blockType),

      worldToChunkCoord: (worldX: number, worldZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed(worldPositionToChunkCoord(worldX, worldZ)),

      chunkToWorldCoord: (coord: ChunkCoord, localX: number, localZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed(chunkLocalToWorldCoord(coord, localX, localZ)),
    }),
  }
) {}
