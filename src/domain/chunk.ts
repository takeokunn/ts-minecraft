import { Array as Arr, Effect, Data, Option, Schema } from 'effect'
import { BlockType } from './block'
import { ChunkError } from './errors'

/**
 * Error type for out-of-bounds block index access
 */
export class BlockIndexError extends Data.TaggedError('BlockIndexError')<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {}

/**
 * Chunk dimensions constants
 */
export const CHUNK_SIZE = 16 // x and z dimensions (0-15)
export const CHUNK_HEIGHT = 256 // y dimension (0-255)

/**
 * Chunk coordinate type for identifying chunk position in world
 */
export const ChunkCoordSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
})
export type ChunkCoord = Schema.Schema.Type<typeof ChunkCoordSchema>

/**
 * Chunk type representing a 16x16x256 section of blocks
 *
 * Blocks are stored in a flat Uint8Array for memory efficiency:
 * - Size: 16 * 16 * 256 = 65536 bytes = 64KB per chunk
 * - Index calculation: y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
 * - BlockType values are stored as their index (0=AIR, 1=DIRT, etc.)
 */
export const ChunkSchema = Schema.Struct({
  coord: ChunkCoordSchema,
  // Schema.declare: opaque brand for Uint8Array (ArrayBufferLike base type, compatible with idb storage returns)
  blocks: Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array),
  fluid: Schema.optional(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array)),
})
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>

/**
 * BlockType to number index mapping for storage
 * This allows efficient storage as Uint8Array indices
 */
const BLOCK_TYPE_TO_INDEX: Record<BlockType, number> = {
  AIR: 0,
  DIRT: 1,
  STONE: 2,
  WOOD: 3,
  GRASS: 4,
  SAND: 5,
  WATER: 6,
  LEAVES: 7,
  GLASS: 8,
  SNOW: 9,
  GRAVEL: 10,
  COBBLESTONE: 11,
}

/**
 * Number index to BlockType mapping for retrieval
 */
const INDEX_TO_BLOCK_TYPE: ReadonlyArray<BlockType> = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE']

/**
 * Convert BlockType to storage index
 */
const blockTypeToIndex = (blockType: BlockType): number => BLOCK_TYPE_TO_INDEX[blockType]

/**
 * Convert storage index to BlockType
 */
const indexToBlockType = (index: number): BlockType => Option.getOrElse(Arr.get(INDEX_TO_BLOCK_TYPE, index), () => 'AIR' as const)

/**
 * Calculate array index from 3D local coordinates.
 * Returns Option.none() if coordinates are out of bounds.
 * Index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
 */
export const blockIndex = (x: number, y: number, z: number): Option.Option<number> => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return Option.none()
  }
  return Option.some(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE)
}

/**
 * Effect version of blockIndex for user-facing boundary APIs.
 * Fails with BlockIndexError if coordinates are out of bounds.
 */
export const toBlockIndex = (x: number, y: number, z: number): Effect.Effect<number, BlockIndexError> =>
  Option.match(blockIndex(x, y, z), {
    onNone: () => Effect.fail(new BlockIndexError({ x, y, z })),
    onSome: (idx) => Effect.succeed(idx),
  })

export class ChunkService extends Effect.Service<ChunkService>()(
  '@minecraft/domain/ChunkService',
  {
    effect: Effect.succeed({
      /**
       * Create a new empty chunk at given coordinate
       * All blocks are initialized to AIR (0)
       */
      createChunk: (coord: ChunkCoord): Effect.Effect<Chunk, never> =>
        Effect.succeed({
          coord,
          blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
          fluid: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
        }),

      /**
       * Get the block type at specified local coordinates within a chunk
       * Returns the BlockType at the position
       */
      getBlock: (chunk: Chunk, localX: number, y: number, localZ: number): Effect.Effect<BlockType, ChunkError> =>
        Option.match(blockIndex(localX, y, localZ), {
          onNone: () => Effect.fail(new ChunkError({
            chunkCoord: chunk.coord,
            reason: `Invalid local coordinates: (${localX}, ${y}, ${localZ}). Valid range: x,z=[0,${CHUNK_SIZE - 1}], y=[0,${CHUNK_HEIGHT - 1}]`,
          })),
          onSome: (idx) => Effect.succeed(indexToBlockType(Option.getOrElse(Option.fromNullable(chunk.blocks[idx]), () => 0))),
        }),

      /**
       * Set the block type at specified local coordinates within a chunk
       * Returns a new chunk with the updated blocks array (immutable update)
       */
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

      /**
       * Convert world coordinates to chunk coordinates
       * Uses floor division to determine which chunk contains the position
       */
      worldToChunkCoord: (worldX: number, worldZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed({
          x: Math.floor(worldX / CHUNK_SIZE),
          z: Math.floor(worldZ / CHUNK_SIZE),
        }),

      /**
       * Convert chunk coordinates and local coordinates to world coordinates
       * Returns the absolute world position
       */
      chunkToWorldCoord: (coord: ChunkCoord, localX: number, localZ: number): Effect.Effect<ChunkCoord, never, never> =>
        Effect.succeed({
          x: coord.x * CHUNK_SIZE + localX,
          z: coord.z * CHUNK_SIZE + localZ,
        }),
    }),
  }
) {}

export { blockTypeToIndex, indexToBlockType }
export const ChunkServiceLive = ChunkService.Default

/**
 * Get a readonly view of the chunk's block data for batch reads.
 * Returns the backing Uint8Array as Readonly — zero allocation, no copy.
 * Use this as a snapshot for performance-critical hot loops (e.g., greedy meshing).
 */
export const getBlocksBatch = (chunk: Chunk): Effect.Effect<Readonly<Uint8Array>, never> =>
  Effect.succeed(chunk.blocks as Readonly<Uint8Array>)

/**
 * Set a block type at local coordinates via in-place mutation (O(1)).
 * Intended for write paths in block-service; NOT a general-purpose API
 * (use ChunkService.setBlock for immutable update patterns).
 * Callers (block-service.ts) must call chunkManagerService.markChunkDirty()
 * to register the coord in the persistence dirty-set (cache.dirtyChunks).
 */
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
