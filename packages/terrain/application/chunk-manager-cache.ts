import { HashSet, HashMap, Schema } from 'effect'
import { ChunkSchema } from '../domain/chunk'
import { FLUID_BYTE_LENGTH, createFluidBuffer, hydrateLegacyFluidBufferFromBlocks } from '@ts-minecraft/world-state'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import type { ChunkStorageValue } from '../domain/storage-service-port'
import type { ChunkCacheKey } from '@ts-minecraft/kernel'

export const normalizeFluidBuffer = (value: unknown): Uint8Array<ArrayBufferLike> => {
  /* c8 ignore next */
  if (!(value instanceof Uint8Array)) return createFluidBuffer()
  return value.byteLength === FLUID_BYTE_LENGTH ? value : createFluidBuffer()
}

export const normalizeChunkStorageValue = (stored: ChunkStorageValue): { blocks: Uint8Array<ArrayBufferLike>; fluid: Uint8Array<ArrayBufferLike> } => {
  if (stored instanceof Uint8Array) {
    return { blocks: stored, fluid: hydrateLegacyFluidBufferFromBlocks(stored, blockTypeToIndex('WATER'), blockTypeToIndex('LAVA')) }
  }

  return {
    blocks: stored.blocks,
    fluid: normalizeFluidBuffer(stored.fluid),
  }
}

// lastAccessed is intentionally mutable for O(1) in-place LRU updates.
export const ChunkCacheEntrySchema = Schema.mutable(
  Schema.Struct({
    chunk: ChunkSchema,         // ChunkSchema defined in src/domain/chunk.ts
    lastAccessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),  // mutable for O(1) LRU in-place updates
  }),
)
export type ChunkCacheEntry = Schema.Schema.Type<typeof ChunkCacheEntrySchema>

// FR-006 DEFERRED: Effect.Cache is incompatible (no onEvict, no distance eviction, atomicity broken by key-dedup).
export type ChunkCache = {
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>
  dirtyChunks: HashSet.HashSet<ChunkCacheKey>
}
