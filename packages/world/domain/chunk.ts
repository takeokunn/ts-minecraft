import { Effect, Schema } from 'effect'
import { BlockType, blockTypeToIndex,
ChunkCoordSchema,
toBlockIndex, BlockIndexError,
CHUNK_SIZE, CHUNK_HEIGHT, } from '@ts-minecraft/core'

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
  // FR-3.3: Highest occupied Y (non-AIR block index) within this chunk. -1 if entirely AIR.
  // Optional: pre-existing in-memory chunks (e.g. created via ChunkService.createChunk) and saved IDB
  // chunks predating FR-3.3 may not have this field; rendering pipeline falls back to CHUNK_HEIGHT.
  maxY: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(-1, CHUNK_HEIGHT - 1))),
})
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>

// FR-3.3: Compute the highest Y where any non-AIR (index !== 0) block exists.
// Returns -1 if the chunk is entirely AIR. Scans top-down so the typical case
// (terrain max-Y around 80–110) early-exits after at most ~145 outer iterations
// (CHUNK_HEIGHT - 110). Inner loop is CHUNK_SIZE*CHUNK_SIZE = 256 cells per Y plane.
//
// Performance: hot at chunk-create time (once per chunk lifetime); negligible.
export const computeMaxY = (blocks: Readonly<Uint8Array>): number => {
  // Use Math.min with byteLength so partially-sized buffers (defensive) don't OOB.
  const yPlanesAvailable = Math.min(CHUNK_HEIGHT, Math.floor(blocks.byteLength / (CHUNK_SIZE * CHUNK_SIZE)))
  for (let y = yPlanesAvailable - 1; y >= 0; y--) {
    // Index layout: idx = y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE.
    // Iterate all (x, z) at this y; a single non-AIR cell finalizes maxY.
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const xBase = x * CHUNK_HEIGHT * CHUNK_SIZE
      for (let z = 0; z < CHUNK_SIZE; z++) {
        if (blocks[xBase + z * CHUNK_HEIGHT + y] !== 0) {
          return y
        }
      }
    }
  }
  return -1
}

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
