import { Effect, Option, Schema } from 'effect'
import {
  BlockType, blockTypeToIndex, indexToBlockType,
  ChunkCoord, ChunkCoordSchema, CHUNK_SIZE, CHUNK_HEIGHT,
  blockIndex, toBlockIndex, BlockIndexError,
} from '@ts-minecraft/kernel'
import { ChunkError } from './errors'

// Bumped from 2 → 3 for Phase 2.1 multi-noise.
export const WORLD_SCHEMA_VERSION = 3

// Blocks stored as flat Uint8Array: index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE).
// 16*16*256 = 65536 bytes (64KB) per chunk; BlockType stored as its numeric index (0=AIR, etc.).
export const ChunkSchema = Schema.Struct({
  coord: ChunkCoordSchema,
  // Schema.declare: opaque brand for Uint8Array (ArrayBufferLike base type, compatible with idb storage returns)
  blocks: Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array),
  fluid: Schema.optionalWith(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array), { as: 'Option' }),
  skyLight: Schema.optional(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array)),
  blockLight: Schema.optional(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array)),
})
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>

export class ChunkService extends Effect.Service<ChunkService>()(
  '@minecraft/domain/ChunkService',
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
          onSome: (idx) => Effect.succeed(indexToBlockType(Option.getOrElse(Option.fromNullable(chunk.blocks[idx]), () => 0))),
        }),

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

// Zero allocation, no copy — returns backing Uint8Array as Readonly. Use for hot loops (e.g., greedy meshing).
export const getBlocksBatch = (chunk: Chunk): Effect.Effect<Readonly<Uint8Array>, never> =>
  Effect.succeed(chunk.blocks as Readonly<Uint8Array>)

// In-place mutation (O(1)). Caller MUST call chunkManagerService.markChunkDirty() to register in the dirty-set.
// Use ChunkService.setBlock for immutable update patterns.
export const setBlockInChunk = (
  chunk: Chunk,
  localX: number,
  y: number,
  localZ: number,
  blockType: BlockType
): Effect.Effect<void, BlockIndexError> =>
  Effect.flatMap(
    toBlockIndex(localX, y, localZ),
    (idx) => Effect.sync(() => {
      chunk.blocks[idx] = blockTypeToIndex(blockType)
    })
  )

export type { ChunkCoord } from '@ts-minecraft/kernel'
export { ChunkCoordSchema, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, toBlockIndex, BlockIndexError } from '@ts-minecraft/kernel'
