import { Effect, Layer } from 'effect'
import { BlockType } from './block'
import { ChunkError } from './errors'

/**
 * Chunk dimensions constants
 */
export const CHUNK_SIZE = 16 // x and z dimensions (0-15)
export const CHUNK_HEIGHT = 256 // y dimension (0-255)

/**
 * Chunk coordinate type for identifying chunk position in world
 */
export interface ChunkCoord {
  readonly x: number
  readonly z: number
}

/**
 * Chunk type representing a 16x16x256 section of blocks
 *
 * Blocks are stored in a flat Uint8Array for memory efficiency:
 * - Size: 16 * 16 * 256 = 65536 bytes = 64KB per chunk
 * - Index calculation: y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
 * - BlockType values are stored as their index (0=AIR, 1=DIRT, etc.)
 */
export interface Chunk {
  readonly coord: ChunkCoord
  readonly blocks: Uint8Array
  dirty: boolean
}

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
const INDEX_TO_BLOCK_TYPE: BlockType[] = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE']

/**
 * Convert BlockType to storage index
 */
const blockTypeToIndex = (blockType: BlockType): number => BLOCK_TYPE_TO_INDEX[blockType]

/**
 * Convert storage index to BlockType
 */
const indexToBlockType = (index: number): BlockType => INDEX_TO_BLOCK_TYPE[index] ?? 'AIR'

/**
 * Calculate array index from 3D coordinates
 * Index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
 */
const blockIndex = (localX: number, y: number, localZ: number): number =>
  y + localZ * CHUNK_HEIGHT + localX * CHUNK_HEIGHT * CHUNK_SIZE

export class ChunkService extends Effect.Service<ChunkService>()(
  '@minecraft/ChunkService',
  {
    effect: Effect.succeed({
      /**
       * Create a new empty chunk at given coordinate
       * All blocks are initialized to AIR (0)
       */
      createChunk: (coord: ChunkCoord): Effect.Effect<Chunk, never> =>
        Effect.sync(() => {
          const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
          return { coord, blocks, dirty: false }
        }),

      /**
       * Get the block type at specified local coordinates within a chunk
       * Returns the BlockType at the position
       */
      getBlock: (chunk: Chunk, localX: number, y: number, localZ: number): Effect.Effect<BlockType, ChunkError> => {
        if (
          localX < 0 ||
          localX >= CHUNK_SIZE ||
          localZ < 0 ||
          localZ >= CHUNK_SIZE ||
          y < 0 ||
          y >= CHUNK_HEIGHT
        ) {
          return Effect.fail(
            new ChunkError({
              chunkCoord: chunk.coord,
              reason: `Invalid local coordinates: (${localX}, ${y}, ${localZ}). Valid range: x,z=[0,${CHUNK_SIZE - 1}], y=[0,${CHUNK_HEIGHT - 1}]`,
            })
          )
        }
        const idx = blockIndex(localX, y, localZ)
        return Effect.succeed(indexToBlockType(chunk.blocks[idx] ?? 0))
      },

      /**
       * Set the block type at specified local coordinates within a chunk
       * Returns the updated chunk with dirty flag set to true
       */
      setBlock: (chunk: Chunk, localX: number, y: number, localZ: number, blockType: BlockType): Effect.Effect<Chunk, ChunkError> => {
        if (
          localX < 0 ||
          localX >= CHUNK_SIZE ||
          localZ < 0 ||
          localZ >= CHUNK_SIZE ||
          y < 0 ||
          y >= CHUNK_HEIGHT
        ) {
          return Effect.fail(
            new ChunkError({
              chunkCoord: chunk.coord,
              reason: `Invalid local coordinates: (${localX}, ${y}, ${localZ}). Valid range: x,z=[0,${CHUNK_SIZE - 1}], y=[0,${CHUNK_HEIGHT - 1}]`,
            })
          )
        }
        const newBlocks = new Uint8Array(chunk.blocks)
        const idx = blockIndex(localX, y, localZ)
        newBlocks[idx] = blockTypeToIndex(blockType)
        return Effect.succeed({ ...chunk, blocks: newBlocks, dirty: true } as const)
      },

      /**
       * Convert world coordinates to chunk coordinates
       * Uses floor division to determine which chunk contains the position
       */
      worldToChunkCoord: (worldX: number, worldZ: number): ChunkCoord => {
        const x = Math.floor(worldX / CHUNK_SIZE)
        const z = Math.floor(worldZ / CHUNK_SIZE)
        return { x, z }
      },

      /**
       * Convert chunk coordinates and local coordinates to world coordinates
       * Returns the absolute world position
       */
      chunkToWorldCoord: (coord: ChunkCoord, localX: number, localZ: number): { readonly x: number; readonly z: number } => {
        const x = coord.x * CHUNK_SIZE + localX
        const z = coord.z * CHUNK_SIZE + localZ
        return { x, z }
      },
    }),
  }
) {}

export { blockIndex, blockTypeToIndex, indexToBlockType }
export { ChunkService as ChunkServiceLive }
