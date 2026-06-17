import { HashMap, HashSet, Option } from 'effect'
import { type Chunk } from '../domain/chunk'
import { type ChunkCacheKey, type WorldId } from '@ts-minecraft/core'
import { removeChunkFromCacheState, type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'

export type ChunkInsertionResult = {
  cache: ChunkCache
  evictedDirtyEntry: Option.Option<ChunkCacheEntry>
}

/**
 * Find the LRU key in a chunks map (O(n) scan, fine at ≤400 items).
 * Uses a monotonically incrementing counter (not wall-clock) to guarantee
 * strict uniqueness per access — HashMap iteration is hash-ordered (not
 * insertion-ordered) so ties in lastAccessed produce non-deterministic eviction.
 */
export const findLRUKey = (
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>
): Option.Option<ChunkCacheKey> => {
  let keyOpt: Option.Option<ChunkCacheKey> = Option.none()
  let time = Infinity

  for (const [key, entry] of chunks) {
    if (entry.lastAccessed < time) {
      keyOpt = Option.some(key)
      time = entry.lastAccessed
    }
  }

  return keyOpt
}

const evictChunk = (
  state: ChunkCache,
  chunks: HashMap.HashMap<ChunkCacheKey, ChunkCacheEntry>,
  evictKey: ChunkCacheKey
): ChunkInsertionResult => {
  const evictEntryOpt = HashMap.get(chunks, evictKey)
  const isDirty = HashSet.has(state.dirtyChunks, evictKey)
  const evictedDirtyEntry = isDirty ? evictEntryOpt : Option.none()

  return {
    cache: removeChunkFromCacheState(state, evictKey, chunks),
    evictedDirtyEntry,
  }
}

/**
 * Insert a chunk into the cache and, if necessary, evict the LRU entry.
 *
 * The returned cache is fully derived from the input state, so callers can
 * keep the Ref.modify boundary small and handle I/O separately.
 */
export const insertChunkWithEviction = (
  state: ChunkCache,
  key: ChunkCacheKey,
  chunk: Chunk,
  worldId: WorldId,
  accessOrder: number,
  maxCachedChunks: number
): ChunkInsertionResult => {
  const baseChunks = HashMap.set(state.chunks, key, { chunk, lastAccessed: accessOrder, worldId })

  if (HashMap.size(baseChunks) <= maxCachedChunks) {
    return {
      cache: { ...state, chunks: baseChunks },
      evictedDirtyEntry: Option.none(),
    }
  }

  const evictKey = Option.getOrNull(findLRUKey(baseChunks))
  if (evictKey === null) {
    return {
      cache: { ...state, chunks: baseChunks },
      evictedDirtyEntry: Option.none(),
    }
  }

  return evictChunk(state, baseChunks, evictKey)
}
