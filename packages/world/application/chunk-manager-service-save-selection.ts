import { HashMap, Option } from 'effect'
import type { ChunkCache, ChunkCacheEntry, ChunkCacheKey } from './chunk-manager-cache'

export const collectDirtyChunksToSave = (
  state: ChunkCache,
  keysToSave: Iterable<ChunkCacheKey>,
): ReadonlyArray<ChunkCacheEntry> => {
  const chunksToSave: Array<ChunkCacheEntry> = []
  for (const key of keysToSave) {
    const entry = Option.getOrNull(HashMap.get(state.chunks, key))
    if (entry !== null) chunksToSave.push(entry)
  }
  return chunksToSave
}
