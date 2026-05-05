import { Effect, Schema } from 'effect'
import {
  BlockType, blockTypeToIndex,
  ChunkCoordSchema,
  toBlockIndex, BlockIndexError,
} from '@ts-minecraft/kernel'

// Bumped from 2 → 3 for Phase 2.1 multi-noise.
export const WORLD_SCHEMA_VERSION = 3

// Blocks stored as flat Uint8Array: index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE).
// 16*16*256 = 65536 bytes (64KB) per chunk; BlockType stored as its numeric index (0=AIR, etc.).
export const ChunkSchema = Schema.Struct({
  coord: ChunkCoordSchema,
// Schema.declare: opaque brand for Uint8Array (ArrayBufferLike base type, matching idb storage returns)
  blocks: Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array),
  fluid: Schema.optionalWith(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array), { as: 'Option' }),
  skyLight: Schema.optional(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array)),
  blockLight: Schema.optional(Schema.declare((u): u is Uint8Array<ArrayBufferLike> => u instanceof Uint8Array)),
})
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>

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
