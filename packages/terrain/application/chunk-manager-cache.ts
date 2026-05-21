import { HashSet, HashMap, Schema } from 'effect'
import { ChunkSchema } from '../domain/chunk'
import type { ChunkAABB } from '../domain/chunk-aabb'
import { FLUID_BYTE_LENGTH, createFluidBuffer } from '@ts-minecraft/world-state'
import type { ChunkCacheKey, WorldId } from '@ts-minecraft/kernel'

const isStoredRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const storedBlocksBuffer = (value: unknown): Uint8Array<ArrayBufferLike> => {
  if (value instanceof Uint8Array) {
    return value
  }

  if (isStoredRecord(value) && value['blocks'] instanceof Uint8Array) {
    return value['blocks']
  }

  return new Uint8Array(0)
}
export const storedFluidBuffer = (value: unknown): Uint8Array<ArrayBufferLike> =>
  value instanceof Uint8Array && value.byteLength === FLUID_BYTE_LENGTH ? value : createFluidBuffer()

export const storedChunkPayload = (stored: unknown): { blocks: Uint8Array<ArrayBufferLike>; fluid: Uint8Array<ArrayBufferLike> } => {
  return {
    blocks: storedBlocksBuffer(stored),
    fluid: storedFluidBuffer(isStoredRecord(stored) ? stored['fluid'] : undefined),
  }
}

// lastAccessed is intentionally mutable for O(1) in-place LRU updates.
export const ChunkCacheEntrySchema = Schema.mutable(
  Schema.Struct({
    chunk: ChunkSchema,
    lastAccessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    worldId: Schema.optional(Schema.String),
  }),
)
export type ChunkCacheEntry = {
  chunk: Schema.Schema.Type<typeof ChunkSchema>
  lastAccessed: number
  worldId?: WorldId
}

// FR-006 DEFERRED: Effect.Cache lacks required eviction hooks, distance eviction, and per-chunk atomicity.
// FR-4.2: `renderDirtyAABBs` mirrors `renderDirtyChunks`, holding the running
// union of dirty voxels per chunk. Absence in this map = "full chunk dirty".
export type ChunkCache = {
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>
  dirtyChunks: HashSet.HashSet<ChunkCacheKey>
  renderDirtyChunks: HashSet.HashSet<ChunkCacheKey>
  renderDirtyAABBs: HashMap.HashMap<ChunkCacheKey, ChunkAABB>
}
